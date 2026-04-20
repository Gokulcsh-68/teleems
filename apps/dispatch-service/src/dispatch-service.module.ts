import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DispatchServiceController } from './dispatch-service.controller';
import { TripController } from './trip.controller';
import { DispatchController } from './dispatch.controller';
import { DispatchServiceService } from './dispatch-service.service';
import { TripService } from './trip.service';
import { IncidentTimeline } from './entities/incident-timeline.entity';
import { IncidentEscalation } from './entities/incident-escalation.entity';
import { 
  PatientProfile, 
  PatientAssessment, 
  PatientIntervention,
  Incident,
  Dispatch
} from '@app/common';
import { Vehicle } from '../../fleet-service/src/entities/vehicle.entity';
import { LocationLog } from '../../fleet-service/src/entities/location-log.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthModule } from '../../auth-service/src/auth.module';
import { CommonModule } from '../../../libs/common/src';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Incident, IncidentTimeline, Dispatch, IncidentEscalation, 
      PatientProfile, PatientAssessment, PatientIntervention,
      Vehicle, LocationLog
    ]),
    AuthModule,
    CommonModule,
  ],
  controllers: [DispatchServiceController, TripController, DispatchController],
  providers: [DispatchServiceService, TripService, JwtStrategy],
  exports: [DispatchServiceService],
})
export class DispatchServiceModule {}

