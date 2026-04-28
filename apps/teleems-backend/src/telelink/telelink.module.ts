import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  TeleLinkSession,
  Dispatch,
  Incident,
  PatientProfile,
  CommonModule,
  User,
} from '@app/common';
import { TelelinkController } from './telelink.controller';
import { TelelinkService } from './telelink.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([
      TeleLinkSession,
      Dispatch,
      Incident,
      PatientProfile,
      User,
    ]),
  ],
  controllers: [TelelinkController],
  providers: [TelelinkService],
  exports: [TelelinkService],
})
export class TelelinkModule {}
