import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class VoucherMatcherQueryDto {
  @IsString()
  @MinLength(5)
  @MaxLength(10)
  zip!: string;

  // 0 = studio, 4 = "4 or more" — matches how HUD's own FMR tables stop at 4.
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  bedrooms!: number;
}
