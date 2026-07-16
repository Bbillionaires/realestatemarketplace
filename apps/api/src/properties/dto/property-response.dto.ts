/**
 * Public-facing property shape (what prospective/current tenants see) never
 * includes the owner's user id, email, or any contact information — just a
 * display name, which is populated from the owner's UserProfile.
 */
export class PropertyResponseDto {
  id!: string;
  title!: string;
  addressLine1!: string;
  addressLine2!: string | null;
  city!: string;
  state!: string;
  zip!: string;
  description!: string | null;
  monthlyRentCents!: number | null;
  depositCents!: number | null;
  petPolicy!: string | null;
  isActive!: boolean;
  landlordDisplayName!: string;
  createdAt!: Date;
  updatedAt!: Date;

  // Only populated when the requester manages the property (owner, assigned
  // manager, staff, or admin).
  ownerId?: string;
  managerIds?: string[];

  static from(
    property: {
      id: string;
      title: string;
      addressLine1: string;
      addressLine2: string | null;
      city: string;
      state: string;
      zip: string;
      description: string | null;
      monthlyRentCents: number | null;
      depositCents: number | null;
      petPolicy: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      ownerId: string;
      owner?: { profile?: { displayName: string } | null };
      managerAssignments?: { userId: string; revokedAt: Date | null }[];
    },
    options: { includeManagement: boolean },
  ): PropertyResponseDto {
    const dto = new PropertyResponseDto();
    dto.id = property.id;
    dto.title = property.title;
    dto.addressLine1 = property.addressLine1;
    dto.addressLine2 = property.addressLine2;
    dto.city = property.city;
    dto.state = property.state;
    dto.zip = property.zip;
    dto.description = property.description;
    dto.monthlyRentCents = property.monthlyRentCents;
    dto.depositCents = property.depositCents;
    dto.petPolicy = property.petPolicy;
    dto.isActive = property.isActive;
    dto.landlordDisplayName = property.owner?.profile?.displayName ?? 'Property Management';
    dto.createdAt = property.createdAt;
    dto.updatedAt = property.updatedAt;

    if (options.includeManagement) {
      dto.ownerId = property.ownerId;
      dto.managerIds = (property.managerAssignments ?? [])
        .filter((a) => !a.revokedAt)
        .map((a) => a.userId);
    }

    return dto;
  }
}

export class UnitResponseDto {
  id!: string;
  propertyId!: string;
  unitLabel!: string;
  bedrooms!: number | null;
  bathrooms!: number | null;
  rentCents!: number | null;
  isAvailable!: boolean;

  static from(unit: {
    id: string;
    propertyId: string;
    unitLabel: string;
    bedrooms: number | null;
    bathrooms: number | null;
    rentCents: number | null;
    isAvailable: boolean;
  }): UnitResponseDto {
    const dto = new UnitResponseDto();
    Object.assign(dto, unit);
    return dto;
  }
}
