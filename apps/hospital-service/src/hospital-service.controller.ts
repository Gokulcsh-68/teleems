import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { HospitalServiceService } from './hospital-service.service';
import { CreateHospitalDto, UpdateHospitalDto, NearestHospitalDto } from './dto/hospital.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';

@Controller('v1/hospitals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HospitalServiceController {
  constructor(private readonly hospitalService: HospitalServiceService) {}

  @Post()
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN')
  async create(@Body() dto: CreateHospitalDto, @Req() req: any) {
    return this.hospitalService.createHospital(dto, req.user.userId, req.ip);
  }

  @Get()
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'EMT / Paramedic')
  async findAll() {
    return this.hospitalService.findAll();
  }

  @Post('nearest')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'EMT / Paramedic')
  async findNearest(@Body() dto: NearestHospitalDto) {
    return this.hospitalService.findNearest(dto);
  }

  @Get(':id')
  @Roles(
    'CureSelect Admin',
    'CURESELECT_ADMIN',
    'Hospital Admin',
    'HOSPITAL_ADMIN',
  )
  async findOne(@Param('id') id: string) {
    return this.hospitalService.findOne(id);
  }

  @Put(':id')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateHospitalDto,
    @Req() req: any,
  ) {
    return this.hospitalService.update(id, dto, req.user.userId, req.ip);
  }

  @Delete(':id')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.hospitalService.remove(id, req.user.userId, req.ip);
  }
}
