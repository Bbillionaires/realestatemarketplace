import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ApplicationsService } from './applications.service';
import { ApplicationDecisionDto } from './dto/application-decision.dto';

/** Landlord/PM/staff-side actions on a specific application, addressed by its own id. */
@Controller('applications')
export class ApplicationsDecisionController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Patch(':id/mark-under-review')
  @AuditLog('application.mark_under_review', 'Application')
  markUnderReview(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.applicationsService.markUnderReview(user, id);
  }

  @Patch(':id/decision')
  @AuditLog('application.decision', 'Application')
  decide(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ApplicationDecisionDto) {
    return this.applicationsService.decide(user, id, dto);
  }
}
