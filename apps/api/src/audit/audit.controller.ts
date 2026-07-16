import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from './audit.service';

@Controller('audit-logs')
@Roles(Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('entityType') entityType?: string,
    @Query('actorId') actorId?: string,
  ) {
    return this.auditService.findAll({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      entityType,
      actorId,
    });
  }
}
