export class ProgressResponseDto {
  savingsGoalCents!: number | null;
  currentSavingsCents!: number | null;
  completedMilestoneIds!: string[];

  static from(progress: {
    savingsGoalCents: number | null;
    currentSavingsCents: number | null;
    completions?: { milestoneId: string }[];
  }): ProgressResponseDto {
    const dto = new ProgressResponseDto();
    dto.savingsGoalCents = progress.savingsGoalCents;
    dto.currentSavingsCents = progress.currentSavingsCents;
    dto.completedMilestoneIds = (progress.completions ?? []).map((c) => c.milestoneId);
    return dto;
  }

  /** Shape returned for a tenant who has never updated their progress — no row exists yet. */
  static empty(): ProgressResponseDto {
    const dto = new ProgressResponseDto();
    dto.savingsGoalCents = null;
    dto.currentSavingsCents = null;
    dto.completedMilestoneIds = [];
    return dto;
  }
}
