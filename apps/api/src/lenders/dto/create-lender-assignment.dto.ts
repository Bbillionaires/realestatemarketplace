import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { LenderAccessTier } from '@prisma/client';

const ACCESS_TIERS = Object.values(LenderAccessTier);

export class CreateLenderAssignmentDto {
  @IsUUID()
  propertyId!: string;

  @IsUUID()
  lenderId!: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsIn(ACCESS_TIERS)
  accessTier?: LenderAccessTier;
}
