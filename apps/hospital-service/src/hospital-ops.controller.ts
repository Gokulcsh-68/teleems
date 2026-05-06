import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { HospitalOpsService } from './hospital-ops.service';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';

@Controller('v1/hospital/ops')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  'Hospital Admin',
  'HOSPITAL_ADMIN',
  'Hospital ED Doctor (ERCP)',
  'ED_DOCTOR',
)
export class HospitalOpsController {
  constructor(private readonly opsService: HospitalOpsService) {}

  private getHospitalId(req: any): string {
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) {
      throw new ForbiddenException(
        'Your account is not linked to a hospital. Contact your administrator.',
      );
    }
    return hospitalId;
  }

  @Get('status')
  async getStatus(@Req() req: any) {
    return this.opsService.getStatus(this.getHospitalId(req));
  }

  @Patch('status')
  async updateStatus(@Body() dto: any, @Req() req: any) {
    const hospitalId = this.getHospitalId(req);
    return this.opsService.updateStatus(
      hospitalId,
      dto,
      req.user.userId,
      req.ip,
    );
  }

  @Get('dashboard')
  async getDashboard(@Req() req: any) {
    return this.opsService.getDashboard(this.getHospitalId(req));
  }

  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.opsService.getProfile(this.getHospitalId(req));
  }
  
  @Patch('profile')
  async updateProfile(@Body() dto: any, @Req() req: any) {
    const hospitalId = this.getHospitalId(req);
    return this.opsService.updateProfile(hospitalId, dto, req.user.userId, req.ip);
  }
}
