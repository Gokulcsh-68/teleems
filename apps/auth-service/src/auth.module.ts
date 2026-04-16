import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuditLogService } from './audit-log.service';
import { User } from './entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Role } from './entities/role.entity';
import { Session } from './entities/session.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import * as fs from 'fs';
import * as path from 'path';

import { APP_GUARD } from '@nestjs/core';
import { GlobalThrottlerModule } from '../../../libs/common/src/throttler/global-throttler.module';
import { DynamicRateLimitGuard } from '../../../libs/common/src/guards/dynamic-rate-limit.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST') || 'localhost',
        port: parseInt(config.get('DB_PORT') || '5433', 10),
        username: config.get('DB_USER') || config.get('DB_USERNAME') || 'postgres',
        password: config.get('DB_PASSWORD') || '',
        database: config.get('DB_NAME') || config.get('DB_DATABASE') || 'teleems',
        entities: [User, AuditLog, Role, Session],
        synchronize: true, // Set to true to auto-create Role table; revert for production migrations
      }),
    }),
    TypeOrmModule.forFeature([User, AuditLog, Role, Session]),
    GlobalThrottlerModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const privateKey = fs.readFileSync(path.join(process.cwd(), 'secrets', 'jwtRS256.key'), 'utf8');
        const publicKey = fs.readFileSync(path.join(process.cwd(), 'secrets', 'jwtRS256.key.pub'), 'utf8');
        return {
          privateKey,
          publicKey,
          signOptions: { 
            expiresIn: config.get('JWT_EXPIRATION') || '3h',
            algorithm: 'RS256'
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuditLogService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: DynamicRateLimitGuard,
    }
  ],
  exports: [JwtModule],
})
export class AuthModule {}
