import { Injectable } from '@nestjs/common';

@Injectable()
export class FleetServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
