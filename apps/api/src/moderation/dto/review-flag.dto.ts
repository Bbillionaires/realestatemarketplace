import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ModerationStatus } from '@prisma/client';

const REVIEWABLE_STATUSES = [ModerationStatus.UNDER_REVIEW, ModerationStatus.CLEARED, ModerationStatus.BLOCKED];

export class ReviewFlagDto {
  @IsEnum(REVIEWABLE_STATUSES)
  status!: ModerationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
