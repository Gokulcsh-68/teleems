import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { VehicleStatus, VehicleType, OwnershipType } from '@app/common';

export class UpdateVehicleDto {
  @IsString()
  @IsOptional()
  registration_number?: string;

  @IsString()
  @IsOptional()
  chassis_number?: string;

  @IsString()
  @IsOptional()
  engine_number?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsNumber()
  @IsOptional()
  make_year?: number;

  @IsEnum(VehicleType)
  @IsOptional()
  vehicle_type?: VehicleType;

  @IsNumber()
  @Min(1)
  @IsOptional()
  stretcher_capacity?: number;

  @IsEnum(OwnershipType)
  @IsOptional()
  ownership_type?: OwnershipType;

  @IsString()
  @IsOptional()
  station_id?: string;

  @IsEnum(VehicleStatus)
  @IsOptional()
  status?: VehicleStatus;

  @IsNumber()
  @IsOptional()
  gps_lat?: number;

  @IsNumber()
  @IsOptional()
  gps_lon?: number;

  @IsString()
  @IsOptional()
  organisationId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
