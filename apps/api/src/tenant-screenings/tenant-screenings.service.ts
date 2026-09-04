import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, TenantScreening, TenantScreeningKind, TenantScreeningStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { EMAIL_PROVIDER } from '../email/email.constants';
import { EmailProvider } from '../email/interfaces/email-provider.interface';
import { PAYMENT_PROVIDER } from '../payments/payments.constants';
import { PaymentProvider } from '../payments/interfaces/payment-provider.interface';
import { RequestTenantScreeningDto } from './dto/request-tenant-screening.dto';
import { AcknowledgeTenantScreeningDto } from './dto/acknowledge-tenant-screening.dto';
import { ShareTenantScreeningDto } from './dto/share-tenant-screening.dto';
import { TenantScreeningResponseDto } from './dto/tenant-screening-response.dto';
import { TenantScreeningAdminSummaryDto } from './dto/tenant-screening-admin-summary.dto';

const STAFF_ROLES: Role[] = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];
const TENANT_ROLES: Role[] = [Role.PROSPECTIVE_TENANT, Role.CURRENT_TENANT];
const TERMINAL_STATUSES: TenantScreeningStatus[] = [
  TenantScreeningStatus.COMPLETE,
  TenantScreeningStatus.DECLINED,
  TenantScreeningStatus.CANCELLED,
];
const PORTABLE_VALIDITY_DAYS = 30;

const ADMIN_INCLUDE = {
  tenant: { select: { email: true, profile: { select: { displayName: true } } } },
  initiatedBy: { select: { email: true } },
} as const;

export interface ScreeningFile {
  fileName: string;
  mimeType: string;
  fileData: Buffer;
}

export interface UploadedResultFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@Injectable()
export class TenantScreeningsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig>,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  private async getConversationOrThrow(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  private async getOwnedByTenant(actor: AuthenticatedUser, id: string): Promise<TenantScreening> {
    const screening = await this.prisma.tenantScreening.findUnique({ where: { id } });
    if (!screening) {
      throw new NotFoundException('Screening not found');
    }
    if (screening.tenantId !== actor.id) {
      throw new ForbiddenException('This screening is not yours');
    }
    return screening;
  }

  private async getScreeningOrThrow(id: string): Promise<TenantScreening> {
    const screening = await this.prisma.tenantScreening.findUnique({ where: { id } });
    if (!screening) {
      throw new NotFoundException('Screening not found');
    }
    return screening;
  }

  private async ensureCheckout(screening: TenantScreening): Promise<TenantScreening> {
    if (screening.checkoutUrl) {
      return screening;
    }
    const dashboardBaseUrl = this.configService.get('dashboardBaseUrl', { infer: true });
    const checkout = await this.paymentProvider.createCheckout({
      amountCents: screening.feeCents,
      description: 'Tenant screening (background & eviction check)',
      referenceId: screening.id,
      redirectUrl: `${dashboardBaseUrl}/tenant-screening?screeningPaid=1`,
    });
    return this.prisma.tenantScreening.update({
      where: { id: screening.id },
      data: {
        paymentProviderCheckoutId: checkout.providerCheckoutId,
        paymentOrderId: checkout.providerOrderId,
        checkoutUrl: checkout.checkoutUrl,
      },
    });
  }

  private async notifyTenantOfRequest(tenantEmail: string, initiatorEmail: string): Promise<void> {
    const dashboardBaseUrl = this.configService.get('dashboardBaseUrl', { infer: true });
    await this.emailProvider.sendEmail({
      to: tenantEmail,
      subject: 'A tenant screening has been requested on your account',
      text: `${initiatorEmail} has asked for a background/eviction screening on your account. Nothing happens until you pay and authorize it yourself: ${dashboardBaseUrl}/tenant-screening`,
    });
  }

  /** Self-initiate (or resume) a portable screening — reuses any existing unpaid one, self or third-party-initiated. */
  async createMine(actor: AuthenticatedUser): Promise<TenantScreeningResponseDto> {
    const existing = await this.prisma.tenantScreening.findFirst({
      where: {
        tenantId: actor.id,
        kind: TenantScreeningKind.PORTABLE,
        status: TenantScreeningStatus.AWAITING_TENANT_AUTHORIZATION,
      },
      orderBy: { createdAt: 'desc' },
    });

    const feeCents = this.configService.get('tenantScreeningFeeCents', { infer: true }) as number;
    const screening =
      existing ??
      (await this.prisma.tenantScreening.create({
        data: { tenantId: actor.id, kind: TenantScreeningKind.PORTABLE, feeCents },
      }));

    const ensured = await this.ensureCheckout(screening);
    return TenantScreeningResponseDto.from(ensured);
  }

  /** Landlord/PM/employer flags a named tenant as needing a screening — the tenant still has to pay+authorize. */
  async requestForTenant(actor: AuthenticatedUser, dto: RequestTenantScreeningDto): Promise<TenantScreeningResponseDto> {
    const tenant = await this.prisma.user.findUnique({ where: { email: dto.tenantEmail } });
    if (!tenant || !TENANT_ROLES.includes(tenant.role)) {
      throw new NotFoundException('No tenant account found with that email');
    }

    const existing = await this.prisma.tenantScreening.findFirst({
      where: {
        tenantId: tenant.id,
        kind: TenantScreeningKind.PORTABLE,
        status: TenantScreeningStatus.AWAITING_TENANT_AUTHORIZATION,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      // Someone (the tenant themselves, or an earlier requester) already has an
      // unpaid portable screening open — reuse it rather than creating a second
      // one, but this landlord's ask must still reach the tenant. If nobody has
      // claimed the initiator slot yet, this landlord claims it (so they get
      // automatic access once it's complete); if it's already claimed by a
      // different requester, leave that intact and just notify.
      const claimed = existing.initiatedById
        ? existing
        : await this.prisma.tenantScreening.update({
            where: { id: existing.id },
            data: { initiatedById: actor.id, initiatorAcknowledgedAt: new Date() },
          });
      await this.notifyTenantOfRequest(tenant.email, actor.email);
      return TenantScreeningResponseDto.from(claimed);
    }

    const feeCents = this.configService.get('tenantScreeningFeeCents', { infer: true }) as number;
    const screening = await this.prisma.tenantScreening.create({
      data: {
        tenantId: tenant.id,
        kind: TenantScreeningKind.PORTABLE,
        feeCents,
        initiatedById: actor.id,
        initiatorAcknowledgedAt: new Date(),
      },
    });

    await this.notifyTenantOfRequest(tenant.email, actor.email);
    return TenantScreeningResponseDto.from(screening);
  }

  /** Landlord requests a screening tied to one conversation/application. */
  async createForConversation(
    actor: AuthenticatedUser,
    conversationId: string,
    _dto: AcknowledgeTenantScreeningDto,
  ): Promise<TenantScreeningResponseDto> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { tenant: { select: { email: true } } },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (actor.id !== conversation.landlordId) {
      throw new ForbiddenException('Only the landlord on this conversation can request a tenant screening');
    }

    const existing = await this.prisma.tenantScreening.findFirst({
      where: { conversationId, status: { notIn: [TenantScreeningStatus.CANCELLED, TenantScreeningStatus.DECLINED] } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return TenantScreeningResponseDto.from(existing);
    }

    const feeCents = this.configService.get('tenantScreeningFeeCents', { infer: true }) as number;
    const screening = await this.prisma.tenantScreening.create({
      data: {
        tenantId: conversation.tenantId,
        kind: TenantScreeningKind.APPLICATION,
        feeCents,
        conversationId,
        initiatedById: actor.id,
        initiatorAcknowledgedAt: new Date(),
      },
    });

    await this.notifyTenantOfRequest(conversation.tenant.email, actor.email);
    return TenantScreeningResponseDto.from(screening);
  }

  async listMine(actor: AuthenticatedUser): Promise<TenantScreeningResponseDto[]> {
    const rows = await this.prisma.tenantScreening.findMany({
      where: { tenantId: actor.id },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => TenantScreeningResponseDto.from(r));
  }

  async pay(actor: AuthenticatedUser, id: string): Promise<TenantScreeningResponseDto> {
    const screening = await this.getOwnedByTenant(actor, id);
    if (screening.status !== TenantScreeningStatus.AWAITING_TENANT_AUTHORIZATION) {
      throw new BadRequestException('This screening has already been paid, declined, or cancelled');
    }
    const ensured = await this.ensureCheckout(screening);
    return TenantScreeningResponseDto.from(ensured);
  }

  async decline(actor: AuthenticatedUser, id: string): Promise<TenantScreeningResponseDto> {
    const screening = await this.getOwnedByTenant(actor, id);
    if (screening.status !== TenantScreeningStatus.AWAITING_TENANT_AUTHORIZATION) {
      throw new BadRequestException('This screening can no longer be declined');
    }
    const updated = await this.prisma.tenantScreening.update({
      where: { id },
      data: { status: TenantScreeningStatus.DECLINED },
    });
    return TenantScreeningResponseDto.from(updated);
  }

  async share(actor: AuthenticatedUser, id: string, dto: ShareTenantScreeningDto): Promise<{ shared: boolean }> {
    const screening = await this.getOwnedByTenant(actor, id);
    if (screening.kind !== TenantScreeningKind.PORTABLE) {
      throw new BadRequestException('Only a portable screening can be shared into a conversation');
    }
    if (screening.status !== TenantScreeningStatus.COMPLETE) {
      throw new BadRequestException('This screening is not complete yet');
    }
    if (screening.expiresAt && screening.expiresAt < new Date()) {
      throw new BadRequestException('This screening has expired');
    }
    const conversation = await this.getConversationOrThrow(dto.conversationId);
    if (conversation.tenantId !== actor.id) {
      throw new ForbiddenException('You are not the tenant on that conversation');
    }

    await this.prisma.tenantScreeningShare.upsert({
      where: { tenantScreeningId_conversationId: { tenantScreeningId: id, conversationId: dto.conversationId } },
      create: { tenantScreeningId: id, conversationId: dto.conversationId },
      update: {},
    });
    return { shared: true };
  }

  async getForConversation(actor: AuthenticatedUser, conversationId: string): Promise<TenantScreeningResponseDto> {
    const conversation = await this.getConversationOrThrow(conversationId);
    const isParticipant =
      STAFF_ROLES.includes(actor.role) || actor.id === conversation.tenantId || actor.id === conversation.landlordId;
    if (!isParticipant) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    const direct = await this.prisma.tenantScreening.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    });
    if (direct) {
      return TenantScreeningResponseDto.from(direct);
    }

    const share = await this.prisma.tenantScreeningShare.findFirst({
      where: { conversationId },
      orderBy: { sharedAt: 'desc' },
      include: { tenantScreening: true },
    });
    if (share) {
      return TenantScreeningResponseDto.from(share.tenantScreening);
    }

    return TenantScreeningResponseDto.none(conversationId);
  }

  private async canAccessScreening(actor: AuthenticatedUser, screening: TenantScreening): Promise<boolean> {
    if (STAFF_ROLES.includes(actor.role) || actor.id === screening.tenantId || actor.id === screening.initiatedById) {
      return true;
    }
    if (screening.conversationId) {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: screening.conversationId },
        select: { landlordId: true },
      });
      if (conversation?.landlordId === actor.id) {
        return true;
      }
    }
    const sharedWithActor = await this.prisma.tenantScreeningShare.findFirst({
      where: { tenantScreeningId: screening.id, conversation: { landlordId: actor.id } },
      select: { id: true },
    });
    return sharedWithActor !== null;
  }

  async getDownloadTarget(actor: AuthenticatedUser, id: string): Promise<ScreeningFile> {
    const screening = await this.getScreeningOrThrow(id);
    if (screening.status !== TenantScreeningStatus.COMPLETE) {
      throw new ForbiddenException('This screening result is not ready yet');
    }
    const allowed = await this.canAccessScreening(actor, screening);
    if (!allowed) {
      throw new ForbiddenException('You do not have access to this screening result');
    }
    if (!screening.resultFile || !screening.resultFileName || !screening.resultMimeType) {
      throw new NotFoundException('No result file on this screening');
    }
    return {
      fileName: screening.resultFileName,
      mimeType: screening.resultMimeType,
      fileData: Buffer.from(screening.resultFile),
    };
  }

  async getDownloadTargetForConversation(actor: AuthenticatedUser, conversationId: string): Promise<ScreeningFile> {
    const conversation = await this.getConversationOrThrow(conversationId);
    const isParticipant =
      STAFF_ROLES.includes(actor.role) || actor.id === conversation.tenantId || actor.id === conversation.landlordId;
    if (!isParticipant) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    const direct = await this.prisma.tenantScreening.findFirst({
      where: { conversationId, status: TenantScreeningStatus.COMPLETE },
      orderBy: { createdAt: 'desc' },
    });
    const shared = direct
      ? null
      : await this.prisma.tenantScreeningShare.findFirst({
          where: { conversationId, tenantScreening: { status: TenantScreeningStatus.COMPLETE } },
          orderBy: { sharedAt: 'desc' },
          include: { tenantScreening: true },
        });
    const screening = direct ?? shared?.tenantScreening;
    if (!screening) {
      throw new NotFoundException('No completed screening available for this conversation');
    }
    return this.getDownloadTarget(actor, screening.id);
  }

  async handlePaymentWebhook(signature: string, url: string, rawBody: string): Promise<void> {
    const valid = this.paymentProvider.validateWebhook({ signature, url, rawBody });
    if (!valid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = this.paymentProvider.parseWebhookEvent(rawBody);
    if (!event || !event.paid) {
      return;
    }

    const screening = await this.prisma.tenantScreening.findFirst({
      where: { paymentOrderId: event.providerOrderId, status: TenantScreeningStatus.AWAITING_TENANT_AUTHORIZATION },
    });
    if (!screening) {
      return;
    }

    await this.prisma.tenantScreening.update({
      where: { id: screening.id },
      data: { status: TenantScreeningStatus.PAID, paidAt: new Date() },
    });
  }

  // --- Admin ---

  async listForAdmin(status?: TenantScreeningStatus): Promise<TenantScreeningAdminSummaryDto[]> {
    const rows = await this.prisma.tenantScreening.findMany({
      where: status ? { status } : undefined,
      include: ADMIN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => TenantScreeningAdminSummaryDto.from(r));
  }

  async markSubmittedExternally(id: string): Promise<TenantScreeningAdminSummaryDto> {
    const screening = await this.getScreeningOrThrow(id);
    if (screening.status !== TenantScreeningStatus.PAID) {
      throw new BadRequestException('Only a paid screening can be marked as submitted externally');
    }
    const updated = await this.prisma.tenantScreening.update({
      where: { id },
      data: { status: TenantScreeningStatus.SUBMITTED_EXTERNALLY },
      include: ADMIN_INCLUDE,
    });
    return TenantScreeningAdminSummaryDto.from(updated);
  }

  async uploadResult(
    actor: AuthenticatedUser,
    id: string,
    staffNotes: string | undefined,
    file: UploadedResultFile,
  ): Promise<TenantScreeningAdminSummaryDto> {
    const screening = await this.getScreeningOrThrow(id);
    if (screening.status !== TenantScreeningStatus.PAID && screening.status !== TenantScreeningStatus.SUBMITTED_EXTERNALLY) {
      throw new BadRequestException('This screening is not ready for a result upload');
    }
    const expiresAt =
      screening.kind === TenantScreeningKind.PORTABLE
        ? new Date(Date.now() + PORTABLE_VALIDITY_DAYS * 24 * 60 * 60 * 1000)
        : null;

    const updated = await this.prisma.tenantScreening.update({
      where: { id },
      data: {
        status: TenantScreeningStatus.COMPLETE,
        resultFileName: file.originalname,
        resultMimeType: file.mimetype,
        resultFile: file.buffer,
        resultUploadedByStaffId: actor.id,
        resultUploadedAt: new Date(),
        staffNotes: staffNotes ?? screening.staffNotes,
        expiresAt,
      },
      include: ADMIN_INCLUDE,
    });
    return TenantScreeningAdminSummaryDto.from(updated);
  }

  async cancelByAdmin(id: string): Promise<TenantScreeningAdminSummaryDto> {
    const screening = await this.getScreeningOrThrow(id);
    if (TERMINAL_STATUSES.includes(screening.status)) {
      throw new BadRequestException('This screening is already finished');
    }
    const updated = await this.prisma.tenantScreening.update({
      where: { id },
      data: { status: TenantScreeningStatus.CANCELLED },
      include: ADMIN_INCLUDE,
    });
    return TenantScreeningAdminSummaryDto.from(updated);
  }
}
