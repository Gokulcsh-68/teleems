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
    TypeOrmModule.forFeature([User, AuditLog, Role, Session]),
    GlobalThrottlerModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        let privateKey = config.get('JWT_PRIVATE_KEY');
        let publicKey = config.get('JWT_PUBLIC_KEY');

        if (!privateKey || !publicKey) {
          try {
            privateKey = fs.readFileSync(path.join(process.cwd(), 'secrets', 'jwtRS256.key'), 'utf8');
            publicKey = fs.readFileSync(path.join(process.cwd(), 'secrets', 'jwtRS256.key.pub'), 'utf8');
          } catch (e) {
            console.error('CRITICAL: JWT keys not found in ENV and secrets folder is missing!', e.message);
            throw e; 
          }
        }

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
  exports: [AuthService, JwtModule, AuditLogService],
})
export class AuthModule {}

