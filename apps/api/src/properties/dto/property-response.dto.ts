import { PropertyType, SewerSourceType, UnitListingType, UtilityType, WaterSourceType } from '@prisma/client';

export class BedResponseDto {
  id!: string;
  unitId!: string;
  bedLabel!: string;
  rentCents!: number | null;
  isAvailable!: boolean;

  static from(bed: {
    id: string;
    unitId: string;
    bedLabel: string;
    rentCents: number | null;
    isAvailable: boolean;
  }): BedResponseDto {
    const dto = new BedResponseDto();
    Object.assign(dto, bed);
    return dto;
  }
}

export class UnitResponseDto {
  id!: string;
  propertyId!: string;
  unitLabel!: string;
  bedrooms!: number | null;
  bathrooms!: number | null;
  squareFeet!: number | null;
  rentCents!: number | null;
  isAvailable!: boolean;
  listingType!: UnitListingType;
  beds!: BedResponseDto[];

  static from(unit: {
    id: string;
    propertyId: string;
    unitLabel: string;
    bedrooms: number | null;
    bathrooms: number | null;
    squareFeet: number | null;
    rentCents: number | null;
    isAvailable: boolean;
    listingType: UnitListingType;
    beds?: { id: string; unitId: string; bedLabel: string; rentCents: number | null; isAvailable: boolean }[];
  }): UnitResponseDto {
    const dto = new UnitResponseDto();
    dto.id = unit.id;
    dto.propertyId = unit.propertyId;
    dto.unitLabel = unit.unitLabel;
    dto.bedrooms = unit.bedrooms;
    dto.bathrooms = unit.bathrooms;
    dto.squareFeet = unit.squareFeet;
    dto.rentCents = unit.rentCents;
    dto.isAvailable = unit.isAvailable;
    dto.listingType = unit.listingType;
    dto.beds = (unit.beds ?? []).map((b) => BedResponseDto.from(b));
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
  amenities!: string | null;
  utilitiesIncluded!: UtilityType[];
  sewerSource!: SewerSourceType | null;
  waterSource!: WaterSourceType | null;
  landlordPaysElectricity!: boolean;
  landlordPaysWater!: boolean;
  subleaseAllowed!: boolean;
  currentLeaseEndDate!: Date | null;
  sellingSoon!: boolean;
  sellingSoonNote!: string | null;
  rentToOwnAvailable!: boolean;
  leaseToOwnAvailable!: boolean;
  sellerFinancingAvailable!: boolean;
  workForRentAvailable!: boolean;
  tenantSwapAllowed!: boolean;
  secondChanceFriendly!: boolean;
  brokenLeaseOk!: boolean;
  cosignerAccepted!: boolean;
  noCreditCheckIncomeOnly!: boolean;
  evictionAgeToleranceYears!: number | null;
  boostedUntil!: Date | null;
  landlordDisplayName!: string;
  units!: UnitResponseDto[];
  // Derived from units rather than stored: true when any unit is rented
  // room-by-room (PRIVATE_ROOM/SHARED_ROOM) instead of as the entire place.
  hasRoomRentals!: boolean;
  // Derived from HqsInspectionRequest rather than stored: true once the
  // landlord has paid for (or completed) an HQS pre-inspection walkthrough.
  hqsPreInspected!: boolean;
  viewCount!: number;
  createdAt!: Date;
  updatedAt!: Date;

  // Only populated when the requester manages the property (owner, assigned
  // manager, staff, or admin).
  ownerId?: string;
  managerIds?: string[];
  boostCheckoutUrl?: string | null;

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
      amenities: string | null;
      utilitiesIncluded: UtilityType[];
      sewerSource: SewerSourceType | null;
      waterSource: WaterSourceType | null;
      landlordPaysElectricity: boolean;
      landlordPaysWater: boolean;
      subleaseAllowed: boolean;
      currentLeaseEndDate: Date | null;
      sellingSoon: boolean;
      sellingSoonNote: string | null;
      rentToOwnAvailable: boolean;
      leaseToOwnAvailable: boolean;
      sellerFinancingAvailable: boolean;
      workForRentAvailable: boolean;
      tenantSwapAllowed: boolean;
      secondChanceFriendly: boolean;
      brokenLeaseOk: boolean;
      cosignerAccepted: boolean;
      noCreditCheckIncomeOnly: boolean;
      evictionAgeToleranceYears: number | null;
      boostedUntil: Date | null;
      boostCheckoutUrl: string | null;
      viewCount: number;
      createdAt: Date;
      updatedAt: Date;
      ownerId: string;
      owner?: { profile?: { displayName: string } | null };
      managerAssignments?: { userId: string; revokedAt: Date | null }[];
      hqsInspectionRequests?: { status: string }[];
      units?: {
        id: string;
        propertyId: string;
        unitLabel: string;
        bedrooms: number | null;
        bathrooms: number | null;
        squareFeet: number | null;
        rentCents: number | null;
        isAvailable: boolean;
        listingType: UnitListingType;
        beds?: { id: string; unitId: string; bedLabel: string; rentCents: number | null; isAvailable: boolean }[];
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
    dto.amenities = property.amenities;
    dto.utilitiesIncluded = property.utilitiesIncluded;
    dto.sewerSource = property.sewerSource;
    dto.waterSource = property.waterSource;
    dto.landlordPaysElectricity = property.landlordPaysElectricity;
    dto.landlordPaysWater = property.landlordPaysWater;
    dto.subleaseAllowed = property.subleaseAllowed;
    dto.currentLeaseEndDate = property.currentLeaseEndDate;
    dto.sellingSoon = property.sellingSoon;
    dto.sellingSoonNote = property.sellingSoonNote;
    dto.rentToOwnAvailable = property.rentToOwnAvailable;
    dto.leaseToOwnAvailable = property.leaseToOwnAvailable;
    dto.sellerFinancingAvailable = property.sellerFinancingAvailable;
    dto.workForRentAvailable = property.workForRentAvailable;
    dto.tenantSwapAllowed = property.tenantSwapAllowed;
    dto.secondChanceFriendly = property.secondChanceFriendly;
    dto.brokenLeaseOk = property.brokenLeaseOk;
    dto.cosignerAccepted = property.cosignerAccepted;
    dto.noCreditCheckIncomeOnly = property.noCreditCheckIncomeOnly;
    dto.evictionAgeToleranceYears = property.evictionAgeToleranceYears;
    dto.boostedUntil = property.boostedUntil;
    dto.landlordDisplayName = property.owner?.profile?.displayName ?? 'Property Management';
    dto.units = (property.units ?? []).map((u) => UnitResponseDto.from(u));
    dto.hasRoomRentals = (property.units ?? []).some((u) => u.listingType !== 'ENTIRE_PLACE');
    dto.hqsPreInspected = (property.hqsInspectionRequests ?? []).length > 0;
    dto.viewCount = property.viewCount;
    dto.createdAt = property.createdAt;
    dto.updatedAt = property.updatedAt;

    if (options.includeManagement) {
      dto.ownerId = property.ownerId;
      dto.boostCheckoutUrl = property.boostCheckoutUrl;
      dto.managerIds = (property.managerAssignments ?? [])
        .filter((a) => !a.revokedAt)
        .map((a) => a.userId);
    }

    return dto;
  }
}
