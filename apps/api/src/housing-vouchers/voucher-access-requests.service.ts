import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, VoucherAccessStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { EMAIL_PROVIDER } from '../email/email.constants';
import { EmailProvider } from '../email/interfaces/email-provider.interface';
import { CreateVoucherAccessRequestDto } from './dto/create-voucher-access-request.dto';
import { VoucherAccessRequestResponseDto } from './dto/voucher-access-request-response.dto';
import { VoucherDocumentsService, VoucherFile } from './voucher-documents.service';

const TENANT_ROLES: Role[] = [Role.PROSPECTIVE_TENANT, Role.CURRENT_TENANT];
const STAFF_ROLES: Role[] = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];

// Metadata-only include shared by every list/status/ownership-check query in
// this service — never pulls VoucherDocument.fileData. Only the download
// handlers ever touch fileData, via VoucherDocumentsService.getFileByTenantId.
const REQUEST_INCLUDE = {
  conversation: {
    select: {
      tenantId: true,
      landlordId: true,
      property: { select: { title: true } },
      landlord: { select: { email: true, profile: { select: { displayName: true } } } },
      tenant: { select: { profile: { select: { displayName: true } } } },
    },
  },
} as const;

@Injectable()
export class VoucherAccessRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig>,
    private readonly voucherDocumentsService: VoucherDocumentsService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  private assertTenant(actor: AuthenticatedUser): void {
    if (!TENANT_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only tenants can respond to a Housing Voucher access request');
    }
  }

  private async getConversationOrThrow(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  async createOrRenew(
    actor: AuthenticatedUser,
    conversationId: string,
    dto: CreateVoucherAccessRequestDto,
  ): Promise<VoucherAccessRequestResponseDto> {
    const conversation = await this.getConversationOrThrow(conversationId);
    if (actor.id !== conversation.landlordId) {
      throw new ForbiddenException('Only the landlord on this conversation can request the Housing Voucher');
    }

    const existing = await this.prisma.voucherAccessRequest.findUnique({ where: { conversationId } });

    let request;
    if (!existing) {
      request = await this.prisma.voucherAccessRequest.create({
        data: { conversationId, message: dto.message ?? null },
        include: REQUEST_INCLUDE,
      });
    } else if (existing.status === VoucherAccessStatus.DECLINED || existing.status === VoucherAccessStatus.REVOKED) {
      request = await this.prisma.voucherAccessRequest.update({
        where: { conversationId },
        data: { status: VoucherAccessStatus.PENDING, message: dto.message ?? null, respondedAt: null },
        include: REQUEST_INCLUDE,
      });
    } else {
      // Already PENDING or ACCEPTED — idempotent no-op, prevents duplicate-request spam.
      request = await this.prisma.voucherAccessRequest.findUniqueOrThrow({ where: { conversationId }, include: REQUEST_INCLUDE });
    }

    return VoucherAccessRequestResponseDto.from(request);
  }

  async getForConversation(actor: AuthenticatedUser, conversationId: string): Promise<VoucherAccessRequestResponseDto> {
    const conversation = await this.getConversationOrThrow(conversationId);
    const isParticipant =
      STAFF_ROLES.includes(actor.role) || actor.id === conversation.tenantId || actor.id === conversation.landlordId;
    if (!isParticipant) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    const request = await this.prisma.voucherAccessRequest.findUnique({ where: { conversationId }, include: REQUEST_INCLUDE });
    return request ? VoucherAccessRequestResponseDto.from(request) : VoucherAccessRequestResponseDto.none(conversationId);
  }

  async listMine(actor: AuthenticatedUser): Promise<VoucherAccessRequestResponseDto[]> {
    this.assertTenant(actor);
    const requests = await this.prisma.voucherAccessRequest.findMany({
      where: { conversation: { tenantId: actor.id } },
      include: REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((r) => VoucherAccessRequestResponseDto.from(r));
  }

  private async getOwnedRequest(actor: AuthenticatedUser, requestId: string) {
    const request = await this.prisma.voucherAccessRequest.findUnique({ where: { id: requestId }, include: REQUEST_INCLUDE });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    if (request.conversation.tenantId !== actor.id) {
      throw new ForbiddenException('This request is not addressed to you');
    }
    return request;
  }

  async accept(actor: AuthenticatedUser, requestId: string): Promise<VoucherAccessRequestResponseDto> {
    this.assertTenant(actor);
    const request = await this.getOwnedRequest(actor, requestId);
    if (request.status !== VoucherAccessStatus.PENDING) {
      throw new BadRequestException('This request has already been responded to');
    }
    const hasDocument = await this.voucherDocumentsService.hasDocument(actor.id);
    if (!hasDocument) {
      throw new BadRequestException('Upload your Housing Voucher before accepting this request');
    }

    const updated = await this.prisma.voucherAccessRequest.update({
      where: { id: requestId },
      data: { status: VoucherAccessStatus.ACCEPTED, respondedAt: new Date() },
      include: REQUEST_INCLUDE,
    });

    const landlordEmail = request.conversation.landlord?.email;
    if (landlordEmail) {
      const dashboardBaseUrl = this.configService.get('dashboardBaseUrl', { infer: true });
      await this.emailProvider.sendEmail({
        to: landlordEmail,
        subject: `Housing Voucher access granted — ${request.conversation.property?.title ?? 'your conversation'}`,
        text: `The tenant accepted your request to view their Housing Voucher. View it here: ${dashboardBaseUrl}/conversations/${request.conversationId}`,
      });
    }

    return VoucherAccessRequestResponseDto.from(updated);
  }

  async decline(actor: AuthenticatedUser, requestId: string): Promise<VoucherAccessRequestResponseDto> {
    this.assertTenant(actor);
    const request = await this.getOwnedRequest(actor, requestId);
    if (request.status !== VoucherAccessStatus.PENDING && request.status !== VoucherAccessStatus.ACCEPTED) {
      throw new BadRequestException('This request has already been responded to');
    }
    const targetStatus = request.status === VoucherAccessStatus.ACCEPTED ? VoucherAccessStatus.REVOKED : VoucherAccessStatus.DECLINED;

    const updated = await this.prisma.voucherAccessRequest.update({
      where: { id: requestId },
      data: { status: targetStatus, respondedAt: new Date() },
      include: REQUEST_INCLUDE,
    });
    return VoucherAccessRequestResponseDto.from(updated);
  }

  async getDownloadTarget(actor: AuthenticatedUser, conversationId: string): Promise<VoucherFile> {
    const conversation = await this.getConversationOrThrow(conversationId);
    if (actor.id !== conversation.landlordId) {
      throw new ForbiddenException('Only the landlord on this conversation can download the Housing Voucher');
    }
    const request = await this.prisma.voucherAccessRequest.findUnique({ where: { conversationId } });
    if (!request || request.status !== VoucherAccessStatus.ACCEPTED) {
      throw new ForbiddenException('You do not have access to this Housing Voucher');
    }
    return this.voucherDocumentsService.getFileByTenantId(conversation.tenantId);
  }
}
