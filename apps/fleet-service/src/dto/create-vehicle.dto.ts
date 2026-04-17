import { IsString, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { VehicleStatus } from '../entities/vehicle.entity';

export class CreateVehicleDto {
  @IsString()
  identifier: string; // e.g. AMB-001

  @IsString()
  @IsOptional()
  type?: string; // ALS, BLS

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
}
