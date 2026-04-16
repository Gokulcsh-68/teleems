import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';

export class RecommendVehicleDto {
  @IsNumber()
  @IsNotEmpty()
  gps_lat: number;

  @IsNumber()
  @IsNotEmpty()
  gps_lon: number;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  severity?: string;

  @IsString()
  @IsOptional()
  vehicle_type_required?: string;
}
