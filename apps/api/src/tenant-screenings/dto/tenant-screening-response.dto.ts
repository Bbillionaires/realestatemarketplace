import { TenantScreeningKind, TenantScreeningStatus } from '@prisma/client';

export class TenantScreeningResponseDto {
  id!: string | null;
  kind!: TenantScreeningKind | null;
  status!: TenantScreeningStatus | null;
  conversationId!: string | null;
  initiatedById!: string | null;
  feeCents!: number | null;
  checkoutUrl!: string | null;
  paidAt!: Date | null;
  expiresAt!: Date | null;
  resultFileName!: string | null;
  resultUploadedAt!: Date | null;
  createdAt!: Date | null;

  static from(row: {
    id: string;
    kind: TenantScreeningKind;
    status: TenantScreeningStatus;
    conversationId: string | null;
    initiatedById: string | null;
    feeCents: number;
    checkoutUrl: string | null;
    paidAt: Date | null;
    expiresAt: Date | null;
    resultFileName: string | null;
    resultUploadedAt: Date | null;
    createdAt: Date;
  }): TenantScreeningResponseDto {
    const dto = new TenantScreeningResponseDto();
    dto.id = row.id;
    dto.kind = row.kind;
    dto.status = row.status;
    dto.conversationId = row.conversationId;
    dto.initiatedById = row.initiatedById;
    dto.feeCents = row.feeCents;
    dto.checkoutUrl = row.checkoutUrl;
    dto.paidAt = row.paidAt;
    dto.expiresAt = row.expiresAt;
    dto.resultFileName = row.resultFileName;
    dto.resultUploadedAt = row.resultUploadedAt;
    dto.createdAt = row.createdAt;
    return dto;
  }

  /** No screening exists yet for this conversation. */
  static none(conversationId: string): TenantScreeningResponseDto {
    const dto = new TenantScreeningResponseDto();
    dto.id = null;
    dto.kind = null;
    dto.status = null;
    dto.conversationId = conversationId;
    dto.initiatedById = null;
    dto.feeCents = null;
    dto.checkoutUrl = null;
    dto.paidAt = null;
    dto.expiresAt = null;
    dto.resultFileName = null;
    dto.resultUploadedAt = null;
    dto.createdAt = null;
    return dto;
  }
}
