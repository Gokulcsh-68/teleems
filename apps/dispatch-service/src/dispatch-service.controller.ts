import { Controller, Post, Body, Req, UseGuards, HttpCode, Get, Query, Param, Patch, Delete, Put } from '@nestjs/common';
import { DispatchServiceService, AuditContext } from './dispatch-service.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentStatusDto, AssignVehicleDto, UpdateIncidentDto, CancelIncidentDto } from './dto/update-incident.dto';
import { DispatchIncidentDto } from './dto/dispatch-incident.dto';
import { ReassignVehicleDto } from './dto/reassign-vehicle.dto';
import { IncidentQueryDto } from './dto/incident-query.dto';
import { JwtAuthGuard } from '../../../libs/common/src/guards/jwt-auth.guard';
import { RolesGuard } from '../../../libs/common/src/guards/roles.guard';
import { Roles } from '../../../libs/common/src/decorators/roles.decorator';

@Controller('v1/incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DispatchServiceController {
  constructor(private readonly dispatchService: DispatchServiceService) {}

  @Post()
  @Roles('CALLER', 'CCE', 'HOSPITAL', 'CURESELECT_ADMIN')
  @HttpCode(201)
  async createIncident(@Body() dto: CreateIncidentDto, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    const result = await this.dispatchService.createIncident(dto, context);
    return {
      message: 'Incident reported successfully',
      data: result.data,
      assigned_vehicle: result.assigned_vehicle,
      eta_seconds: result.eta_seconds,
    };
  }

  @Get()
  @Roles('CCE', 'FLEET_MANAGER', 'CURESELECT_ADMIN', 'CALLER', 'HOSPITAL')
  async listIncidents(@Query() query: IncidentQueryDto, @Req() req: any) {
    const isPrivileged = req.user.roles.includes('CURESELECT_ADMIN') || 
                        req.user.roles.includes('CCE') ||
                        req.user.roles.includes('FLEET_MANAGER') ||
                        req.user.roles.includes('HOSPITAL');

    const callerIdOverride = !isPrivileged ? req.user.userId : undefined;
    
    return this.dispatchService.findAll(query, callerIdOverride);
  }

  @Post(':id/dispatch')
  @Roles('CCE', 'CURESELECT_ADMIN', 'HOSPITAL', 'FLEET_MANAGER')
  async dispatchIncident(@Param('id') id: string, @Body() dto: DispatchIncidentDto, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    return this.dispatchService.dispatchIncident(id, dto, context);
  }

  @Put(':id/dispatch/reassign')
  @Roles('CCE', 'CURESELECT_ADMIN')
  async reassignVehicle(@Param('id') id: string, @Body() dto: ReassignVehicleDto, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    return this.dispatchService.reassignVehicle(id, dto, context);
  }

  @Get(':id')
  @Roles('CCE', 'FLEET_MANAGER', 'CURESELECT_ADMIN', 'CALLER', 'HOSPITAL')
  async getIncident(@Param('id') id: string, @Req() req: any) {
    return this.dispatchService.findOne(id, req.user);
  }

  @Patch(':id/status')
  @Roles('CCE', 'FLEET_MANAGER', 'CURESELECT_ADMIN')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateIncidentStatusDto, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    return this.dispatchService.updateStatus(id, dto, context);
  }

  @Patch(':id/assign')
  @Roles('CCE', 'FLEET_MANAGER', 'CURESELECT_ADMIN')
  async assignVehicle(@Param('id') id: string, @Body() dto: AssignVehicleDto, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    return this.dispatchService.assignVehicle(id, dto, context);
  }

  @Patch(':id')
  @Roles('CCE', 'FLEET_MANAGER', 'CURESELECT_ADMIN')
  async updateIncident(@Param('id') id: string, @Body() dto: UpdateIncidentDto, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    return this.dispatchService.updateIncident(id, dto, context);
  }

  @Delete(':id')
  @Roles('CCE', 'CURESELECT_ADMIN')
  @HttpCode(204)
  async cancelIncident(@Param('id') id: string, @Body() dto: CancelIncidentDto, @Req() req: any) {
    const context: AuditContext = {
      userId: req.user.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    await this.dispatchService.cancelIncident(id, dto, context);
  }

  @Get(':id/timeline')
  @Roles('CCE', 'FLEET_MANAGER', 'CURESELECT_ADMIN', 'CALLER', 'HOSPITAL')
  async getTimeline(@Param('id') id: string, @Req() req: any) {
    // Security check: ensure user has access to this incident first
    await this.dispatchService.findOne(id, req.user);
    return this.dispatchService.getTimeline(id);
  }

  @Get(':id/audit')
  @Roles('CURESELECT_ADMIN', 'FLEET_MANAGER')
  async getAudit(@Param('id') id: string) {
    return this.dispatchService.getAuditLogs(id);
  }
}
