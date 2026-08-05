import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { JobReferralsService } from './job-referrals.service';
import { CreateJobReferralDto } from './dto/create-job-referral.dto';
import { CreateSponsoredJobListingDto } from './dto/create-sponsored-job-listing.dto';
import { TopUpJobListingDto } from './dto/topup-job-listing.dto';

@Controller('job-referrals')
export class JobReferralsController {
  constructor(private readonly jobReferralsService: JobReferralsService) {}

  @Get()
  listVisible(@CurrentUser() user: AuthenticatedUser) {
    return this.jobReferralsService.listVisibleToTenant(user);
  }

  @Get('posted')
  listPosted(@CurrentUser() user: AuthenticatedUser) {
    return this.jobReferralsService.listPosted(user);
  }

  @Post()
  @AuditLog('job_referral.create', 'JobReferral')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateJobReferralDto) {
    return this.jobReferralsService.create(user, dto);
  }

  @Post('sponsored')
  @AuditLog('job_referral.create_sponsored', 'JobReferral')
  createSponsored(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSponsoredJobListingDto) {
    return this.jobReferralsService.createSponsored(user, dto);
  }

  @Post(':id/topup')
  @AuditLog('job_referral.topup', 'JobReferral')
  topUp(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: TopUpJobListingDto) {
    return this.jobReferralsService.topUp(user, id, dto);
  }

  @Post(':id/renew')
  @AuditLog('job_referral.renew', 'JobReferral')
  renew(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.jobReferralsService.renew(user, id);
  }

  @Post(':id/click')
  registerClick(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.jobReferralsService.registerClick(user, id);
  }

  @Patch(':id/close')
  @AuditLog('job_referral.close', 'JobReferral')
  close(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.jobReferralsService.close(user, id);
  }
}
