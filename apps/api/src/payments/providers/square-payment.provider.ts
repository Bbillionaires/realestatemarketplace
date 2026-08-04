import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { v4 as uuid } from 'uuid';
import { AppConfig } from '../../config/configuration';
import {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProvider,
  ValidateWebhookInput,
  WebhookPaymentEvent,
} from '../interfaces/payment-provider.interface';

interface SquarePaymentLinkResponse {
  payment_link?: { id: string; order_id: string; url: string };
  errors?: { code: string; detail: string }[];
}

/**
 * Square Payment Links API — a $5 fixed-fee purchase doesn't need our own
 * card-tokenization UI, so this hands the buyer a Square-hosted checkout
 * page (which also offers Cash App Pay, Apple Pay, Google Pay alongside
 * cards, depending on what's enabled on the Square account) and relies on
 * the `payment.updated` webhook to confirm payment, matched back to our
 * IdSubmission record by `order_id` (stored as paymentOrderId at checkout
 * creation time).
 *
 * NOTE: written against Square's documented Payment Links + Webhooks APIs
 * but not exercised against a live Square (sandbox or production) account —
 * verify against a real Square sandbox before taking real payments.
 */
@Injectable()
export class SquarePaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(SquarePaymentProvider.name);

  constructor(private readonly configService: ConfigService<AppConfig>) {}

  private get baseUrl(): string {
    const square = this.configService.get('square', { infer: true }) as AppConfig['square'];
    return square.environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const square = this.configService.get('square', { infer: true }) as AppConfig['square'];

    const response = await fetch(`${this.baseUrl}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${square.accessToken}`,
        'Square-Version': '2024-10-17',
      },
      body: JSON.stringify({
        idempotency_key: uuid(),
        order: {
          location_id: square.locationId,
          reference_id: input.referenceId.slice(0, 40),
          line_items: [
            {
              name: input.description.slice(0, 512),
              quantity: '1',
              base_price_money: { amount: input.amountCents, currency: 'USD' },
            },
          ],
        },
        checkout_options: {
          redirect_url: input.redirectUrl,
        },
      }),
    });

    const body = (await response.json()) as SquarePaymentLinkResponse;
    if (!response.ok || !body.payment_link) {
      const detail = body.errors?.map((e) => e.detail).join('; ') ?? `HTTP ${response.status}`;
      this.logger.error(`Square payment link creation failed: ${detail}`);
      throw new Error(`Failed to create Square checkout: ${detail}`);
    }

    return {
      providerCheckoutId: body.payment_link.id,
      providerOrderId: body.payment_link.order_id,
      checkoutUrl: body.payment_link.url,
    };
  }

  validateWebhook(input: ValidateWebhookInput): boolean {
    const square = this.configService.get('square', { infer: true }) as AppConfig['square'];
    if (!square.webhookSignatureKey) return false;

    const expected = createHmac('sha256', square.webhookSignatureKey)
      .update(input.url + input.rawBody)
      .digest('base64');

    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(input.signature);
    if (expectedBuffer.length !== actualBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, actualBuffer);
  }

  parseWebhookEvent(rawBody: string): WebhookPaymentEvent | null {
    try {
      const event = JSON.parse(rawBody) as {
        type?: string;
        data?: { object?: { payment?: { order_id?: string; status?: string } } };
      };
      const payment = event.data?.object?.payment;
      if (event.type !== 'payment.updated' || !payment?.order_id) return null;
      return { providerOrderId: payment.order_id, paid: payment.status === 'COMPLETED' };
    } catch {
      return null;
    }
  }
}
