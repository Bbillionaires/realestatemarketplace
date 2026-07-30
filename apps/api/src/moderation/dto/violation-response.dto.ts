import { DetectionMethod, ViolationAction, ViolationType } from '@prisma/client';

export class ViolationResponseDto {
  id!: string;
  conversationId!: string;
  messageId!: string;
  violationType!: ViolationType;
  detectionMethod!: DetectionMethod;
  confidenceScore!: number;
  actionTaken!: ViolationAction;
  createdAt!: Date;

  static from(violation: {
    id: string;
    conversationId: string;
    messageId: string;
    violationType: ViolationType;
    detectionMethod: DetectionMethod;
    confidenceScore: number;
    actionTaken: ViolationAction;
    createdAt: Date;
  }): ViolationResponseDto {
    const dto = new ViolationResponseDto();
    dto.id = violation.id;
    dto.conversationId = violation.conversationId;
    dto.messageId = violation.messageId;
    dto.violationType = violation.violationType;
    dto.detectionMethod = violation.detectionMethod;
    dto.confidenceScore = violation.confidenceScore;
    dto.actionTaken = violation.actionTaken;
    dto.createdAt = violation.createdAt;
    return dto;
  }
}
