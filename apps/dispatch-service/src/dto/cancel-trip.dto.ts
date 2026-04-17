import { IsNumber, IsString } from 'class-validator';

export class CancelTripDto {
  @IsNumber()
  gps_lat: number;

  @IsNumber()
  gps_lon: number;

  @IsString()
  reason: string;
}
