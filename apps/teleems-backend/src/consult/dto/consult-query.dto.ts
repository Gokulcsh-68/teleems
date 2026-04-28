import { IsOptional, IsEnum, IsUUID, IsString } from 'class-validator';
import { ConsultStatus } from '@app/common';

export class ConsultQueryDto {
  @IsEnum(ConsultStatus)
  @IsOptional()
  status?: ConsultStatus;

  @IsUUID()
  @IsOptional()
  incident_id?: string;

  @IsUUID()
  @IsOptional()
  doctor_id?: string;

  @IsUUID()
  @IsOptional()
  secondary_doctor_id?: string;

  @IsUUID()
  @IsOptional()
  emt_id?: string;

  @IsString()
  @IsOptional()
  date_from?: string;

  @IsString()
  @IsOptional()
  date_to?: string;

  @IsString()
  @IsOptional()
  from_date?: string;

  @IsString()
  @IsOptional()
  to_date?: string;

  @IsString()
  @IsOptional()
  consult_id?: string;

  @IsString()
  @IsOptional()
  organization_id?: string;
}
