import { IsNumber, IsString, IsOptional } from 'class-validator';

export class PatientLoadedDto {
  @IsNumber()
  gps_lat: number;

  @IsNumber()
  gps_lon: number;

  @IsString()
  destination_hospital_id: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
