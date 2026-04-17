import { IsEnum, IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';
import { TripStatus } from '../enums/trip-status.enum';

export class UpdateTripStatusDto {
  @IsEnum(TripStatus)
  status: TripStatus;

  @IsNumber()
  gps_lat: number;

  @IsNumber()
  gps_lon: number;

  @IsNumber()
  @IsOptional()
  speed?: number;

  @IsDateString()
  @IsOptional()
  timestamp?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
