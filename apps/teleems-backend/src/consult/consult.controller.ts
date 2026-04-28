import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { ConsultService } from './consult.service';
import { CreateConsultDto, UpdateConsultDto, ConsultQueryDto } from './dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';

@Controller('v1/consults')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConsultController {
  constructor(private readonly consultService: ConsultService) { }

  @Post()
  @Roles('Doctor', 'Emergency doctor', 'CureSelect Admin', 'EMT', 'Paramedic')
  create(@Body() createConsultDto: CreateConsultDto, @Req() req: any) {
    return this.consultService.create(createConsultDto, req.user);
  }

  @Get()
  @Roles('Doctor', 'Emergency doctor', 'CureSelect Admin', 'EMT', 'Paramedic')
  findAll(@Query() query: ConsultQueryDto, @Req() req: any) {
    return this.consultService.findAll(query, req.user);
  }

  @Get(':id')
  @Roles('Doctor', 'Emergency doctor', 'CureSelect Admin', 'EMT', 'Paramedic')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.consultService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('Doctor', 'Emergency doctor', 'CureSelect Admin', 'EMT', 'Paramedic')
  update(@Param('id') id: string, @Body() updateConsultDto: UpdateConsultDto, @Req() req: any) {
    return this.consultService.update(id, updateConsultDto, req.user);
  }

  @Delete(':id')
  @Roles('Doctor', 'Emergency doctor', 'CureSelect Admin')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.consultService.remove(id, req.user);
  }

  @Get(':id/escalate')
  @Roles('Doctor', 'Emergency doctor', 'CureSelect Admin', 'EMT', 'Paramedic')
  escalateGet(@Param('id') id: string, @Query('secondary_doctor_id') secondary_doctor_id: string, @Req() req: any) {
    if (!secondary_doctor_id) {
      throw new BadRequestException('secondary_doctor_id query parameter is required');
    }
    return this.consultService.escalate(id, secondary_doctor_id, req.user);
  }

  @Post(':id/escalate')
  @Roles('Doctor', 'Emergency doctor', 'CureSelect Admin', 'EMT', 'Paramedic')
  escalatePost(@Param('id') id: string, @Body() body: { secondary_doctor_id: string }, @Req() req: any) {
    if (!body.secondary_doctor_id) {
      throw new BadRequestException('secondary_doctor_id is required in body');
    }
    return this.consultService.escalate(id, body.secondary_doctor_id, req.user);
  }

  @Post(':id/notes')
  @Roles('Doctor', 'Emergency doctor', 'CureSelect Admin', 'EMT', 'Paramedic')
  addNote(
    @Param('id') id: string,
    @Body() body: { note_type: 'CLINICAL'|'PRESCRIPTION'|'INSTRUCTION'; content: string; timestamp?: string },
    @Req() req: any
  ) {
    if (!body.note_type || !body.content) {
      throw new BadRequestException('note_type and content are required');
    }
    return this.consultService.addNote(id, body, req.user);
  }

  @Get(':id/notes')
  @Roles('Doctor', 'Emergency doctor', 'CureSelect Admin', 'EMT', 'Paramedic')
  getNotes(@Param('id') id: string, @Req() req: any) {
    return this.consultService.getNotes(id, req.user);
  }

  @Patch(':id/notes/:note_id')
  @Roles('Doctor', 'Emergency doctor', 'CureSelect Admin', 'EMT', 'Paramedic')
  updateNote(
    @Param('id') id: string,
    @Param('note_id') noteId: string,
    @Body() body: { content: string },
    @Req() req: any
  ) {
    if (!body.content) {
      throw new BadRequestException('content is required');
    }
    return this.consultService.updateNote(id, noteId, body.content, req.user);
  }

  @Post(':id/recording/consent')
  @Roles('EMT', 'Paramedic', 'CureSelect Admin')
  recordConsent(
    @Param('id') id: string,
    @Body() body: { 
      consented: boolean; 
      consented_by: string; 
      consent_type?: 'VERBAL' | 'WRITTEN' | 'DIGITAL';
      relationship_to_patient?: string;
      remarks?: string;
      timestamp?: string 
    },
    @Req() req: any
  ) {
    if (body.consented === undefined || !body.consented_by) {
      throw new BadRequestException('consented (boolean) and consented_by (string) are required');
    }
    return this.consultService.recordConsent(id, body, req.user);
  }

  @Get(':id/recording')
  @Roles('CureSelect Admin', 'Emergency doctor', 'Doctor')
  getRecording(@Param('id') id: string, @Req() req: any) {
    return this.consultService.getRecording(id, req.user);
  }

  @Delete(':id/recording')
  @Roles('CureSelect Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRecording(@Param('id') id: string, @Body() body: { reason: string }, @Req() req: any) {
    if (!body.reason) {
      throw new BadRequestException('Deletion reason is required');
    }
    return this.consultService.deleteRecording(id, body.reason, req.user);
  }

}
