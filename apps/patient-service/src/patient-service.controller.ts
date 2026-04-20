import { Controller, Post, Body, Req, UseGuards, Get, Param, Patch, Put, HttpCode, Delete } from '@nestjs/common';
import { PatientService } from './patient-service.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { RecordVitalsDto } from './dto/record-vitals.dto';
import { RecordGcsDto } from './dto/record-gcs.dto';
import { 
  CreateInterventionDto, 
  RecordCprDto, 
  RecordDefibDto, 
  RecordIntubationDto 
} from './dto/clinical-intervention.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { FullUpdatePatientDto } from './dto/full-update-patient.dto';
import { MrnLookupDto } from './dto/mrn-lookup.dto';
import { AbhaLookupDto } from './dto/abha-lookup.dto';
import { AddConditionDto } from './dto/add-condition.dto';
import { RecordMedicationDto } from './dto/record-medication.dto';
import { RecordAllergyDto } from './dto/record-allergy.dto';
import { LogMedicationDto } from './dto/medication-administration.dto';
import { UpdateMedicalHistoryDto } from './dto/update-medical-history.dto';
import { 
  CreateClinicalAssessmentDto, 
  UpdateClinicalAssessmentDto, 
  CreateAssessmentNoteDto 
} from './dto/clinical-assessment.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';

@Controller('v1/patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Post()
  @Roles('EMT / Paramedic', 'CureSelect Admin', 'Call Centre Executive (CCE)')
  async createPatient(@Body() dto: CreatePatientDto, @Req() req: any) {
    return this.patientService.createPatient(
      dto, 
      req.user, 
      req.ip, 
      req.get('user-agent')
    );
  }

  @Patch(':id')
  @Roles('EMT / Paramedic', 'CureSelect Admin', 'Call Centre Executive (CCE)', 'Hospital Admin')
  async updatePatient(@Param('id') id: string, @Body() dto: UpdatePatientDto, @Req() req: any) {
    return this.patientService.updatePatient(id, dto, req.user, req.ip);
  }

  @Put(':id')
  @Roles('EMT / Paramedic', 'CureSelect Admin', 'Call Centre Executive (CCE)', 'Hospital Admin')
  async fullUpdatePatient(@Param('id') id: string, @Body() dto: FullUpdatePatientDto, @Req() req: any) {
    return this.patientService.fullUpdatePatient(id, dto, req.user, req.ip);
  }

  @Get(':id')
  @Roles('EMT / Paramedic', 'CureSelect Admin', 'Call Centre Executive (CCE)', 'Hospital Admin')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.patientService.findOneForUser(id, req.user);
  }

  @Get(':id/history')
  @Roles('EMT / Paramedic', 'CureSelect Admin', 'Call Centre Executive (CCE)', 'Hospital Admin')
  async getHistory(@Param('id') id: string, @Req() req: any) {
    return this.patientService.getGlobalHistory(id, req.user);
  }

  @Post('lookup/mrn')
  @HttpCode(200)
  @Roles('EMT / Paramedic', 'CureSelect Admin', 'Call Centre Executive (CCE)', 'Hospital Admin')
  async lookupByMrn(@Body() dto: MrnLookupDto, @Req() req: any) {
    return this.patientService.lookupByMrn(dto, req.user);
  }

  @Post('lookup/abha')
  @HttpCode(200)
  @Roles('EMT / Paramedic', 'CureSelect Admin', 'Call Centre Executive (CCE)', 'Hospital Admin')
  async lookupByAbha(@Body() dto: AbhaLookupDto, @Req() req: any) {
    return this.patientService.lookupByAbha(dto, req.user);
  }

  @Get('incident/:incidentId')
  @Roles('EMT / Paramedic', 'CureSelect Admin', 'Call Centre Executive (CCE)', 'Hospital Admin')
  async getByIncident(@Param('incidentId') incidentId: string) {
    return this.patientService.findByIncident(incidentId);
  }

  @Post(':id/medications')
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async administerMedication(@Param('id') id: string, @Body() dto: LogMedicationDto, @Req() req: any) {
    return this.patientService.administerMedication(id, dto, req.user, req.ip);
  }

  @Get(':id/medications')
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async getMedicationLogs(@Param('id') id: string, @Req() req: any) {
    return this.patientService.getMedicationLogs(id, req.user);
  }

  @Delete(':id/medications/:medLogId')
  @HttpCode(204)
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async deleteMedicationLog(
    @Param('id') id: string,
    @Param('medLogId') medLogId: string,
    @Req() req: any
  ) {
    return this.patientService.deleteMedicationLog(id, medLogId, req.user, req.ip);
  }

  @Post(':id/vitals')
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async recordVitals(@Param('id') id: string, @Body() dto: RecordVitalsDto, @Req() req: any) {
    return this.patientService.recordVitals(id, dto, req.user, req.ip);
  }

  @Post(':id/gcs')
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async recordGcs(@Param('id') id: string, @Body() dto: RecordGcsDto, @Req() req: any) {
    return this.patientService.recordGcs(id, dto, req.user, req.ip);
  }

  @Post(':id/interventions')
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async recordIntervention(@Param('id') id: string, @Body() dto: CreateInterventionDto, @Req() req: any) {
    return this.patientService.recordIntervention(id, dto, req.user, req.ip);
  }

  @Post(':id/interventions/cpr')
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async recordCpr(@Param('id') id: string, @Body() dto: RecordCprDto, @Req() req: any) {
    return this.patientService.recordCpr(id, dto, req.user, req.ip);
  }

  @Post(':id/interventions/defibrillation')
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async recordDefib(@Param('id') id: string, @Body() dto: RecordDefibDto, @Req() req: any) {
    return this.patientService.recordDefibrillation(id, dto, req.user, req.ip);
  }

  @Post(':id/interventions/intubation')
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async recordIntubation(@Param('id') id: string, @Body() dto: RecordIntubationDto, @Req() req: any) {
    return this.patientService.recordIntubation(id, dto, req.user, req.ip);
  }

  @Get(':id/interventions')
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async getInterventions(@Param('id') id: string, @Req() req: any) {
    return this.patientService.getInterventions(id, req.user);
  }

  @Delete(':id/interventions/:interventionId')
  @HttpCode(204)
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async deleteIntervention(
    @Param('id') id: string, 
    @Param('interventionId') interventionId: string, 
    @Req() req: any
  ) {
    return this.patientService.deleteIntervention(id, interventionId, req.user, req.ip);
  }

  @Post(':id/medical-history')
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async recordMedicalHistory(@Param('id') id: string, @Body() dto: UpdateMedicalHistoryDto, @Req() req: any) {
    return this.patientService.recordMedicalHistory(id, dto, req.user, req.ip);
  }

  @Delete(':id/medical-history/conditions/:cond_id')
  @HttpCode(204)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async removeCondition(@Param('id') id: string, @Param('cond_id') condId: string, @Req() req: any) {
    await this.patientService.removeCondition(id, condId, req.user);
  }

  @Delete(':id/medical-history/medications/:med_id')
  @HttpCode(204)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async removeMedication(@Param('id') id: string, @Param('med_id') medId: string, @Req() req: any) {
    await this.patientService.removeMedication(id, medId, req.user);
  }

  @Delete(':id/medical-history/allergies/:allergy_id')
  @HttpCode(204)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async removeAllergy(@Param('id') id: string, @Param('allergy_id') allergyId: string, @Req() req: any) {
    await this.patientService.removeAllergy(id, allergyId, req.user);
  }

  @Put(':id/medical-history')
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async updateMedicalHistory(@Param('id') id: string, @Body() dto: UpdateMedicalHistoryDto, @Req() req: any) {
    return this.patientService.updateMedicalHistory(id, dto, req.user);
  }

  @Get(':id/medical-history')
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async getMedicalHistory(@Param('id') id: string, @Req() req: any) {
    return this.patientService.getMedicalHistory(id, req.user);
  }

  @Get(':id/clinical')
  @Roles('EMT / Paramedic', 'Hospital Admin', 'Fleet Operator', 'CureSelect Admin')
  async getClinicalHistory(@Param('id') id: string, @Req() req: any) {
    return this.patientService.getClinicalHistory(id, req.user);
  }

  // --- Spec 5.3: Clinical Assessment ---

  @Post(':id/assessments')
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async recordAssessment(@Param('id') id: string, @Body() dto: CreateClinicalAssessmentDto, @Req() req: any) {
    return this.patientService.recordAssessment(id, dto, req.user, req.ip);
  }

  @Get(':id/assessments')
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async listAssessments(@Param('id') id: string, @Req() req: any) {
    return this.patientService.getAssessments(id, req.user);
  }

  @Get(':id/assessments/latest')
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async getLatestAssessment(@Param('id') id: string, @Req() req: any) {
    return this.patientService.getLatestAssessment(id, req.user);
  }

  @Patch(':id/assessments/:assessmentId')
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async updateAssessment(
    @Param('assessmentId') assessmentId: string,
    @Body() dto: UpdateClinicalAssessmentDto,
    @Req() req: any
  ) {
    return this.patientService.updateAssessment(assessmentId, dto, req.user, req.ip);
  }

  @Post(':id/assessments/:assessmentId/notes')
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async addNote(
    @Param('assessmentId') assessmentId: string,
    @Body() dto: CreateAssessmentNoteDto,
    @Req() req: any
  ) {
    return this.patientService.addAssessmentNote(assessmentId, dto, req.user, req.ip);
  }
}
