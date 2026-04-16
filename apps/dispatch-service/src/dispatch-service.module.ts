import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DispatchServiceController } from './dispatch-service.controller';
import { DispatchController } from './dispatch.controller';
import { DispatchServiceService } from './dispatch-service.service';
import { Incident } from './entities/incident.entity';
import { IncidentTimeline } from './entities/incident-timeline.entity';
import { Dispatch } from './entities/dispatch.entity';
import { Vehicle } from '../../fleet-service/src/entities/vehicle.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthModule } from '../../auth-service/src/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Incident, IncidentTimeline, Dispatch, Vehicle]),
    AuthModule,
  ],
  controllers: [DispatchServiceController, DispatchController],
  providers: [DispatchServiceService, JwtStrategy],
  exports: [DispatchServiceService],
})
export class DispatchServiceModule {}

