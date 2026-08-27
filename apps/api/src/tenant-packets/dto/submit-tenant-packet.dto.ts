import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitTenantPacketDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  backgroundExplanation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  references?: string;
}
