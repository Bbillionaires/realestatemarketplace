import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';
import { RestrictionType } from '@prisma/client';

export class ImposeRestrictionDto {
  @IsEnum(RestrictionType)
  type!: RestrictionType;

  @IsString()
  @MaxLength(500)
  reason!: string;

  /** Omit for an indefinite restriction (e.g. a suspension pending review); otherwise hours from now. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8760)
  durationHours?: number;
}
