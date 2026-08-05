import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateGigJobDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  description!: string;

  @IsInt()
  @Min(100)
  @Max(500_00)
  payoutCents!: number;

  @IsOptional()
  @IsString()
  propertyId?: string;
}
