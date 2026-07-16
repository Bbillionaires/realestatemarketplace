import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  ParsedDeliveryStatus,
  ParsedInboundMessage,
  SendSmsInput,
  SendSmsResult,
  SmsProvider,
  ValidateWebhookInput,
} from '../interfaces/sms-provider.interface';

export interface MockSentMessage extends SendSmsInput {
  providerMessageId: string;
  sentAt: Date;
}

/**
 * In-memory SMS provider used for local development and automated tests.
 * No network calls are made. `getSentMessages` / `getLastMessageTo` let
 * tests assert on what "went out" (e.g. reading an OTP code) without a real
 * carrier account. Webhook validation always passes here since there is no
 * real signing secret to check.
 */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);
  private readonly sentMessages: MockSentMessage[] = [];

  async sendMessage(input: SendSmsInput): Promise<SendSmsResult> {
    const providerMessageId = `mock_${uuid()}`;
    this.sentMessages.push({ ...input, providerMessageId, sentAt: new Date() });
    this.logger.debug(`[mock-sms] to=${input.to} from=${input.from} body="${input.body}"`);
    return { providerMessageId, status: 'queued' };
  }

  validateWebhook(_input: ValidateWebhookInput): boolean {
    return true;
  }

  parseInboundMessage(input: unknown): ParsedInboundMessage {
    const body = input as Record<string, string>;
    return {
      providerMessageId: body.MessageSid ?? `mock_in_${uuid()}`,
      from: body.From,
      to: body.To,
      body: body.Body ?? '',
      numMedia: parseInt(body.NumMedia ?? '0', 10),
      mediaUrls: [],
    };
  }

  parseDeliveryStatus(input: unknown): ParsedDeliveryStatus {
    const body = input as Record<string, string>;
    return {
      providerMessageId: body.MessageSid,
      status: (body.MessageStatus ?? 'delivered').toLowerCase(),
      errorCode: body.ErrorCode,
    };
  }

  getSentMessages(): readonly MockSentMessage[] {
    return this.sentMessages;
  }

  getLastMessageTo(to: string): MockSentMessage | undefined {
    return [...this.sentMessages].reverse().find((m) => m.to === to);
  }

  clear(): void {
    this.sentMessages.length = 0;
  }
}
