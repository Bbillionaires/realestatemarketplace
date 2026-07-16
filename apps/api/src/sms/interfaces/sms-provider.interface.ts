export interface SendSmsInput {
  to: string;
  from: string;
  body: string;
  mediaUrls?: string[];
}

export interface SendSmsResult {
  providerMessageId: string;
  status: string;
}

export interface ValidateWebhookInput {
  signature: string;
  url: string;
  rawBody: string;
  params?: Record<string, string>;
}

export interface ParsedInboundMessage {
  providerMessageId: string;
  from: string;
  to: string;
  body: string;
  numMedia: number;
  mediaUrls: string[];
}

export interface ParsedDeliveryStatus {
  providerMessageId: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Provider-agnostic SMS gateway. Twilio, Telnyx, Sinch, or any future
 * carrier plug in by implementing this interface; nothing else in the
 * codebase (relay routing, moderation, delivery tracking) knows or cares
 * which provider is active.
 */
export interface SmsProvider {
  sendMessage(input: SendSmsInput): Promise<SendSmsResult>;
  validateWebhook(input: ValidateWebhookInput): boolean;
  parseInboundMessage(input: unknown): ParsedInboundMessage;
  parseDeliveryStatus(input: unknown): ParsedDeliveryStatus;
}
