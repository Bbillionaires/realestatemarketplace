import { JobReferralPendingOperation, JobReferralStatus, Role } from '@prisma/client';

export class JobReferralResponseDto {
  id!: string;
  posterId!: string;
  posterDisplayName!: string;
  posterRole!: Role;
  title!: string;
  employerName!: string;
  location!: string;
  applyUrl!: string | null;
  contactInfo!: string | null;
  description!: string | null;
  status!: JobReferralStatus;
  closedAt!: Date | null;
  createdAt!: Date;

  // Sponsored (paid) listings only.
  sponsored!: boolean;
  costPerClickCents!: number | null;
  monthlyFeeCents!: number | null;
  budgetRemainingCents!: number;
  clickCount!: number;
  currentPeriodEnd!: Date | null;
  pendingOperation!: JobReferralPendingOperation | null;
  checkoutUrl!: string | null;

  static from(referral: {
    id: string;
    posterId: string;
    poster?: { profile?: { displayName: string } | null } | null;
    posterRole: Role;
    title: string;
    employerName: string;
    location: string;
    applyUrl: string | null;
    contactInfo: string | null;
    description: string | null;
    status: JobReferralStatus;
    closedAt: Date | null;
    createdAt: Date;
    sponsored: boolean;
    costPerClickCents: number | null;
    monthlyFeeCents: number | null;
    budgetRemainingCents: number;
    clickCount: number;
    currentPeriodEnd: Date | null;
    pendingOperation: JobReferralPendingOperation | null;
    checkoutUrl: string | null;
  }): JobReferralResponseDto {
    const dto = new JobReferralResponseDto();
    dto.id = referral.id;
    dto.posterId = referral.posterId;
    dto.posterDisplayName = referral.poster?.profile?.displayName ?? 'Platform';
    dto.posterRole = referral.posterRole;
    dto.title = referral.title;
    dto.employerName = referral.employerName;
    dto.location = referral.location;
    dto.applyUrl = referral.applyUrl;
    dto.contactInfo = referral.contactInfo;
    dto.description = referral.description;
    dto.status = referral.status;
    dto.closedAt = referral.closedAt;
    dto.createdAt = referral.createdAt;
    dto.sponsored = referral.sponsored;
    dto.costPerClickCents = referral.costPerClickCents;
    dto.monthlyFeeCents = referral.monthlyFeeCents;
    dto.budgetRemainingCents = referral.budgetRemainingCents;
    dto.clickCount = referral.clickCount;
    dto.currentPeriodEnd = referral.currentPeriodEnd;
    dto.pendingOperation = referral.pendingOperation;
    dto.checkoutUrl = referral.checkoutUrl ?? null;
    return dto;
  }
}
