import { Controller, Post, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { DispatchServiceService } from './dispatch-service.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { JwtAuthGuard } from '../../../libs/common/src/guards/jwt-auth.guard';
import { RolesGuard } from '../../../libs/common/src/guards/roles.guard';
import { Roles } from '../../../libs/common/src/decorators/roles.decorator';

@Controller('v1/incidents')
export class DispatchServiceController {
  constructor(private readonly dispatchService: DispatchServiceService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CALLER', 'CCE', 'HOSPITAL', 'SYSTEM', 'CURESELECT_ADMIN') // Include admin for testing
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
}
