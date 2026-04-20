import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminServiceController } from './admin-service.controller';
import { AdminServiceService } from './admin-service.service';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';
import { CallCentreController } from './call-centre.controller';
import { CallCentreService } from './call-centre.service';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigService } from './platform-config.service';
import { 
  Organisation, 
  SymptomMaster, 
  IncidentCategoryMaster, 
  InventoryItemMaster, 
  Hospital,
  CCEProfile,
  SystemConfig,
  FeatureFlag,
  IotDeviceProfile,
  IcdMaster,
  AllergyMaster,
  MedicationMaster,
  SurgeryMaster,
  HospitalisationMaster,
  MedicationRouteMaster,
  ChiefComplaintMaster,
  InterventionMaster,
  FleetOperator
} from '@app/common';
import { AuthModule } from '../../auth-service/src/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organisation, 
      SymptomMaster, 
      IncidentCategoryMaster, 
      InventoryItemMaster, 
      Hospital,
      CCEProfile,
      SystemConfig,
      FeatureFlag,
      IotDeviceProfile,
      IcdMaster,
      AllergyMaster,
      MedicationMaster,
      SurgeryMaster,
      HospitalisationMaster,
      MedicationRouteMaster,
      ChiefComplaintMaster,
      InterventionMaster,
      FleetOperator
    ]),
    AuthModule,
  ],
  controllers: [
    AdminServiceController, 
    MasterDataController, 
    CallCentreController,
    PlatformConfigController
  ],
  providers: [
    AdminServiceService, 
    MasterDataService, 
    CallCentreService,
    PlatformConfigService
  ],
})
export class AdminServiceModule {}
