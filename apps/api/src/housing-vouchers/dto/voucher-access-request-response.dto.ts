import { VoucherAccessStatus } from '@prisma/client';

export class VoucherAccessRequestResponseDto {
  id!: string | null;
  conversationId!: string;
  propertyTitle!: string;
  landlordDisplayName!: string;
  tenantDisplayName!: string;
  status!: VoucherAccessStatus | null;
  message!: string | null;
  createdAt!: Date | null;
  respondedAt!: Date | null;

  static from(request: {
    id: string;
    conversationId: string;
    status: VoucherAccessStatus;
    message: string | null;
    createdAt: Date;
    respondedAt: Date | null;
    conversation?: {
      property?: { title: string };
      landlord?: { profile?: { displayName: string } | null };
      tenant?: { profile?: { displayName: string } | null };
    };
  }): VoucherAccessRequestResponseDto {
    const dto = new VoucherAccessRequestResponseDto();
    dto.id = request.id;
    dto.conversationId = request.conversationId;
    dto.propertyTitle = request.conversation?.property?.title ?? '';
    dto.landlordDisplayName = request.conversation?.landlord?.profile?.displayName ?? 'Landlord';
    dto.tenantDisplayName = request.conversation?.tenant?.profile?.displayName ?? 'Tenant';
    dto.status = request.status;
    dto.message = request.message;
    dto.createdAt = request.createdAt;
    dto.respondedAt = request.respondedAt;
    return dto;
  }

  static none(conversationId: string): VoucherAccessRequestResponseDto {
    const dto = new VoucherAccessRequestResponseDto();
    dto.id = null;
    dto.conversationId = conversationId;
    dto.propertyTitle = '';
    dto.landlordDisplayName = '';
    dto.tenantDisplayName = '';
    dto.status = null;
    dto.message = null;
    dto.createdAt = null;
    dto.respondedAt = null;
    return dto;
  }
}
