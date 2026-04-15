import { Controller, Get } from '@nestjs/common';
import { HospitalServiceService } from './hospital-service.service';

@Controller()
export class HospitalServiceController {
  constructor(private readonly hospitalServiceService: HospitalServiceService) {}

  @Get()
  getHello(): string {
    return this.hospitalServiceService.getHello();
  }
}
