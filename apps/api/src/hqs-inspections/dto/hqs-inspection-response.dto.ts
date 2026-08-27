import { HqsInspectionStatus } from '@prisma/client';

export class HqsInspectionResponseDto {
  id!: string;
  propertyId!: string;
  feeCents!: number;
  status!: HqsInspectionStatus;
  checkoutUrl!: string | null;
  paidAt!: Date | null;
  preferredDateNote!: string | null;
  requestedAt!: Date | null;
  emailSent!: boolean;
  createdAt!: Date;

  static from(req: {
    id: string;
    propertyId: string;
    feeCents: number;
    status: HqsInspectionStatus;
    checkoutUrl: string | null;
    paidAt: Date | null;
    preferredDateNote: string | null;
    requestedAt: Date | null;
    emailSent: boolean;
    createdAt: Date;
  }): HqsInspectionResponseDto {
    const dto = new HqsInspectionResponseDto();
    dto.id = req.id;
    dto.propertyId = req.propertyId;
    dto.feeCents = req.feeCents;
    dto.status = req.status;
    dto.checkoutUrl = req.checkoutUrl;
    dto.paidAt = req.paidAt;
    dto.preferredDateNote = req.preferredDateNote;
    dto.requestedAt = req.requestedAt;
    dto.emailSent = req.emailSent;
    dto.createdAt = req.createdAt;
    return dto;
  }
}
