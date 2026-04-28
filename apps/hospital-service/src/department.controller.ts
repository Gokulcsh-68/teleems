import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DepartmentService } from './department.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  DepartmentQueryDto,
} from './dto/department.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';

@Controller('v1/hospital/departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post()
  @Roles('CureSelect Admin', 'Hospital Admin')
  create(@Body() dto: CreateDepartmentDto, @Req() req: any) {
    return this.departmentService.create(dto, req.user, req.ip);
  }

  @Get()
  @Roles('CureSelect Admin', 'Hospital Admin', 'Hospital Coordinator')
  findAll(@Query() query: DepartmentQueryDto, @Req() req: any) {
    if (!req.user.roles.includes('CureSelect Admin')) {
      query.hospitalId = req.user.hospitalId || req.user.organisationId;
    }
    return this.departmentService.findAll(query);
  }

  @Get(':id')
  @Roles('CureSelect Admin', 'Hospital Admin', 'Hospital Coordinator')
  findOne(@Param('id') id: string) {
    return this.departmentService.findOne(id);
  }

  @Patch(':id')
  @Roles('CureSelect Admin', 'Hospital Admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @Req() req: any,
  ) {
    return this.departmentService.update(id, dto, req.user, req.ip);
  }

  @Delete(':id')
  @Roles('CureSelect Admin', 'Hospital Admin')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.departmentService.remove(id, req.user, req.ip);
  }
}
