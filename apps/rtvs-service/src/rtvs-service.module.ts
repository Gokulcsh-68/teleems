import { Module } from '@nestjs/common';
import { RtvsServiceController } from './rtvs-service.controller';
import { RtvsServiceService } from './rtvs-service.service';
import { RtvsGateway } from './rtvs.gateway';
import { CommonModule } from '../../../libs/common/src';

@Module({
  imports: [CommonModule],
  controllers: [RtvsServiceController],
  providers: [RtvsServiceService, RtvsGateway],
})
export class RtvsServiceModule {}
