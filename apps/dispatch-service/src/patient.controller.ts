import { Controller, Post, Body, Req, UseGuards, Get, Param } from '@nestjs/common';
import { PatientService } from './patient.service';
import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import { JwtAuthGuard } from '../../../libs/common/src/guards/jwt-auth.guard';
import { RolesGuard } from '../../../libs/common/src/guards/roles.guard';
import { Roles } from '../../../libs/common/src/decorators/roles.decorator';

@Controller('v1/patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Post()
  @Roles('EMT', 'CureSelect Admin', 'Call Centre Executive (CCE)')
  async createPatient(@Body() dto: CreatePatientProfileDto, @Req() req: any) {
    return this.patientService.createPatient(
      dto, 
      req.user.userId, 
      req.ip, 
      req.get('user-agent')
    );
  }

  @Get('incident/:incidentId')
  @Roles('EMT', 'CureSelect Admin', 'Call Centre Executive (CCE)', 'Hospital Admin')
  async getByIncident(@Param('incidentId') incidentId: string, @Req() req: any) {
    return this.patientService.findByIncident(incidentId, req.user);
  }
}
