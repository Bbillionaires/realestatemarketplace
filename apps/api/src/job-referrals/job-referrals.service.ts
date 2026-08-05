import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobReferralPendingOperation, JobReferralStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PAYMENT_PROVIDER } from '../payments/payments.constants';
import { PaymentProvider } from '../payments/interfaces/payment-provider.interface';
import { CreateJobReferralDto } from './dto/create-job-referral.dto';
import { CreateSponsoredJobListingDto } from './dto/create-sponsored-job-listing.dto';
import { TopUpJobListingDto } from './dto/topup-job-listing.dto';
import { JobReferralResponseDto } from './dto/job-referral-response.dto';

const TENANT_ROLES: Role[] = [Role.PROSPECTIVE_TENANT, Role.CURRENT_TENANT];
const OWN_TENANT_SCOPED_ROLES: Role[] = [Role.LANDLORD, Role.PROPERTY_MANAGER];
const PLATFORM_ROLES: Role[] = [Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];
const SPONSOR_ROLES: Role[] = [Role.EMPLOYER, ...PLATFORM_ROLES];

const BILLING_PERIOD_DAYS = 30;

const REFERRAL_INCLUDE = {
  poster: { select: { profile: { select: { displayName: true } } } },
} as const;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function todayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Word of a real, external job opening a landlord/manager/admin has no
 * control over and isn't paying for — deliberately kept separate from
 * GigJob (which involves real money and the poster's own liability for the
 * work site). Visibility scoping mirrors GigJob exactly (own tenants via
 * an existing Conversation, or platform-wide for admins) since the
 * "who should see this" question is the same; nothing else about it is.
 *
 * This same model also carries `sponsored` listings: a self-serve, prepaid
 * advertisement an EMPLOYER (or admin, on an employer's behalf) pays the
 * platform to run, billed per click against a prepaid budget plus a small
 * recurring monthly fee. Unlike an organic referral, a sponsored listing
 * bypasses own-tenant scoping entirely and shows to every tenant on the
 * platform — that reach is exactly what the employer is paying for.
 */
@Injectable()
export class JobReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig>,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateJobReferralDto): Promise<JobReferralResponseDto> {
    if (!OWN_TENANT_SCOPED_ROLES.includes(actor.role) && !PLATFORM_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only landlords, property managers, or admins can post a job referral');
    }

    const referral = await this.prisma.jobReferral.create({
      data: {
        posterId: actor.id,
        posterRole: actor.role,
        title: dto.title,
        employerName: dto.employerName,
        location: dto.location,
        applyUrl: dto.applyUrl,
        contactInfo: dto.contactInfo,
        description: dto.description,
      },
      include: REFERRAL_INCLUDE,
    });
    return JobReferralResponseDto.from(referral);
  }

  async createSponsored(actor: AuthenticatedUser, dto: CreateSponsoredJobListingDto): Promise<JobReferralResponseDto> {
    if (!SPONSOR_ROLES.includes(actor.role)) {
      throw new ForbiddenException("Only employer accounts (or admins, on an employer's behalf) can create a sponsored listing");
    }
    if (dto.initialBudgetCents < dto.costPerClickCents) {
      throw new BadRequestException('The initial budget must cover at least one click at the chosen cost-per-click');
    }

    const referral = await this.prisma.jobReferral.create({
      data: {
        posterId: actor.id,
        posterRole: actor.role,
        title: dto.title,
        employerName: dto.employerName,
        location: dto.location,
        applyUrl: dto.applyUrl,
        contactInfo: dto.contactInfo,
        description: dto.description,
        status: JobReferralStatus.PENDING_PAYMENT,
        sponsored: true,
        costPerClickCents: dto.costPerClickCents,
        monthlyFeeCents: dto.monthlyFeeCents,
        pendingOperation: JobReferralPendingOperation.ACTIVATE,
        pendingBudgetCents: dto.initialBudgetCents,
      },
      include: REFERRAL_INCLUDE,
    });

    const dashboardBaseUrl = this.configService.get('dashboardBaseUrl', { infer: true });
    const checkout = await this.paymentProvider.createCheckout({
      amountCents: dto.monthlyFeeCents + dto.initialBudgetCents,
      description: `Sponsored job listing — ${dto.title}`,
      referenceId: referral.id,
      redirectUrl: `${dashboardBaseUrl}/gig-jobs?sponsored=1`,
    });

    const updated = await this.prisma.jobReferral.update({
      where: { id: referral.id },
      data: {
        paymentProviderCheckoutId: checkout.providerCheckoutId,
        paymentOrderId: checkout.providerOrderId,
        checkoutUrl: checkout.checkoutUrl,
      },
      include: REFERRAL_INCLUDE,
    });
    return JobReferralResponseDto.from(updated);
  }

  async topUp(actor: AuthenticatedUser, id: string, dto: TopUpJobListingDto): Promise<JobReferralResponseDto> {
    const referral = await this.requireOwnSponsoredListing(actor, id);
    const dashboardBaseUrl = this.configService.get('dashboardBaseUrl', { infer: true });
    const checkout = await this.paymentProvider.createCheckout({
      amountCents: dto.additionalBudgetCents,
      description: `Ad budget top-up — ${referral.title}`,
      referenceId: referral.id,
      redirectUrl: `${dashboardBaseUrl}/gig-jobs?sponsored=1`,
    });

    const updated = await this.prisma.jobReferral.update({
      where: { id },
      data: {
        pendingOperation: JobReferralPendingOperation.TOPUP,
        pendingBudgetCents: dto.additionalBudgetCents,
        paymentProviderCheckoutId: checkout.providerCheckoutId,
        paymentOrderId: checkout.providerOrderId,
        checkoutUrl: checkout.checkoutUrl,
      },
      include: REFERRAL_INCLUDE,
    });
    return JobReferralResponseDto.from(updated);
  }

  async renew(actor: AuthenticatedUser, id: string): Promise<JobReferralResponseDto> {
    const referral = await this.requireOwnSponsoredListing(actor, id);
    const dashboardBaseUrl = this.configService.get('dashboardBaseUrl', { infer: true });
    const checkout = await this.paymentProvider.createCheckout({
      amountCents: referral.monthlyFeeCents!,
      description: `Monthly listing fee — ${referral.title}`,
      referenceId: referral.id,
      redirectUrl: `${dashboardBaseUrl}/gig-jobs?sponsored=1`,
    });

    const updated = await this.prisma.jobReferral.update({
      where: { id },
      data: {
        pendingOperation: JobReferralPendingOperation.RENEW,
        pendingBudgetCents: 0,
        paymentProviderCheckoutId: checkout.providerCheckoutId,
        paymentOrderId: checkout.providerOrderId,
        checkoutUrl: checkout.checkoutUrl,
      },
      include: REFERRAL_INCLUDE,
    });
    return JobReferralResponseDto.from(updated);
  }

  private async requireOwnSponsoredListing(actor: AuthenticatedUser, id: string) {
    const referral = await this.prisma.jobReferral.findUnique({ where: { id } });
    if (!referral || !referral.sponsored) {
      throw new NotFoundException('Sponsored listing not found');
    }
    if (referral.posterId !== actor.id) {
      throw new ForbiddenException('Only the poster can manage this sponsored listing');
    }
    if (referral.status === JobReferralStatus.CLOSED) {
      throw new BadRequestException('This sponsored listing has been closed');
    }
    if (referral.pendingOperation) {
      throw new BadRequestException('This sponsored listing already has a payment in progress');
    }
    return referral;
  }

  async listVisibleToTenant(actor: AuthenticatedUser): Promise<JobReferralResponseDto[]> {
    if (!TENANT_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only tenants can browse job referrals');
    }

    const myConversations = await this.prisma.conversation.findMany({
      where: { tenantId: actor.id },
      select: { landlordId: true },
      distinct: ['landlordId'],
    });
    const myLandlordIds = myConversations.map((c) => c.landlordId);
    const now = new Date();

    const referrals = await this.prisma.jobReferral.findMany({
      where: {
        OR: [
          { sponsored: false, status: JobReferralStatus.ACTIVE, posterRole: { in: PLATFORM_ROLES } },
          { sponsored: false, status: JobReferralStatus.ACTIVE, posterId: { in: myLandlordIds } },
          {
            sponsored: true,
            status: JobReferralStatus.ACTIVE,
            currentPeriodEnd: { gt: now },
            budgetRemainingCents: { gt: 0 },
          },
        ],
      },
      include: REFERRAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    // budgetRemainingCents > 0 above is a coarse pre-filter (Prisma can't
    // compare two columns against each other in a single query); the
    // precise "can this listing actually afford one more click" check
    // happens here.
    const eligible = referrals.filter((r) => !r.sponsored || r.budgetRemainingCents >= (r.costPerClickCents ?? 0));
    return eligible.map((r) => JobReferralResponseDto.from(r));
  }

  async listPosted(actor: AuthenticatedUser): Promise<JobReferralResponseDto[]> {
    const referrals = await this.prisma.jobReferral.findMany({
      where: { posterId: actor.id },
      include: REFERRAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return referrals.map((r) => JobReferralResponseDto.from(r));
  }

  async close(actor: AuthenticatedUser, id: string): Promise<JobReferralResponseDto> {
    const referral = await this.prisma.jobReferral.findUnique({ where: { id } });
    if (!referral) {
      throw new NotFoundException('Job referral not found');
    }
    if (referral.posterId !== actor.id) {
      throw new ForbiddenException('Only the poster can close this job referral');
    }
    if (referral.status === JobReferralStatus.CLOSED) {
      throw new BadRequestException('This job referral is already closed');
    }

    const updated = await this.prisma.jobReferral.update({
      where: { id },
      data: { status: JobReferralStatus.CLOSED, closedAt: new Date() },
      include: REFERRAL_INCLUDE,
    });
    return JobReferralResponseDto.from(updated);
  }

  /**
   * Records (and, if the day's budget allows it, bills) a tenant's click
   * on a sponsored listing's apply link. Always returns the apply URL —
   * running out of budget is the employer's problem, never a reason to
   * block the tenant from applying.
   */
  async registerClick(actor: AuthenticatedUser, id: string): Promise<{ applyUrl: string }> {
    if (!TENANT_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only tenants can click through a sponsored listing');
    }
    const referral = await this.prisma.jobReferral.findUnique({ where: { id } });
    if (!referral || !referral.sponsored) {
      throw new NotFoundException('Sponsored listing not found');
    }
    if (referral.status !== JobReferralStatus.ACTIVE) {
      throw new BadRequestException('This sponsored listing is not currently active');
    }
    if (!referral.currentPeriodEnd || referral.currentPeriodEnd <= new Date()) {
      throw new BadRequestException("This sponsored listing's billing period has ended");
    }

    const clickDate = todayKey(new Date());
    try {
      await this.prisma.jobReferralClick.create({
        data: { jobReferralId: id, tenantId: actor.id, clickDate },
      });
    } catch {
      // Unique constraint hit — this tenant already clicked today. Not
      // billed again, but still let them through to the apply link.
      return { applyUrl: referral.applyUrl! };
    }

    // Atomic conditional decrement: only actually bills if the budget still
    // covers one click at the moment this runs, so two concurrent clicks
    // can't both succeed against the last few cents of budget.
    await this.prisma.jobReferral.updateMany({
      where: { id, budgetRemainingCents: { gte: referral.costPerClickCents! } },
      data: {
        budgetRemainingCents: { decrement: referral.costPerClickCents! },
        clickCount: { increment: 1 },
      },
    });

    return { applyUrl: referral.applyUrl! };
  }

  /** Returns true if this webhook's order belonged to a job referral (handled or not), so the caller knows not to try other handlers. */
  async handlePaymentWebhook(signature: string, url: string, rawBody: string): Promise<boolean> {
    const valid = this.paymentProvider.validateWebhook({ signature, url, rawBody });
    if (!valid) {
      return false;
    }
    const event = this.paymentProvider.parseWebhookEvent(rawBody);
    if (!event) {
      return false;
    }

    const referral = await this.prisma.jobReferral.findFirst({
      where: { paymentOrderId: event.providerOrderId, sponsored: true },
    });
    if (!referral || !referral.pendingOperation) {
      return false;
    }
    if (!event.paid) {
      return true;
    }

    const now = new Date();
    const pendingBudget = referral.pendingBudgetCents ?? 0;

    if (referral.status === JobReferralStatus.CLOSED) {
      // Payment for a listing the poster already cancelled — acknowledge
      // and clear the pending operation, but never resurrect it.
      await this.prisma.jobReferral.update({
        where: { id: referral.id },
        data: { pendingOperation: null, pendingBudgetCents: null },
      });
      return true;
    }

    if (referral.pendingOperation === JobReferralPendingOperation.ACTIVATE) {
      await this.prisma.jobReferral.update({
        where: { id: referral.id },
        data: {
          status: JobReferralStatus.ACTIVE,
          budgetRemainingCents: pendingBudget,
          currentPeriodEnd: addDays(now, BILLING_PERIOD_DAYS),
          pendingOperation: null,
          pendingBudgetCents: null,
        },
      });
    } else if (referral.pendingOperation === JobReferralPendingOperation.TOPUP) {
      await this.prisma.jobReferral.update({
        where: { id: referral.id },
        data: {
          budgetRemainingCents: { increment: pendingBudget },
          pendingOperation: null,
          pendingBudgetCents: null,
        },
      });
    } else if (referral.pendingOperation === JobReferralPendingOperation.RENEW) {
      const base = referral.currentPeriodEnd && referral.currentPeriodEnd > now ? referral.currentPeriodEnd : now;
      await this.prisma.jobReferral.update({
        where: { id: referral.id },
        data: {
          status: JobReferralStatus.ACTIVE,
          currentPeriodEnd: addDays(base, BILLING_PERIOD_DAYS),
          pendingOperation: null,
          pendingBudgetCents: null,
        },
      });
    }

    return true;
  }
}
