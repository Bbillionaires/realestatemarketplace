import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { IdSubmissionsService } from './id-submissions.service';

/**
 * Unauthenticated by JWT — the payment processor (or the mock provider's
 * "simulate payment" page in dev), not a logged-in user, calls this.
 * Trust comes from PaymentProvider.validateWebhook, checked inside the
 * service before anything is applied.
 */
@Controller('payments/webhooks')
@Public()
export class PaymentWebhooksController {
  constructor(private readonly idSubmissionsService: IdSubmissionsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Body() body: Record<string, unknown>,
    @Headers('x-square-hmacsha256-signature') signature: string | undefined,
    @Req() req: Request,
  ) {
    await this.idSubmissionsService.handlePaymentWebhook(
      signature ?? '',
      `${req.protocol}://${req.get('host')}${req.originalUrl}`,
      JSON.stringify(body),
    );
    return { status: 'ok' };
  }
}
