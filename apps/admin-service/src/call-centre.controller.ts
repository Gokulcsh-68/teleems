import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { CallCentreService } from './call-centre.service';
import { CreateCCEDto, UpdateCCEProfileDto } from './dto/call-centre.dto';
import { JwtAuthGuard, RolesGuard, Roles, AdminIpWhitelistGuard } from '@app/common';

@Controller('v1/admin/call-centre')
@UseGuards(JwtAuthGuard, RolesGuard, AdminIpWhitelistGuard)
@Roles('CureSelect Admin', 'CURESELECT_ADMIN')
export class CallCentreController {
  constructor(private readonly callCentreService: CallCentreService) {}

  @Post('cces')
  async createCCE(@Body() dto: CreateCCEDto, @Req() req: any) {
    return this.callCentreService.createCCE(dto, req.user.userId, req.ip);
  }

  @Patch('cces/:id/profile')
  async updateProfile(@Param('id') id: string, @Body() dto: UpdateCCEProfileDto, @Req() req: any) {
    return this.callCentreService.updateProfile(id, dto, req.user.userId, req.ip);
  }

  @Get('dashboard')
  async getDashboard() {
    return this.callCentreService.getDashboard();
  }
}
