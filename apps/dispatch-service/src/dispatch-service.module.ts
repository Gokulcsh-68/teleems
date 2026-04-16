import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DispatchServiceController } from './dispatch-service.controller';
import { DispatchServiceService } from './dispatch-service.service';
import { Incident } from './entities/incident.entity';
import { JwtStrategy } from './strategies/jwt.strategy';

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
        entities: [Incident],
        synchronize: true,
      }),
    }),
    TypeOrmModule.forFeature([Incident]),
  ],
  controllers: [DispatchServiceController],
  providers: [DispatchServiceService, JwtStrategy],
})
export class DispatchServiceModule {}
