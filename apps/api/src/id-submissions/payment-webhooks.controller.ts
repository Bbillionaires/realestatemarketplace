import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { IdSubmissionsService } from './id-submissions.service';
import { GigJobsService } from '../gig-jobs/gig-jobs.service';
import { JobReferralsService } from '../job-referrals/job-referrals.service';
import { PropertiesService } from '../properties/properties.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { HqsInspectionsService } from '../hqs-inspections/hqs-inspections.service';
import { TenantPacketsService } from '../tenant-packets/tenant-packets.service';

/**
 * Unauthenticated by JWT — the payment processor (or the mock provider's
 * "simulate payment" page in dev), not a logged-in user, calls this.
 * Trust comes from PaymentProvider.validateWebhook, checked inside each
 * service before anything is applied. A single PAYMENT_PROVIDER serves
 * every paid flow in the app, so every feature that can be paid for gets a
 * turn at the same event — each one is scoped by paymentOrderId lookup and
 * silently no-ops if this order isn't theirs.
 */
@Controller('payments/webhooks')
@Public()
export class PaymentWebhooksController {
  constructor(
    private readonly idSubmissionsService: IdSubmissionsService,
    private readonly gigJobsService: GigJobsService,
    private readonly jobReferralsService: JobReferralsService,
    private readonly propertiesService: PropertiesService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly hqsInspectionsService: HqsInspectionsService,
    private readonly tenantPacketsService: TenantPacketsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Body() body: Record<string, unknown>,
    @Headers('x-square-hmacsha256-signature') signature: string | undefined,
    @Req() req: Request,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const rawBody = JSON.stringify(body);
    await this.idSubmissionsService.handlePaymentWebhook(signature ?? '', url, rawBody);
    await this.gigJobsService.handlePaymentWebhook(signature ?? '', url, rawBody);
    await this.jobReferralsService.handlePaymentWebhook(signature ?? '', url, rawBody);
    await this.propertiesService.handlePaymentWebhook(signature ?? '', url, rawBody);
    await this.subscriptionsService.handlePaymentWebhook(signature ?? '', url, rawBody);
    await this.hqsInspectionsService.handlePaymentWebhook(signature ?? '', url, rawBody);
    await this.tenantPacketsService.handlePaymentWebhook(signature ?? '', url, rawBody);
    return { status: 'ok' };
  }
}
