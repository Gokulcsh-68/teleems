import { Injectable } from '@nestjs/common';

@Injectable()
export class HospitalServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
