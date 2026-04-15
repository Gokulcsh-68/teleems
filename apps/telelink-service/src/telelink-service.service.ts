import { Injectable } from '@nestjs/common';

@Injectable()
export class TelelinkServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
