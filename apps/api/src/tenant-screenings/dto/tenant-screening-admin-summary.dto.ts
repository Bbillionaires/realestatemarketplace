import { TenantScreeningKind, TenantScreeningStatus } from '@prisma/client';

export class TenantScreeningAdminSummaryDto {
  id!: string;
  kind!: TenantScreeningKind;
  status!: TenantScreeningStatus;
  tenantId!: string;
  tenantEmail!: string;
  tenantDisplayName!: string | null;
  initiatedById!: string | null;
  initiatedByEmail!: string | null;
  conversationId!: string | null;
  feeCents!: number;
  paidAt!: Date | null;
  resultFileName!: string | null;
  resultUploadedAt!: Date | null;
  staffNotes!: string | null;
  createdAt!: Date;

  static from(row: {
    id: string;
    kind: TenantScreeningKind;
    status: TenantScreeningStatus;
    tenantId: string;
    feeCents: number;
    paidAt: Date | null;
    conversationId: string | null;
    initiatedById: string | null;
    resultFileName: string | null;
    resultUploadedAt: Date | null;
    staffNotes: string | null;
    createdAt: Date;
    tenant: { email: string; profile: { displayName: string } | null };
    initiatedBy: { email: string } | null;
  }): TenantScreeningAdminSummaryDto {
    const dto = new TenantScreeningAdminSummaryDto();
    dto.id = row.id;
    dto.kind = row.kind;
    dto.status = row.status;
    dto.tenantId = row.tenantId;
    dto.tenantEmail = row.tenant.email;
    dto.tenantDisplayName = row.tenant.profile?.displayName ?? null;
    dto.initiatedById = row.initiatedById;
    dto.initiatedByEmail = row.initiatedBy?.email ?? null;
    dto.conversationId = row.conversationId;
    dto.feeCents = row.feeCents;
    dto.paidAt = row.paidAt;
    dto.resultFileName = row.resultFileName;
    dto.resultUploadedAt = row.resultUploadedAt;
    dto.staffNotes = row.staffNotes;
    dto.createdAt = row.createdAt;
    return dto;
  }
}
