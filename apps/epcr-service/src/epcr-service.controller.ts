import { Controller, Post, Param, Req, UseGuards, Get } from '@nestjs/common';
import { EpcrServiceService } from './epcr-service.service';
import { JwtAuthGuard } from '../../../libs/common/src/guards/jwt-auth.guard';
import { RolesGuard } from '../../../libs/common/src/guards/roles.guard';
import { Roles } from '../../../libs/common/src/decorators/roles.decorator';

@Controller('v1/epcr')
export class EpcrServiceController {
  constructor(private readonly epcrServiceService: EpcrServiceService) {}

  @Post(':tripId/generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async generate(@Param('tripId') tripId: string, @Req() req: any) {
    return this.epcrServiceService.generateEpcr(tripId, req.user);
  }

  @Get(':tripId/print')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMT / Paramedic', 'Hospital Admin', 'CureSelect Admin')
  async getPrintPayload(@Param('tripId') tripId: string, @Req() req: any) {
    // Re-use the generation logic or return specific print payload
    const result = await this.epcrServiceService.generateEpcr(tripId, req.user);
    return { data: result.data.thermal_payload };
  }
}
