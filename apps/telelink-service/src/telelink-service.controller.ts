import { Controller, Get } from '@nestjs/common';
import { TelelinkServiceService } from './telelink-service.service';

@Controller()
export class TelelinkServiceController {
  constructor(private readonly telelinkServiceService: TelelinkServiceService) {}

  @Get()
  getHello(): string {
    return this.telelinkServiceService.getHello();
  }
}
