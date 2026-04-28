import { Module } from '@nestjs/common';
import { EpcrServiceController } from './epcr-service.controller';
import { EpcrServiceService } from './epcr-service.service';
import { CommonModule } from '../../../libs/common/src';

import { TypeOrmModule } from '@nestjs/typeorm';
import { Epcr, EpcrSignature } from '@app/common';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([Epcr, EpcrSignature]),
  ],
  controllers: [EpcrServiceController],
  providers: [EpcrServiceService],
})
export class EpcrServiceModule {}
