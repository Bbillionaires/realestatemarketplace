import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { PropertyResponseDto, UnitResponseDto } from './dto/property-response.dto';

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
    filters: { city?: string; state?: string; skip?: number; take?: number },
  ): Promise<PropertyResponseDto[]> {
    const { city, state, skip = 0, take = 50 } = filters;

    if (!actor || actor.role === Role.PROSPECTIVE_TENANT || actor.role === Role.CURRENT_TENANT) {
      const properties = await this.prisma.property.findMany({
        where: { isActive: true, city: city ?? undefined, state: state ?? undefined },
        include: PROPERTY_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      });
      return properties.map((p) => PropertyResponseDto.from(p, { includeManagement: false }));
    }

    if (STAFF_ROLES.includes(actor.role)) {
      const properties = await this.prisma.property.findMany({
        where: { city: city ?? undefined, state: state ?? undefined },
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
        city: city ?? undefined,
        state: state ?? undefined,
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
