export class VoucherDocumentAdminSummaryDto {
  tenantId!: string;
  tenantDisplayName!: string;
  tenantEmail!: string;
  fileName!: string;
  mimeType!: string;
  uploadedAt!: Date;

  static from(doc: {
    tenantId: string;
    fileName: string;
    mimeType: string;
    uploadedAt: Date;
    tenant: { email: string; profile: { displayName: string } | null };
  }): VoucherDocumentAdminSummaryDto {
    const dto = new VoucherDocumentAdminSummaryDto();
    dto.tenantId = doc.tenantId;
    dto.tenantDisplayName = doc.tenant.profile?.displayName ?? doc.tenant.email;
    dto.tenantEmail = doc.tenant.email;
    dto.fileName = doc.fileName;
    dto.mimeType = doc.mimeType;
    dto.uploadedAt = doc.uploadedAt;
    return dto;
  }
}
