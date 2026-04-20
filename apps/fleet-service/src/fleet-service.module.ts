import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetServiceController } from './fleet-service.controller';
import { FleetServiceService } from './fleet-service.service';
import { FleetOperator, Organisation, Vehicle } from '@app/common';
import { LocationLog } from './entities/location-log.entity';
import { AuthModule } from '../../auth-service/src/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vehicle, LocationLog, FleetOperator, Organisation]),
    AuthModule,
  ],
  controllers: [FleetServiceController],
  providers: [FleetServiceService],
  exports: [TypeOrmModule],
})
export class FleetServiceModule {}
