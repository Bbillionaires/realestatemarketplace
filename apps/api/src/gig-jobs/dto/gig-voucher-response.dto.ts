import { GigVoucherStatus } from '@prisma/client';

export class GigVoucherResponseDto {
  id!: string;
  gigJobId!: string;
  gigJobTitle!: string;
  tenantId!: string;
  tenantDisplayName!: string;
  landlordId!: string;
  landlordDisplayName!: string;
  payoutCents!: number;
  feeCents!: number;
  voucherCents!: number;
  status!: GigVoucherStatus;
  appliedAt!: Date | null;
  appliedNote!: string | null;
  createdAt!: Date;

  static from(voucher: {
    id: string;
    gigJobId: string;
    gigJob?: { title: string } | null;
    tenantId: string;
    tenant?: { profile?: { displayName: string } | null } | null;
    landlordId: string;
    landlord?: { profile?: { displayName: string } | null } | null;
    payoutCents: number;
    feeCents: number;
    voucherCents: number;
    status: GigVoucherStatus;
    appliedAt: Date | null;
    appliedNote: string | null;
    createdAt: Date;
  }): GigVoucherResponseDto {
    const dto = new GigVoucherResponseDto();
    dto.id = voucher.id;
    dto.gigJobId = voucher.gigJobId;
    dto.gigJobTitle = voucher.gigJob?.title ?? '';
    dto.tenantId = voucher.tenantId;
    dto.tenantDisplayName = voucher.tenant?.profile?.displayName ?? 'Tenant';
    dto.landlordId = voucher.landlordId;
    dto.landlordDisplayName = voucher.landlord?.profile?.displayName ?? 'Landlord';
    dto.payoutCents = voucher.payoutCents;
    dto.feeCents = voucher.feeCents;
    dto.voucherCents = voucher.voucherCents;
    dto.status = voucher.status;
    dto.appliedAt = voucher.appliedAt;
    dto.appliedNote = voucher.appliedNote;
    dto.createdAt = voucher.createdAt;
    return dto;
  }
}
