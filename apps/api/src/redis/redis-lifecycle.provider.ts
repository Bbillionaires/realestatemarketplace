import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Ensures the shared Redis connection is closed cleanly when the Nest
 * application (or a test module) shuts down, instead of leaving an open
 * socket handle that keeps the process alive.
 */
@Injectable()
export class RedisLifecycle implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
