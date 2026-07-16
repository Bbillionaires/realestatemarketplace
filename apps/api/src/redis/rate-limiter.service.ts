import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * Fixed-window rate limiter backed by Redis. Used for auth attempts, OTP
 * sends/verifies, and outbound SMS send caps so a single misbehaving client
 * can't rack up SMS provider cost or hammer login.
 */
@Injectable()
export class RateLimiterService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const redisKey = `ratelimit:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }
    const ttl = await this.redis.ttl(redisKey);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetSeconds: ttl >= 0 ? ttl : windowSeconds,
    };
  }
}
