import { LenderRequestStatus } from '@prisma/client';

export class LenderRequestResponseDto {
  id!: string;
  lenderAssignmentId!: string;
  propertyId!: string;
  propertyTitle!: string;
  message!: string | null;
  status!: LenderRequestStatus;
  responseNote!: string | null;
  responseFileName!: string | null;
  emailSent!: boolean;
  createdAt!: Date;
  respondedAt!: Date | null;

  static from(request: {
    id: string;
    lenderAssignmentId: string;
    message: string | null;
    status: LenderRequestStatus;
    responseNote: string | null;
    responseFileName: string | null;
    emailSent: boolean;
    createdAt: Date;
    respondedAt: Date | null;
    lenderAssignment?: { propertyId: string; property?: { title: string } };
  }): LenderRequestResponseDto {
    const dto = new LenderRequestResponseDto();
    dto.id = request.id;
    dto.lenderAssignmentId = request.lenderAssignmentId;
    dto.propertyId = request.lenderAssignment?.propertyId ?? '';
    dto.propertyTitle = request.lenderAssignment?.property?.title ?? '';
    dto.message = request.message;
    dto.status = request.status;
    dto.responseNote = request.responseNote;
    dto.responseFileName = request.responseFileName;
    dto.emailSent = request.emailSent;
    dto.createdAt = request.createdAt;
    dto.respondedAt = request.respondedAt;
    return dto;
  }
}
