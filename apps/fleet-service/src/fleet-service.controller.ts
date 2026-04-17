import { Controller, Get, Post, Body, Query, Req, UseGuards, Param, Put } from '@nestjs/common';
import { FleetServiceService } from './fleet-service.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleQueryDto } from './dto/vehicle-query.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';
import { CreateFleetOperatorDto, UpdateFleetOperatorDto } from './dto/fleet-operator.dto';

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

  @Get('operators')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN')
  async listOperators() {
    return this.fleetService.findAllOperators();
  }

  @Post('operators')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN')
  async createOperator(@Body() dto: CreateFleetOperatorDto, @Req() req: any) {
    return this.fleetService.createOperator(dto, req.user.userId, req.ip);
  }

  @Get('operators/:id')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN')
  async getOperator(@Param('id') id: string) {
    return this.fleetService.findOneOperator(id);
  }

  @Put('operators/:id')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN')
  async updateOperator(@Param('id') id: string, @Body() dto: UpdateFleetOperatorDto, @Req() req: any) {
    return this.fleetService.updateOperator(id, dto, req.user.userId, req.ip);
  }
}
