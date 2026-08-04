import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { AppConfig } from '../../config/configuration';
import {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProvider,
  ValidateWebhookInput,
  WebhookPaymentEvent,
} from '../interfaces/payment-provider.interface';

/**
 * In-memory payment provider used for local development and automated
 * tests. No network calls are made and no real money moves. The
 * "checkoutUrl" points at a dashboard page that lets a developer/tester
 * simulate a completed payment, which posts straight to the payments
 * webhook — standing in for Square calling that same webhook after a real
 * charge. Webhook signature validation always passes since there is no
 * real signing secret to check.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);

  constructor(private readonly configService: ConfigService<AppConfig>) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const providerOrderId = `mock_order_${uuid()}`;
    const providerCheckoutId = `mock_checkout_${uuid()}`;
    const dashboardBaseUrl = this.configService.get('dashboardBaseUrl', { infer: true });
    const checkoutUrl =
      `${dashboardBaseUrl}/mock-checkout?orderId=${encodeURIComponent(providerOrderId)}` +
      `&referenceId=${encodeURIComponent(input.referenceId)}` +
      `&amountCents=${input.amountCents}` +
      `&description=${encodeURIComponent(input.description)}` +
      `&redirectUrl=${encodeURIComponent(input.redirectUrl)}`;
    this.logger.debug(`[mock-payment] checkout created for referenceId=${input.referenceId} amountCents=${input.amountCents}`);
    return { providerCheckoutId, providerOrderId, checkoutUrl };
  }

  validateWebhook(_input: ValidateWebhookInput): boolean {
    return true;
  }

  parseWebhookEvent(rawBody: string): WebhookPaymentEvent | null {
    try {
      const body = JSON.parse(rawBody) as { providerOrderId?: string; paid?: boolean };
      if (!body.providerOrderId) return null;
      return { providerOrderId: body.providerOrderId, paid: body.paid !== false };
    } catch {
      return null;
    }
  }
}
