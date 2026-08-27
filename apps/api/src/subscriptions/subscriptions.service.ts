import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, SubscriptionTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PAYMENT_PROVIDER } from '../payments/payments.constants';
import { PaymentProvider } from '../payments/interfaces/payment-provider.interface';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';

const STAFF_ROLES: Role[] = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];

const TIER_LABELS: Record<'PRO' | 'UNLIMITED', string> = {
  PRO: 'Landlord Pro',
  UNLIMITED: 'Landlord Unlimited',
};

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig>,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  private assertLandlord(actor: AuthenticatedUser): void {
    if (actor.role !== Role.LANDLORD && !STAFF_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only landlords can manage a subscription');
    }
  }

  private feeCentsFor(tier: 'PRO' | 'UNLIMITED'): number {
    return tier === 'PRO'
      ? (this.configService.get('landlordProFeeCents', { infer: true }) as number)
      : (this.configService.get('landlordUnlimitedFeeCents', { infer: true }) as number);
  }

  async getOrCreateMine(actor: AuthenticatedUser): Promise<SubscriptionResponseDto> {
    this.assertLandlord(actor);
    const sub = await this.prisma.landlordSubscription.upsert({
      where: { userId: actor.id },
      update: {},
      create: { userId: actor.id },
    });
    return SubscriptionResponseDto.from(sub);
  }

  async createCheckout(actor: AuthenticatedUser, tier: 'PRO' | 'UNLIMITED'): Promise<SubscriptionResponseDto> {
    this.assertLandlord(actor);
    const feeCents = this.feeCentsFor(tier);
    const dashboardBaseUrl = this.configService.get('dashboardBaseUrl', { infer: true });

    const sub = await this.prisma.landlordSubscription.upsert({
      where: { userId: actor.id },
      update: {},
      create: { userId: actor.id },
    });

    const checkout = await this.paymentProvider.createCheckout({
      amountCents: feeCents,
      description: `${TIER_LABELS[tier]} subscription — 30 days`,
      referenceId: sub.id,
      redirectUrl: `${dashboardBaseUrl}/pricing?subscriptionPaid=1`,
    });

    const updated = await this.prisma.landlordSubscription.update({
      where: { id: sub.id },
      data: {
        pendingTier: tier as SubscriptionTier,
        paymentProviderCheckoutId: checkout.providerCheckoutId,
        paymentOrderId: checkout.providerOrderId,
        checkoutUrl: checkout.checkoutUrl,
      },
    });
    return SubscriptionResponseDto.from(updated);
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

    const sub = await this.prisma.landlordSubscription.findFirst({
      where: { paymentOrderId: event.providerOrderId, pendingTier: { not: null } },
    });
    if (!sub || !sub.pendingTier) {
      return;
    }

    const periodDays = this.configService.get('paidPeriodDays', { infer: true }) as number;
    await this.prisma.landlordSubscription.update({
      where: { id: sub.id },
      data: {
        tier: sub.pendingTier,
        expiresAt: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
        pendingTier: null,
      },
    });
  }
}
