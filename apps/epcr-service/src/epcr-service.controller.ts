import { Controller, Post, Param, Req, UseGuards, Get, Body, Query } from '@nestjs/common';
import { EpcrServiceService } from './epcr-service.service';
import { JwtAuthGuard } from '../../../libs/common/src/guards/jwt-auth.guard';
import { RolesGuard } from '../../../libs/common/src/guards/roles.guard';
import { Roles } from '../../../libs/common/src/decorators/roles.decorator';
import { GenerateEpcrDto } from './dto/generate-epcr.dto';
import { SubmitSignatureDto } from './dto/submit-signature.dto';
import { SubmitClinicianSignatureDto } from './dto/submit-clinician-signature.dto';
import { AcknowledgeEpcrDto } from './dto/acknowledge-epcr.dto';
import { LinkMrnDto } from './dto/link-mrn.dto';
import { PrintEpcrDto } from './dto/print-epcr.dto';
import { SendEpcrDto } from './dto/send-epcr.dto';
import { CreateMlcRecordDto } from './dto/create-mlc.dto';
import { SetSpecialFlagsDto } from './dto/set-flags.dto';
import { ExportEpcrDto } from './dto/export-epcr.dto';

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
  async list(@Query() query: any) {
    const filters = {
      trip_id: query.trip_id,
      patient_id: query.patient_id,
      hospital_id: query.hospital_id,
      date_from: query.date_from,
      date_to: query.date_to,
      triage_code: query.triage_code,
      limit: query.limit ? parseInt(query.limit) : 20,
      cursor: query.cursor,
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

  @Get(':id/signatures')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin', 'Fleet Operator')
  async getSignatures(@Param('id') id: string) {
    return this.epcrServiceService.getSignaturesByEpcrId(id);
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

  @Post(':id/signatures/clinician')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async addClinicianSignature(
    @Param('id') id: string,
    @Body() dto: SubmitClinicianSignatureDto,
  ) {
    return this.epcrServiceService.addClinicianSignature(id, dto);
  }

  @Get(':id/acknowledge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Fleet Operator', 'CureSelect Admin')
  async getAcknowledgement(@Param('id') id: string) {
    return this.epcrServiceService.getAcknowledgementByEpcrId(id);
  }

  @Post(':id/acknowledge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Hospital Admin', 'CureSelect Admin')
  async acknowledge(
    @Param('id') id: string,
    @Body() dto: AcknowledgeEpcrDto,
  ) {
    return this.epcrServiceService.acknowledgeEpcr(id, dto);
  }

  @Post(':id/link-mrn')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Hospital Admin', 'CureSelect Admin')
  async linkMrn(
    @Param('id') id: string,
    @Body() dto: LinkMrnDto,
  ) {
    return this.epcrServiceService.linkMrn(id, dto);
  }

  @Post(':id/print')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async print(
    @Param('id') id: string,
    @Body() dto: PrintEpcrDto,
  ) {
    return this.epcrServiceService.triggerPrintJob(id, dto);
  }
  @Get(':id/print/:printJobId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async getPrintStatus(
    @Param('id') id: string,
    @Param('printJobId') printJobId: string,
  ) {
    return this.epcrServiceService.getPrintJobStatus(id, printJobId);
  }

  @Post(':id/send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async send(
    @Param('id') id: string,
    @Body() dto: SendEpcrDto,
  ) {
    return this.epcrServiceService.sendEpcr(id, dto);
  }

  @Get(':id/delivery-log')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Fleet Operator', 'CureSelect Admin')
  async getDeliveryLogs(@Param('id') id: string) {
    return this.epcrServiceService.getDeliveryLogs(id);
  }

  @Post(':id/mlc')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async createMlc(
    @Param('id') id: string,
    @Body() dto: CreateMlcRecordDto,
  ) {
    return this.epcrServiceService.createMlcRecord(id, dto);
  }

  @Get(':id/mlc')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'Fleet Operator', 'CureSelect Admin')
  async getMlc(@Param('id') id: string) {
    return this.epcrServiceService.getMlcRecord(id);
  }

  @Post(':id/flags')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async setFlags(
    @Param('id') id: string,
    @Body() dto: SetSpecialFlagsDto,
  ) {
    return this.epcrServiceService.setSpecialFlags(id, dto);
  }

  @Get(':id/hash')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CureSelect Admin')
  async getHash(@Param('id') id: string) {
    return this.epcrServiceService.getEpcrHash(id);
  }

  @Post(':id/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Hospital Admin', 'CureSelect Admin')
  async export(
    @Param('id') id: string,
    @Body() dto: ExportEpcrDto,
  ) {
    return this.epcrServiceService.triggerExportJob(id, dto);
  }

  @Get('export/:jobId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Hospital Admin', 'CureSelect Admin')
  async getExportStatus(@Param('jobId') jobId: string) {
    return this.epcrServiceService.getExportJobStatus(jobId);
  }
}
