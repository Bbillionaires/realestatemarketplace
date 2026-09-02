export class MilestoneResponseDto {
  id!: string;
  label!: string;
  sortOrder!: number;
  isActive!: boolean;

  static from(milestone: { id: string; label: string; sortOrder: number; isActive: boolean }): MilestoneResponseDto {
    const dto = new MilestoneResponseDto();
    Object.assign(dto, milestone);
    return dto;
  }
}
