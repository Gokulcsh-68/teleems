import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsBoolean, IsArray, IsObject } from 'class-validator';
import { HospitalType } from '@app/common';

export class CreateHospitalDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(HospitalType)
  @IsOptional()
  type?: HospitalType;

  @IsString()
  @IsOptional()
  accreditation?: string;

  @IsBoolean()
  @IsOptional()
  nabh_status?: boolean;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  gps_lat?: number;

  @IsNumber()
  @IsOptional()
  gps_lon?: number;

  @IsNumber()
  @IsOptional()
  service_radius?: number;

  @IsString()
  @IsOptional()
  emergency_phone?: string;

  @IsString()
  @IsOptional()
  medical_director?: string;

  @IsObject()
  @IsOptional()
  bed_capacity?: {
    icu: number;
    er: number;
    general: number;
    ventilators: number;
    updated_at: string;
  };

  @IsArray()
  @IsOptional()
  referral_for_orgs?: string[];

  @IsOptional()
  routing_rules?: any;
}

export class UpdateHospitalDto extends CreateHospitalDto {
  @IsString()
  @IsOptional()
  status?: 'ACTIVE' | 'INACTIVE';
}
