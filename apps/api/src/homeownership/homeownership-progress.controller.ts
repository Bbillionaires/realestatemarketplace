import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { HomeownershipProgressService } from './homeownership-progress.service';
import { UpdateProgressDto } from './dto/update-progress.dto';

@Controller('homeownership-progress')
export class HomeownershipProgressController {
  constructor(private readonly progressService: HomeownershipProgressService) {}

  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.progressService.getMine(user);
  }

  @Patch('me')
  @AuditLog('homeownership_progress.update', 'HomeownershipProgress')
  updateMine(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProgressDto) {
    return this.progressService.updateMine(user, dto);
  }

  @Post('me/milestones/:milestoneId')
  @AuditLog('homeownership_progress.milestone_complete', 'HomeownershipMilestoneCompletion')
  markMilestoneComplete(@CurrentUser() user: AuthenticatedUser, @Param('milestoneId') milestoneId: string) {
    return this.progressService.markMilestoneComplete(user, milestoneId);
  }

  @Delete('me/milestones/:milestoneId')
  @AuditLog('homeownership_progress.milestone_uncomplete', 'HomeownershipMilestoneCompletion')
  unmarkMilestoneComplete(@CurrentUser() user: AuthenticatedUser, @Param('milestoneId') milestoneId: string) {
    return this.progressService.unmarkMilestoneComplete(user, milestoneId);
  }
}
