import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Import Feature Modules from other "apps"
import { AuthModule } from '../../auth-service/src/auth.module';
import { DispatchServiceModule } from '../../dispatch-service/src/dispatch-service.module';
import { AdminServiceModule } from '../../admin-service/src/admin-service.module';
import { EpcrServiceModule } from '../../epcr-service/src/epcr-service.module';
import { FleetServiceModule } from '../../fleet-service/src/fleet-service.module';
import { HospitalServiceModule } from '../../hospital-service/src/hospital-service.module';
import { NotificationServiceModule } from '../../notification-service/src/notification-service.module';
import { RtvsServiceModule } from '../../rtvs-service/src/rtvs-service.module';
import { PatientServiceModule } from '../../patient-service/src/patient-service.module';
import { TelelinkModule } from './telelink/telelink.module';
import { ConsultModule } from './consult/consult.module';

import {
  Organisation,
  Hospital,
  Department,
  AuditLog,
  SymptomMaster,
  IncidentCategoryMaster,
  InventoryItemMaster,
  CCEProfile,
  SystemConfig,
  FeatureFlag,
  IotDeviceProfile,
  PatientProfile,
  PatientAssessment,
  PatientAssessmentNote,
  PatientIntervention,
  PatientCondition,
  IcdMaster,
  PatientAllergy,
  PatientMedication,
  PatientSurgery,
  PatientHospitalisation,
  AllergyMaster,
  MedicationMaster,
  SurgeryMaster,
  HospitalisationMaster,
  PatientMedicationLog,
  VehicleInventory,
  MedicationRouteMaster,
  ChiefComplaintMaster,
  InterventionMaster,
  Incident,
  Dispatch,
  FleetOperator,
  Vehicle,
  Station,
  StaffProfile,
  StaffType,
  StaffStatus,
  DutyShift,
  DutyShiftStatus,
  InventoryLog,
  DutyRoster
} from '@app/common';

// Entities for global TypeORM config
import { User, Role, Session } from '@app/common';
import { IncidentTimeline } from '../../dispatch-service/src/entities/incident-timeline.entity';
import { RtvsRecord } from '../../rtvs-service/src/entities/rtvs-record.entity';
import { LocationLog } from '../../fleet-service/src/entities/location-log.entity';
import { IncidentEscalation } from '../../dispatch-service/src/entities/incident-escalation.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST') || 'localhost',
        port: parseInt(config.get('DB_PORT') || '5433', 10),
        username:
          config.get('DB_USER') || config.get('DB_USERNAME') || 'postgres',
        password: config.get('DB_PASSWORD') || '',
        database:
          config.get('DB_NAME') || config.get('DB_DATABASE') || 'teleems',
        entities: [
          User, AuditLog, Role, Session, 
          Incident, IncidentTimeline, Dispatch, IncidentEscalation, PatientProfile,
          PatientAssessment, PatientAssessmentNote, PatientIntervention, PatientCondition, IcdMaster,
          PatientAllergy, PatientMedication, PatientSurgery, PatientHospitalisation,
          AllergyMaster, MedicationMaster, SurgeryMaster, HospitalisationMaster,
          PatientMedicationLog, MedicationRouteMaster,
          ChiefComplaintMaster, InterventionMaster,
          RtvsRecord, Vehicle, LocationLog, Station, StaffProfile, DutyShift,
          Organisation, Hospital, FleetOperator, Department,
          SymptomMaster, IncidentCategoryMaster, InventoryItemMaster,
          VehicleInventory, InventoryLog, DutyRoster,
          CCEProfile, SystemConfig, FeatureFlag, IotDeviceProfile
        ],
        synchronize: true, // Auto-create tables; revert for prod migrations
      }),
    }),
    AuthModule,
    DispatchServiceModule,
    AdminServiceModule,
    EpcrServiceModule,
    FleetServiceModule,
    HospitalServiceModule,
    NotificationServiceModule,
    RtvsServiceModule,
    PatientServiceModule,
    TelelinkModule,
    ConsultModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
