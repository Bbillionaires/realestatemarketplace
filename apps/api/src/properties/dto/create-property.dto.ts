import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

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
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_00)
  monthlyRentCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_00)
  depositCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  petPolicy?: string;
}
