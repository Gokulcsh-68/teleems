import { Module } from '@nestjs/common';
import { EpcrServiceController } from './epcr-service.controller';
import { EpcrServiceService } from './epcr-service.service';

@Module({
  imports: [],
  controllers: [EpcrServiceController],
  providers: [EpcrServiceService],
})
export class EpcrServiceModule {}
