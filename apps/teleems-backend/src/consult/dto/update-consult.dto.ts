import { CreateConsultDto } from './create-consult.dto';
import { IsEnum, IsOptional, IsObject } from 'class-validator';
import { ConsultStatus } from '@app/common';

export class UpdateConsultDto extends CreateConsultDto {
  @IsEnum(ConsultStatus)
  @IsOptional()
  status?: ConsultStatus;

  @IsObject()
  @IsOptional()
  clinical_notes?: Record<string, any>;
}
