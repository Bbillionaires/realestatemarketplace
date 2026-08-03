import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LenderAccessTier, LenderRequestStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { EMAIL_PROVIDER } from '../email/email.constants';
import { EmailProvider } from '../email/interfaces/email-provider.interface';
import { CreateLenderAssignmentDto } from './dto/create-lender-assignment.dto';
import { UpdateLenderAssignmentDto } from './dto/update-lender-assignment.dto';
import { CreateLenderRequestDto } from './dto/create-lender-request.dto';
import { LenderAssignmentResponseDto } from './dto/lender-assignment-response.dto';
import { LenderRequestResponseDto } from './dto/lender-request-response.dto';

const TENANT_ROLES: Role[] = [Role.PROSPECTIVE_TENANT, Role.CURRENT_TENANT];

const ASSIGNMENT_INCLUDE = {
  property: true,
  lender: { include: { profile: true } },
  tenant: { include: { profile: true } },
} as const;

const REQUEST_INCLUDE = {
  lenderAssignment: { include: { property: true } },
} as const;

export interface SubmittedFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@Injectable()
export class LendersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  async createAssignment(dto: CreateLenderAssignmentDto, actorId: string): Promise<LenderAssignmentResponseDto> {
    const [property, lender, tenant] = await Promise.all([
      this.prisma.property.findUnique({ where: { id: dto.propertyId } }),
      this.prisma.user.findUnique({ where: { id: dto.lenderId } }),
      dto.tenantId ? this.prisma.user.findUnique({ where: { id: dto.tenantId } }) : Promise.resolve(null),
    ]);
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    if (!lender || lender.role !== Role.LENDER) {
      throw new BadRequestException('Target user must have the LENDER role');
    }
    if (dto.tenantId && (!tenant || !TENANT_ROLES.includes(tenant.role))) {
      throw new BadRequestException('tenantId must belong to a prospective or current tenant');
    }

    const assignment = await this.prisma.lenderAssignment.upsert({
      where: { propertyId_lenderId: { propertyId: dto.propertyId, lenderId: dto.lenderId } },
      create: {
        propertyId: dto.propertyId,
        lenderId: dto.lenderId,
        tenantId: dto.tenantId,
        accessTier: dto.accessTier ?? LenderAccessTier.BASIC,
        assignedById: actorId,
      },
      update: {
        tenantId: dto.tenantId,
        accessTier: dto.accessTier ?? undefined,
        revokedAt: null,
        assignedById: actorId,
      },
      include: ASSIGNMENT_INCLUDE,
    });
    return LenderAssignmentResponseDto.from(assignment);
  }

  async listAssignments(filters: { propertyId?: string; lenderId?: string }): Promise<LenderAssignmentResponseDto[]> {
    const assignments = await this.prisma.lenderAssignment.findMany({
      where: { propertyId: filters.propertyId, lenderId: filters.lenderId },
      include: ASSIGNMENT_INCLUDE,
      orderBy: { assignedAt: 'desc' },
    });
    return assignments.map((a) => LenderAssignmentResponseDto.from(a));
  }

  async updateAssignment(id: string, dto: UpdateLenderAssignmentDto): Promise<LenderAssignmentResponseDto> {
    const existing = await this.prisma.lenderAssignment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Lender assignment not found');
    }
    if (dto.tenantId) {
      const tenant = await this.prisma.user.findUnique({ where: { id: dto.tenantId } });
      if (!tenant || !TENANT_ROLES.includes(tenant.role)) {
        throw new BadRequestException('tenantId must belong to a prospective or current tenant');
      }
    }

    const updated = await this.prisma.lenderAssignment.update({
      where: { id },
      data: {
        tenantId: dto.tenantId === null ? null : dto.tenantId ?? undefined,
        accessTier: dto.accessTier,
      },
      include: ASSIGNMENT_INCLUDE,
    });
    return LenderAssignmentResponseDto.from(updated);
  }

  async revokeAssignment(id: string): Promise<LenderAssignmentResponseDto> {
    const existing = await this.prisma.lenderAssignment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Lender assignment not found');
    }
    const updated = await this.prisma.lenderAssignment.update({
      where: { id },
      data: { revokedAt: new Date() },
      include: ASSIGNMENT_INCLUDE,
    });
    return LenderAssignmentResponseDto.from(updated);
  }

  async listMyAssignments(actor: AuthenticatedUser): Promise<LenderAssignmentResponseDto[]> {
    const assignments = await this.prisma.lenderAssignment.findMany({
      where: { lenderId: actor.id, revokedAt: null },
      include: ASSIGNMENT_INCLUDE,
      orderBy: { assignedAt: 'desc' },
    });
    return assignments.map((a) => LenderAssignmentResponseDto.from(a));
  }

  private async getAssignmentForLender(actor: AuthenticatedUser, assignmentId: string) {
    const assignment = await this.prisma.lenderAssignment.findUnique({
      where: { id: assignmentId },
      include: ASSIGNMENT_INCLUDE,
    });
    if (!assignment) {
      throw new NotFoundException('Lender assignment not found');
    }
    if (assignment.lenderId !== actor.id) {
      throw new ForbiddenException('You do not have access to this lender assignment');
    }
    if (assignment.revokedAt) {
      throw new ForbiddenException('This lender assignment has been revoked');
    }
    return assignment;
  }

  async createRequest(
    actor: AuthenticatedUser,
    assignmentId: string,
    dto: CreateLenderRequestDto,
  ): Promise<LenderRequestResponseDto> {
    const assignment = await this.getAssignmentForLender(actor, assignmentId);
    if (!assignment.tenantId) {
      throw new BadRequestException('This assignment has no tenant assigned yet');
    }

    const request = await this.prisma.lenderPaymentRequest.create({
      data: { lenderAssignmentId: assignment.id, message: dto.message },
      include: REQUEST_INCLUDE,
    });
    return LenderRequestResponseDto.from(request);
  }

  async listRequestsForAssignment(actor: AuthenticatedUser, assignmentId: string): Promise<LenderRequestResponseDto[]> {
    await this.getAssignmentForLender(actor, assignmentId);
    const requests = await this.prisma.lenderPaymentRequest.findMany({
      where: { lenderAssignmentId: assignmentId },
      include: REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((r) => LenderRequestResponseDto.from(r));
  }

  async listMyRequests(actor: AuthenticatedUser): Promise<LenderRequestResponseDto[]> {
    const requests = await this.prisma.lenderPaymentRequest.findMany({
      where: { lenderAssignment: { tenantId: actor.id } },
      include: REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((r) => LenderRequestResponseDto.from(r));
  }

  private async getRequestForTenant(actor: AuthenticatedUser, requestId: string) {
    const request = await this.prisma.lenderPaymentRequest.findUnique({
      where: { id: requestId },
      include: { lenderAssignment: { include: ASSIGNMENT_INCLUDE } },
    });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    if (request.lenderAssignment.tenantId !== actor.id) {
      throw new ForbiddenException('This request is not addressed to you');
    }
    if (request.status !== LenderRequestStatus.PENDING) {
      throw new BadRequestException('This request has already been responded to');
    }
    return request;
  }

  async submitRequest(
    actor: AuthenticatedUser,
    requestId: string,
    responseNote: string | undefined,
    file: SubmittedFile | undefined,
  ): Promise<LenderRequestResponseDto> {
    const request = await this.getRequestForTenant(actor, requestId);
    if (!responseNote && !file) {
      throw new BadRequestException('Provide a note, a file, or both');
    }

    const lender = request.lenderAssignment.lender;
    let emailSent = false;
    if (lender?.email) {
      await this.emailProvider.sendEmail({
        to: lender.email,
        subject: `Payment proof submitted for ${request.lenderAssignment.property?.title ?? 'your assigned property'}`,
        text: responseNote ?? '(No note provided — see attached file.)',
        attachments: file ? [{ filename: file.originalname, content: file.buffer, contentType: file.mimetype }] : undefined,
      });
      emailSent = true;
    }

    const updated = await this.prisma.lenderPaymentRequest.update({
      where: { id: requestId },
      data: {
        status: LenderRequestStatus.FULFILLED,
        responseNote: responseNote ?? null,
        responseFileName: file?.originalname ?? null,
        emailSent,
        respondedAt: new Date(),
      },
      include: REQUEST_INCLUDE,
    });
    return LenderRequestResponseDto.from(updated);
  }

  async declineRequest(actor: AuthenticatedUser, requestId: string): Promise<LenderRequestResponseDto> {
    await this.getRequestForTenant(actor, requestId);
    const updated = await this.prisma.lenderPaymentRequest.update({
      where: { id: requestId },
      data: { status: LenderRequestStatus.DECLINED, respondedAt: new Date() },
      include: REQUEST_INCLUDE,
    });
    return LenderRequestResponseDto.from(updated);
  }
}
