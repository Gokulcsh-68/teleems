import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RtvsServiceController } from './rtvs-service.controller';
import { RtvsServiceService } from './rtvs-service.service';
import { RtvsGateway } from './rtvs.gateway';
import { CommonModule } from '../../../libs/common/src';
import { RtvsRecord } from './entities/rtvs-record.entity';

@Module({
  imports: [CommonModule, TypeOrmModule.forFeature([RtvsRecord])],
  controllers: [RtvsServiceController],
  providers: [RtvsServiceService, RtvsGateway],
})
export class RtvsServiceModule {}
