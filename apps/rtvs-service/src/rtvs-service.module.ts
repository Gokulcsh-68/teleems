import { Module } from '@nestjs/common';
import { RtvsServiceController } from './rtvs-service.controller';
import { RtvsServiceService } from './rtvs-service.service';

@Module({
  imports: [],
  controllers: [RtvsServiceController],
  providers: [RtvsServiceService],
})
export class RtvsServiceModule {}
