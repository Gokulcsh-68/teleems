import { Controller, Get, Post, Put, Body, Param, Req, UseGuards } from '@nestjs/common';
import { MasterDataService } from './master-data.service';
import { 
  CreateSymptomDto, 
  CreateIncidentCategoryDto, 
  CreateInventoryItemDto,
  UpdateHospitalMasterDto,
  RegisterHospitalDto
} from './dto/master-data.dto';
import { JwtAuthGuard, RolesGuard, Roles, AdminIpWhitelistGuard } from '@app/common';

@Controller('v1/admin/master')
@UseGuards(JwtAuthGuard, RolesGuard, AdminIpWhitelistGuard)
@Roles('CureSelect Admin', 'CURESELECT_ADMIN')
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Post('symptoms')
  async createSymptom(@Body() dto: CreateSymptomDto, @Req() req: any) {
    return this.masterDataService.createSymptom(dto, req.user.userId, req.ip);
  }

  @Get('symptoms')
  async listSymptoms() {
    return this.masterDataService.findAllSymptoms();
  }

  @Post('categories')
  async createCategory(@Body() dto: CreateIncidentCategoryDto, @Req() req: any) {
    return this.masterDataService.createCategory(dto, req.user.userId, req.ip);
  }

  @Get('categories')
  async listCategories() {
    return this.masterDataService.findAllCategories();
  }

  @Post('inventory')
  async createInventoryItem(@Body() dto: CreateInventoryItemDto, @Req() req: any) {
    return this.masterDataService.createInventoryItem(dto, req.user.userId, req.ip);
  }

  @Get('inventory')
  async listInventoryItems() {
    return this.masterDataService.findAllInventoryItems();
  }

  @Put('hospitals/:id')
  async updateHospital(@Param('id') id: string, @Body() dto: UpdateHospitalMasterDto, @Req() req: any) {
    return this.masterDataService.updateHospitalMaster(id, dto, req.user.userId, req.ip);
  }

  @Post('register-hospital')
  async registerHospital(@Body() dto: RegisterHospitalDto, @Req() req: any) {
    return this.masterDataService.registerHospitalWithAdmin(dto, req.user, req.ip);
  }
}
