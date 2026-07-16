import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfig } from '../config/configuration';
import { REDIS_CLIENT } from './redis.constants';
import { RedisLifecycle } from './redis-lifecycle.provider';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig>) => {
        const redisUrl = configService.get('redisUrl', { infer: true }) as string;
        return new Redis(redisUrl, { maxRetriesPerRequest: 3 });
      },
    },
    RedisLifecycle,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
