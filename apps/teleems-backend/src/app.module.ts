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

// Common Library
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
  FleetOperator,
  Vehicle
} from '@app/common';

// Entities for global TypeORM config
import { User } from '../../auth-service/src/entities/user.entity';
import { Role } from '../../auth-service/src/entities/role.entity';
import { Session } from '../../auth-service/src/entities/session.entity';
import { Incident } from '../../dispatch-service/src/entities/incident.entity';
import { IncidentTimeline } from '../../dispatch-service/src/entities/incident-timeline.entity';
import { Dispatch } from '../../dispatch-service/src/entities/dispatch.entity';
import { RtvsRecord } from '../../rtvs-service/src/entities/rtvs-record.entity';
import { LocationLog } from '../../fleet-service/src/entities/location-log.entity';
import { PatientProfile } from '../../dispatch-service/src/entities/patient-profile.entity';
import { PatientAssessment } from '../../dispatch-service/src/entities/patient-assessment.entity';
import { PatientIntervention } from '../../dispatch-service/src/entities/patient-intervention.entity';
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
        username: config.get('DB_USER') || config.get('DB_USERNAME') || 'postgres',
        password: config.get('DB_PASSWORD') || '',
        database: config.get('DB_NAME') || config.get('DB_DATABASE') || 'teleems',
        entities: [
          User, AuditLog, Role, Session, 
          Incident, IncidentTimeline, Dispatch, IncidentEscalation, PatientProfile,
          PatientAssessment, PatientIntervention,
          RtvsRecord, Vehicle, LocationLog,
          Organisation, Hospital, FleetOperator, Department,
          SymptomMaster, IncidentCategoryMaster, InventoryItemMaster,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
