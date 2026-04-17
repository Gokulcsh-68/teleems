import { Controller, Get, Query, Req, UseGuards, Param } from '@nestjs/common';
import { TripService } from './trip.service';
import { TripQueryDto } from './dto/trip-query.dto';
import { JwtAuthGuard } from '../../../libs/common/src/guards/jwt-auth.guard';
import { RolesGuard } from '../../../libs/common/src/guards/roles.guard';
import { Roles } from '../../../libs/common/src/decorators/roles.decorator';

@Controller('v1/trips')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripController {
  constructor(private readonly tripService: TripService) {}

  @Get()
  @Roles('Fleet Operator', 'Hospital Admin', 'CureSelect Admin', 'Call Centre Executive (CCE)')
  async listTrips(@Query() query: TripQueryDto, @Req() req: any) {
    return this.tripService.findAllTrips(query, req.user);
  }

  @Get(':id')
  @Roles('Fleet Operator', 'Hospital Admin', 'CureSelect Admin', 'Call Centre Executive (CCE)')
  async getOneTrip(@Param('id') id: string, @Req() req: any) {
    return this.tripService.findOneTrip(id, req.user);
  }

  @Get(':id/crew')
  @Roles('Fleet Operator', 'Hospital Admin', 'CureSelect Admin', 'Call Centre Executive (CCE)')
  async getTripCrew(@Param('id') id: string, @Req() req: any) {
    return this.tripService.getTripCrew(id, req.user);
  }
}
