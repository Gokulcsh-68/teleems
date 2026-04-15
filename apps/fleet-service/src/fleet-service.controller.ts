import { Controller, Get } from '@nestjs/common';
import { FleetServiceService } from './fleet-service.service';

@Controller()
export class FleetServiceController {
  constructor(private readonly fleetServiceService: FleetServiceService) {}

  @Get()
  getHello(): string {
    return this.fleetServiceService.getHello();
  }
}
