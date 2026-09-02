import { TenantPacketStatus } from '@prisma/client';

export class TenantPacketReferenceResponseDto {
  id!: string;
  name!: string;
  phone!: string | null;
  email!: string | null;
  relationship!: string | null;

  static from(reference: { id: string; name: string; phone: string | null; email: string | null; relationship: string | null }): TenantPacketReferenceResponseDto {
    const dto = new TenantPacketReferenceResponseDto();
    Object.assign(dto, reference);
    return dto;
  }
}

export class TenantPacketResponseDto {
  id!: string;
  status!: TenantPacketStatus;
  incomeProofFileName!: string | null;
  backgroundExplanation!: string | null;
  references!: string | null;
  monthlyIncomeCents!: number | null;
  employerName!: string | null;
  referenceContacts!: TenantPacketReferenceResponseDto[];
  submittedAt!: Date | null;

  static from(packet: {
    id: string;
    status: TenantPacketStatus;
    incomeProofFileName: string | null;
    backgroundExplanation: string | null;
    references: string | null;
    monthlyIncomeCents: number | null;
    employerName: string | null;
    referenceContacts?: { id: string; name: string; phone: string | null; email: string | null; relationship: string | null }[];
    submittedAt: Date | null;
  }): TenantPacketResponseDto {
    const dto = new TenantPacketResponseDto();
    dto.id = packet.id;
    dto.status = packet.status;
    dto.incomeProofFileName = packet.incomeProofFileName;
    dto.backgroundExplanation = packet.backgroundExplanation;
    dto.references = packet.references;
    dto.monthlyIncomeCents = packet.monthlyIncomeCents;
    dto.employerName = packet.employerName;
    dto.referenceContacts = (packet.referenceContacts ?? []).map((r) => TenantPacketReferenceResponseDto.from(r));
    dto.submittedAt = packet.submittedAt;
    return dto;
  }
}
