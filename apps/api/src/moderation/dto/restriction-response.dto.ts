import { RestrictionType } from '@prisma/client';

export class RestrictionResponseDto {
  id!: string;
  userId!: string;
  type!: RestrictionType;
  reason!: string;
  imposedByName!: string | null;
  startsAt!: Date;
  endsAt!: Date | null;
  liftedAt!: Date | null;
  isActive!: boolean;

  static from(restriction: {
    id: string;
    userId: string;
    type: RestrictionType;
    reason: string;
    imposedBy?: { profile?: { displayName: string } | null; email: string } | null;
    startsAt: Date;
    endsAt: Date | null;
    liftedAt: Date | null;
  }): RestrictionResponseDto {
    const dto = new RestrictionResponseDto();
    dto.id = restriction.id;
    dto.userId = restriction.userId;
    dto.type = restriction.type;
    dto.reason = restriction.reason;
    dto.imposedByName = restriction.imposedBy?.profile?.displayName ?? restriction.imposedBy?.email ?? null;
    dto.startsAt = restriction.startsAt;
    dto.endsAt = restriction.endsAt;
    dto.liftedAt = restriction.liftedAt;
    dto.isActive = !restriction.liftedAt && (!restriction.endsAt || restriction.endsAt > new Date());
    return dto;
  }
}
