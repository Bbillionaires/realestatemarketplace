import { DetectionMethod, ModerationStatus, ViolationType } from '@prisma/client';

/**
 * The moderator-facing view of a flag, unlike MessageResponseDto/
 * ConversationResponseDto, deliberately includes the real sender identity
 * (name/role) and the un-redacted original message content — staff
 * reviewing a flag need to see exactly what was written and by whom, which
 * is why every route serving this DTO is staff-only (see moderation-admin
 * guards).
 */
export class ModerationFlagResponseDto {
  id!: string;
  status!: ModerationStatus;
  flagType!: ViolationType;
  detectionMethod!: DetectionMethod;
  confidenceScore!: number;
  createdAt!: Date;
  reviewedAt!: Date | null;
  reviewedByName!: string | null;
  decision!: string | null;
  message!: {
    id: string;
    originalContent: string;
    sanitizedContent: string | null;
    createdAt: Date;
  };
  conversation!: {
    id: string;
    propertyTitle: string;
  };
  flaggedUser!: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    isActive: boolean;
  } | null;

  static from(flag: {
    id: string;
    status: ModerationStatus;
    flagType: ViolationType;
    detectionMethod: DetectionMethod;
    confidenceScore: number;
    createdAt: Date;
    reviewedAt: Date | null;
    reviewedBy?: { profile?: { displayName: string } | null; email: string } | null;
    decision: string | null;
    message: {
      id: string;
      originalContent: string;
      sanitizedContent: string | null;
      createdAt: Date;
      sender?: {
        id: string;
        email: string;
        role: string;
        isActive: boolean;
        profile?: { displayName: string } | null;
      } | null;
    };
    conversation: { id: string; property: { title: string } };
  }): ModerationFlagResponseDto {
    const dto = new ModerationFlagResponseDto();
    dto.id = flag.id;
    dto.status = flag.status;
    dto.flagType = flag.flagType;
    dto.detectionMethod = flag.detectionMethod;
    dto.confidenceScore = flag.confidenceScore;
    dto.createdAt = flag.createdAt;
    dto.reviewedAt = flag.reviewedAt;
    dto.reviewedByName = flag.reviewedBy?.profile?.displayName ?? flag.reviewedBy?.email ?? null;
    dto.decision = flag.decision;
    dto.message = {
      id: flag.message.id,
      originalContent: flag.message.originalContent,
      sanitizedContent: flag.message.sanitizedContent,
      createdAt: flag.message.createdAt,
    };
    dto.conversation = { id: flag.conversation.id, propertyTitle: flag.conversation.property.title };
    dto.flaggedUser = flag.message.sender
      ? {
          id: flag.message.sender.id,
          email: flag.message.sender.email,
          displayName: flag.message.sender.profile?.displayName ?? flag.message.sender.email,
          role: flag.message.sender.role,
          isActive: flag.message.sender.isActive,
        }
      : null;
    return dto;
  }
}
