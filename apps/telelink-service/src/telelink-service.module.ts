import { Module } from '@nestjs/common';
import { TelelinkServiceController } from './telelink-service.controller';
import { TelelinkServiceService } from './telelink-service.service';

@Module({
  imports: [],
  controllers: [TelelinkServiceController],
  providers: [TelelinkServiceService],
})
export class TelelinkServiceModule {}
