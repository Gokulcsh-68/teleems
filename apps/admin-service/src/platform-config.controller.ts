import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { PlatformConfigService } from './platform-config.service';
import {
  UpdateSystemConfigDto,
  ToggleFeatureFlagDto,
  CreateIotProfileDto,
} from './dto/platform-config.dto';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
  AdminIpWhitelistGuard,
} from '@app/common';

@Controller('v1/admin/config')
@UseGuards(JwtAuthGuard, RolesGuard, AdminIpWhitelistGuard)
@Roles('CureSelect Admin', 'CURESELECT_ADMIN')
export class PlatformConfigController {
  constructor(private readonly configService: PlatformConfigService) {}

  @Post('system')
  async setConfig(@Body() dto: UpdateSystemConfigDto, @Req() req: any) {
    return this.configService.setConfig(dto, req.user.userId, req.ip);
  }

  @Get('system')
  async getConfigs() {
    return this.configService.getAllConfigs();
  }

  @Post('feature-flags')
  async toggleFlag(@Body() dto: ToggleFeatureFlagDto, @Req() req: any) {
    return this.configService.toggleFlag(dto, req.user.userId, req.ip);
  }

  @Get('feature-flags')
  async getFlags() {
    return this.configService.getFlags();
  }

  @Post('iot-profiles')
  async createIotProfile(@Body() dto: CreateIotProfileDto, @Req() req: any) {
    return this.configService.createIotProfile(dto, req.user.userId, req.ip);
  }

  @Get('iot-profiles')
  async getIotProfiles() {
    return this.configService.getIotProfiles();
  }
}
