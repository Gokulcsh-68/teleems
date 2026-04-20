import { Controller, Get, Post, Body, Query, Req, UseGuards, Param, Put, Patch, Delete } from '@nestjs/common';
import { FleetServiceService } from './fleet-service.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleQueryDto } from './dto/vehicle-query.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';
import { CreateFleetOperatorDto, UpdateFleetOperatorDto } from './dto/fleet-operator.dto';
import { CreateFleetOrganisationDto } from './dto/fleet-organisation.dto';

@Controller('v1/fleet')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FleetServiceController {
  constructor(private readonly fleetService: FleetServiceService) {}

  @Get('vehicles')
  @Roles('Fleet Operator', 'Hospital Admin', 'CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)')
  async findAll(@Query() query: VehicleQueryDto, @Req() req: any) {
    return this.fleetService.findAllVehicles(query, req.user);
  }

  @Post('vehicles')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator')
  async register(@Body() dto: CreateVehicleDto, @Req() req: any) {
    return this.fleetService.registerVehicle(dto, req.user);
  }

  @Patch('vehicles/:id')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator')
  async update(@Param('id') id: string, @Body() dto: UpdateVehicleDto, @Req() req: any) {
    return this.fleetService.updateVehicle(id, dto, req.user);
  }

  @Delete('vehicles/:id')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.fleetService.deleteVehicle(id, req.user);
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
 
  @Post('organisations')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN')
  async createOrganisation(@Body() dto: CreateFleetOrganisationDto, @Req() req: any) {
    return this.fleetService.createOrganisation(dto, req.user.userId, req.ip);
  }
}
