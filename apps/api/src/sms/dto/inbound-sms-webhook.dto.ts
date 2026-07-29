import { IsOptional, IsString } from 'class-validator';

/**
 * Shape mirrors the field names carriers like Twilio POST as
 * application/x-www-form-urlencoded webhook bodies (From/To/Body/
 * MessageSid/NumMedia). SmsProvider.parseInboundMessage is what actually
 * interprets these per-provider; this DTO only validates the wire shape.
 */
export class InboundSmsWebhookDto {
  @IsString()
  From!: string;

  @IsString()
  To!: string;

  @IsOptional()
  @IsString()
  Body?: string;

  @IsOptional()
  @IsString()
  MessageSid?: string;

  @IsOptional()
  @IsString()
  NumMedia?: string;
}
