import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitLenderRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  responseNote?: string;
}
