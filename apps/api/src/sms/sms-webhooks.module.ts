import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { SmsWebhooksController } from './sms-webhooks.controller';
import { SmsRoutingService } from './sms-routing.service';

/**
 * Separate from SmsModule (which is @Global and only owns the SMS_PROVIDER
 * binding) so this module can depend on MessagesModule without creating a
 * circular module dependency — SMS_PROVIDER is available here via the
 * global token without needing to import SmsModule directly.
 */
@Module({
  imports: [MessagesModule],
  controllers: [SmsWebhooksController],
  providers: [SmsRoutingService],
})
export class SmsWebhooksModule {}
