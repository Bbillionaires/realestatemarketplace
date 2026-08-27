import { TenantPacketStatus } from '@prisma/client';

export class TenantPacketResponseDto {
  id!: string | null;
  feeCents!: number;
  status!: TenantPacketStatus;
  checkoutUrl!: string | null;
  paidAt!: Date | null;
  incomeProofFileName!: string | null;
  backgroundExplanation!: string | null;
  references!: string | null;
  submittedAt!: Date | null;

  static from(packet: {
    id: string;
    feeCents: number;
    status: TenantPacketStatus;
    checkoutUrl: string | null;
    paidAt: Date | null;
    incomeProofFileName: string | null;
    backgroundExplanation: string | null;
    references: string | null;
    submittedAt: Date | null;
  }): TenantPacketResponseDto {
    const dto = new TenantPacketResponseDto();
    dto.id = packet.id;
    dto.feeCents = packet.feeCents;
    dto.status = packet.status;
    dto.checkoutUrl = packet.checkoutUrl;
    dto.paidAt = packet.paidAt;
    dto.incomeProofFileName = packet.incomeProofFileName;
    dto.backgroundExplanation = packet.backgroundExplanation;
    dto.references = packet.references;
    dto.submittedAt = packet.submittedAt;
    return dto;
  }

  /** Shape returned for a tenant who has never started a packet — no row exists yet. */
  static notStarted(feeCents: number): TenantPacketResponseDto {
    const dto = new TenantPacketResponseDto();
    dto.id = null;
    dto.feeCents = feeCents;
    dto.status = 'NOT_STARTED';
    dto.checkoutUrl = null;
    dto.paidAt = null;
    dto.incomeProofFileName = null;
    dto.backgroundExplanation = null;
    dto.references = null;
    dto.submittedAt = null;
    return dto;
  }
}
