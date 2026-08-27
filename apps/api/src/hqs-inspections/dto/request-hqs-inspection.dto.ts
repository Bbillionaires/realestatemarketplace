import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestHqsInspectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  preferredDateNote?: string;
}
