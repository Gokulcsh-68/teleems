import { Controller, Post, Param, Req, UseGuards, Get, Body } from '@nestjs/common';
import { EpcrServiceService } from './epcr-service.service';
import { JwtAuthGuard } from '../../../libs/common/src/guards/jwt-auth.guard';
import { RolesGuard } from '../../../libs/common/src/guards/roles.guard';
import { Roles } from '../../../libs/common/src/decorators/roles.decorator';
import { GenerateEpcrDto } from './dto/generate-epcr.dto';
import { SubmitSignatureDto } from './dto/submit-signature.dto';

@Controller('v1/epcr')
export class EpcrServiceController {
  constructor(private readonly epcrServiceService: EpcrServiceService) {}

  @Post('generate/:tripId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async generate(
    @Param('tripId') tripId: string,
    @Body() dto: GenerateEpcrDto,
    @Req() req: any,
  ) {
    const authToken = req.headers.authorization;
    return this.epcrServiceService.generateEpcr(tripId, dto, req.user, authToken);
  }

  @Get(':tripId/print')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async getPrintPayload(@Param('tripId') tripId: string, @Req() req: any) {
    const result = await this.epcrServiceService.generateEpcr(tripId, {}, req.user);
    return { data: result.data.thermal_payload };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Hospital Admin', 'Fleet Operator', 'CureSelect Admin')
  async list(@Req() req: any) {
    const filters = {
      trip_id: req.query.trip_id,
      patient_id: req.query.patient_id,
      hospital_id: req.query.hospital_id,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      triage_code: req.query.triage_code,
      limit: req.query.limit ? parseInt(req.query.limit) : 20,
      cursor: req.query.cursor,
    };
    return this.epcrServiceService.listEpcrs(filters);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin', 'Fleet Operator')
  async getOne(@Param('id') id: string) {
    return this.epcrServiceService.getEpcrById(id);
  }

  @Get(':id/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin', 'Fleet Operator')
  async getPdf(@Param('id') id: string) {
    return this.epcrServiceService.getEpcrPdfUrl(id);
  }

  @Get(':id/sections/:sectionName')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin', 'Fleet Operator')
  async getSection(
    @Param('id') id: string,
    @Param('sectionName') sectionName: string,
  ) {
    return this.epcrServiceService.getEpcrSection(id, sectionName);
  }

  @Post(':id/signatures/emt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async addEmtSignature(
    @Param('id') id: string,
    @Body() dto: SubmitSignatureDto,
  ) {
    return this.epcrServiceService.addEmtSignature(id, dto);
  }

  @Post(':id/signatures/doctor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Hospital Admin', 'CureSelect Admin')
  async addDoctorSignature(
    @Param('id') id: string,
    @Body() dto: SubmitSignatureDto,
  ) {
    return this.epcrServiceService.addDoctorSignature(id, dto);
  }

  @Post(':id/signatures/patient')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async addPatientSignature(
    @Param('id') id: string,
    @Body() dto: SubmitSignatureDto,
  ) {
    return this.epcrServiceService.addPatientSignature(id, dto);
  }
}
