import { IsString, IsUUID, IsOptional, IsObject, IsDateString } from 'class-validator';
import { ConsultStatus } from '@app/common';

export class CreateConsultDto {
  @IsUUID()
  @IsOptional()
  incident_id?: string;

  @IsUUID()
  @IsOptional()
  doctor_id?: string;

  @IsUUID()
  @IsOptional()
  emt_id?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  consult_type?: string;

  @IsDateString()
  @IsOptional()
  scheduled_at?: string;

  @IsObject()
  @IsOptional()
  additional_info?: Record<string, any>;

  @IsString()
  @IsOptional()
  speciality?: string;

  @IsString()
  @IsOptional()
  trip_id?: string;
}
