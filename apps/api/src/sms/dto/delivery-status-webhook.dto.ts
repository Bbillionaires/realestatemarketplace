import { IsOptional, IsString } from 'class-validator';

export class DeliveryStatusWebhookDto {
  @IsString()
  MessageSid!: string;

  @IsOptional()
  @IsString()
  MessageStatus?: string;

  @IsOptional()
  @IsString()
  ErrorCode?: string;
}
