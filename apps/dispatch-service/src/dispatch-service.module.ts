import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DispatchServiceController } from './dispatch-service.controller';
import { DispatchServiceService } from './dispatch-service.service';
import { Incident } from './entities/incident.entity';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([Incident]),
  ],
  controllers: [DispatchServiceController],
  providers: [DispatchServiceService, JwtStrategy],
  exports: [DispatchServiceService],
})
export class DispatchServiceModule {}

