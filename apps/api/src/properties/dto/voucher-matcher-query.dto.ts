import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class VoucherMatcherQueryDto {
  @IsString()
  @MinLength(5)
  @MaxLength(10)
  zip!: string;

  // 0 = studio, 6 = "6 or more" — matches the range Jacksonville Housing
  // Authority publishes its own payment standards for (HUD's own nationwide
  // FMR schedule stops at 4, but JaxHA's local SAFMR table extends further
  // for larger voucher households).
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  bedrooms!: number;
}
