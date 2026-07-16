import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';

const STAFF_ROLES: Role[] = [Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { profile: true } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return UserResponseDto.from(user);
  }

  async updateOwnProfile(userId: string, dto: UpdateProfileDto): Promise<UserResponseDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        profile: {
          upsert: {
            create: { displayName: dto.displayName ?? 'User', ...dto },
            update: { ...dto },
          },
        },
      },
      include: { profile: true },
    });
    return UserResponseDto.from(user);
  }

  async findAllForAdmin(params: {
    skip?: number;
    take?: number;
    role?: Role;
  }): Promise<UserResponseDto[]> {
    const { skip = 0, take = 50, role } = params;
    const users = await this.prisma.user.findMany({
      where: { role: role ?? undefined },
      include: { profile: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
    return users.map((u) => UserResponseDto.from(u));
  }

  /**
   * Least-privilege role change: administrators may assign any role EXCEPT
   * ADMINISTRATOR or SUPER_ADMINISTRATOR (prevents a compromised admin
   * account from minting more admins). Only a super administrator can grant
   * those two roles.
   */
  async changeRole(
    actor: { id: string; role: Role },
    targetUserId: string,
    newRole: Role,
    ctx: { ipAddress?: string; userAgent?: string },
  ): Promise<UserResponseDto> {
    if (STAFF_ROLES.includes(newRole) && actor.role !== Role.SUPER_ADMINISTRATOR) {
      throw new ForbiddenException('Only a super administrator can grant administrator roles');
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
      include: { profile: true },
    });

    await this.auditService.log({
      actorId: actor.id,
      action: 'user.role_change',
      entityType: 'User',
      entityId: targetUserId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { previousRole: target.role, newRole },
    });

    return UserResponseDto.from(updated);
  }

  async setActive(
    actorId: string,
    targetUserId: string,
    isActive: boolean,
    ctx: { ipAddress?: string; userAgent?: string },
  ): Promise<UserResponseDto> {
    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
      include: { profile: true },
    });

    await this.auditService.log({
      actorId,
      action: isActive ? 'user.restore' : 'user.suspend',
      entityType: 'User',
      entityId: targetUserId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return UserResponseDto.from(updated);
  }
}
