import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { GigJobsService } from './gig-jobs.service';
import { CreateGigJobDto } from './dto/create-gig-job.dto';
import { ClaimGigJobDto } from './dto/claim-gig-job.dto';
import { ApplyGigVoucherDto } from './dto/apply-gig-voucher.dto';

@Controller('gig-jobs')
export class GigJobsController {
  constructor(private readonly gigJobsService: GigJobsService) {}

  @Get()
  listVisible(@CurrentUser() user: AuthenticatedUser) {
    return this.gigJobsService.listVisibleToTenant(user);
  }

  @Get('posted')
  listPosted(@CurrentUser() user: AuthenticatedUser) {
    return this.gigJobsService.listPosted(user);
  }

  @Post()
  @AuditLog('gig_job.create', 'GigJob')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGigJobDto) {
    return this.gigJobsService.create(user, dto);
  }

  @Patch(':id/claim')
  @AuditLog('gig_job.claim', 'GigJob')
  claim(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ClaimGigJobDto) {
    return this.gigJobsService.claim(user, id, dto);
  }

  @Patch(':id/complete')
  @AuditLog('gig_job.complete', 'GigJob')
  markComplete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.gigJobsService.markComplete(user, id);
  }

  @Patch(':id/reject-completion')
  @AuditLog('gig_job.reject_completion', 'GigJob')
  rejectCompletion(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.gigJobsService.rejectCompletion(user, id);
  }

  @Patch(':id/cancel')
  @AuditLog('gig_job.cancel', 'GigJob')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.gigJobsService.cancel(user, id);
  }

  @Post(':id/pay')
  @AuditLog('gig_job.pay', 'GigJob')
  payAndConfirm(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.gigJobsService.payAndConfirm(user, id);
  }
}

@Controller('gig-vouchers')
export class GigVouchersController {
  constructor(private readonly gigJobsService: GigJobsService) {}

  @Get('me')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.gigJobsService.listMyVouchers(user);
  }

  @Get('issued')
  listIssued(@CurrentUser() user: AuthenticatedUser) {
    return this.gigJobsService.listIssuedVouchers(user);
  }

  @Patch(':id/apply')
  @AuditLog('gig_voucher.apply', 'GigVoucher')
  apply(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ApplyGigVoucherDto) {
    return this.gigJobsService.applyVoucher(user, id, dto);
  }
}
