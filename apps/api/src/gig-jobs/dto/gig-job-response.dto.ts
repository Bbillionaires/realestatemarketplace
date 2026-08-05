import { GigJobStatus, Role } from '@prisma/client';

export class GigJobResponseDto {
  id!: string;
  posterId!: string;
  posterDisplayName!: string;
  posterRole!: Role;
  propertyId!: string | null;
  propertyTitle!: string | null;
  title!: string;
  description!: string;
  payoutCents!: number;
  status!: GigJobStatus;
  claimedById!: string | null;
  claimedAt!: Date | null;
  completedAt!: Date | null;
  confirmedAt!: Date | null;
  cancelledAt!: Date | null;
  checkoutUrl!: string | null;
  createdAt!: Date;

  static from(job: {
    id: string;
    posterId: string;
    poster?: { profile?: { displayName: string } | null } | null;
    posterRole: Role;
    propertyId: string | null;
    property?: { title: string } | null;
    title: string;
    description: string;
    payoutCents: number;
    status: GigJobStatus;
    claimedById: string | null;
    claimedAt: Date | null;
    completedAt: Date | null;
    confirmedAt: Date | null;
    cancelledAt: Date | null;
    checkoutUrl: string | null;
    createdAt: Date;
  }): GigJobResponseDto {
    const dto = new GigJobResponseDto();
    dto.id = job.id;
    dto.posterId = job.posterId;
    dto.posterDisplayName = job.poster?.profile?.displayName ?? 'Platform';
    dto.posterRole = job.posterRole;
    dto.propertyId = job.propertyId;
    dto.propertyTitle = job.property?.title ?? null;
    dto.title = job.title;
    dto.description = job.description;
    dto.payoutCents = job.payoutCents;
    dto.status = job.status;
    dto.claimedById = job.claimedById;
    dto.claimedAt = job.claimedAt;
    dto.completedAt = job.completedAt;
    dto.confirmedAt = job.confirmedAt;
    dto.cancelledAt = job.cancelledAt;
    dto.checkoutUrl = job.checkoutUrl;
    dto.createdAt = job.createdAt;
    return dto;
  }
}
