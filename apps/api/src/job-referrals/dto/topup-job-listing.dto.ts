import { IsInt, Max, Min } from 'class-validator';

export class TopUpJobListingDto {
  @IsInt()
  @Min(100)
  @Max(100_000)
  additionalBudgetCents!: number;
}
