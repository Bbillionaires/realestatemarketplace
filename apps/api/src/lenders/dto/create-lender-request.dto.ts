import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLenderRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
