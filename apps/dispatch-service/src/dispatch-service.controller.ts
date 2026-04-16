import { Controller, Post, Body, Req, UseGuards, HttpCode, Get, Query, Param, Patch } from '@nestjs/common';
import { DispatchServiceService } from './dispatch-service.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentStatusDto, AssignVehicleDto } from './dto/update-incident.dto';
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
    const requestUserId = req.user.userId;
    const result = await this.dispatchService.createIncident(dto, requestUserId);
    return {
      message: 'Incident reported successfully',
      data: result.data,
      assigned_vehicle: result.assigned_vehicle,
      eta_seconds: result.eta_seconds,
    };
  }

  @Get()
  @Roles('CCE', 'FLEET_MANAGER', 'CURESELECT_ADMIN', 'CALLER')
  async listIncidents(@Query('status') status: string, @Req() req: any) {
    const isAdmin = req.user.roles.includes('CURESELECT_ADMIN') || req.user.roles.includes('CCE');
    // Callers can only see their own incidents
    const callerIdFilter = !isAdmin ? req.user.userId : undefined;
    
    return this.dispatchService.findAll(status, callerIdFilter);
  }

  @Get(':id')
  @Roles('CCE', 'FLEET_MANAGER', 'CURESELECT_ADMIN', 'CALLER')
  async getIncident(@Param('id') id: string, @Req() req: any) {
    return this.dispatchService.findOne(id, req.user);
  }

  @Patch(':id/status')
  @Roles('CCE', 'FLEET_MANAGER', 'CURESELECT_ADMIN')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateIncidentStatusDto) {
    return this.dispatchService.updateStatus(id, dto);
  }

  @Patch(':id/assign')
  @Roles('CCE', 'FLEET_MANAGER', 'CURESELECT_ADMIN')
  async assignVehicle(@Param('id') id: string, @Body() dto: AssignVehicleDto) {
    return this.dispatchService.assignVehicle(id, dto);
  }
}
