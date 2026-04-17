import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DispatchServiceController } from './dispatch-service.controller';
import { PatientController } from './patient.controller';
import { TripController } from './trip.controller';
import { DispatchController } from './dispatch.controller';
import { DispatchServiceService } from './dispatch-service.service';
import { PatientService } from './patient.service';
import { TripService } from './trip.service';
import { Incident } from './entities/incident.entity';
import { IncidentTimeline } from './entities/incident-timeline.entity';
import { Dispatch } from './entities/dispatch.entity';
import { IncidentEscalation } from './entities/incident-escalation.entity';
import { PatientProfile } from './entities/patient-profile.entity';
import { PatientAssessment } from './entities/patient-assessment.entity';
import { PatientIntervention } from './entities/patient-intervention.entity';
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
  controllers: [DispatchServiceController, PatientController, TripController, DispatchController],
  providers: [DispatchServiceService, PatientService, TripService, JwtStrategy],
  exports: [DispatchServiceService],
})
export class DispatchServiceModule {}

