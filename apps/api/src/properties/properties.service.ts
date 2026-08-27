import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PropertyType, Role, UnitListingType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AppConfig } from '../config/configuration';
import { boundingBox, haversineMiles } from '../common/utils/geo.util';
import { GEOCODING_PROVIDER } from '../geocoding/geocoding.constants';
import { GeocodingProvider } from '../geocoding/interfaces/geocoding-provider.interface';
import { SCHOOLS_PROVIDER } from '../schools/schools.constants';
import { SchoolsProvider } from '../schools/interfaces/schools-provider.interface';
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
  matches: PropertyResponseDto[];
}

const STAFF_ROLES: Role[] = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];
const PROPERTY_INCLUDE = {
  owner: { include: { profile: true } },
  managerAssignments: true,
  units: { include: { beds: true } },
} as const;

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig>,
    @Inject(GEOCODING_PROVIDER) private readonly geocodingProvider: GeocodingProvider,
    @Inject(SCHOOLS_PROVIDER) private readonly schoolsProvider: SchoolsProvider,
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
    filters: {
      city?: string;
      state?: string;
      propertyType?: string;
      acceptsSection8Vouchers?: boolean;
      secondChanceFriendly?: boolean;
      roomRentals?: boolean;
      skip?: number;
      take?: number;
    },
  ): Promise<PropertyResponseDto[]> {
    const { city, state, propertyType, acceptsSection8Vouchers, secondChanceFriendly, roomRentals, skip = 0, take = 50 } = filters;
    const typeFilter = propertyType && PROPERTY_TYPE_VALUES.includes(propertyType) ? (propertyType as PropertyType) : undefined;
    const commonFilters = {
      city: city ?? undefined,
      state: state ?? undefined,
      propertyType: typeFilter,
      acceptsSection8Vouchers: acceptsSection8Vouchers === true ? true : undefined,
      secondChanceFriendly: secondChanceFriendly === true ? true : undefined,
      // A property "has room rentals" when at least one of its units is
      // rented room-by-room rather than as the entire place.
      units: roomRentals === true ? { some: { listingType: { in: ['PRIVATE_ROOM', 'SHARED_ROOM'] as UnitListingType[] } } } : undefined,
    };

    if (!actor || actor.role === Role.PROSPECTIVE_TENANT || actor.role === Role.CURRENT_TENANT) {
      const properties = await this.prisma.property.findMany({
        where: { isActive: true, ...commonFilters },
        include: PROPERTY_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      });
      return properties.map((p) => PropertyResponseDto.from(p, { includeManagement: false }));
    }

    if (STAFF_ROLES.includes(actor.role)) {
      const properties = await this.prisma.property.findMany({
        where: { ...commonFilters },
        include: PROPERTY_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      });
      return properties.map((p) => PropertyResponseDto.from(p, { includeManagement: true }));
    }

    // Landlord or property manager: only what they own or manage.
    const properties = await this.prisma.property.findMany({
      where: {
        ...commonFilters,
        OR: [
          { ownerId: actor.id },
          { managerAssignments: { some: { userId: actor.id, revokedAt: null } } },
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

    if (!standard) {
      return { zip, bedrooms, paymentStandardCents: null, metroArea: null, effectiveDate: null, covered: false, matches: [] };
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
        return rentCents !== null && rentCents <= standard.monthlyRentCents;
      });

    return {
      zip,
      bedrooms,
      paymentStandardCents: standard.monthlyRentCents,
      metroArea: standard.metroArea,
      effectiveDate: standard.effectiveDate,
      covered: true,
      matches,
    };
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
