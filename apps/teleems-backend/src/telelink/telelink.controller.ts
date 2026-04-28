import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  Param,
  Query,
} from '@nestjs/common';
import { TelelinkService } from './telelink.service';
import {
  CreateTeleLinkSessionDto,
  CreateDoctorConsultDto,
  UpdateTeleLinkStatusDto,
  AddClinicalNotesDto,
  RescheduleTeleLinkSessionDto,
  CancelTeleLinkSessionDto,
} from './dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';

@Controller('v1/telelink')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TelelinkController {
  constructor(private readonly telelinkService: TelelinkService) { }

  @Post('sessions')
  @Roles('EMT', 'Paramedic', 'CureSelect Admin', 'Doctor')
  createSession(@Body() dto: CreateTeleLinkSessionDto, @Req() req: any) {
    return this.telelinkService.createSession(dto, req.user);
  }

  @Post('doctor-consult')
  @Roles('Doctor', 'CureSelect Admin')
  createDoctorConsult(@Body() dto: CreateDoctorConsultDto, @Req() req: any) {
    return this.telelinkService.createDoctorConsult(dto, req.user);
  }

  @Get()
  @Roles('EMT', 'Paramedic', 'CureSelect Admin', 'Doctor')
  findAll(@Req() req: any) {
    return this.telelinkService.findAll(req.user);
  }

  @Get('consult/:consultId')
  @Roles('EMT', 'Paramedic', 'CureSelect Admin', 'Doctor')
  getConsultById(@Param('consultId') consultId: string) {
    return this.telelinkService.getConsultById(consultId);
  }

  @Get(':id')
  @Roles('EMT', 'Paramedic', 'CureSelect Admin', 'Doctor')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.telelinkService.findOne(id, req.user);
  }

  @Patch(':id/status')
  @Roles('EMT', 'Paramedic', 'CureSelect Admin', 'Doctor')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTeleLinkStatusDto,
    @Req() req: any,
  ) {
    return this.telelinkService.updateStatus(id, dto, req.user);
  }

  @Post(':id/clinical-notes')
  @Roles('Doctor', 'Paramedic', 'CureSelect Admin')
  addClinicalNotes(
    @Param('id') id: string,
    @Body() dto: AddClinicalNotesDto,
    @Req() req: any,
  ) {
    return this.telelinkService.addClinicalNotes(id, dto, req.user);
  }

  @Patch(':id/reschedule')
  @Roles('EMT', 'Paramedic', 'CureSelect Admin', 'Doctor')
  rescheduleSession(
    @Param('id') id: string,
    @Body() dto: RescheduleTeleLinkSessionDto,
    @Req() req: any,
  ) {
    return this.telelinkService.rescheduleSession(id, dto, req.user);
  }

  @Patch(':id/cancel')
  @Roles('EMT', 'Paramedic', 'CureSelect Admin', 'Doctor')
  cancelSession(
    @Param('id') id: string,
    @Body() dto: CancelTeleLinkSessionDto,
    @Req() req: any,
  ) {
    return this.telelinkService.cancelSession(id, dto, req.user);
  }

  @Get('details/token-validate')
  @Roles('EMT', 'Paramedic', 'CureSelect Admin', 'Doctor')
  getDetails(@Query('token') token: string) {
    return this.telelinkService.getConsultDetailsByToken(token);
  }
}
