import { IsNumber, IsString, IsOptional } from 'class-validator';

export class AtHospitalDto {
  @IsNumber()
  gps_lat: number;

  @IsNumber()
  gps_lon: number;

  @IsString()
  hospital_id: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
