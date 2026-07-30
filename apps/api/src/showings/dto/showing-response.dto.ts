import { ShowingStatus } from '@prisma/client';

export class ShowingTimeSlotResponseDto {
  id!: string;
  proposedBy!: string;
  startTime!: Date;
  endTime!: Date;
  isSelected!: boolean;
}

export class ShowingResponseDto {
  id!: string;
  conversationId!: string;
  status!: ShowingStatus;
  scheduledAt!: Date | null;
  durationMinutes!: number;
  notes!: string | null;
  createdAt!: Date;
  cancelledAt!: Date | null;
  completedAt!: Date | null;
  timeSlots!: ShowingTimeSlotResponseDto[];

  static from(showing: {
    id: string;
    conversationId: string;
    status: ShowingStatus;
    scheduledAt: Date | null;
    durationMinutes: number;
    notes: string | null;
    createdAt: Date;
    cancelledAt: Date | null;
    completedAt: Date | null;
    timeSlots: { id: string; proposedBy: string; startTime: Date; endTime: Date; isSelected: boolean }[];
  }): ShowingResponseDto {
    const dto = new ShowingResponseDto();
    dto.id = showing.id;
    dto.conversationId = showing.conversationId;
    dto.status = showing.status;
    dto.scheduledAt = showing.scheduledAt;
    dto.durationMinutes = showing.durationMinutes;
    dto.notes = showing.notes;
    dto.createdAt = showing.createdAt;
    dto.cancelledAt = showing.cancelledAt;
    dto.completedAt = showing.completedAt;
    dto.timeSlots = showing.timeSlots.map((s) => ({
      id: s.id,
      proposedBy: s.proposedBy,
      startTime: s.startTime,
      endTime: s.endTime,
      isSelected: s.isSelected,
    }));
    return dto;
  }
}
