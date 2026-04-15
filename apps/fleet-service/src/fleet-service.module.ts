import { Module } from '@nestjs/common';
import { FleetServiceController } from './fleet-service.controller';
import { FleetServiceService } from './fleet-service.service';

@Module({
  imports: [],
  controllers: [FleetServiceController],
  providers: [FleetServiceService],
})
export class FleetServiceModule {}
