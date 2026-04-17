import { Controller, Post, Body, Req, UseGuards, Get, Param } from '@nestjs/common';
import { PatientService } from './patient.service';
import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import { RecordVitalsDto } from './dto/record-vitals.dto';
import { RecordGcsDto } from './dto/record-gcs.dto';
import { RecordInterventionDto } from './dto/record-intervention.dto';
import { JwtAuthGuard } from '../../../libs/common/src/guards/jwt-auth.guard';
import { RolesGuard } from '../../../libs/common/src/guards/roles.guard';
import { Roles } from '../../../libs/common/src/decorators/roles.decorator';

@Controller('v1/patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Post()
  @Roles('EMT / Paramedic', 'CureSelect Admin', 'Call Centre Executive (CCE)')
  async createPatient(@Body() dto: CreatePatientProfileDto, @Req() req: any) {
    return this.patientService.createPatient(
      dto, 
      req.user.userId, 
      req.ip, 
      req.get('user-agent')
    );
  }

  @Get('incident/:incidentId')
  @Roles('EMT / Paramedic', 'CureSelect Admin', 'Call Centre Executive (CCE)', 'Hospital Admin')
  async getByIncident(@Param('incidentId') incidentId: string, @Req() req: any) {
    return this.patientService.findByIncident(incidentId, req.user);
  }

  @Post(':id/vitals')
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async recordVitals(@Param('id') id: string, @Body() dto: RecordVitalsDto, @Req() req: any) {
    return this.patientService.recordVitals(id, dto, req.user.userId);
  }

  @Post(':id/gcs')
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async recordGcs(@Param('id') id: string, @Body() dto: RecordGcsDto, @Req() req: any) {
    return this.patientService.recordGcs(id, dto, req.user.userId);
  }

  @Post(':id/interventions')
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async recordIntervention(@Param('id') id: string, @Body() dto: RecordInterventionDto, @Req() req: any) {
    return this.patientService.recordIntervention(id, dto, req.user.userId);
  }

  @Get(':id/clinical')
  @Roles('EMT / Paramedic', 'Hospital Admin', 'Fleet Operator', 'CureSelect Admin')
  async getClinicalHistory(@Param('id') id: string, @Req() req: any) {
    return this.patientService.getClinicalHistory(id, req.user);
  }
}
