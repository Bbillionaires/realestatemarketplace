export interface CreateCheckoutInput {
  amountCents: number;
  /** Shown on the hosted checkout page. */
  description: string;
  /** Echoed back on the webhook so the order can be matched to our record. */
  referenceId: string;
  /** Where the buyer is sent after completing (or abandoning) checkout. */
  redirectUrl: string;
}

export interface CreateCheckoutResult {
  providerCheckoutId: string;
  providerOrderId: string;
  checkoutUrl: string;
}

export interface ValidateWebhookInput {
  signature: string;
  url: string;
  rawBody: string;
}

export interface WebhookPaymentEvent {
  providerOrderId: string;
  paid: boolean;
}

/**
 * Provider-agnostic payment gateway, mirroring SmsProvider/EmailProvider:
 * nothing outside this module knows or cares whether Square, another
 * processor, or the in-memory mock is behind PAYMENT_PROVIDER.
 */
export interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  validateWebhook(input: ValidateWebhookInput): boolean;
  parseWebhookEvent(rawBody: string): WebhookPaymentEvent | null;
}
