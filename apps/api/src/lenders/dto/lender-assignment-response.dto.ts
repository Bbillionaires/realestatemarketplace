import { LenderAccessTier } from '@prisma/client';

export class LenderAssignmentResponseDto {
  id!: string;
  propertyId!: string;
  propertyTitle!: string;
  lenderId!: string;
  lenderDisplayName!: string;
  tenantId!: string | null;
  tenantDisplayName!: string | null;
  accessTier!: LenderAccessTier;
  assignedAt!: Date;
  revokedAt!: Date | null;

  static from(assignment: {
    id: string;
    propertyId: string;
    property?: { title: string };
    lenderId: string;
    lender?: { profile?: { displayName: string } | null };
    tenantId: string | null;
    tenant?: { profile?: { displayName: string } | null } | null;
    accessTier: LenderAccessTier;
    assignedAt: Date;
    revokedAt: Date | null;
  }): LenderAssignmentResponseDto {
    const dto = new LenderAssignmentResponseDto();
    dto.id = assignment.id;
    dto.propertyId = assignment.propertyId;
    dto.propertyTitle = assignment.property?.title ?? '';
    dto.lenderId = assignment.lenderId;
    dto.lenderDisplayName = assignment.lender?.profile?.displayName ?? 'Lender';
    dto.tenantId = assignment.tenantId;
    dto.tenantDisplayName = assignment.tenant?.profile?.displayName ?? null;
    dto.accessTier = assignment.accessTier;
    dto.assignedAt = assignment.assignedAt;
    dto.revokedAt = assignment.revokedAt;
    return dto;
  }
}
