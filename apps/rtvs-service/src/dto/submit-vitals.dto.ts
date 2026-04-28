import { IsEnum, IsNumber, IsOptional, IsString, IsDateString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum EcgLead {
  II = 'II',
  V1 = 'V1',
  L12 = '12LEAD',
}

export enum VitalsSource {
  DEVICE = 'DEVICE',
  MANUAL = 'MANUAL',
}

export class VitalsReadingDto {
  @IsDateString()
  timestamp: string;

  @IsOptional()
  @IsNumber()
  spo2?: number;

  @IsOptional()
  @IsNumber()
  hr?: number;

  @IsOptional()
  @IsNumber()
  bp_sys?: number;

  @IsOptional()
  @IsNumber()
  bp_dia?: number;

  @IsOptional()
  @IsNumber()
  bp_map?: number;

  @IsOptional()
  @IsNumber()
  temp_celsius?: number;

  @IsOptional()
  @IsNumber()
  rbs_mg_dl?: number;

  @IsOptional()
  @IsNumber()
  hct?: number;

  @IsOptional()
  @IsNumber()
  hgb?: number;

  @IsOptional()
  @IsNumber()
  etco2?: number;

  @IsOptional()
  @IsEnum(EcgLead)
  ecg_lead?: EcgLead;

  @IsEnum(VitalsSource)
  source: VitalsSource;
}

export class SubmitVitalsDto extends VitalsReadingDto {
  @IsString()
  @IsNotEmpty()
  incident_id: string;

  @IsString()
  @IsNotEmpty()
  patient_id: string;
}

export class BulkSubmitVitalsDto {
  @IsString()
  @IsNotEmpty()
  incident_id: string;

  @IsString()
  @IsNotEmpty()
  patient_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VitalsReadingDto)
  readings: VitalsReadingDto[];
}

export class GetVitalsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  interval?: string;
}

export class GetVitalsTrendQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsNotEmpty()
  @IsString()
  granularity: string;
}
