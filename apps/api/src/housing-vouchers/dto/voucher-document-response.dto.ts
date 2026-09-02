export class VoucherDocumentResponseDto {
  hasDocument!: boolean;
  fileName!: string | null;
  mimeType!: string | null;
  uploadedAt!: Date | null;

  static from(doc: { fileName: string; mimeType: string; uploadedAt: Date }): VoucherDocumentResponseDto {
    const dto = new VoucherDocumentResponseDto();
    dto.hasDocument = true;
    dto.fileName = doc.fileName;
    dto.mimeType = doc.mimeType;
    dto.uploadedAt = doc.uploadedAt;
    return dto;
  }

  static none(): VoucherDocumentResponseDto {
    const dto = new VoucherDocumentResponseDto();
    dto.hasDocument = false;
    dto.fileName = null;
    dto.mimeType = null;
    dto.uploadedAt = null;
    return dto;
  }
}
