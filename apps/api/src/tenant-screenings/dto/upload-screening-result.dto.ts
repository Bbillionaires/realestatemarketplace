import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadScreeningResultDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  staffNotes?: string;
}
