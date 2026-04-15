import { Injectable } from '@nestjs/common';

@Injectable()
export class RtvsServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
