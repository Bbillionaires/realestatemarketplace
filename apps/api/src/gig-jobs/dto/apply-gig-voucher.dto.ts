import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplyGigVoucherDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
