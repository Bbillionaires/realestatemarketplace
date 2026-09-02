import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVoucherAccessRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
