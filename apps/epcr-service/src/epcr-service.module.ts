import { Module } from '@nestjs/common';
import { EpcrServiceController } from './epcr-service.controller';
import { EpcrServiceService } from './epcr-service.service';
import { CommonModule } from '../../../libs/common/src';

@Module({
  imports: [CommonModule],
  controllers: [EpcrServiceController],
  providers: [EpcrServiceService],
})
export class EpcrServiceModule {}
