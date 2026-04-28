import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsultService } from './consult.service';
import { ConsultController } from './consult.controller';
import { UserController } from './user.controller';
import { Consult, Incident, User, PatientProfile, CommonModule } from '@app/common';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([Consult, Incident, User, PatientProfile]),
  ],
  controllers: [ConsultController, UserController],
  providers: [ConsultService],
  exports: [ConsultService],
})
export class ConsultModule {}
