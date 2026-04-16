import { Controller, Get } from '@nestjs/common';
import { EpcrServiceService } from './epcr-service.service';

@Controller('v1/epcr')
export class EpcrServiceController {
  constructor(private readonly epcrServiceService: EpcrServiceService) {}

  @Get()
  getHello(): string {
    return this.epcrServiceService.getHello();
  }
}
