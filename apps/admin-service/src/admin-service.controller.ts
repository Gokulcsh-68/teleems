import { Controller, Post, Get, Put, Body, Param, Req, UseGuards, Patch, Query } from '@nestjs/common';
import { AdminServiceService } from './admin-service.service';
import { CreateOrganisationDto, UpdateOrganisationDto } from './dto/organisation.dto';
import { RegisterHospitalDto } from './dto/register-hospital.dto';
import { RegisterFleetOperatorDto } from './dto/register-fleet-operator.dto';
import { OrganisationStatus, JwtAuthGuard, RolesGuard, Roles, AdminIpWhitelistGuard } from '@app/common';

@Controller('v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard, AdminIpWhitelistGuard)
@Roles('CureSelect Admin', 'CURESELECT_ADMIN')
export class AdminServiceController {
  constructor(private readonly adminService: AdminServiceService) {}

  @Post('organisations')
  async createOrg(@Body() dto: CreateOrganisationDto, @Req() req: any) {
    return this.adminService.createOrganisation(dto, req.user.userId, req.ip);
  }

  @Get('organisations')
  async listOrgs() {
    return this.adminService.findAllOrganisations();
  }

  @Get('organisations/:id')
  async getOrg(@Param('id') id: string) {
    return this.adminService.findOneOrganisation(id);
  }

  @Put('organisations/:id')
  async updateOrg(@Param('id') id: string, @Body() dto: UpdateOrganisationDto, @Req() req: any) {
    return this.adminService.updateOrganisation(id, dto, req.user.userId, req.ip);
  }

  @Patch('organisations/:id/status')
  async setStatus(@Param('id') id: string, @Body() body: { status: OrganisationStatus }, @Req() req: any) {
    return this.adminService.setOrganisationStatus(id, body.status, req.user.userId, req.ip);
  }

  @Get('audit-logs')
  async getGlobalLogs(@Query('limit') limit = 50, @Query('offset') offset = 0) {
    return this.adminService.getGlobalAuditLogs(+limit, +offset);
  }

  @Post('organisations/:id/invoices')
  async createInvoice(@Param('id') id: string, @Req() req: any) {
    return this.adminService.generateInvoice(id, req.user.userId, req.ip);
  }

  @Post('register-hospital')
  async registerHospital(@Body() dto: RegisterHospitalDto, @Req() req: any) {
    return this.adminService.registerHospitalWithAdmin(dto, req.user, req.ip);
  }

  @Post('register-fleet-operator')
  async registerFleetOperator(@Body() dto: RegisterFleetOperatorDto, @Req() req: any) {
    return this.adminService.registerFleetOperatorWithAdmin(dto, req.user, req.ip);
  }
}
