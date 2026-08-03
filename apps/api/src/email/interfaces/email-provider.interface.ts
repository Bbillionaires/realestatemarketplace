export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  providerMessageId: string;
  status: string;
}

/**
 * Provider-agnostic email gateway. A real provider (Resend, Postmark,
 * SendGrid) plugs in by implementing this interface; nothing else in the
 * codebase (password reset, lender payment-request forwarding) knows or
 * cares which provider is active.
 */
export interface EmailProvider {
  sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
}
