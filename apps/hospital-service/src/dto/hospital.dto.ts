import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  IsObject,
} from 'class-validator';
import { HospitalType } from '@app/common';

export class BaseHospitalDto {
  @IsEnum(HospitalType)
  @IsOptional()
  type?: HospitalType;

  @IsString()
  @IsOptional()
  code?: string;

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
  contact_phone?: string;

  @IsString()
  @IsOptional()
  contact_email?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsArray()
  @IsOptional()
  specialties?: string[];

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

export class CreateHospitalDto extends BaseHospitalDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateHospitalDto extends BaseHospitalDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  status?: 'ACTIVE' | 'INACTIVE';
}

export class NearestHospitalDto {
  @IsNumber()
  @IsNotEmpty()
  lat: number;

  @IsNumber()
  @IsNotEmpty()
  lng: number;

  @IsNumber()
  @IsOptional()
  radius_km?: number;
}

export class PaginationDto {
  @IsNumber()
  @IsOptional()
  page?: number;

  @IsNumber()
  @IsOptional()
  limit?: number;

  @IsString()
  @IsOptional()
  search?: string;
}
