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
  ParseUUIDPipe,
} from '@nestjs/common';
import { HospitalServiceService } from './hospital-service.service';
import { CreateHospitalDto, UpdateHospitalDto, NearestHospitalDto, PaginationDto } from './dto/hospital.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';
import { Query } from '@nestjs/common';

@Controller('v1/hospitals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HospitalServiceController {
  constructor(private readonly hospitalService: HospitalServiceService) {}

  @Get('nearest')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'EMT / Paramedic')
  async findNearestGet(@Query('lat') lat: string, @Query('lng') lng: string, @Query('radius') radius?: string) {
    return this.hospitalService.findNearest({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radius_km: radius ? parseFloat(radius) : 100,
    });
  }

  @Post('nearest')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'EMT / Paramedic')
  async findNearest(@Body() dto: NearestHospitalDto) {
    return this.hospitalService.findNearest(dto);
  }

  @Post()
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN')
  async create(@Body() dto: CreateHospitalDto, @Req() req: any) {
    return this.hospitalService.createHospital(dto, req.user.userId, req.ip);
  }

  @Get()
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'EMT / Paramedic')
  async findAll(@Query() dto: PaginationDto) {
    return this.hospitalService.findAll(dto);
  }

  @Get(':id')
  @Roles(
    'CureSelect Admin',
    'CURESELECT_ADMIN',
    'Hospital Admin',
    'HOSPITAL_ADMIN',
    'EMT / Paramedic',
  )
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.hospitalService.findOne(id);
  }

  @Put(':id')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateHospitalDto,
    @Req() req: any,
  ) {
    return this.hospitalService.update(id, dto, req.user.userId, req.ip);
  }

  @Delete(':id')
  @Roles('CureSelect Admin', 'CURESELECT_ADMIN')
  async remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: any) {
    return this.hospitalService.remove(id, req.user.userId, req.ip);
  }
}
