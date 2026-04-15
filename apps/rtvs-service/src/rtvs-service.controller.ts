import { Controller, Get } from '@nestjs/common';
import { RtvsServiceService } from './rtvs-service.service';

@Controller()
export class RtvsServiceController {
  constructor(private readonly rtvsServiceService: RtvsServiceService) {}

  @Get()
  getHello(): string {
    return this.rtvsServiceService.getHello();
  }
}
