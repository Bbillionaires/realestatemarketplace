import { IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateSponsoredJobListingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  employerName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  location!: string;

  // Required (unlike an organic referral's optional applyUrl) — a paid ad
  // needs somewhere to send the clicks it's charging for.
  @IsUrl()
  @MaxLength(500)
  applyUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactInfo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsInt()
  @Min(25)
  @Max(2000)
  costPerClickCents!: number;

  @IsInt()
  @Min(500)
  @Max(100_000)
  monthlyFeeCents!: number;

  @IsInt()
  @Min(100)
  @Max(100_000)
  initialBudgetCents!: number;
}
