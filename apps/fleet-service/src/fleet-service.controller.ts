import { Controller, Get, Post, Body, Query, Req, UseGuards } from '@nestjs/common';
import { FleetServiceService } from './fleet-service.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleQueryDto } from './dto/vehicle-query.dto';
import { JwtAuthGuard } from '../../../libs/common/src/guards/jwt-auth.guard';
import { RolesGuard } from '../../../libs/common/src/guards/roles.guard';
import { Roles } from '../../../libs/common/src/decorators/roles.decorator';

@Controller('v1/fleet')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FleetServiceController {
  constructor(private readonly fleetService: FleetServiceService) {}

  @Get()
  @Roles('Fleet Operator', 'Hospital Admin', 'CureSelect Admin', 'Call Centre Executive (CCE)')
  async findAll(@Query() query: VehicleQueryDto, @Req() req: any) {
    return this.fleetService.findAllVehicles(query, req.user);
  }

  @Post()
  @Roles('Hospital Admin', 'CureSelect Admin')
  async register(@Body() dto: CreateVehicleDto, @Req() req: any) {
    return this.fleetService.registerVehicle(dto, req.user);
  }
}
