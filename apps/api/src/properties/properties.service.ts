import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HqsInspectionStatus, Prisma, PropertyType, Role, UnitListingType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AppConfig } from '../config/configuration';
import { boundingBox, haversineMiles } from '../common/utils/geo.util';
import { GEOCODING_PROVIDER } from '../geocoding/geocoding.constants';
import { GeocodingProvider } from '../geocoding/interfaces/geocoding-provider.interface';
import { SCHOOLS_PROVIDER } from '../schools/schools.constants';
import { SchoolsProvider } from '../schools/interfaces/schools-provider.interface';
import { PAYMENT_PROVIDER } from '../payments/payments.constants';
import { PaymentProvider } from '../payments/interfaces/payment-provider.interface';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { CreateBedDto } from './dto/create-bed.dto';
import { UpdateBedDto } from './dto/update-bed.dto';
import { PropertyResponseDto, UnitResponseDto, BedResponseDto } from './dto/property-response.dto';
import { WaitlistEntryResponseDto } from './dto/waitlist-entry-response.dto';
import { AgencyResponseDto } from './dto/agency-response.dto';
import { NearbySchoolResponseDto } from './dto/nearby-school-response.dto';

const TENANT_ROLES: Role[] = [Role.PROSPECTIVE_TENANT, Role.CURRENT_TENANT];
const PROPERTY_TYPE_VALUES: string[] = Object.values(PropertyType);

export interface RentEstimate {
  estimatedMonthlyRentCents: number | null;
  sampleSize: number;
  radiusMiles: number;
  bedrooms?: number;
  /** False when the given address couldn't be geocoded at all — distinct from "geocoded fine, just no comps nearby". */
  addressResolved: boolean;
}

export interface VoucherMatcherResult {
  zip: string;
  bedrooms: number;
  paymentStandardCents: number | null;
  metroArea: string | null;
  effectiveDate: Date | null;
  /** False when this zip/bedroom combo has no published payment standard yet — distinct from "covered, but $0 matches". */
  covered: boolean;
  /**
   * True for a locally-confirmed payment standard (e.g. Duval County's
   * JaxHA data); false when this figure came from the nationwide HUD FMR
   * baseline fallback instead — a real precision difference worth
   * surfacing to the tenant, not just an internal implementation detail.
   */
  isPreciseLocalStandard: boolean;
  matches: PropertyResponseDto[];
}

/** HUD's own rule for bedroom sizes beyond its published 4BR ceiling (FY2026 FMR Schedule, Note 1; 24 CFR 888.113): add 15% of the 4BR rent per extra bedroom. */
function extrapolateBeyondFourBedrooms(rent4Cents: number, bedrooms: number): number {
  return Math.round(rent4Cents * (1 + 0.15 * (bedrooms - 4)));
}

export interface PropertySearchFilters {
  city?: string;
  state?: string;
  propertyType?: string;
  acceptsSection8Vouchers?: boolean;
  secondChanceFriendly?: boolean;
  roomRentals?: boolean;
  brokenLeaseOk?: boolean;
  cosignerAccepted?: boolean;
  noCreditCheckIncomeOnly?: boolean;
  /** Match listings whose stated eviction-age tolerance is at or below this many years. */
  maxEvictionYears?: number;
  /** At least one utility is included, per the landlord's utilitiesIncluded checklist. */
  utilitiesIncluded?: boolean;
  landlordPaysWater?: boolean;
  landlordPaysElectricity?: boolean;
  /** Rent-to-own, lease-to-own, or seller financing — any path to ownership. */
  rentToOwn?: boolean;
}

/** Shared by findAll() and getPublicPreview() so both search the same criteria. */
function buildPropertySearchWhere(filters: PropertySearchFilters): Prisma.PropertyWhereInput {
  const typeFilter =
    filters.propertyType && PROPERTY_TYPE_VALUES.includes(filters.propertyType) ? (filters.propertyType as PropertyType) : undefined;

  return {
    city: filters.city ?? undefined,
    state: filters.state ?? undefined,
    propertyType: typeFilter,
    acceptsSection8Vouchers: filters.acceptsSection8Vouchers === true ? true : undefined,
    secondChanceFriendly: filters.secondChanceFriendly === true ? true : undefined,
    brokenLeaseOk: filters.brokenLeaseOk === true ? true : undefined,
    cosignerAccepted: filters.cosignerAccepted === true ? true : undefined,
    noCreditCheckIncomeOnly: filters.noCreditCheckIncomeOnly === true ? true : undefined,
    evictionAgeToleranceYears: filters.maxEvictionYears !== undefined ? { lte: filters.maxEvictionYears } : undefined,
    utilitiesIncluded: filters.utilitiesIncluded === true ? { isEmpty: false } : undefined,
    landlordPaysWater: filters.landlordPaysWater === true ? true : undefined,
    landlordPaysElectricity: filters.landlordPaysElectricity === true ? true : undefined,
    OR:
      filters.rentToOwn === true
        ? [{ rentToOwnAvailable: true }, { leaseToOwnAvailable: true }, { sellerFinancingAvailable: true }]
        : undefined,
    // A property "has room rentals" when at least one of its units is
    // rented room-by-room rather than as the entire place.
    units: filters.roomRentals === true ? { some: { listingType: { in: ['PRIVATE_ROOM', 'SHARED_ROOM'] as UnitListingType[] } } } : undefined,
  };
}

const STAFF_ROLES: Role[] = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];
const PROPERTY_INCLUDE = {
  owner: { include: { profile: true } },
  managerAssignments: true,
  units: { include: { beds: true } },
  // Only the still-relevant statuses — used to derive the "HQS Pre-Inspected"
  // badge (PropertyResponseDto.hqsPreInspected) without a stored column.
  hqsInspectionRequests: {
    where: { status: { in: [HqsInspectionStatus.PAID, HqsInspectionStatus.REQUESTED] as HqsInspectionStatus[] } },
  },
} as const;

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig>,
    @Inject(GEOCODING_PROVIDER) private readonly geocodingProvider: GeocodingProvider,
    @Inject(SCHOOLS_PROVIDER) private readonly schoolsProvider: SchoolsProvider,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreatePropertyDto): Promise<PropertyResponseDto> {
    if (actor.role !== Role.LANDLORD && !STAFF_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only landlords or staff can create a property listing');
    }

    const property = await this.prisma.property.create({
      data: { ...dto, ownerId: actor.id },
      include: PROPERTY_INCLUDE,
    });

    await this.refreshLocationData(property.id);
    const refreshed = await this.prisma.property.findUniqueOrThrow({ where: { id: property.id }, include: PROPERTY_INCLUDE });
    return PropertyResponseDto.from(refreshed, { includeManagement: true });
  }

  async findAll(
    actor: AuthenticatedUser | null,
    filters: PropertySearchFilters & { skip?: number; take?: number },
  ): Promise<PropertyResponseDto[]> {
    const { skip = 0, take = 50 } = filters;
    const commonFilters = buildPropertySearchWhere(filters);

    // A Featured Listing Boost surfaces a property first: non-null
    // boostedUntil sorts ahead of never-boosted (null) listings, most
    // recently boosted first among those. Only meaningful for search —
    // the landlord/manager "my own listings" branch below skips it.
    const boostedFirstOrder = [{ boostedUntil: { sort: 'desc' as const, nulls: 'last' as const } }, { createdAt: 'desc' as const }];

    if (!actor || actor.role === Role.PROSPECTIVE_TENANT || actor.role === Role.CURRENT_TENANT) {
      const properties = await this.prisma.property.findMany({
        where: { isActive: true, ...commonFilters },
        include: PROPERTY_INCLUDE,
        orderBy: boostedFirstOrder,
        skip,
        take,
      });
      return properties.map((p) => PropertyResponseDto.from(p, { includeManagement: false }));
    }

    if (STAFF_ROLES.includes(actor.role)) {
      const properties = await this.prisma.property.findMany({
        where: { ...commonFilters },
        include: PROPERTY_INCLUDE,
        orderBy: boostedFirstOrder,
        skip,
        take,
      });
      return properties.map((p) => PropertyResponseDto.from(p, { includeManagement: true }));
    }

    // Landlord or property manager: only what they own or manage. Ownership
    // scoping goes in its own AND/OR rather than a top-level `OR` key, since
    // commonFilters may already set `OR` (the rentToOwn filter) — a second
    // top-level `OR` here would silently overwrite it instead of combining.
    const properties = await this.prisma.property.findMany({
      where: {
        ...commonFilters,
        AND: [
          { OR: [{ ownerId: actor.id }, { managerAssignments: { some: { userId: actor.id, revokedAt: null } } }] },
        ],
      },
      include: PROPERTY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
    return properties.map((p) => PropertyResponseDto.from(p, { includeManagement: true }));
  }

  async findOne(actor: AuthenticatedUser | null, id: string): Promise<PropertyResponseDto> {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: PROPERTY_INCLUDE,
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const canManage = await this.canManage(actor, property);
    if (!canManage && !property.isActive) {
      throw new NotFoundException('Property not found');
    }

    return PropertyResponseDto.from(property, { includeManagement: canManage });
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdatePropertyDto): Promise<PropertyResponseDto> {
    const property = await this.prisma.property.findUnique({ where: { id }, include: PROPERTY_INCLUDE });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    await this.assertCanManage(actor, property);

    const addressFields: (keyof UpdatePropertyDto)[] = ['addressLine1', 'city', 'state', 'zip'];
    const addressChanged = addressFields.some(
      (field) => dto[field] !== undefined && dto[field] !== property[field as keyof typeof property],
    );

    const updated = await this.prisma.property.update({
      where: { id },
      data: { ...dto },
      include: PROPERTY_INCLUDE,
    });

    if (addressChanged) {
      await this.refreshLocationData(id);
    }

    const refreshed = addressChanged
      ? await this.prisma.property.findUniqueOrThrow({ where: { id }, include: PROPERTY_INCLUDE })
      : updated;
    return PropertyResponseDto.from(refreshed, { includeManagement: true });
  }

  async assignManager(actor: AuthenticatedUser, propertyId: string, userId: string): Promise<void> {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    if (property.ownerId !== actor.id && !STAFF_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only the property owner or staff can assign managers');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: userId } });
    const assignableRoles: Role[] = [Role.PROPERTY_MANAGER, Role.STAFF_MODERATOR];
    if (!targetUser || !assignableRoles.includes(targetUser.role)) {
      throw new BadRequestException('Target user must have the PROPERTY_MANAGER or STAFF_MODERATOR role');
    }

    await this.prisma.propertyManagerAssignment.upsert({
      where: { propertyId_userId: { propertyId, userId } },
      create: { propertyId, userId },
      update: { revokedAt: null },
    });
  }

  async revokeManager(actor: AuthenticatedUser, propertyId: string, userId: string): Promise<void> {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    if (property.ownerId !== actor.id && !STAFF_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only the property owner or staff can revoke managers');
    }

    await this.prisma.propertyManagerAssignment.updateMany({
      where: { propertyId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async createUnit(actor: AuthenticatedUser, propertyId: string, dto: CreateUnitDto): Promise<UnitResponseDto> {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId }, include: PROPERTY_INCLUDE });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    await this.assertCanManage(actor, property);

    const unit = await this.prisma.propertyUnit.create({ data: { propertyId, ...dto } });
    return UnitResponseDto.from(unit);
  }

  async updateUnit(
    actor: AuthenticatedUser,
    propertyId: string,
    unitId: string,
    dto: UpdateUnitDto,
  ): Promise<UnitResponseDto> {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId }, include: PROPERTY_INCLUDE });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    await this.assertCanManage(actor, property);

    const unit = await this.prisma.propertyUnit.update({ where: { id: unitId }, data: { ...dto } });
    return UnitResponseDto.from(unit);
  }

  async listUnits(id: string): Promise<UnitResponseDto[]> {
    const units = await this.prisma.propertyUnit.findMany({ where: { propertyId: id }, include: { beds: true } });
    return units.map((u) => UnitResponseDto.from(u));
  }

  async createBed(actor: AuthenticatedUser, propertyId: string, unitId: string, dto: CreateBedDto): Promise<BedResponseDto> {
    const unit = await this.getOwnUnit(actor, propertyId, unitId);
    const bed = await this.prisma.bed.create({ data: { unitId: unit.id, ...dto } });
    return BedResponseDto.from(bed);
  }

  async updateBed(
    actor: AuthenticatedUser,
    propertyId: string,
    unitId: string,
    bedId: string,
    dto: UpdateBedDto,
  ): Promise<BedResponseDto> {
    await this.getOwnUnit(actor, propertyId, unitId);
    const bed = await this.prisma.bed.findFirst({ where: { id: bedId, unitId } });
    if (!bed) {
      throw new NotFoundException('Bed not found');
    }

    const updated = await this.prisma.bed.update({ where: { id: bedId }, data: { ...dto } });
    return BedResponseDto.from(updated);
  }

  async listBeds(propertyId: string, unitId: string): Promise<BedResponseDto[]> {
    const unit = await this.prisma.propertyUnit.findFirst({ where: { id: unitId, propertyId } });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }
    const beds = await this.prisma.bed.findMany({ where: { unitId }, orderBy: { bedLabel: 'asc' } });
    return beds.map((b) => BedResponseDto.from(b));
  }

  /** Loads the unit, checking it belongs to the property and the actor can manage the property. */
  private async getOwnUnit(actor: AuthenticatedUser, propertyId: string, unitId: string) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId }, include: PROPERTY_INCLUDE });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    await this.assertCanManage(actor, property);

    const unit = await this.prisma.propertyUnit.findFirst({ where: { id: unitId, propertyId } });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }
    return unit;
  }

  async listNearbySchools(propertyId: string): Promise<NearbySchoolResponseDto[]> {
    const schools = await this.prisma.nearbySchool.findMany({
      where: { propertyId },
      orderBy: { distanceMiles: 'asc' },
    });
    return schools.map((s) => NearbySchoolResponseDto.from(s));
  }

  async refreshSchools(actor: AuthenticatedUser, propertyId: string): Promise<NearbySchoolResponseDto[]> {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId }, include: PROPERTY_INCLUDE });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    await this.assertCanManage(actor, property);

    await this.refreshLocationData(propertyId);
    return this.listNearbySchools(propertyId);
  }

  async joinWaitlist(actor: AuthenticatedUser, propertyId: string, note?: string): Promise<WaitlistEntryResponseDto> {
    if (!TENANT_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only prospective or current tenants can join a property waitlist');
    }
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const entry = await this.prisma.propertyWaitlistEntry.upsert({
      where: { propertyId_userId: { propertyId, userId: actor.id } },
      create: { propertyId, userId: actor.id, note },
      update: { note },
      include: { user: { include: { profile: true } } },
    });
    return WaitlistEntryResponseDto.from(entry);
  }

  async leaveWaitlist(actor: AuthenticatedUser, propertyId: string): Promise<void> {
    await this.prisma.propertyWaitlistEntry.deleteMany({ where: { propertyId, userId: actor.id } });
  }

  async listWaitlist(actor: AuthenticatedUser, propertyId: string): Promise<WaitlistEntryResponseDto[]> {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId }, include: PROPERTY_INCLUDE });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    await this.assertCanManage(actor, property);

    const entries = await this.prisma.propertyWaitlistEntry.findMany({
      where: { propertyId },
      include: { user: { include: { profile: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return entries.map((e) => WaitlistEntryResponseDto.from(e));
  }

  async listMyWaitlistEntries(actor: AuthenticatedUser): Promise<WaitlistEntryResponseDto[]> {
    const entries = await this.prisma.propertyWaitlistEntry.findMany({
      where: { userId: actor.id },
      include: { property: true },
      orderBy: { createdAt: 'desc' },
    });
    return entries.map((e) => WaitlistEntryResponseDto.from(e));
  }

  async listAgencies(): Promise<AgencyResponseDto[]> {
    const managers = await this.prisma.user.findMany({
      where: { role: Role.PROPERTY_MANAGER, isActive: true },
      include: { profile: true, managerAssignments: { where: { revokedAt: null } } },
    });
    return managers
      .map((m) =>
        AgencyResponseDto.from({
          id: m.id,
          displayName: m.profile?.displayName ?? 'Property Manager',
          managedPropertyCount: m.managerAssignments.length,
        }),
      )
      .filter((a) => a.managedPropertyCount > 0)
      .sort((a, b) => b.managedPropertyCount - a.managedPropertyCount);
  }

  /**
   * Weighted-random sample for the public home page feed: every active
   * property gets a chance, but one with more flips-to-details is more
   * likely to be picked. Uses weighted random sampling without replacement
   * (Efraimidis-Spirakis: each candidate draws key = U^(1/weight) for
   * U ~ Uniform(0,1), and the largest keys win) rather than a straight
   * "top N by viewCount" — a straight ranking would freeze the same
   * handful of properties on the feed forever once they got an early lead.
   */
  async getFeed(take: number): Promise<PropertyResponseDto[]> {
    const candidates = await this.prisma.property.findMany({
      where: { isActive: true },
      include: PROPERTY_INCLUDE,
    });

    const keyed = candidates.map((property) => ({
      property,
      key: Math.random() ** (1 / (property.viewCount + 1)),
    }));
    keyed.sort((a, b) => b.key - a.key);

    return keyed.slice(0, take).map(({ property }) => PropertyResponseDto.from(property, { includeManagement: false }));
  }

  /**
   * Public, capped preview for a logged-out visitor browsing a filtered
   * category page (Section 8, second-chance, room rentals) — enough real
   * results for the page to be worth indexing, without handing the whole
   * matching inventory to someone who hasn't signed up.
   */
  async getPublicPreview(filters: PropertySearchFilters): Promise<{ total: number; properties: PropertyResponseDto[] }> {
    const candidates = await this.prisma.property.findMany({
      where: { isActive: true, ...buildPropertySearchWhere(filters) },
      include: PROPERTY_INCLUDE,
      orderBy: [{ boostedUntil: { sort: 'desc' as const, nulls: 'last' as const } }, { createdAt: 'desc' as const }],
    });

    const total = candidates.length;
    // 10-20% of matching listings, at least 1 if any exist at all.
    const previewCount = total === 0 ? 0 : Math.min(total, Math.max(1, Math.ceil(total * 0.15)));

    return {
      total,
      properties: candidates.slice(0, previewCount).map((property) => PropertyResponseDto.from(property, { includeManagement: false })),
    };
  }

  /** Fires when a logged-out (or logged-in) visitor flips a home-feed card to its details side. */
  async recordView(propertyId: string): Promise<void> {
    await this.prisma.property.updateMany({
      where: { id: propertyId, isActive: true },
      data: { viewCount: { increment: 1 } },
    });
  }

  /**
   * Address-specific, not city/zip-bucketed: rent can swing significantly
   * within under a mile (different school zone, block, amenities), so this
   * geocodes the given address and averages rent from units on *other*
   * active listings within a radius of those exact coordinates rather than
   * every listing that happens to share a city or zip.
   */
  async estimateRent(params: {
    addressLine1: string;
    city: string;
    state: string;
    zip: string;
    bedrooms?: number;
  }): Promise<RentEstimate> {
    const radiusMiles = this.configService.get('rentEstimateRadiusMiles', { infer: true }) as number;

    const geocoded = await this.geocodingProvider.geocode({
      addressLine1: params.addressLine1,
      city: params.city,
      state: params.state,
      zip: params.zip,
    });
    if (!geocoded) {
      return { estimatedMonthlyRentCents: null, sampleSize: 0, radiusMiles, bedrooms: params.bedrooms, addressResolved: false };
    }

    const box = boundingBox(geocoded.latitude, geocoded.longitude, radiusMiles);
    const candidates = await this.prisma.property.findMany({
      where: {
        isActive: true,
        latitude: { gte: box.minLat, lte: box.maxLat },
        longitude: { gte: box.minLon, lte: box.maxLon },
      },
      select: {
        latitude: true,
        longitude: true,
        units: {
          where: { rentCents: { not: null }, bedrooms: params.bedrooms ?? undefined },
          select: { rentCents: true },
        },
      },
    });

    const rents: number[] = [];
    for (const candidate of candidates) {
      if (candidate.latitude === null || candidate.longitude === null) continue;
      const distance = haversineMiles(geocoded.latitude, geocoded.longitude, candidate.latitude, candidate.longitude);
      if (distance > radiusMiles) continue;
      for (const unit of candidate.units) {
        if (unit.rentCents !== null) rents.push(unit.rentCents);
      }
    }

    const estimatedMonthlyRentCents =
      rents.length > 0 ? Math.round(rents.reduce((sum, r) => sum + r, 0) / rents.length) : null;
    return { estimatedMonthlyRentCents, sampleSize: rents.length, radiusMiles, bedrooms: params.bedrooms, addressResolved: true };
  }

  /**
   * "Voucher Value Matcher": given a bedroom allowance and zip code, looks
   * up the published HUD payment standard for that combo and returns every
   * active, Section-8-accepting listing in that zip priced at or below it —
   * exactly what a voucher holder can actually afford and use their voucher
   * on, not a market-rate comp average like estimateRent() above. Matching
   * is by rent alone, not by the unit's own bedroom count: a voucher's
   * payment standard is set by the *voucher's* bedroom allowance, so a
   * holder can rent any unit at or under that standard, per actual HUD
   * rules — filtering out cheaper units with fewer bedrooms would be wrong.
   */
  async matchVoucherProperties(zip: string, bedrooms: number): Promise<VoucherMatcherResult> {
    const standard = await this.prisma.paymentStandard.findUnique({ where: { zip_bedrooms: { zip, bedrooms } } });

    let paymentStandardCents: number | null = null;
    let metroArea: string | null = null;
    let effectiveDate: Date | null = null;
    let isPreciseLocalStandard = false;

    if (standard) {
      paymentStandardCents = standard.monthlyRentCents;
      metroArea = standard.metroArea;
      effectiveDate = standard.effectiveDate;
      isPreciseLocalStandard = true;
    } else {
      // No locally-confirmed payment standard for this zip yet — fall back
      // to the nationwide HUD FMR baseline (county/metro-level, not a real
      // local payment standard) rather than reporting "not covered".
      const baseline = await this.prisma.nationwideFmrBaseline.findUnique({ where: { zip } });
      if (baseline) {
        const rentsByBedroom = [
          baseline.rent0Cents,
          baseline.rent1Cents,
          baseline.rent2Cents,
          baseline.rent3Cents,
          baseline.rent4Cents,
        ];
        paymentStandardCents =
          bedrooms <= 4 ? rentsByBedroom[bedrooms] : extrapolateBeyondFourBedrooms(baseline.rent4Cents, bedrooms);
        metroArea = baseline.areaName;
        effectiveDate = baseline.effectiveDate;
        isPreciseLocalStandard = false;
      }
    }

    if (paymentStandardCents === null) {
      return {
        zip,
        bedrooms,
        paymentStandardCents: null,
        metroArea: null,
        effectiveDate: null,
        covered: false,
        isPreciseLocalStandard: false,
        matches: [],
      };
    }

    const candidates = await this.prisma.property.findMany({
      where: { isActive: true, zip, acceptsSection8Vouchers: true },
      include: PROPERTY_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    const matches = candidates
      .map((p) => PropertyResponseDto.from(p, { includeManagement: false }))
      .filter((p) => {
        const rentCents = p.units[0]?.rentCents ?? p.monthlyRentCents;
        return rentCents !== null && rentCents <= paymentStandardCents!;
      });

    return {
      zip,
      bedrooms,
      paymentStandardCents,
      metroArea,
      effectiveDate,
      covered: true,
      isPreciseLocalStandard,
      matches,
    };
  }

  /**
   * "Featured Listing Boost": a flat one-time fee that surfaces this
   * property first in search results for `paidPeriodDays` (30 by default).
   * Owner/manager/staff only, mirroring update()'s authorization.
   */
  async purchaseBoost(actor: AuthenticatedUser, propertyId: string): Promise<PropertyResponseDto> {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId }, include: PROPERTY_INCLUDE });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    await this.assertCanManage(actor, property);

    const feeCents = this.configService.get('featuredBoostFeeCents', { infer: true }) as number;
    const dashboardBaseUrl = this.configService.get('dashboardBaseUrl', { infer: true });
    const checkout = await this.paymentProvider.createCheckout({
      amountCents: feeCents,
      description: `Featured Listing Boost — ${property.title}`,
      referenceId: property.id,
      redirectUrl: `${dashboardBaseUrl}/properties/${property.id}?boostPaid=1`,
    });

    const updated = await this.prisma.property.update({
      where: { id: propertyId },
      data: {
        boostPaymentProviderCheckoutId: checkout.providerCheckoutId,
        boostPaymentOrderId: checkout.providerOrderId,
        boostCheckoutUrl: checkout.checkoutUrl,
      },
      include: PROPERTY_INCLUDE,
    });
    return PropertyResponseDto.from(updated, { includeManagement: true });
  }

  async handlePaymentWebhook(signature: string, url: string, rawBody: string): Promise<void> {
    const valid = this.paymentProvider.validateWebhook({ signature, url, rawBody });
    if (!valid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = this.paymentProvider.parseWebhookEvent(rawBody);
    if (!event || !event.paid) {
      return;
    }

    const property = await this.prisma.property.findFirst({
      where: { boostPaymentOrderId: event.providerOrderId },
    });
    if (!property) {
      return;
    }

    const periodDays = this.configService.get('paidPeriodDays', { infer: true }) as number;
    await this.prisma.property.update({
      where: { id: property.id },
      data: {
        boostedUntil: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
        boostPaymentOrderId: null,
      },
    });
  }

  private async canManage(
    actor: AuthenticatedUser | null,
    property: { id: string; ownerId: string; managerAssignments?: { userId: string; revokedAt: Date | null }[] },
  ): Promise<boolean> {
    if (!actor) return false;
    if (STAFF_ROLES.includes(actor.role)) return true;
    if (property.ownerId === actor.id) return true;
    if (property.managerAssignments) {
      return property.managerAssignments.some((a) => a.userId === actor.id && !a.revokedAt);
    }
    // No managerAssignments included on this fetch — fall back to a direct,
    // property-scoped query rather than "does this user manage *anything*"
    // (which would wrongly grant access to every property a manager is
    // assigned to, not just this one).
    const assignment = await this.prisma.propertyManagerAssignment.findFirst({
      where: { propertyId: property.id, userId: actor.id, revokedAt: null },
    });
    return !!assignment;
  }

  private async assertCanManage(
    actor: AuthenticatedUser,
    property: { id: string; ownerId: string; managerAssignments?: { userId: string; revokedAt: Date | null }[] },
  ): Promise<void> {
    const allowed = await this.canManage(actor, property);
    if (!allowed) {
      throw new ForbiddenException('You do not have permission to manage this property');
    }
  }

  /**
   * Geocodes the property's current address and refreshes its cached
   * nearby-schools list. Best-effort and non-fatal by design: a transient
   * geocoding/schools API hiccup should never fail the create/update call
   * that triggered it — the property just keeps its previous (or null)
   * location data until the next successful refresh.
   */
  private async refreshLocationData(propertyId: string): Promise<void> {
    try {
      const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
      if (!property) return;

      const geocoded = await this.geocodingProvider.geocode({
        addressLine1: property.addressLine1,
        addressLine2: property.addressLine2,
        city: property.city,
        state: property.state,
        zip: property.zip,
      });
      if (!geocoded) {
        this.logger.warn(`Could not geocode property ${propertyId} — leaving location data unchanged`);
        return;
      }

      await this.prisma.property.update({
        where: { id: propertyId },
        data: { latitude: geocoded.latitude, longitude: geocoded.longitude },
      });

      const schools = await this.schoolsProvider.findNearby({
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        limit: 10,
      });

      await this.prisma.$transaction([
        this.prisma.nearbySchool.deleteMany({ where: { propertyId } }),
        this.prisma.nearbySchool.createMany({
          data: schools.map((s) => ({
            propertyId,
            externalId: s.externalId,
            name: s.name,
            schoolType: s.schoolType,
            level: s.level,
            rating: s.rating,
            distanceMiles: s.distanceMiles,
            address: s.address,
            websiteUrl: s.websiteUrl,
          })),
        }),
        this.prisma.property.update({ where: { id: propertyId }, data: { schoolsFetchedAt: new Date() } }),
      ]);
    } catch (err) {
      this.logger.error(`Failed to refresh location data for property ${propertyId}`, err instanceof Error ? err.stack : err);
    }
  }
}
