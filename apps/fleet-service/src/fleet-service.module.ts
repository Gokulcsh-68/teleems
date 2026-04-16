import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetServiceController } from './fleet-service.controller';
import { FleetServiceService } from './fleet-service.service';
import { Vehicle } from './entities/vehicle.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vehicle]),
  ],
  controllers: [FleetServiceController],
  providers: [FleetServiceService],
  exports: [TypeOrmModule],
})
export class FleetServiceModule {}
