import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetServiceController } from './fleet-service.controller';
import { FleetServiceService } from './fleet-service.service';
import { 
  FleetOperator, Organisation, Vehicle, Station, StaffProfile, DutyShift, 
  InventoryItemMaster, VehicleInventory, InventoryLog, DutyRoster 
} from '@app/common';
import { LocationLog } from './entities/location-log.entity';
import { AuthModule } from '../../auth-service/src/auth.module';
import { CommonModule } from '../../../libs/common/src';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehicle,
      LocationLog,
      FleetOperator,
      Organisation,
      Station,
      StaffProfile,
      DutyShift,
      InventoryItemMaster,
      VehicleInventory,
      InventoryLog,
      DutyRoster
    ]),
    AuthModule,
    CommonModule,
  ],
  controllers: [FleetServiceController],
  providers: [FleetServiceService],
  exports: [TypeOrmModule],
})
export class FleetServiceModule {}
