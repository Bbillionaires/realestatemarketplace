import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { SMS_PROVIDER } from './sms.constants';
import { MockSmsProvider } from './providers/mock-sms.provider';

/**
 * Binds the SMS_PROVIDER token to a concrete SmsProvider implementation
 * based on SMS_PROVIDER env var. Only "mock" is wired up in Phase 1; the
 * Twilio/Telnyx implementations land in Phase 2 alongside relay-number
 * routing and inbound/delivery webhooks, and will be added to the switch
 * below without any caller of SMS_PROVIDER needing to change.
 */
@Global()
@Module({
  providers: [
    MockSmsProvider,
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService, MockSmsProvider],
      useFactory: (configService: ConfigService<AppConfig>, mock: MockSmsProvider) => {
        const provider = configService.get('smsProvider', { infer: true });
        switch (provider) {
          case 'mock':
          default:
            return mock;
        }
      },
    },
  ],
  exports: [SMS_PROVIDER, MockSmsProvider],
})
export class SmsModule {}
