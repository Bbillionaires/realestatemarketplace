import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdSubmissionStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { EMAIL_PROVIDER } from '../email/email.constants';
import { EmailProvider } from '../email/interfaces/email-provider.interface';
import { PAYMENT_PROVIDER } from '../payments/payments.constants';
import { PaymentProvider } from '../payments/interfaces/payment-provider.interface';
import { IdSubmissionResponseDto } from './dto/id-submission-response.dto';

const STAFF_ROLES: Role[] = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];
const OPEN_STATUSES: IdSubmissionStatus[] = [IdSubmissionStatus.AWAITING_PAYMENT, IdSubmissionStatus.PAID];

const CONVERSATION_INCLUDE = {
  property: { select: { title: true } },
  tenant: { select: { email: true } },
  landlord: { select: { email: true, profile: { select: { displayName: true } } } },
} as const;

export interface SubmittedIdFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@Injectable()
export class IdSubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig>,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  private async getConversationForTenant(actor: AuthenticatedUser, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: CONVERSATION_INCLUDE,
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.tenantId !== actor.id) {
      throw new ForbiddenException('Only the tenant on this conversation can do this');
    }
    return conversation;
  }

  private async assertParticipant(actor: AuthenticatedUser, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (STAFF_ROLES.includes(actor.role) || actor.id === conversation.tenantId || actor.id === conversation.landlordId) {
      return conversation;
    }
    throw new ForbiddenException('You do not have access to this conversation');
  }

  async create(actor: AuthenticatedUser, conversationId: string): Promise<IdSubmissionResponseDto> {
    const conversation = await this.getConversationForTenant(actor, conversationId);

    const existing = await this.prisma.idSubmission.findFirst({
      where: { conversationId, status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return IdSubmissionResponseDto.from(existing);
    }

    const feeCents = this.configService.get('idSubmissionFeeCents', { infer: true }) as number;
    const submission = await this.prisma.idSubmission.create({
      data: { conversationId, feeCents },
    });

    const dashboardBaseUrl = this.configService.get('dashboardBaseUrl', { infer: true });
    const checkout = await this.paymentProvider.createCheckout({
      amountCents: feeCents,
      description: `ID verification fee — ${conversation.property.title}`,
      referenceId: submission.id,
      redirectUrl: `${dashboardBaseUrl}/conversations/${conversationId}?idSubmissionPaid=1`,
    });

    const updated = await this.prisma.idSubmission.update({
      where: { id: submission.id },
      data: {
        paymentProviderCheckoutId: checkout.providerCheckoutId,
        paymentOrderId: checkout.providerOrderId,
        checkoutUrl: checkout.checkoutUrl,
      },
    });
    return IdSubmissionResponseDto.from(updated);
  }

  async listForConversation(actor: AuthenticatedUser, conversationId: string): Promise<IdSubmissionResponseDto[]> {
    await this.assertParticipant(actor, conversationId);
    const submissions = await this.prisma.idSubmission.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    });
    return submissions.map((s) => IdSubmissionResponseDto.from(s));
  }

  async cancel(actor: AuthenticatedUser, submissionId: string): Promise<IdSubmissionResponseDto> {
    const submission = await this.prisma.idSubmission.findUnique({ where: { id: submissionId } });
    if (!submission) {
      throw new NotFoundException('ID submission not found');
    }
    await this.getConversationForTenant(actor, submission.conversationId);
    if (!OPEN_STATUSES.includes(submission.status)) {
      throw new BadRequestException('This submission can no longer be cancelled');
    }

    const updated = await this.prisma.idSubmission.update({
      where: { id: submissionId },
      data: { status: IdSubmissionStatus.CANCELLED },
    });
    return IdSubmissionResponseDto.from(updated);
  }

  async submit(
    actor: AuthenticatedUser,
    submissionId: string,
    note: string | undefined,
    file: SubmittedIdFile | undefined,
  ): Promise<IdSubmissionResponseDto> {
    if (!file) {
      throw new BadRequestException('An ID file is required');
    }
    const submission = await this.prisma.idSubmission.findUnique({ where: { id: submissionId } });
    if (!submission) {
      throw new NotFoundException('ID submission not found');
    }
    const conversation = await this.getConversationForTenant(actor, submission.conversationId);
    if (submission.status !== IdSubmissionStatus.PAID) {
      throw new BadRequestException(
        submission.status === IdSubmissionStatus.SUBMITTED
          ? 'This ID has already been submitted'
          : 'The convenience fee must be paid before submitting an ID',
      );
    }

    let emailSent = false;
    if (conversation.landlord.email) {
      await this.emailProvider.sendEmail({
        to: conversation.landlord.email,
        subject: `ID submitted for ${conversation.property.title}`,
        text: note ?? '(No note provided — see attached file.)',
        attachments: [{ filename: file.originalname, content: file.buffer, contentType: file.mimetype }],
      });
      emailSent = true;
    }

    const updated = await this.prisma.idSubmission.update({
      where: { id: submissionId },
      data: {
        status: IdSubmissionStatus.SUBMITTED,
        submittedFileName: file.originalname,
        emailSent,
        submittedAt: new Date(),
      },
    });
    return IdSubmissionResponseDto.from(updated);
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

    const submission = await this.prisma.idSubmission.findFirst({
      where: { paymentOrderId: event.providerOrderId, status: IdSubmissionStatus.AWAITING_PAYMENT },
    });
    if (!submission) {
      return;
    }

    await this.prisma.idSubmission.update({
      where: { id: submission.id },
      data: { status: IdSubmissionStatus.PAID, paidAt: new Date() },
    });
  }
}
