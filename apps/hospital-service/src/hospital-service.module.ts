import { Module } from '@nestjs/common';
import { HospitalServiceController } from './hospital-service.controller';
import { HospitalServiceService } from './hospital-service.service';
import { HospitalOpsController } from './hospital-ops.controller';
import { HospitalOpsService } from './hospital-ops.service';

import { TypeOrmModule } from '@nestjs/typeorm';
import { Hospital, HospitalStatus } from '@app/common';
import { AuthModule } from '../../auth-service/src/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Hospital, HospitalStatus]),
    AuthModule,
  ],
  controllers: [HospitalServiceController, HospitalOpsController],
  providers: [HospitalServiceService, HospitalOpsService],
})
export class HospitalServiceModule {}
