import { Module } from '@nestjs/common';
import { HospitalServiceController } from './hospital-service.controller';
import { HospitalServiceService } from './hospital-service.service';

import { TypeOrmModule } from '@nestjs/typeorm';
import { Hospital } from '@app/common';
import { AuthModule } from '../../auth-service/src/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Hospital]),
    AuthModule,
  ],
  controllers: [HospitalServiceController],
  providers: [HospitalServiceService],
})
export class HospitalServiceModule {}
