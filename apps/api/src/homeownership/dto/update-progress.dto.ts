import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateProgressDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_00)
  savingsGoalCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_00)
  currentSavingsCents?: number;
}
