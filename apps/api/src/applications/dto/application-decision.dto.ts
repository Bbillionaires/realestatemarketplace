import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplicationDecisionDto {
  @IsIn(['APPROVED', 'DENIED'])
  decision!: 'APPROVED' | 'DENIED';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
