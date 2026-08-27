import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { HqsInspectionsService } from './hqs-inspections.service';
import { RequestHqsInspectionDto } from './dto/request-hqs-inspection.dto';

@Controller('properties/:propertyId/hqs-inspections')
export class HqsInspectionsController {
  constructor(private readonly hqsInspectionsService: HqsInspectionsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string) {
    return this.hqsInspectionsService.listForProperty(user, propertyId);
  }

  @Post()
  @AuditLog('hqs_inspection.create', 'HqsInspectionRequest')
  create(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string) {
    return this.hqsInspectionsService.create(user, propertyId);
  }
}

@Controller('hqs-inspections')
export class HqsInspectionActionsController {
  constructor(private readonly hqsInspectionsService: HqsInspectionsService) {}

  @Patch(':id/cancel')
  @AuditLog('hqs_inspection.cancel', 'HqsInspectionRequest')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.hqsInspectionsService.cancel(user, id);
  }

  @Post(':id/request')
  @AuditLog('hqs_inspection.request', 'HqsInspectionRequest')
  request(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RequestHqsInspectionDto) {
    return this.hqsInspectionsService.request(user, id, dto.preferredDateNote);
  }
}
