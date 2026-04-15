import { Injectable } from '@nestjs/common';

@Injectable()
export class EpcrServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
