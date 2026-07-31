import { PropertyType } from '@prisma/client';

export class UnitResponseDto {
  id!: string;
  propertyId!: string;
  unitLabel!: string;
  bedrooms!: number | null;
  bathrooms!: number | null;
  squareFeet!: number | null;
  rentCents!: number | null;
  isAvailable!: boolean;

  static from(unit: {
    id: string;
    propertyId: string;
    unitLabel: string;
    bedrooms: number | null;
    bathrooms: number | null;
    squareFeet: number | null;
    rentCents: number | null;
    isAvailable: boolean;
  }): UnitResponseDto {
    const dto = new UnitResponseDto();
    Object.assign(dto, unit);
    return dto;
  }
}

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
  photoUrl!: string | null;
  isActive!: boolean;
  propertyType!: PropertyType;
  acceptsSection8Vouchers!: boolean;
  sellingSoon!: boolean;
  sellingSoonNote!: string | null;
  rentToOwnAvailable!: boolean;
  leaseToOwnAvailable!: boolean;
  sellerFinancingAvailable!: boolean;
  workForRentAvailable!: boolean;
  tenantSwapAllowed!: boolean;
  landlordDisplayName!: string;
  units!: UnitResponseDto[];
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
      photoUrl: string | null;
      isActive: boolean;
      propertyType: PropertyType;
      acceptsSection8Vouchers: boolean;
      sellingSoon: boolean;
      sellingSoonNote: string | null;
      rentToOwnAvailable: boolean;
      leaseToOwnAvailable: boolean;
      sellerFinancingAvailable: boolean;
      workForRentAvailable: boolean;
      tenantSwapAllowed: boolean;
      createdAt: Date;
      updatedAt: Date;
      ownerId: string;
      owner?: { profile?: { displayName: string } | null };
      managerAssignments?: { userId: string; revokedAt: Date | null }[];
      units?: {
        id: string;
        propertyId: string;
        unitLabel: string;
        bedrooms: number | null;
        bathrooms: number | null;
        squareFeet: number | null;
        rentCents: number | null;
        isAvailable: boolean;
      }[];
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
    dto.photoUrl = property.photoUrl;
    dto.isActive = property.isActive;
    dto.propertyType = property.propertyType;
    dto.acceptsSection8Vouchers = property.acceptsSection8Vouchers;
    dto.sellingSoon = property.sellingSoon;
    dto.sellingSoonNote = property.sellingSoonNote;
    dto.rentToOwnAvailable = property.rentToOwnAvailable;
    dto.leaseToOwnAvailable = property.leaseToOwnAvailable;
    dto.sellerFinancingAvailable = property.sellerFinancingAvailable;
    dto.workForRentAvailable = property.workForRentAvailable;
    dto.tenantSwapAllowed = property.tenantSwapAllowed;
    dto.landlordDisplayName = property.owner?.profile?.displayName ?? 'Property Management';
    dto.units = (property.units ?? []).map((u) => UnitResponseDto.from(u));
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
