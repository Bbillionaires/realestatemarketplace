import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { EMAIL_PROVIDER } from './email.constants';
import { MockEmailProvider } from './providers/mock-email.provider';

/**
 * Binds the EMAIL_PROVIDER token to a concrete EmailProvider implementation
 * based on EMAIL_PROVIDER env var. Only "mock" is wired up for now — a
 * "resend" case gets added to the switch below (using AppConfig.resend)
 * once a Resend API key is available, with no caller needing to change.
 */
@Global()
@Module({
  providers: [
    MockEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService, MockEmailProvider],
      useFactory: (configService: ConfigService<AppConfig>, mock: MockEmailProvider) => {
        const provider = configService.get('emailProvider', { infer: true });
        switch (provider) {
          case 'mock':
          default:
            return mock;
        }
      },
    },
  ],
  exports: [EMAIL_PROVIDER, MockEmailProvider],
})
export class EmailModule {}
