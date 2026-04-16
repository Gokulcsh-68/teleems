import { ThrottlerStorage } from '@nestjs/throttler';
import Redis, { RedisOptions } from 'ioredis';

export class RedisThrottlerStorage implements ThrottlerStorage {
  private redis: Redis;

  constructor(options?: RedisOptions | string) {
    if (typeof options === 'string') {
      this.redis = new Redis(options);
    } else if (options) {
      this.redis = new Redis(options);
    } else {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const blockKey = `${key}:block`;
    const blockedDuration = await this.redis.pttl(blockKey);

    let isBlocked = blockedDuration > 0;
    let timeToBlockExpire = isBlocked ? blockedDuration : 0;
    let totalHits = 0;
    let timeToExpire = 0;

    if (!isBlocked) {
      totalHits = await this.redis.incr(key);
      const pttl = await this.redis.pttl(key);

      if (pttl === -1 || totalHits === 1) {
        await this.redis.pexpire(key, ttl);
        timeToExpire = ttl;
      } else {
        timeToExpire = pttl;
      }

      if (totalHits > limit) {
        isBlocked = true;
        await this.redis.set(blockKey, 1, 'PX', blockDuration);
        timeToBlockExpire = blockDuration;
      }
    } else {
      totalHits = parseInt((await this.redis.get(key)) || '0', 10);
      timeToExpire = await this.redis.pttl(key);
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire,
    };
  }
}
