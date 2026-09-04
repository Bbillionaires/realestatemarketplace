import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Application, ApplicationStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { EMAIL_PROVIDER } from '../email/email.constants';
import { EmailProvider } from '../email/interfaces/email-provider.interface';
import { PAYMENT_PROVIDER } from '../payments/payments.constants';
import { PaymentProvider } from '../payments/interfaces/payment-provider.interface';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { ApplicationDecisionDto } from './dto/application-decision.dto';
import { ApplicationResponseDto } from './dto/application-response.dto';

const STAFF_ROLES: Role[] = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];
const REOPENABLE_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.STARTED,
  ApplicationStatus.WITHDRAWN,
  ApplicationStatus.DENIED,
];

/**
 * Multipart form booleans arrive as the strings "true"/"false". Normalized
 * here rather than via a DTO `@Transform` — the global ValidationPipe's
 * `enableImplicitConversion` applies its own `Boolean(value)` coercion to a
 * `boolean`-typed property *after* a custom `@Transform` runs, and
 * `Boolean('false')` is `true`, silently flipping every explicit "false".
 */
function toBoolean(value: boolean | string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value === true || value === 'true';
}

const APPLICATION_INCLUDE = {
  occupants: true,
  rentalHistory: true,
  references: true,
} as const;

const CONVERSATION_INCLUDE = {
  property: { select: { title: true, applicationFeeCents: true } },
  landlord: { select: { email: true } },
} as const;

export interface UploadedIncomeProofFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export interface IncomeProofFile {
  fileName: string;
  mimeType: string;
  fileData: Buffer;
}

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig>,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  private async getConversationOrThrow(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: CONVERSATION_INCLUDE,
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  private async assertParticipant(actor: AuthenticatedUser, conversationId: string) {
    const conversation = await this.getConversationOrThrow(conversationId);
    if (STAFF_ROLES.includes(actor.role) || actor.id === conversation.tenantId || actor.id === conversation.landlordId) {
      return conversation;
    }
    throw new ForbiddenException('You do not have access to this conversation');
  }

  private async getOwnedByTenant(actor: AuthenticatedUser, conversationId: string) {
    const conversation = await this.getConversationOrThrow(conversationId);
    if (conversation.tenantId !== actor.id) {
      throw new ForbiddenException('Only the tenant on this conversation can do this');
    }
    return conversation;
  }

  private async getEditableByTenant(actor: AuthenticatedUser, conversationId: string): Promise<Application> {
    await this.getOwnedByTenant(actor, conversationId);
    const application = await this.prisma.application.findUnique({ where: { conversationId } });
    if (!application) {
      throw new NotFoundException('Start your application before editing it');
    }
    if (!REOPENABLE_STATUSES.includes(application.status)) {
      throw new BadRequestException('This application can no longer be edited');
    }
    return application;
  }

  async createOrGet(actor: AuthenticatedUser, conversationId: string): Promise<ApplicationResponseDto> {
    const conversation = await this.getOwnedByTenant(actor, conversationId);
    const existing = await this.prisma.application.findUnique({ where: { conversationId }, include: APPLICATION_INCLUDE });
    if (existing) {
      return ApplicationResponseDto.from(existing);
    }

    const application = await this.prisma.application.create({
      data: {
        conversationId,
        tenantId: actor.id,
        propertyId: conversation.propertyId,
        unitId: conversation.unitId,
        bedId: conversation.bedId,
        feeCents: conversation.property.applicationFeeCents ?? null,
      },
      include: APPLICATION_INCLUDE,
    });
    return ApplicationResponseDto.from(application);
  }

  async get(actor: AuthenticatedUser, conversationId: string): Promise<ApplicationResponseDto> {
    await this.assertParticipant(actor, conversationId);
    const application = await this.prisma.application.findUnique({ where: { conversationId }, include: APPLICATION_INCLUDE });
    return application ? ApplicationResponseDto.from(application) : ApplicationResponseDto.none(conversationId);
  }

  async update(
    actor: AuthenticatedUser,
    conversationId: string,
    dto: UpdateApplicationDto,
    file: UploadedIncomeProofFile | undefined,
  ): Promise<ApplicationResponseDto> {
    const application = await this.getEditableByTenant(actor, conversationId);

    await this.prisma.application.update({
      where: { id: application.id },
      data: {
        // Reopening this write path from WITHDRAWN/DENIED restarts the
        // workflow — a fresh decision later overwrites the stale one.
        status: ApplicationStatus.STARTED,
        fullLegalName: dto.fullLegalName ?? application.fullLegalName,
        dateOfBirth: dto.dateOfBirth ?? application.dateOfBirth,
        contactPhone: dto.contactPhone ?? application.contactPhone,
        contactEmail: dto.contactEmail ?? application.contactEmail,
        currentAddressLine1: dto.currentAddressLine1 ?? application.currentAddressLine1,
        currentAddressLine2: dto.currentAddressLine2 ?? application.currentAddressLine2,
        currentCity: dto.currentCity ?? application.currentCity,
        currentState: dto.currentState ?? application.currentState,
        currentZip: dto.currentZip ?? application.currentZip,
        employerName: dto.employerName ?? application.employerName,
        employerPhone: dto.employerPhone ?? application.employerPhone,
        position: dto.position ?? application.position,
        employmentStartDate: dto.employmentStartDate ?? application.employmentStartDate,
        monthlyIncomeCents: dto.monthlyIncomeCents ?? application.monthlyIncomeCents,
        otherIncomeCents: dto.otherIncomeCents ?? application.otherIncomeCents,
        otherIncomeNote: dto.otherIncomeNote ?? application.otherIncomeNote,
        reasonForMoving: dto.reasonForMoving ?? application.reasonForMoving,
        hasPets: toBoolean(dto.hasPets) ?? application.hasPets,
        petDetails: dto.petDetails ?? application.petDetails,
        hasVehicles: toBoolean(dto.hasVehicles) ?? application.hasVehicles,
        vehicleDetails: dto.vehicleDetails ?? application.vehicleDetails,
        hasGuarantor: toBoolean(dto.hasGuarantor) ?? application.hasGuarantor,
        guarantorFullName: dto.guarantorFullName ?? application.guarantorFullName,
        guarantorPhone: dto.guarantorPhone ?? application.guarantorPhone,
        guarantorEmail: dto.guarantorEmail ?? application.guarantorEmail,
        guarantorMonthlyIncomeCents: dto.guarantorMonthlyIncomeCents ?? application.guarantorMonthlyIncomeCents,
        ...(file
          ? { incomeProofFileName: file.originalname, incomeProofMimeType: file.mimetype, incomeProofFile: file.buffer }
          : {}),
      },
    });

    if (dto.occupants) {
      await this.prisma.applicationOccupant.deleteMany({ where: { applicationId: application.id } });
      if (dto.occupants.length > 0) {
        await this.prisma.applicationOccupant.createMany({
          data: dto.occupants.map((o) => ({ applicationId: application.id, ...o })),
        });
      }
    }
    if (dto.rentalHistory) {
      await this.prisma.applicationRentalHistoryEntry.deleteMany({ where: { applicationId: application.id } });
      if (dto.rentalHistory.length > 0) {
        await this.prisma.applicationRentalHistoryEntry.createMany({
          data: dto.rentalHistory.map((r) => ({ applicationId: application.id, ...r })),
        });
      }
    }
    if (dto.references) {
      await this.prisma.applicationReference.deleteMany({ where: { applicationId: application.id } });
      if (dto.references.length > 0) {
        await this.prisma.applicationReference.createMany({
          data: dto.references.map((r) => ({ applicationId: application.id, ...r })),
        });
      }
    }

    const final = await this.prisma.application.findUniqueOrThrow({ where: { id: application.id }, include: APPLICATION_INCLUDE });
    return ApplicationResponseDto.from(final);
  }

  private async ensureCheckout(application: Application): Promise<Application> {
    if (application.checkoutUrl) {
      return application;
    }
    const dashboardBaseUrl = this.configService.get('dashboardBaseUrl', { infer: true });
    const checkout = await this.paymentProvider.createCheckout({
      amountCents: application.feeCents ?? 0,
      description: 'Rental application fee',
      referenceId: application.id,
      redirectUrl: `${dashboardBaseUrl}/conversations/${application.conversationId}/apply?applicationPaid=1`,
    });
    return this.prisma.application.update({
      where: { id: application.id },
      data: {
        paymentProviderCheckoutId: checkout.providerCheckoutId,
        paymentOrderId: checkout.providerOrderId,
        checkoutUrl: checkout.checkoutUrl,
      },
    });
  }

  async pay(actor: AuthenticatedUser, conversationId: string): Promise<ApplicationResponseDto> {
    await this.getOwnedByTenant(actor, conversationId);
    const application = await this.prisma.application.findUnique({ where: { conversationId } });
    if (!application) {
      throw new NotFoundException('Start your application before paying its fee');
    }
    if (application.status !== ApplicationStatus.STARTED) {
      throw new BadRequestException('This application is not currently open for payment');
    }
    if (!application.feeCents) {
      throw new BadRequestException('This application has no fee to pay');
    }
    const ensured = application.paidAt ? application : await this.ensureCheckout(application);
    const full = await this.prisma.application.findUniqueOrThrow({ where: { id: ensured.id }, include: APPLICATION_INCLUDE });
    return ApplicationResponseDto.from(full);
  }

  async submit(actor: AuthenticatedUser, conversationId: string): Promise<ApplicationResponseDto> {
    const conversation = await this.getOwnedByTenant(actor, conversationId);
    const application = await this.prisma.application.findUnique({ where: { conversationId } });
    if (!application) {
      throw new NotFoundException('Start your application before submitting it');
    }
    if (application.status !== ApplicationStatus.STARTED) {
      throw new BadRequestException('This application has already been submitted');
    }
    if (application.feeCents && !application.paidAt) {
      throw new BadRequestException('Pay the application fee before submitting');
    }

    const updated = await this.prisma.application.update({
      where: { id: application.id },
      data: { status: ApplicationStatus.SUBMITTED, submittedAt: new Date() },
      include: APPLICATION_INCLUDE,
    });

    if (conversation.landlord.email) {
      // The application is already recorded as SUBMITTED above — the landlord
      // can always see it from their dashboard/conversation thread regardless
      // of whether this notification goes out, so a flaky email provider must
      // not turn an already-successful submission into a 500 for the tenant.
      try {
        await this.emailProvider.sendEmail({
          to: conversation.landlord.email,
          subject: `New rental application — ${conversation.property.title}`,
          text: `A tenant has submitted a rental application for ${conversation.property.title}. View it in your conversation thread.`,
        });
      } catch (error) {
        this.logger.warn(`Failed to notify landlord of application ${application.id} submission: ${error}`);
      }
    }
    return ApplicationResponseDto.from(updated);
  }

  async withdraw(actor: AuthenticatedUser, conversationId: string): Promise<ApplicationResponseDto> {
    await this.getOwnedByTenant(actor, conversationId);
    const application = await this.prisma.application.findUnique({ where: { conversationId } });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    if (application.status !== ApplicationStatus.SUBMITTED && application.status !== ApplicationStatus.UNDER_REVIEW) {
      throw new BadRequestException('This application cannot be withdrawn from its current status');
    }
    const updated = await this.prisma.application.update({
      where: { id: application.id },
      data: { status: ApplicationStatus.WITHDRAWN },
      include: APPLICATION_INCLUDE,
    });
    return ApplicationResponseDto.from(updated);
  }

  async getIncomeProof(actor: AuthenticatedUser, conversationId: string): Promise<IncomeProofFile> {
    await this.assertParticipant(actor, conversationId);
    const application = await this.prisma.application.findUnique({
      where: { conversationId },
      select: { incomeProofFileName: true, incomeProofMimeType: true, incomeProofFile: true },
    });
    if (!application?.incomeProofFile || !application.incomeProofFileName || !application.incomeProofMimeType) {
      throw new NotFoundException('No income proof on file');
    }
    return {
      fileName: application.incomeProofFileName,
      mimeType: application.incomeProofMimeType,
      fileData: Buffer.from(application.incomeProofFile),
    };
  }

  private async assertCanDecide(actor: AuthenticatedUser, application: Application): Promise<void> {
    if (STAFF_ROLES.includes(actor.role)) {
      return;
    }
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: application.conversationId },
      select: { landlordId: true },
    });
    if (conversation?.landlordId !== actor.id) {
      throw new ForbiddenException('Only the landlord on this conversation can do this');
    }
  }

  async markUnderReview(actor: AuthenticatedUser, id: string): Promise<ApplicationResponseDto> {
    const application = await this.prisma.application.findUnique({ where: { id } });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    await this.assertCanDecide(actor, application);
    if (application.status !== ApplicationStatus.SUBMITTED) {
      throw new BadRequestException('Only a submitted application can be marked under review');
    }
    const updated = await this.prisma.application.update({
      where: { id },
      data: { status: ApplicationStatus.UNDER_REVIEW },
      include: APPLICATION_INCLUDE,
    });
    return ApplicationResponseDto.from(updated);
  }

  async decide(actor: AuthenticatedUser, id: string, dto: ApplicationDecisionDto): Promise<ApplicationResponseDto> {
    const application = await this.prisma.application.findUnique({ where: { id } });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    await this.assertCanDecide(actor, application);
    if (application.status !== ApplicationStatus.SUBMITTED && application.status !== ApplicationStatus.UNDER_REVIEW) {
      throw new BadRequestException('This application is not awaiting a decision');
    }

    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status: dto.decision === 'APPROVED' ? ApplicationStatus.APPROVED : ApplicationStatus.DENIED,
        decisionAt: new Date(),
        decisionBy: actor.id,
        notes: dto.notes ?? application.notes,
      },
      include: APPLICATION_INCLUDE,
    });
    return ApplicationResponseDto.from(updated);
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

    const application = await this.prisma.application.findFirst({
      where: { paymentOrderId: event.providerOrderId, paidAt: null },
    });
    if (!application) {
      return;
    }

    await this.prisma.application.update({
      where: { id: application.id },
      data: { paidAt: new Date() },
    });
  }
}
