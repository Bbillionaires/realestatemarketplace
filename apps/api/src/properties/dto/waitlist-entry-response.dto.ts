export class WaitlistEntryResponseDto {
  id!: string;
  propertyId!: string;
  userId!: string;
  displayName!: string;
  note!: string | null;
  createdAt!: Date;
  property?: { id: string; title: string; addressLine1: string; city: string; state: string };

  static from(entry: {
    id: string;
    propertyId: string;
    userId: string;
    note: string | null;
    createdAt: Date;
    user?: { profile?: { displayName: string } | null };
    property?: { id: string; title: string; addressLine1: string; city: string; state: string };
  }): WaitlistEntryResponseDto {
    const dto = new WaitlistEntryResponseDto();
    dto.id = entry.id;
    dto.propertyId = entry.propertyId;
    dto.userId = entry.userId;
    dto.displayName = entry.user?.profile?.displayName ?? 'Tenant';
    dto.note = entry.note;
    dto.createdAt = entry.createdAt;
    if (entry.property) {
      dto.property = {
        id: entry.property.id,
        title: entry.property.title,
        addressLine1: entry.property.addressLine1,
        city: entry.property.city,
        state: entry.property.state,
      };
    }
    return dto;
  }
}
