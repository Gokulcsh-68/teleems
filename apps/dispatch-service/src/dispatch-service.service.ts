import { Injectable } from '@nestjs/common';

@Injectable()
export class DispatchServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
