import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HqsInspectionStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { EMAIL_PROVIDER } from '../email/email.constants';
import { EmailProvider } from '../email/interfaces/email-provider.interface';
import { PAYMENT_PROVIDER } from '../payments/payments.constants';
import { PaymentProvider } from '../payments/interfaces/payment-provider.interface';
import { HqsInspectionResponseDto } from './dto/hqs-inspection-response.dto';

const STAFF_ROLES: Role[] = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];
const OPEN_STATUSES: HqsInspectionStatus[] = [HqsInspectionStatus.AWAITING_PAYMENT, HqsInspectionStatus.PAID];

@Injectable()
export class HqsInspectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig>,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  private async assertCanManageProperty(actor: AuthenticatedUser, propertyId: string): Promise<{ id: string; title: string }> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, title: true, ownerId: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    if (STAFF_ROLES.includes(actor.role) || property.ownerId === actor.id) {
      return property;
    }
    const assignment = await this.prisma.propertyManagerAssignment.findFirst({
      where: { propertyId, userId: actor.id, revokedAt: null },
    });
    if (!assignment) {
      throw new ForbiddenException('You do not have permission to manage this property');
    }
    return property;
  }

  async create(actor: AuthenticatedUser, propertyId: string): Promise<HqsInspectionResponseDto> {
    const property = await this.assertCanManageProperty(actor, propertyId);

    const existing = await this.prisma.hqsInspectionRequest.findFirst({
      where: { propertyId, status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return HqsInspectionResponseDto.from(existing);
    }

    const feeCents = this.configService.get('hqsInspectionFeeCents', { infer: true }) as number;
    const request = await this.prisma.hqsInspectionRequest.create({
      data: { propertyId, requestedById: actor.id, feeCents },
    });

    const dashboardBaseUrl = this.configService.get('dashboardBaseUrl', { infer: true });
    const checkout = await this.paymentProvider.createCheckout({
      amountCents: feeCents,
      description: `HQS pre-inspection package — ${property.title}`,
      referenceId: request.id,
      redirectUrl: `${dashboardBaseUrl}/properties/${propertyId}?hqsInspectionPaid=1`,
    });

    const updated = await this.prisma.hqsInspectionRequest.update({
      where: { id: request.id },
      data: {
        paymentProviderCheckoutId: checkout.providerCheckoutId,
        paymentOrderId: checkout.providerOrderId,
        checkoutUrl: checkout.checkoutUrl,
      },
    });
    return HqsInspectionResponseDto.from(updated);
  }

  async listForProperty(actor: AuthenticatedUser, propertyId: string): Promise<HqsInspectionResponseDto[]> {
    await this.assertCanManageProperty(actor, propertyId);
    const requests = await this.prisma.hqsInspectionRequest.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((r) => HqsInspectionResponseDto.from(r));
  }

  async cancel(actor: AuthenticatedUser, id: string): Promise<HqsInspectionResponseDto> {
    const request = await this.prisma.hqsInspectionRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Inspection request not found');
    }
    await this.assertCanManageProperty(actor, request.propertyId);
    if (!OPEN_STATUSES.includes(request.status)) {
      throw new BadRequestException('This request can no longer be cancelled');
    }

    const updated = await this.prisma.hqsInspectionRequest.update({
      where: { id },
      data: { status: HqsInspectionStatus.CANCELLED },
    });
    return HqsInspectionResponseDto.from(updated);
  }

  async request(actor: AuthenticatedUser, id: string, preferredDateNote: string | undefined): Promise<HqsInspectionResponseDto> {
    const request = await this.prisma.hqsInspectionRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Inspection request not found');
    }
    const property = await this.assertCanManageProperty(actor, request.propertyId);
    if (request.status !== HqsInspectionStatus.PAID) {
      throw new BadRequestException(
        request.status === HqsInspectionStatus.REQUESTED
          ? 'This inspection has already been requested'
          : 'The inspection fee must be paid before requesting a walkthrough',
      );
    }

    const inspectionsEmail = this.configService.get('hqsInspectionsEmail', { infer: true }) as string;
    await this.emailProvider.sendEmail({
      to: inspectionsEmail,
      subject: `HQS pre-inspection requested — ${property.title}`,
      text: preferredDateNote ?? '(No preferred date/note provided.)',
    });

    const updated = await this.prisma.hqsInspectionRequest.update({
      where: { id },
      data: {
        status: HqsInspectionStatus.REQUESTED,
        preferredDateNote: preferredDateNote ?? null,
        requestedAt: new Date(),
        emailSent: true,
      },
    });
    return HqsInspectionResponseDto.from(updated);
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

    const request = await this.prisma.hqsInspectionRequest.findFirst({
      where: { paymentOrderId: event.providerOrderId, status: HqsInspectionStatus.AWAITING_PAYMENT },
    });
    if (!request) {
      return;
    }

    await this.prisma.hqsInspectionRequest.update({
      where: { id: request.id },
      data: { status: HqsInspectionStatus.PAID, paidAt: new Date() },
    });
  }
}
