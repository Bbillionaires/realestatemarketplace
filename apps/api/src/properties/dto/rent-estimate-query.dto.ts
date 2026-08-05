import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class RentEstimateQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  addressLine1!: string;

  @IsString()
  @MaxLength(100)
  city!: string;

  @IsString()
  @MaxLength(50)
  state!: string;

  @IsString()
  @MaxLength(20)
  zip!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  bedrooms?: number;
}
