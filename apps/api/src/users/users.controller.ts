import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { SetSuspendPermissionDto } from './dto/set-suspend-permission.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getById(user.id);
  }

  @Patch('me')
  @AuditLog('user.update_profile', 'User')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateOwnProfile(user.id, dto);
  }

  @Get()
  @Roles(Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR, Role.STAFF_MODERATOR)
  findAll(@Query('skip') skip?: string, @Query('take') take?: string, @Query('role') role?: Role) {
    return this.usersService.findAllForAdmin({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      role,
    });
  }

  @Get('admin/overview')
  @Roles(Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR, Role.STAFF_MODERATOR)
  registrantOverview(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.usersService.findRegistrantOverview({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get(':id')
  @Roles(Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR, Role.STAFF_MODERATOR)
  findOne(@Param('id') id: string) {
    return this.usersService.getById(id);
  }

  @Patch(':id/role')
  @Roles(Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR)
  @AuditLog('user.role_change', 'User')
  changeRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ChangeRoleDto,
    @Req() req: Request,
  ) {
    return this.usersService.changeRole(actor, id, dto.role, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/suspend')
  @Roles(Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR, Role.STAFF_MODERATOR)
  @AuditLog('user.suspend', 'User')
  suspend(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Req() req: Request) {
    return this.usersService.setActive(actor, id, false, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/restore')
  @Roles(Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR, Role.STAFF_MODERATOR)
  @AuditLog('user.restore', 'User')
  restore(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Req() req: Request) {
    return this.usersService.setActive(actor, id, true, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/suspend-permission')
  @Roles(Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR)
  @AuditLog('user.suspend_permission_change', 'User')
  setSuspendPermission(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetSuspendPermissionDto,
    @Req() req: Request,
  ) {
    return this.usersService.setSuspendPermission(actor, id, dto.enabled, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
