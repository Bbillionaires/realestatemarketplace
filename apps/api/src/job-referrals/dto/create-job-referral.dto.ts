import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateJobReferralDto {
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

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  applyUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactInfo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
