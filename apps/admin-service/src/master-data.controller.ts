import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { MasterDataService } from './master-data.service';
import {
  CreateSymptomDto,
  CreateIncidentCategoryDto,
  CreateInventoryItemDto,
  UpdateHospitalMasterDto,
  MasterQueryDto,
  CreateAllergenDto,
  CreateMedicationDto,
  CreateSurgeryDto,
  CreateHospitalisationReasonDto,
  CreateChiefComplaintDto,
  CreateInterventionMasterDto,
  CreateMedicationRouteDto,
  UpdateIncidentCategoryDto,
} from './dto/master-data.dto';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
  AdminIpWhitelistGuard,
} from '@app/common';
import { Public } from '../../../libs/common/src/decorators/public.decorator';

@Controller('v1/admin/master')
@UseGuards(JwtAuthGuard, RolesGuard, AdminIpWhitelistGuard)
@Roles('CureSelect Admin', 'CURESELECT_ADMIN')
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Post('symptoms')
  async createSymptom(@Body() dto: CreateSymptomDto, @Req() req: any) {
    const result = await this.masterDataService.createSymptom(
      dto,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  @Get('symptoms')
  async listSymptoms(@Query() query: MasterQueryDto) {
    const result = await this.masterDataService.findAllSymptoms(query);
    return { data: result };
  }

  @Post('categories')
  async createCategory(
    @Body() dto: CreateIncidentCategoryDto,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.createCategory(
      dto,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  @Public()
  @Get('categories')
  async listCategories(@Query() query: MasterQueryDto) {
    const result = await this.masterDataService.findAllCategories(query);
    return { data: result };
  }

  @Put('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentCategoryDto,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.updateCategory(
      id,
      dto,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  @Patch('categories/:id/status')
  async toggleCategoryStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.toggleCategoryStatus(
      id,
      isActive,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  @Post('categories/:id/delete') // Or DELETE if preferred, but following some conventions
  async deleteCategory(@Param('id') id: string, @Req() req: any) {
    const result = await this.masterDataService.deleteCategory(
      id,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  @Post('inventory')
  async createInventoryItem(
    @Body() dto: CreateInventoryItemDto,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.createInventoryItem(
      dto,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  @Get('inventory')
  async listInventoryItems(@Query() query: MasterQueryDto) {
    const result = await this.masterDataService.findAllInventoryItems(query);
    return { data: result };
  }

  @Put('hospitals/:id')
  async updateHospital(
    @Param('id') id: string,
    @Body() dto: UpdateHospitalMasterDto,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.updateHospitalMaster(
      id,
      dto,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  // --- ICD-10 Master ---

  @Post('icd-codes')
  async createIcdCode(@Body() dto: any, @Req() req: any) {
    const result = await this.masterDataService.createIcdCode(
      dto,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  @Patch('icd-codes/:id/status')
  async toggleIcdStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.toggleIcdStatus(
      id,
      isActive,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  @Get('icd-codes')
  async listIcdCodes(@Query() query: MasterQueryDto) {
    const result = await this.masterDataService.findAllIcdCodes(query);
    return { data: result };
  }

  // --- Allergy Master ---

  @Post('allergies')
  async createAllergen(@Body() dto: CreateAllergenDto, @Req() req: any) {
    const result = await this.masterDataService.createAllergen(
      dto,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  @Get('allergies')
  async listAllergens(@Query() query: MasterQueryDto) {
    const result = await this.masterDataService.findAllAllergens(query);
    return { data: result };
  }

  @Patch('allergies/:id/status')
  async toggleAllergenStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.toggleAllergenStatus(
      id,
      isActive,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  // --- Medication Master ---

  @Post('medications')
  async createMedication(@Body() dto: CreateMedicationDto, @Req() req: any) {
    const result = await this.masterDataService.createMedication(
      dto,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  @Get('medications')
  async listMedications(@Query() query: MasterQueryDto) {
    const result = await this.masterDataService.findAllMedications(query);
    return { data: result };
  }

  @Patch('medications/:id/status')
  async toggleMedicationStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.toggleMedicationStatus(
      id,
      isActive,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  // --- Surgery Master ---

  @Post('surgeries')
  async createSurgery(@Body() dto: CreateSurgeryDto, @Req() req: any) {
    const result = await this.masterDataService.createSurgery(
      dto,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  @Get('surgeries')
  async listSurgeries(@Query() query: MasterQueryDto) {
    const result = await this.masterDataService.findAllSurgeries(query);
    return { data: result };
  }

  @Patch('surgeries/:id/status')
  async toggleSurgeryStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.toggleSurgeryStatus(
      id,
      isActive,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  // --- Hospitalisation Master ---

  @Post('hospitalisations')
  async createHospitalisationReason(
    @Body() dto: CreateHospitalisationReasonDto,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.createHospitalisationReason(
      dto,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  @Get('hospitalisations')
  async listHospitalisations(@Query() query: MasterQueryDto) {
    const result = await this.masterDataService.findAllHospitalisations(query);
    return { data: result };
  }

  @Patch('hospitalisations/:id/status')
  async toggleHospitalisationStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.toggleHospitalisationStatus(
      id,
      isActive,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  // --- Chief Complaint Master ---

  @Get('chief-complaints')
  async findAllChiefComplaints(@Query() query: MasterQueryDto) {
    const result = await this.masterDataService.findAllChiefComplaints(query);
    return { data: result };
  }

  @Post('chief-complaints')
  async createChiefComplaint(
    @Body() dto: CreateChiefComplaintDto,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.createChiefComplaint(
      dto,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  @Patch('chief-complaints/:id/status')
  async toggleChiefComplaintStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.toggleChiefComplaintStatus(
      id,
      isActive,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  // --- Intervention Master ---

  @Get('interventions')
  async findAllInterventionMasters(@Query() query: MasterQueryDto) {
    const result =
      await this.masterDataService.findAllInterventionMasters(query);
    return { data: result };
  }

  @Post('interventions')
  async createInterventionMaster(
    @Body() dto: CreateInterventionMasterDto,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.createInterventionMaster(
      dto,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  @Patch('interventions/:id/status')
  async toggleInterventionMasterStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.toggleInterventionMasterStatus(
      id,
      isActive,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  // --- Medication Route Master ---

  @Get('medication-routes')
  async findAllMedicationRoutes(@Query() query: MasterQueryDto) {
    const result = await this.masterDataService.findAllMedicationRoutes(query);
    return { data: result };
  }

  @Post('medication-routes')
  async createMedicationRoute(
    @Body() dto: CreateMedicationRouteDto,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.createMedicationRoute(
      dto,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }

  @Patch('medication-routes/:id/status')
  async toggleMedicationRouteStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Req() req: any,
  ) {
    const result = await this.masterDataService.toggleMedicationRouteStatus(
      id,
      isActive,
      req.user.userId,
      req.ip,
    );
    return { data: result };
  }
}
