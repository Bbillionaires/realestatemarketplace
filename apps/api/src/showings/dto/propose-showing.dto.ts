import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ProposeShowingDto {
  @IsDateString()
  startTime!: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  durationMinutes?: number;
}
