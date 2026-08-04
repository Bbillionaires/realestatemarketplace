import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitIdSubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
