import { Controller, Get, Post, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { RtvsServiceService } from './rtvs-service.service';
import { SubmitVitalsDto, BulkSubmitVitalsDto, GetVitalsQueryDto, GetVitalsTrendQueryDto } from './dto/submit-vitals.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';

@Controller('v1/rtvs')
export class RtvsServiceController {
  constructor(private readonly rtvsServiceService: RtvsServiceService) {}

  @Get()
  getHello(): string {
    return this.rtvsServiceService.getHello();
  }

  @Post('vitals')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'EMT Device', 'CureSelect Admin')
  async submitVitals(
    @Body() dto: SubmitVitalsDto,
    @Req() req: any,
  ) {
    return this.rtvsServiceService.submitVitals(dto, req.user);
  }

  @Post('vitals/bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'EMT Device', 'CureSelect Admin')
  async submitBulkVitals(@Body() dto: BulkSubmitVitalsDto, @Req() req: any) {
    return this.rtvsServiceService.submitBulkVitals(dto, req.user);
  }

  @Get(':incident_id/:patient_id/vitals')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    'EMT / Paramedic',
    'Hospital Admin',
    'Doctor',
    'Nurse',
    'CureSelect Admin',
  )
  async getHistoricalVitals(
    @Param('incident_id') incidentId: string,
    @Param('patient_id') patientId: string,
    @Query() query: GetVitalsQueryDto,
  ) {
    return this.rtvsServiceService.getHistoricalVitals(
      incidentId,
      patientId,
      query,
    );
  }

  @Get(':incident_id/:patient_id/vitals/latest')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    'EMT / Paramedic',
    'Hospital Admin',
    'Doctor',
    'Nurse',
    'CureSelect Admin',
  )
  async getLatestVitals(
    @Param('incident_id') incidentId: string,
    @Param('patient_id') patientId: string,
    @Req() req: any,
  ) {
    return this.rtvsServiceService.getLatestVitals(
      incidentId,
      patientId,
      req.user,
    );
  }

  @Get(':incident_id/:patient_id/vitals/trend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Hospital Admin', 'Doctor', 'Nurse', 'CureSelect Admin')
  async getVitalsTrend(
    @Param('incident_id') incidentId: string,
    @Param('patient_id') patientId: string,
    @Query() query: GetVitalsTrendQueryDto,
    @Req() req: any,
  ) {
    return this.rtvsServiceService.getVitalsTrend(
      incidentId,
      patientId,
      query,
      req.user,
    );
  }
}
