import { Global, Module } from '@nestjs/common';
import { CryptoService } from './utils/crypto.util';
import { RateLimiterService } from '../redis/rate-limiter.service';

@Global()
@Module({
  providers: [CryptoService, RateLimiterService],
  exports: [CryptoService, RateLimiterService],
})
export class CommonModule {}
