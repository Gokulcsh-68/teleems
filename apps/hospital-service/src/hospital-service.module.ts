import { Module } from '@nestjs/common';
import { HospitalServiceController } from './hospital-service.controller';
import { HospitalServiceService } from './hospital-service.service';

@Module({
  imports: [],
  controllers: [HospitalServiceController],
  providers: [HospitalServiceService],
})
export class HospitalServiceModule {}
