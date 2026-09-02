import { Role, TenantPacketStatus, TenantScreeningKind, TenantScreeningStatus } from '@prisma/client';

export interface LatestScreeningSummary {
  kind: TenantScreeningKind;
  status: TenantScreeningStatus;
  expiresAt: Date | null;
}

/**
 * One row per registered account for the admin/staff "where is this person in
 * the process" overview. Deliberately presence/status-only — never pulls any
 * binary field (TenantPacket.incomeProofFile, VoucherDocument.fileData,
 * TenantScreening.resultFile), since this endpoint only ever needs to answer
 * yes/no or "what state," not serve a file.
 */
export class RegistrantOverviewDto {
  id!: string;
  email!: string;
  displayName!: string | null;
  role!: Role;
  createdAt!: Date;
  tenantPacketStatus!: TenantPacketStatus | null;
  hasVoucherUpload!: boolean;
  hasSubmittedId!: boolean;
  homeownershipEnrolled!: boolean;
  latestScreening!: LatestScreeningSummary | null;

  static from(user: {
    id: string;
    email: string;
    role: Role;
    createdAt: Date;
    profile: { displayName: string } | null;
    tenantPacket: { status: TenantPacketStatus } | null;
    voucherDocument: { uploadedAt: Date } | null;
    homeownershipProgress: { id: string } | null;
    tenantScreenings: { kind: TenantScreeningKind; status: TenantScreeningStatus; expiresAt: Date | null }[];
    conversationsAsTenant: { idSubmissions: { id: string }[] }[];
  }): RegistrantOverviewDto {
    const dto = new RegistrantOverviewDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.displayName = user.profile?.displayName ?? null;
    dto.role = user.role;
    dto.createdAt = user.createdAt;
    dto.tenantPacketStatus = user.tenantPacket?.status ?? null;
    dto.hasVoucherUpload = user.voucherDocument !== null;
    dto.hasSubmittedId = user.conversationsAsTenant.some((c) => c.idSubmissions.length > 0);
    dto.homeownershipEnrolled = user.homeownershipProgress !== null;
    dto.latestScreening = user.tenantScreenings[0]
      ? {
          kind: user.tenantScreenings[0].kind,
          status: user.tenantScreenings[0].status,
          expiresAt: user.tenantScreenings[0].expiresAt,
        }
      : null;
    return dto;
  }
}
