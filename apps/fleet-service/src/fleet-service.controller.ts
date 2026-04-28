import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  Param,
  Put,
  Patch,
  Delete,
} from '@nestjs/common';
import { FleetServiceService } from './fleet-service.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleQueryDto } from './dto/vehicle-query.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';
import {
  CreateFleetOperatorDto,
  UpdateFleetOperatorDto,
} from './dto/fleet-operator.dto';
import { CreateFleetOrganisationDto } from './dto/fleet-organisation.dto';
import { CreateStationDto, UpdateStationDto } from './dto/station.dto';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';
import { StartShiftDto, EndShiftDto } from './dto/duty.dto';
import { CreateInventoryItemDto, UpdateVehicleInventoryDto, BulkUpdateInventoryDto } from './dto/inventory.dto';
import { CreateRosterDto } from './dto/roster.dto';
import { StaffType } from '@app/common';

@Controller('v1/fleet')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FleetServiceController {
  constructor(private readonly fleetService: FleetServiceService) {}

  @Get('vehicles')
  @Roles(
    'Fleet Operator',
    'Hospital Admin',
    'CureSelect Admin',
    'CURESELECT_ADMIN',
    'Call Centre Executive (CCE)',
  )
  async findAll(@Query() query: VehicleQueryDto, @Req() req: any) {
    return this.fleetService.findAllVehicles(query, req.user);
  }

  @Post('vehicles')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator')
  async register(@Body() dto: CreateVehicleDto, @Req() req: any) {
    return this.fleetService.registerVehicle(dto, req.user);
  }

  @Get('vehicles/:id')
  @Roles('Fleet Operator', 'Hospital Admin', 'CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)')
  async getVehicle(@Param('id') id: string, @Req() req: any) {
    return this.fleetService.findOneVehicle(id, req.user);
  }

  @Patch('vehicles/:id')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @Req() req: any,
  ) {
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
  async updateOperator(
    @Param('id') id: string,
    @Body() dto: UpdateFleetOperatorDto,
    @Req() req: any,
  ) {
    return this.fleetService.updateOperator(id, dto, req.user.userId, req.ip);
  }

  @Post('organisations')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN')
  async createOrganisation(
    @Body() dto: CreateFleetOrganisationDto,
    @Req() req: any,
  ) {
    return this.fleetService.createOrganisation(dto, req.user.userId, req.ip);
  }

  // --- Station Endpoints ---

  @Post('stations')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator')
  async createStation(@Body() dto: CreateStationDto, @Req() req: any) {
    return this.fleetService.createStation(dto, req.user);
  }

  @Get('stations')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator', 'Hospital Admin')
  async listStations(@Query('organisation_id') orgId: string, @Req() req: any) {
    return this.fleetService.findAllStations(req.user, orgId);
  }

  @Get('stations/:id')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator', 'Hospital Admin')
  async getStation(@Param('id') id: string, @Req() req: any) {
    return this.fleetService.findOneStation(id, req.user);
  }

  @Patch('stations/:id')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator')
  async updateStation(@Param('id') id: string, @Body() dto: UpdateStationDto, @Req() req: any) {
    return this.fleetService.updateStation(id, dto, req.user);
  }

  // --- Staff Endpoints ---

  @Post('staff')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator')
  async createStaff(@Body() dto: CreateStaffDto, @Req() req: any) {
    return this.fleetService.createStaff(dto, req.user);
  }

  @Get('staff')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator', 'Hospital Admin')
  async listStaff(@Query('type') type: StaffType, @Req() req: any) {
    return this.fleetService.findAllStaff(req.user, type);
  }

  @Get('staff/:id')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator', 'Hospital Admin')
  async getStaff(@Param('id') id: string, @Req() req: any) {
    return this.fleetService.findOneStaff(id, req.user);
  }

  @Patch('staff/:id')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator')
  async updateStaff(@Param('id') id: string, @Body() dto: UpdateStaffDto, @Req() req: any) {
    return this.fleetService.updateStaff(id, dto, req.user);
  }

  // --- Duty Shift Endpoints ---

  @Post('shifts/start')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator')
  async startShift(@Body() dto: StartShiftDto, @Req() req: any) {
    return this.fleetService.startShift(dto, req.user);
  }

  @Post('duty/start-self')
  @Roles('Ambulance Pilot (Driver)', 'EMT / Paramedic', 'On-board Doctor', 'Hospital ED Doctor (ERCP)', 'CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator')
  async startDutySelf(@Body() dto: { vehicleId: string }, @Req() req: any) {
    return this.fleetService.startDutySelf(dto.vehicleId, req.user);
  }

  @Post('duty/end-self')
  @Roles('Ambulance Pilot (Driver)', 'EMT / Paramedic', 'On-board Doctor', 'Hospital ED Doctor (ERCP)', 'CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator')
  async endDutySelf(@Req() req: any) {
    return this.fleetService.endDutySelf(req.user);
  }

  @Post('shifts/end/:id')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator')
  async endShift(@Param('id') id: string, @Body() dto: EndShiftDto, @Req() req: any) {
    return this.fleetService.endShift(id, dto, req.user);
  }

  @Get('shifts/active')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator', 'Hospital Admin')
  async getActiveShifts(@Req() req: any) {
    return this.fleetService.getActiveShifts(req.user);
  }

  // --- Inventory Endpoints (Step 5) ---

  @Post('inventory/master')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN')
  async createInventoryItem(@Body() dto: CreateInventoryItemDto) {
    return this.fleetService.createInventoryItem(dto);
  }

  @Post('inventory/seed')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN')
  async seedInventory() {
    return this.fleetService.seedDefaultInventory();
  }

  @Get('inventory/master')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator', 'Driver', 'EMT', 'Doctor')
  async getMasterInventory() {
    return this.fleetService.getMasterInventory();
  }

  @Get('inventory/reports/low-stock')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator')
  async getLowStockReport(@Req() req: any) {
    return this.fleetService.getLowStockReport(req.user);
  }

  @Get('vehicles/:id/inventory')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator', 'Driver', 'EMT', 'Doctor')
  async getVehicleInventory(@Param('id') id: string, @Req() req: any) {
    return this.fleetService.getVehicleInventory(id, req.user);
  }

  @Patch('vehicles/:id/inventory')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator', 'Driver', 'EMT', 'Doctor')
  async updateVehicleInventory(@Param('id') id: string, @Body() dto: UpdateVehicleInventoryDto, @Req() req: any) {
    return this.fleetService.updateVehicleInventory(id, dto, req.user);
  }

  @Post('vehicles/:id/inventory/bulk')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator', 'Driver', 'EMT', 'Doctor')
  async bulkUpdateInventory(@Param('id') id: string, @Body() dto: BulkUpdateInventoryDto, @Req() req: any) {
    // Ensure the URL param ID matches the body ID
    dto.vehicleId = id;
    return this.fleetService.bulkUpdateInventory(dto, req.user);
  }

  @Get('vehicles/:id/inventory/logs')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator', 'Driver', 'EMT', 'Doctor')
  async getInventoryLogs(@Param('id') id: string) {
    return this.fleetService.getInventoryLogs(id);
  }

  // --- Roster Endpoints (Step 6) ---

  @Post('roster')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator')
  async createRoster(@Body() dto: CreateRosterDto, @Req() req: any) {
    return this.fleetService.createRoster(dto, req.user);
  }

  @Get('vehicles/:id/roster')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Fleet Operator')
  async getVehicleRoster(@Param('id') id: string, @Req() req: any) {
    return this.fleetService.getVehicleRoster(id, req.user);
  }
}
