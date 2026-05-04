import { Module } from '@nestjs/common';
import { HospitalServiceController } from './hospital-service.controller';
import { HospitalServiceService } from './hospital-service.service';
import { HospitalOpsController } from './hospital-ops.controller';
import { HospitalOpsService } from './hospital-ops.service';

import { TypeOrmModule } from '@nestjs/typeorm';
import { Hospital, HospitalStatus, Department } from '@app/common';
import { AuthModule } from '../../auth-service/src/auth.module';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { CommonModule } from '../../../libs/common/src';

@Module({
  imports: [
    TypeOrmModule.forFeature([Hospital, HospitalStatus, Department]),
    AuthModule,
    CommonModule,
  ],
  controllers: [
    HospitalServiceController,
    HospitalOpsController,
    DepartmentController,
  ],
  providers: [HospitalServiceService, HospitalOpsService, DepartmentService],
})
export class HospitalServiceModule {}
