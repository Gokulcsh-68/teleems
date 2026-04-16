import { Controller, Get } from '@nestjs/common';
import { HospitalServiceService } from './hospital-service.service';

@Controller('v1/hospital')
export class HospitalServiceController {
  constructor(private readonly hospitalServiceService: HospitalServiceService) {}

  @Get()
  getHello(): string {
    return this.hospitalServiceService.getHello();
  }
}
