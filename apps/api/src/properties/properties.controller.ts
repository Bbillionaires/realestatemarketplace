import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { AssignManagerDto } from './dto/assign-manager.dto';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  @AuditLog('property.create', 'Property')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePropertyDto) {
    return this.propertiesService.create(user, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('city') city?: string,
    @Query('state') state?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.propertiesService.findAll(user, {
      city,
      state,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.propertiesService.findOne(user, id);
  }

  @Patch(':id')
  @AuditLog('property.update', 'Property')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdatePropertyDto) {
    return this.propertiesService.update(user, id, dto);
  }

  @Post(':id/managers')
  @AuditLog('property.assign_manager', 'Property')
  assignManager(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignManagerDto,
  ) {
    return this.propertiesService.assignManager(user, id, dto.userId);
  }

  @Patch(':id/managers/:userId/revoke')
  @AuditLog('property.revoke_manager', 'Property')
  revokeManager(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.propertiesService.revokeManager(user, id, userId);
  }

  @Get(':id/units')
  listUnits(@Param('id') id: string) {
    return this.propertiesService.listUnits(id);
  }

  @Post(':id/units')
  @AuditLog('property.create_unit', 'PropertyUnit')
  createUnit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateUnitDto) {
    return this.propertiesService.createUnit(user, id, dto);
  }

  @Patch(':id/units/:unitId')
  @AuditLog('property.update_unit', 'PropertyUnit')
  updateUnit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('unitId') unitId: string,
    @Body() dto: UpdateUnitDto,
  ) {
    return this.propertiesService.updateUnit(user, id, unitId, dto);
  }
}
