import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuditLogService } from './services/audit-log.service';
import { RedisService } from './redis.service';
import { MapsService } from './maps.service';
import { StorageService } from './storage.service';
import { Organisation } from './entities/organisation.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Hospital } from './entities/hospital.entity';
import { SymptomMaster } from './entities/symptom-master.entity';
import { IncidentCategoryMaster } from './entities/incident-category-master.entity';
import { InventoryItemMaster } from './entities/inventory-item-master.entity';
import { CCEProfile } from './entities/cce-profile.entity';
import { SystemConfig } from './entities/system-config.entity';
import { FeatureFlag } from './entities/feature-flag.entity';
import { IotDeviceProfile } from './entities/iot-device-profile.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organisation, 
      AuditLog, 
      Hospital, 
      SymptomMaster, 
      IncidentCategoryMaster, 
      InventoryItemMaster,
      CCEProfile,
      SystemConfig,
      FeatureFlag,
      IotDeviceProfile
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [AuditLogService, RedisService, MapsService, StorageService],
  exports: [AuditLogService, RedisService, MapsService, StorageService, TypeOrmModule, JwtModule],
})
export class CommonModule {}
