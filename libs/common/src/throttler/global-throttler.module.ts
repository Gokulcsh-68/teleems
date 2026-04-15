import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            limit: 100, // Dummy fallback, overridden dynamically by DynamicRateLimitGuard
            ttl: 60000,
          },
        ],
        storage: new ThrottlerStorageRedisService({
          host: config.get('REDIS_HOST') || 'localhost',
          port: config.get('REDIS_PORT') || 6379,
          password: config.get('REDIS_PASSWORD'),
        }),
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class GlobalThrottlerModule {}
