import { Controller, Post, Get, Query, Req, UseGuards, Param, Put, Body } from '@nestjs/common';
import { TripService } from './trip.service';
import { TripQueryDto } from './dto/trip-query.dto';
import { UpdateTripStatusDto } from './dto/update-trip-status.dto';
import { StartTripDto } from './dto/start-trip.dto';
import { PatientLoadedDto } from './dto/patient-loaded.dto';
import { AtHospitalDto } from './dto/at-hospital.dto';
import { CancelTripDto } from './dto/cancel-trip.dto';
import { BreakdownDto } from './dto/breakdown.dto';
import { CreateIftTripDto } from './dto/create-ift-trip.dto';
import { VerifyIftDocumentsDto } from './dto/verify-ift-documents.dto';
import { RecordRefusalDto } from './dto/record-refusal.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';
import { JwtAuthGuard } from '../../../libs/common/src/guards/jwt-auth.guard';
import { RolesGuard } from '../../../libs/common/src/guards/roles.guard';
import { Roles } from '../../../libs/common/src/decorators/roles.decorator';

@Controller('v1/trips')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripController {
  constructor(private readonly tripService: TripService) { }

  @Get()
  @Roles('Fleet Operator', 'Hospital Admin', 'CureSelect Admin', 'Call Centre Executive (CCE)')
  async listTrips(@Query() query: TripQueryDto, @Req() req: any) {
    return this.tripService.findAllTrips(query, req.user);
  }

  @Get(':id')
  @Roles('Fleet Operator', 'Hospital Admin', 'CureSelect Admin', 'Call Centre Executive (CCE)')
  async getOneTrip(@Param('id') id: string, @Req() req: any) {
    return this.tripService.findOneTrip(id, req.user);
  }

  @Get(':id/crew')
  @Roles('Fleet Operator', 'Hospital Admin', 'CureSelect Admin', 'Call Centre Executive (CCE)')
  async getTripCrew(@Param('id') id: string, @Req() req: any) {
    return this.tripService.getTripCrew(id, req.user);
  }

  @Get(':id/location-history')
  @Roles('Fleet Operator', 'Hospital Admin', 'CureSelect Admin', 'Call Centre Executive (CCE)')
  async getTripLocationHistory(@Param('id') id: string, @Req() req: any) {
    return this.tripService.findLocationHistory(id, req.user);
  }

  @Put(':id/status')
  @Roles('Pilot', 'Ambulance Pilot (Driver)', 'EMT / Paramedic', 'Fleet Operator', 'Hospital Admin', 'CureSelect Admin')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateTripStatusDto, @Req() req: any) {
    return this.tripService.updateTripStatus(id, dto, req.user);
  }

  @Put(':id/status/start')
  @Roles('Pilot', 'Ambulance Pilot (Driver)', 'CureSelect Admin')
  async startTrip(@Param('id') id: string, @Body() dto: StartTripDto, @Req() req: any) {
    return this.tripService.startTrip(id, dto, req.user);
  }

  @Put(':id/status/at-scene')
  @Roles('Pilot', 'Ambulance Pilot (Driver)', 'EMT / Paramedic', 'CureSelect Admin')
  async markAtScene(@Param('id') id: string, @Body() dto: StartTripDto, @Req() req: any) {
    return this.tripService.markAtScene(id, dto, req.user);
  }

  @Put(':id/status/patient-loaded')
  @Roles('Pilot', 'Ambulance Pilot (Driver)', 'EMT / Paramedic', 'CureSelect Admin')
  async markPatientLoaded(@Param('id') id: string, @Body() dto: PatientLoadedDto, @Req() req: any) {
    return this.tripService.markPatientLoaded(id, dto, req.user);
  }

  @Put(':id/status/at-hospital')
  @Roles('Pilot', 'Ambulance Pilot (Driver)', 'EMT / Paramedic', 'CureSelect Admin')
  async markAtHospital(@Param('id') id: string, @Body() dto: AtHospitalDto, @Req() req: any) {
    return this.tripService.markAtHospital(id, dto, req.user);
  }

  @Put(':id/status/handoff')
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async markHandoff(@Param('id') id: string, @Body() dto: StartTripDto, @Req() req: any) {
    return this.tripService.markHandoff(id, dto, req.user);
  }

  @Put(':id/status/cancel')
  @Roles('Pilot', 'Ambulance Pilot (Driver)', 'Fleet Operator', 'CureSelect Admin', 'Call Centre Executive (CCE)')
  async cancelTrip(@Param('id') id: string, @Body() dto: CancelTripDto, @Req() req: any) {
    return this.tripService.cancelTrip(id, dto, req.user);
  }

  @Put(':id/status/breakdown')
  @Roles('Pilot', 'Ambulance Pilot (Driver)', 'EMT / Paramedic', 'CureSelect Admin')
  async reportBreakdown(@Param('id') id: string, @Body() dto: BreakdownDto, @Req() req: any) {
    return this.tripService.reportBreakdown(id, dto, req.user);
  }

  @Post('ift')
  @Roles('Hospital Admin', 'Fleet Operator', 'CureSelect Admin')
  async createIftTrip(@Body() dto: CreateIftTripDto, @Req() req: any) {
    return this.tripService.createIftTrip(dto, req.user);
  }

  @Get(':id/ift-documents')
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async getIftDocuments(@Param('id') id: string, @Req() req: any) {
    return this.tripService.getIftDocuments(id, req.user);
  }

  @Put(':id/ift-documents')
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async verifyIftDocuments(@Param('id') id: string, @Body() dto: VerifyIftDocumentsDto, @Req() req: any) {
    return this.tripService.verifyIftDocuments(id, dto, req.user);
  }

  @Post(':id/refusal')
  @Roles('EMT / Paramedic', 'CureSelect Admin')
  async recordRefusal(@Param('id') id: string, @Body() dto: RecordRefusalDto, @Req() req: any) {
    return this.tripService.recordRefusal(id, dto, req.user);
  }

  @Get(':id/refusal')
  @Roles('Hospital Admin', 'Fleet Operator', 'CureSelect Admin')
  async getRefusalRecord(@Param('id') id: string, @Req() req: any) {
    return this.tripService.getRefusalRecord(id, req.user);
  }

  @Get(':id/eta')
  @Roles('Caller (Public)', 'Hospital Admin', 'Fleet Operator', 'CureSelect Admin', 'Call Centre Executive (CCE)')
  async getTripEta(@Param('id') id: string, @Req() req: any) {
    return this.tripService.getTripEta(id, req.user);
  }

  @Put(':id/destination')
  @Roles('Pilot', 'Ambulance Pilot (Driver)', 'EMT / Paramedic', 'CureSelect Admin')
  async updateDestination(@Param('id') id: string, @Body() dto: UpdateDestinationDto, @Req() req: any) {
    return this.tripService.updateDestination(id, dto, req.user);
  }

  @Get(':id/route')
  @Roles('Pilot', 'Paramedic', 'EMT / Paramedic', 'CureSelect Admin')
  async getNavigationRoute(@Param('id') id: string, @Req() req: any) {
    return this.tripService.getNavigationRoute(id, req.user);
  }

  @Get(':id/bundle')
  @Roles('CureSelect Admin', 'Hospital Admin', 'Fleet Operator', 'EMT / Paramedic')
  async getMissionBundle(@Param('id') id: string, @Req() req: any) {
    return this.tripService.getMissionBundle(id, req.user);
  }
}
