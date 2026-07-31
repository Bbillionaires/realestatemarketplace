import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PropertyType, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { PropertyResponseDto, UnitResponseDto } from './dto/property-response.dto';
import { WaitlistEntryResponseDto } from './dto/waitlist-entry-response.dto';
import { AgencyResponseDto } from './dto/agency-response.dto';

const TENANT_ROLES: Role[] = [Role.PROSPECTIVE_TENANT, Role.CURRENT_TENANT];
const PROPERTY_TYPE_VALUES: string[] = Object.values(PropertyType);

export interface RentEstimate {
  estimatedMonthlyRentCents: number | null;
  sampleSize: number;
  city?: string;
  state?: string;
  bedrooms?: number;
}

const STAFF_ROLES: Role[] = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];
const PROPERTY_INCLUDE = {
  owner: { include: { profile: true } },
  managerAssignments: true,
  units: true,
} as const;

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: AuthenticatedUser, dto: CreatePropertyDto): Promise<PropertyResponseDto> {
    if (actor.role !== Role.LANDLORD && !STAFF_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only landlords or staff can create a property listing');
    }

    const property = await this.prisma.property.create({
      data: { ...dto, ownerId: actor.id },
      include: PROPERTY_INCLUDE,
    });

    return PropertyResponseDto.from(property, { includeManagement: true });
  }

  async findAll(
    actor: AuthenticatedUser | null,
    filters: {
      city?: string;
      state?: string;
      propertyType?: string;
      acceptsSection8Vouchers?: boolean;
      skip?: number;
      take?: number;
    },
  ): Promise<PropertyResponseDto[]> {
    const { city, state, propertyType, acceptsSection8Vouchers, skip = 0, take = 50 } = filters;
    const typeFilter = propertyType && PROPERTY_TYPE_VALUES.includes(propertyType) ? (propertyType as PropertyType) : undefined;
    const commonFilters = {
      city: city ?? undefined,
      state: state ?? undefined,
      propertyType: typeFilter,
      acceptsSection8Vouchers: acceptsSection8Vouchers === true ? true : undefined,
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

    const updated = await this.prisma.property.update({
      where: { id },
      data: { ...dto },
      include: PROPERTY_INCLUDE,
    });
    return PropertyResponseDto.from(updated, { includeManagement: true });
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
    const units = await this.prisma.propertyUnit.findMany({ where: { propertyId: id } });
    return units.map((u) => UnitResponseDto.from(u));
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

  async estimateRent(params: { city?: string; state?: string; bedrooms?: number }): Promise<RentEstimate> {
    const { city, state, bedrooms } = params;
    const units = await this.prisma.propertyUnit.findMany({
      where: {
        rentCents: { not: null },
        bedrooms: bedrooms ?? undefined,
        property: { city: city ?? undefined, state: state ?? undefined, isActive: true },
      },
      select: { rentCents: true },
    });
    const rents = units.map((u) => u.rentCents).filter((r): r is number => r !== null);
    const estimatedMonthlyRentCents =
      rents.length > 0 ? Math.round(rents.reduce((sum, r) => sum + r, 0) / rents.length) : null;
    return { estimatedMonthlyRentCents, sampleSize: rents.length, city, state, bedrooms };
  }

  private async canManage(
    actor: AuthenticatedUser | null,
    property: { ownerId: string; managerAssignments?: { userId: string; revokedAt: Date | null }[] },
  ): Promise<boolean> {
    if (!actor) return false;
    if (STAFF_ROLES.includes(actor.role)) return true;
    if (property.ownerId === actor.id) return true;
    if (property.managerAssignments) {
      return property.managerAssignments.some((a) => a.userId === actor.id && !a.revokedAt);
    }
    const assignment = await this.prisma.propertyManagerAssignment.findFirst({
      where: { userId: actor.id, revokedAt: null },
    });
    return !!assignment;
  }

  private async assertCanManage(
    actor: AuthenticatedUser,
    property: { ownerId: string; managerAssignments?: { userId: string; revokedAt: Date | null }[] },
  ): Promise<void> {
    const allowed = await this.canManage(actor, property);
    if (!allowed) {
      throw new ForbiddenException('You do not have permission to manage this property');
    }
  }
}
