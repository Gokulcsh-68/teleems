import { Controller, Post, Body, Req, UseGuards, Get, Param } from '@nestjs/common';
import { DispatchServiceService, AuditContext } from './dispatch-service.service';
import { RecommendVehicleDto } from './dto/recommend-vehicle.dto';
import { JwtAuthGuard } from '../../../libs/common/src/guards/jwt-auth.guard';
import { RolesGuard } from '../../../libs/common/src/guards/roles.guard';
import { Roles } from '../../../libs/common/src/decorators/roles.decorator';

@Controller('v1/dispatch')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DispatchController {
  constructor(private readonly dispatchService: DispatchServiceService) {}

  @Post('recommend')
  @Roles('CCE', 'CURESELECT_ADMIN', 'HOSPITAL', 'Call Centre Executive (CCE)', 'Hospital Admin')
  async recommendVehicles(@Body() dto: RecommendVehicleDto) {
    return this.dispatchService.recommendVehicles(dto);
  }

  @Post(':id/accept')
  @Roles('DRIVER', 'EMT', 'DOCTOR', 'CURESELECT_ADMIN', 'Ambulance Pilot (Driver)', 'EMT / Paramedic', 'On-board Doctor')
  async acceptDispatch(@Param('id') id: string, @Req() req: any) {
    return this.dispatchService.acceptDispatch(id, req.user);
  }

  @Post(':id/reject')
  @Roles('DRIVER', 'EMT', 'DOCTOR', 'CURESELECT_ADMIN', 'Ambulance Pilot (Driver)', 'EMT / Paramedic', 'On-board Doctor')
  async rejectDispatch(
    @Param('id') id: string, 
    @Body() body: { reason?: string }, 
    @Req() req: any
  ) {
    return this.dispatchService.rejectDispatch(id, body.reason || 'Not specified', req.user);
  }
}
