import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { EmailProvider, SendEmailInput, SendEmailResult } from '../interfaces/email-provider.interface';

interface ResendSendResponse {
  id?: string;
  message?: string;
  name?: string;
}

/**
 * Resend REST API (https://api.resend.com/emails) — no SDK dependency,
 * matching the raw-fetch style already used by the Square payment provider.
 */
@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);

  constructor(private readonly configService: ConfigService<AppConfig>) {}

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const resend = this.configService.get('resend', { infer: true }) as AppConfig['resend'];

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resend.apiKey}`,
      },
      body: JSON.stringify({
        from: resend.fromAddress,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        attachments: (input.attachments ?? []).map((a) => ({
          filename: a.filename,
          content: a.content.toString('base64'),
        })),
      }),
    });

    const body = (await response.json()) as ResendSendResponse;
    if (!response.ok || !body.id) {
      const detail = body.message ?? `HTTP ${response.status}`;
      this.logger.error(`Resend email send failed: ${detail}`);
      throw new Error(`Failed to send email via Resend: ${detail}`);
    }

    return { providerMessageId: body.id, status: 'queued' };
  }
}
