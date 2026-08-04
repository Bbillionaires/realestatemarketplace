import { IdSubmissionStatus } from '@prisma/client';

export class IdSubmissionResponseDto {
  id!: string;
  conversationId!: string;
  feeCents!: number;
  status!: IdSubmissionStatus;
  checkoutUrl!: string | null;
  paidAt!: Date | null;
  submittedFileName!: string | null;
  emailSent!: boolean;
  submittedAt!: Date | null;
  createdAt!: Date;

  static from(submission: {
    id: string;
    conversationId: string;
    feeCents: number;
    status: IdSubmissionStatus;
    checkoutUrl: string | null;
    paidAt: Date | null;
    submittedFileName: string | null;
    emailSent: boolean;
    submittedAt: Date | null;
    createdAt: Date;
  }): IdSubmissionResponseDto {
    const dto = new IdSubmissionResponseDto();
    dto.id = submission.id;
    dto.conversationId = submission.conversationId;
    dto.feeCents = submission.feeCents;
    dto.status = submission.status;
    dto.checkoutUrl = submission.checkoutUrl;
    dto.paidAt = submission.paidAt;
    dto.submittedFileName = submission.submittedFileName;
    dto.emailSent = submission.emailSent;
    dto.submittedAt = submission.submittedAt;
    dto.createdAt = submission.createdAt;
    return dto;
  }
}
