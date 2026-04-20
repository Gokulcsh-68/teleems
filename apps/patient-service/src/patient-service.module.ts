import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { 
  CommonModule, 
  PatientProfile, 
  PatientAssessment,
  PatientAssessmentNote,
  PatientIntervention,
  PatientCondition,
  PatientAllergy,
  PatientMedication,
  PatientSurgery,
  PatientHospitalisation
} from '@app/common';
import { PatientController } from './patient-service.controller';
import { PatientService } from './patient-service.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([
      PatientProfile, 
      PatientAssessment, 
      PatientAssessmentNote,
      PatientIntervention,
      PatientCondition,
      PatientAllergy,
      PatientMedication,
      PatientSurgery,
      PatientHospitalisation
    ]),
  ],
  controllers: [PatientController],
  providers: [PatientService],
  exports: [PatientService],
})
export class PatientServiceModule {}
