import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private publisher: Redis;
  private subscriber: Redis;
  private client: Redis;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');

    const options = {
      host,
      port,
      password,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    };

    this.client = new Redis(options);
    this.publisher = new Redis(options);
    this.subscriber = new Redis(options);
  }

  onModuleInit() {
    // Initialized in constructor
  }

  onModuleDestroy() {
    this.client.quit();
    this.publisher.quit();
    this.subscriber.quit();
  }

  // --- Key-Value Operations ---

  async set(key: string, value: any, ttlSeconds?: number) {
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.set(key, data, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, data);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string) {
    await this.client.del(key);
  }

  // --- Hash Operations (Useful for status dashboards) ---

  async hset(key: string, field: string, value: any) {
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    await this.client.hset(key, field, data);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  // --- Pub/Sub Operations ---

  async publish(channel: string, message: any) {
    const payload =
      typeof message === 'string' ? message : JSON.stringify(message);
    await this.publisher.publish(channel, payload);
  }

  async subscribe(channel: string, callback: (message: string) => void) {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (chan, msg) => {
      if (chan === channel) {
        callback(msg);
      }
    });
  }

  async pSubscribe(
    pattern: string,
    callback: (channel: string, message: string) => void,
  ) {
    await this.subscriber.psubscribe(pattern);
    this.subscriber.on('pmessage', (patternMatch, channel, message) => {
      if (patternMatch === pattern) {
        callback(channel, message);
      }
    });
  }
}
