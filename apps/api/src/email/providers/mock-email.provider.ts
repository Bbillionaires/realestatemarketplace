import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { EmailProvider, SendEmailInput, SendEmailResult } from '../interfaces/email-provider.interface';

export interface MockSentEmail extends Omit<SendEmailInput, 'attachments'> {
  providerMessageId: string;
  sentAt: Date;
  attachmentFilenames: string[];
}

/**
 * In-memory email provider used for local development, tests, and until a
 * real provider (e.g. Resend) is wired up in production. No network calls
 * are made, and attachment bytes are never retained — only filenames, so
 * callers exercising the request/response flow can't accidentally rely on
 * this provider as storage.
 */
@Injectable()
export class MockEmailProvider implements EmailProvider {
  private readonly logger = new Logger(MockEmailProvider.name);
  private readonly sentEmails: MockSentEmail[] = [];

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const providerMessageId = `mock_${uuid()}`;
    const attachmentFilenames = (input.attachments ?? []).map((a) => a.filename);
    this.sentEmails.push({
      to: input.to,
      subject: input.subject,
      text: input.text,
      providerMessageId,
      sentAt: new Date(),
      attachmentFilenames,
    });
    this.logger.debug(
      `[mock-email] to=${input.to} subject="${input.subject}" attachments=${attachmentFilenames.join(', ') || 'none'}`,
    );
    return { providerMessageId, status: 'queued' };
  }

  getSentEmails(): readonly MockSentEmail[] {
    return this.sentEmails;
  }

  getLastEmailTo(to: string): MockSentEmail | undefined {
    return [...this.sentEmails].reverse().find((e) => e.to === to);
  }

  clear(): void {
    this.sentEmails.length = 0;
  }
}
