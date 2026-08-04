import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { PAYMENT_PROVIDER } from './payments.constants';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { SquarePaymentProvider } from './providers/square-payment.provider';

/**
 * Binds the PAYMENT_PROVIDER token to a concrete PaymentProvider
 * implementation based on the PAYMENT_PROVIDER env var, mirroring
 * SmsModule/EmailModule so no caller needs to know which processor is active.
 */
@Global()
@Module({
  providers: [
    MockPaymentProvider,
    SquarePaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, MockPaymentProvider, SquarePaymentProvider],
      useFactory: (
        configService: ConfigService<AppConfig>,
        mock: MockPaymentProvider,
        square: SquarePaymentProvider,
      ) => {
        const provider = configService.get('paymentProvider', { infer: true });
        switch (provider) {
          case 'square':
            return square;
          case 'mock':
          default:
            return mock;
        }
      },
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentsModule {}
