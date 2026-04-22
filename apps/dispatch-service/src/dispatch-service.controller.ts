import { Controller, Post, Body, Req, UseGuards, HttpCode, Get, Query, Param, Patch, Delete, Put } from '@nestjs/common';
import { DispatchServiceService, AuditContext } from './dispatch-service.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentStatusDto, AssignVehicleDto, UpdateIncidentDto, CancelIncidentDto } from './dto/update-incident.dto';
import { DispatchIncidentDto } from './dto/dispatch-incident.dto';
import { ReassignVehicleDto } from './dto/reassign-vehicle.dto';
import { CancelDispatchDto } from './dto/cancel-dispatch.dto';
import { RecommendVehicleDto } from './dto/recommend-vehicle.dto';
import { BulkAddPatientsDto } from './dto/bulk-add-patients.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { IncidentQueryDto } from './dto/incident-query.dto';
import { SlaBreachQueryDto } from './dto/sla-breach-query.dto';
import { PaginationQueryDto, OffsetPaginationQueryDto } from './dto/pagination-query.dto';
import { EscalateIncidentDto } from './dto/escalate-incident.dto';
import { IncidentAnalyticsQueryDto } from './dto/incident-analytics-query.dto';
import { JwtAuthGuard } from '../../../libs/common/src/guards/jwt-auth.guard';
import { RolesGuard } from '../../../libs/common/src/guards/roles.guard';
import { Roles } from '../../../libs/common/src/decorators/roles.decorator';
import { Public } from '../../../libs/common/src/decorators/public.decorator';

@Controller('v1/incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DispatchServiceController {
  constructor(private readonly dispatchService: DispatchServiceService) {}

  @Public()
  @Post()
  @Roles('Caller (Public)', 'Call Centre Executive (CCE)', 'Hospital Admin', 'CureSelect Admin')
  @HttpCode(201)
  async createIncident(@Body() dto: CreateIncidentDto, @Req() req: any) {
    const context: Partial<AuditContext> = {
      userId: req.user?.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      organisationId: req.user?.organisationId,
    };
    const result = await this.dispatchService.createIncident(dto, context);
    return {
      message: 'Incident reported successfully',
      data: result.data,
      patient_count: result.data.patients?.length || 0,
      assigned_vehicle: result.assigned_vehicle,
      eta_seconds: result.eta_seconds,
    };
  }

  @Get()
  @Roles('Call Centre Executive (CCE)', 'Fleet Operator', 'CureSelect Admin', 'Caller (Public)', 'Hospital Admin')
  async listIncidents(@Query() query: IncidentQueryDto, @Req() req: any) {
    return this.dispatchService.findAll(query, req.user);
  }

  @Get('sla-breaches')
  @Roles('Call Centre Executive (CCE)', 'CureSelect Admin', 'Hospital Admin')
  async getSlaBreaches(@Query() query: SlaBreachQueryDto, @Req() req: any) {
    const isPlatformAdmin = req.user.roles.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'CCE'].includes(r)
    );

    // Tenant Isolation: Hospital Admins can only see breaches for their own organization
    if (!isPlatformAdmin && req.user.roles.includes('Hospital Admin') && req.user.org_id) {
      query.org_id = req.user.org_id;
    }

    return this.dispatchService.getSlaBreaches(query);
  }

  @Post(':id/auto-assign')
  @Roles('Call Centre Executive (CCE)', 'CureSelect Admin', 'Hospital Admin', 'Fleet Operator')
  async autoAssignIncident(@Param('id') id: string, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      organisationId: req.user.organisationId,
    };
    return this.dispatchService.startAutoAssignment(id, context);
  }

  @Post(':id/dispatch')
  @Roles('Call Centre Executive (CCE)', 'CureSelect Admin', 'Hospital Admin', 'Fleet Operator')
  async dispatchIncident(@Param('id') id: string, @Body() dto: DispatchIncidentDto, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      organisationId: req.user.organisationId,
    };
    return this.dispatchService.dispatchIncident(id, dto, context);
  }

  @Get(':id/dispatch')
  @Roles('Call Centre Executive (CCE)', 'CureSelect Admin', 'Hospital Admin', 'Fleet Operator', 'Ambulance Pilot (Driver)', 'EMT / Paramedic')
  async getActiveDispatch(@Param('id') id: string, @Req() req: any) {
    return this.dispatchService.getActiveDispatch(id, req.user);
  }

  @Put(':id/dispatch/reassign')
  @Roles('Call Centre Executive (CCE)', 'CureSelect Admin')
  async reassignVehicle(@Param('id') id: string, @Body() dto: ReassignVehicleDto, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      organisationId: req.user.organisationId,
    };
    return this.dispatchService.reassignVehicle(id, dto, context);
  }

  @Post(':id/dispatch/cancel')
  @Roles('Call Centre Executive (CCE)', 'CureSelect Admin')
  async cancelDispatch(@Param('id') id: string, @Body() dto: CancelDispatchDto, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      organisationId: req.user.organisationId,
    };
    return this.dispatchService.cancelDispatch(id, dto, context);
  }

  @Public()
  @Get(':id')
  @Roles('Call Centre Executive (CCE)', 'Fleet Operator', 'CureSelect Admin', 'Caller (Public)', 'Hospital Admin')
  async getIncident(@Param('id') id: string, @Req() req: any) {
    return this.dispatchService.findOne(id, req.user);
  }

  @Patch(':id/status')
  @Roles('Call Centre Executive (CCE)', 'Fleet Operator', 'CureSelect Admin')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateIncidentStatusDto, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      organisationId: req.user.organisationId,
    };
    return this.dispatchService.updateStatus(id, dto, context);
  }

  @Patch(':id/assign')
  @Roles('Call Centre Executive (CCE)', 'Fleet Operator', 'CureSelect Admin')
  async assignVehicle(@Param('id') id: string, @Body() dto: AssignVehicleDto, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      organisationId: req.user.organisationId,
    };
    return this.dispatchService.assignVehicle(id, dto, context);
  }

  @Patch(':id')
  @Roles('Call Centre Executive (CCE)', 'Fleet Operator', 'CureSelect Admin')
  async updateIncident(@Param('id') id: string, @Body() dto: UpdateIncidentDto, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      organisationId: req.user.organisationId,
    };
    return this.dispatchService.updateIncident(id, dto, context);
  }

  @Delete(':id')
  @Roles('Call Centre Executive (CCE)', 'CureSelect Admin')
  @HttpCode(204)
  async cancelIncident(@Param('id') id: string, @Body() dto: CancelIncidentDto, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      organisationId: req.user.organisationId,
    };
    await this.dispatchService.cancelIncident(id, dto, context);
  }

  @Public()
  @Get(':id/timeline')
  @Roles('Call Centre Executive (CCE)', 'Fleet Operator', 'CureSelect Admin', 'Caller (Public)', 'Hospital Admin')
  async getTimeline(@Param('id') id: string, @Query() query: PaginationQueryDto, @Req() req: any) {
    await this.dispatchService.findOne(id, req.user);
    return this.dispatchService.getTimeline(id, query);
  }

  @Get(':id/sla')
  @Roles('Call Centre Executive (CCE)', 'Fleet Operator', 'CureSelect Admin', 'Hospital Admin')
  async getSlaStatus(@Param('id') id: string) {
    return this.dispatchService.getSlaStatus(id);
  }

  @Get(':id/audit')
  @Roles('CureSelect Admin', 'Fleet Operator')
  async getAudit(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.dispatchService.getAuditLogs(id, query.limit, query.cursor);
  }

  @Post(':id/patients')
  @Roles('CureSelect Admin', 'Call Centre Executive (CCE)', 'EMT / Paramedic')
  async addPatient(@Param('id') id: string, @Body() dto: BulkAddPatientsDto, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      organisationId: req.user.organisationId,
    };
    return this.dispatchService.addPatient(id, dto, context);
  }

  @Get(':id/patients')
  @Roles('CureSelect Admin', 'Call Centre Executive (CCE)', 'EMT / Paramedic', 'Hospital Admin', 'Fleet Operator')
  async getPatients(@Param('id') id: string, @Query() query: OffsetPaginationQueryDto, @Req() req: any) {
    return this.dispatchService.getPatients(id, req.user, query);
  }

  @Patch(':id/patients/:patient_id')
  @Roles('CureSelect Admin', 'Call Centre Executive (CCE)', 'EMT / Paramedic', 'Hospital Admin')
  async updatePatient(
    @Param('id') id: string, 
    @Param('patient_id') patientId: string, 
    @Body() dto: UpdatePatientDto, 
    @Req() req: any
  ) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      organisationId: req.user.organisationId,
    };
    return this.dispatchService.updatePatient(id, patientId, dto, context);
  }

  @Post(':id/escalate')
  @Roles('Call Centre Executive (CCE)', 'CureSelect Admin', 'Hospital Admin')
  async escalateIncident(@Param('id') id: string, @Body() dto: EscalateIncidentDto, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      organisationId: req.user.organisationId,
    };
    return this.dispatchService.escalateIncident(id, req.user, dto, context);
  }

  @Get('analytics/summary')
  @Roles('Call Centre Executive (CCE)', 'CureSelect Admin', 'Hospital Admin', 'Fleet Operator')
  async getAnalyticsSummary(@Query() query: IncidentAnalyticsQueryDto, @Req() req: any) {
    return this.dispatchService.getAnalyticsSummary(query, req.user);
  }
}
