import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { HomeownershipMilestonesService } from './homeownership-milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';

const ADMIN_ROLES = [Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];

@Controller('homeownership-milestones')
export class HomeownershipMilestonesController {
  constructor(private readonly milestonesService: HomeownershipMilestonesService) {}

  // No @Roles — any authenticated user can read the active checklist; it's
  // reference data for the tenant-facing tracker, not sensitive.
  @Get()
  listActive() {
    return this.milestonesService.listActive();
  }

  @Get('all')
  @Roles(...ADMIN_ROLES)
  listAll() {
    return this.milestonesService.listAll();
  }

  @Post()
  @Roles(...ADMIN_ROLES)
  @AuditLog('homeownership_milestone.create', 'HomeownershipMilestone')
  create(@Body() dto: CreateMilestoneDto) {
    return this.milestonesService.create(dto);
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @AuditLog('homeownership_milestone.update', 'HomeownershipMilestone')
  update(@Param('id') id: string, @Body() dto: UpdateMilestoneDto) {
    return this.milestonesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...ADMIN_ROLES)
  @AuditLog('homeownership_milestone.delete', 'HomeownershipMilestone')
  remove(@Param('id') id: string) {
    return this.milestonesService.remove(id);
  }
}
