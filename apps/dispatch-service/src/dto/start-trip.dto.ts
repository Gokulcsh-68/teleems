import { IsNumber, IsOptional, IsString } from 'class-validator';

export class StartTripDto {
  @IsNumber()
  gps_lat: number;

  @IsNumber()
  gps_lon: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
