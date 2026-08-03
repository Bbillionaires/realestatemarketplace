import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { LenderAccessTier } from '@prisma/client';

const ACCESS_TIERS = Object.values(LenderAccessTier);

export class UpdateLenderAssignmentDto {
  /** Pass null to clear the current tenant; @IsOptional() skips IsUUID validation for null. */
  @IsOptional()
  @IsUUID()
  tenantId?: string | null;

  @IsOptional()
  @IsIn(ACCESS_TIERS)
  accessTier?: LenderAccessTier;
}
