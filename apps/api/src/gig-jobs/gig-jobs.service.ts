import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GigJobStatus, GigVoucherStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PAYMENT_PROVIDER } from '../payments/payments.constants';
import { PaymentProvider } from '../payments/interfaces/payment-provider.interface';
import { CreateGigJobDto } from './dto/create-gig-job.dto';
import { ClaimGigJobDto } from './dto/claim-gig-job.dto';
import { ApplyGigVoucherDto } from './dto/apply-gig-voucher.dto';
import { GigJobResponseDto } from './dto/gig-job-response.dto';
import { GigVoucherResponseDto } from './dto/gig-voucher-response.dto';

const TENANT_ROLES: Role[] = [Role.PROSPECTIVE_TENANT, Role.CURRENT_TENANT];
const OWN_TENANT_SCOPED_ROLES: Role[] = [Role.LANDLORD, Role.PROPERTY_MANAGER];
const PLATFORM_ROLES: Role[] = [Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];
const STAFF_ROLES: Role[] = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];

const JOB_INCLUDE = {
  poster: { select: { profile: { select: { displayName: true } } } },
  property: { select: { title: true } },
} as const;

const VOUCHER_INCLUDE = {
  gigJob: { select: { title: true } },
  tenant: { select: { profile: { select: { displayName: true } } } },
  landlord: { select: { profile: { select: { displayName: true } } } },
} as const;

@Injectable()
export class GigJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig>,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateGigJobDto): Promise<GigJobResponseDto> {
    const isOwnTenantScoped = OWN_TENANT_SCOPED_ROLES.includes(actor.role);
    const isPlatformWide = PLATFORM_ROLES.includes(actor.role);
    if (!isOwnTenantScoped && !isPlatformWide) {
      throw new ForbiddenException('Only landlords, property managers, or admins can post a gig job');
    }

    if (dto.propertyId) {
      const property = await this.prisma.property.findUnique({ where: { id: dto.propertyId } });
      if (!property) {
        throw new NotFoundException('Property not found');
      }
      if (isOwnTenantScoped) {
        const isOwner = property.ownerId === actor.id;
        const isManager = isOwner
          ? true
          : !!(await this.prisma.propertyManagerAssignment.findFirst({
              where: { propertyId: dto.propertyId, userId: actor.id, revokedAt: null },
            }));
        if (!isOwner && !isManager) {
          throw new ForbiddenException('You do not own or manage this property');
        }
      }
    }

    const job = await this.prisma.gigJob.create({
      data: {
        posterId: actor.id,
        posterRole: actor.role,
        propertyId: dto.propertyId,
        title: dto.title,
        description: dto.description,
        payoutCents: dto.payoutCents,
      },
      include: JOB_INCLUDE,
    });
    return GigJobResponseDto.from(job);
  }

  async listVisibleToTenant(actor: AuthenticatedUser): Promise<GigJobResponseDto[]> {
    if (!TENANT_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only tenants can browse gig jobs');
    }

    const myConversations = await this.prisma.conversation.findMany({
      where: { tenantId: actor.id },
      select: { landlordId: true },
      distinct: ['landlordId'],
    });
    const myLandlordIds = myConversations.map((c) => c.landlordId);

    const jobs = await this.prisma.gigJob.findMany({
      where: {
        OR: [
          { status: GigJobStatus.OPEN, posterRole: { in: PLATFORM_ROLES } },
          { status: GigJobStatus.OPEN, posterId: { in: myLandlordIds } },
          { claimedById: actor.id },
        ],
      },
      include: JOB_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return jobs.map((j) => GigJobResponseDto.from(j));
  }

  async listPosted(actor: AuthenticatedUser): Promise<GigJobResponseDto[]> {
    const jobs = await this.prisma.gigJob.findMany({
      where: { posterId: actor.id },
      include: JOB_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return jobs.map((j) => GigJobResponseDto.from(j));
  }

  async claim(actor: AuthenticatedUser, gigJobId: string, dto: ClaimGigJobDto): Promise<GigJobResponseDto> {
    if (!TENANT_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only tenants can claim a gig job');
    }
    const job = await this.prisma.gigJob.findUnique({ where: { id: gigJobId } });
    if (!job) {
      throw new NotFoundException('Gig job not found');
    }
    if (job.status !== GigJobStatus.OPEN) {
      throw new BadRequestException('This gig job is no longer open');
    }

    const conversation = await this.prisma.conversation.findUnique({ where: { id: dto.conversationId } });
    if (!conversation || conversation.tenantId !== actor.id) {
      throw new ForbiddenException('That conversation does not belong to you');
    }
    if (OWN_TENANT_SCOPED_ROLES.includes(job.posterRole) && conversation.landlordId !== job.posterId) {
      throw new ForbiddenException('This gig job is only open to that landlord/manager\'s own tenants');
    }

    const updated = await this.prisma.gigJob.update({
      where: { id: gigJobId },
      data: {
        status: GigJobStatus.CLAIMED,
        claimedById: actor.id,
        claimedConversationId: dto.conversationId,
        claimedAt: new Date(),
      },
      include: JOB_INCLUDE,
    });
    return GigJobResponseDto.from(updated);
  }

  async markComplete(actor: AuthenticatedUser, gigJobId: string): Promise<GigJobResponseDto> {
    const job = await this.prisma.gigJob.findUnique({ where: { id: gigJobId } });
    if (!job) {
      throw new NotFoundException('Gig job not found');
    }
    if (job.claimedById !== actor.id) {
      throw new ForbiddenException('You have not claimed this gig job');
    }
    if (job.status !== GigJobStatus.CLAIMED) {
      throw new BadRequestException('This gig job is not awaiting completion');
    }

    const updated = await this.prisma.gigJob.update({
      where: { id: gigJobId },
      data: { status: GigJobStatus.COMPLETED, completedAt: new Date() },
      include: JOB_INCLUDE,
    });
    return GigJobResponseDto.from(updated);
  }

  async rejectCompletion(actor: AuthenticatedUser, gigJobId: string): Promise<GigJobResponseDto> {
    const job = await this.prisma.gigJob.findUnique({ where: { id: gigJobId } });
    if (!job) {
      throw new NotFoundException('Gig job not found');
    }
    if (job.posterId !== actor.id) {
      throw new ForbiddenException('Only the poster can reject completion');
    }
    if (job.status !== GigJobStatus.COMPLETED) {
      throw new BadRequestException('This gig job has not been marked complete');
    }

    const updated = await this.prisma.gigJob.update({
      where: { id: gigJobId },
      data: { status: GigJobStatus.CLAIMED, completedAt: null },
      include: JOB_INCLUDE,
    });
    return GigJobResponseDto.from(updated);
  }

  async cancel(actor: AuthenticatedUser, gigJobId: string): Promise<GigJobResponseDto> {
    const job = await this.prisma.gigJob.findUnique({ where: { id: gigJobId } });
    if (!job) {
      throw new NotFoundException('Gig job not found');
    }
    if (job.posterId !== actor.id) {
      throw new ForbiddenException('Only the poster can cancel this gig job');
    }
    if (job.status !== GigJobStatus.OPEN && job.status !== GigJobStatus.CLAIMED) {
      throw new BadRequestException('This gig job can no longer be cancelled');
    }

    const updated = await this.prisma.gigJob.update({
      where: { id: gigJobId },
      data: { status: GigJobStatus.CANCELLED, cancelledAt: new Date() },
      include: JOB_INCLUDE,
    });
    return GigJobResponseDto.from(updated);
  }

  async payAndConfirm(actor: AuthenticatedUser, gigJobId: string): Promise<GigJobResponseDto> {
    const job = await this.prisma.gigJob.findUnique({ where: { id: gigJobId } });
    if (!job) {
      throw new NotFoundException('Gig job not found');
    }
    if (job.posterId !== actor.id) {
      throw new ForbiddenException('Only the poster can pay out this gig job');
    }
    if (job.status !== GigJobStatus.COMPLETED) {
      throw new BadRequestException('This gig job has not been marked complete yet');
    }

    const dashboardBaseUrl = this.configService.get('dashboardBaseUrl', { infer: true });
    const checkout = await this.paymentProvider.createCheckout({
      amountCents: job.payoutCents,
      description: `Gig payout — ${job.title}`,
      referenceId: job.id,
      redirectUrl: `${dashboardBaseUrl}/gig-jobs?paid=1`,
    });

    const updated = await this.prisma.gigJob.update({
      where: { id: gigJobId },
      data: {
        paymentProviderCheckoutId: checkout.providerCheckoutId,
        paymentOrderId: checkout.providerOrderId,
        checkoutUrl: checkout.checkoutUrl,
      },
      include: JOB_INCLUDE,
    });
    return GigJobResponseDto.from(updated);
  }

  /** Returns true if this webhook's order belonged to a gig job (handled or not), so the caller knows not to try other handlers. */
  async handlePaymentWebhook(signature: string, url: string, rawBody: string): Promise<boolean> {
    const valid = this.paymentProvider.validateWebhook({ signature, url, rawBody });
    if (!valid) {
      return false;
    }
    const event = this.paymentProvider.parseWebhookEvent(rawBody);
    if (!event) {
      return false;
    }

    const job = await this.prisma.gigJob.findFirst({
      where: { paymentOrderId: event.providerOrderId, status: GigJobStatus.COMPLETED },
    });
    if (!job) {
      return false;
    }
    if (!event.paid || !job.claimedById || !job.claimedConversationId) {
      return true;
    }

    const conversation = await this.prisma.conversation.findUnique({ where: { id: job.claimedConversationId } });
    if (!conversation) {
      return true;
    }

    const feePercent = this.configService.get('gigJobFeePercent', { infer: true }) as number;
    const feeCents = Math.round((job.payoutCents * feePercent) / 100);
    const voucherCents = job.payoutCents - feeCents;

    await this.prisma.$transaction([
      this.prisma.gigVoucher.create({
        data: {
          gigJobId: job.id,
          tenantId: job.claimedById,
          landlordId: conversation.landlordId,
          payoutCents: job.payoutCents,
          feeCents,
          voucherCents,
        },
      }),
      this.prisma.gigJob.update({
        where: { id: job.id },
        data: { status: GigJobStatus.CONFIRMED, confirmedAt: new Date() },
      }),
    ]);
    return true;
  }

  async listMyVouchers(actor: AuthenticatedUser): Promise<GigVoucherResponseDto[]> {
    const vouchers = await this.prisma.gigVoucher.findMany({
      where: { tenantId: actor.id },
      include: VOUCHER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return vouchers.map((v) => GigVoucherResponseDto.from(v));
  }

  async listIssuedVouchers(actor: AuthenticatedUser): Promise<GigVoucherResponseDto[]> {
    const vouchers = await this.prisma.gigVoucher.findMany({
      where: { landlordId: actor.id },
      include: VOUCHER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return vouchers.map((v) => GigVoucherResponseDto.from(v));
  }

  async applyVoucher(actor: AuthenticatedUser, voucherId: string, dto: ApplyGigVoucherDto): Promise<GigVoucherResponseDto> {
    const voucher = await this.prisma.gigVoucher.findUnique({ where: { id: voucherId } });
    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }
    if (voucher.landlordId !== actor.id && !STAFF_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only the landlord this voucher is earmarked for can apply it');
    }
    if (voucher.status !== GigVoucherStatus.ISSUED) {
      throw new BadRequestException('This voucher has already been applied');
    }

    const updated = await this.prisma.gigVoucher.update({
      where: { id: voucherId },
      data: { status: GigVoucherStatus.APPLIED, appliedAt: new Date(), appliedNote: dto.note },
      include: VOUCHER_INCLUDE,
    });
    return GigVoucherResponseDto.from(updated);
  }
}
