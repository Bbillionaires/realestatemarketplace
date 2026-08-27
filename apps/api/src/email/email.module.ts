import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { EMAIL_PROVIDER } from './email.constants';
import { MockEmailProvider } from './providers/mock-email.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';

/**
 * Binds the EMAIL_PROVIDER token to a concrete EmailProvider implementation
 * based on the EMAIL_PROVIDER env var.
 */
@Global()
@Module({
  providers: [
    MockEmailProvider,
    ResendEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService, MockEmailProvider, ResendEmailProvider],
      useFactory: (
        configService: ConfigService<AppConfig>,
        mock: MockEmailProvider,
        resend: ResendEmailProvider,
      ) => {
        const provider = configService.get('emailProvider', { infer: true });
        switch (provider) {
          case 'resend':
            return resend;
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
