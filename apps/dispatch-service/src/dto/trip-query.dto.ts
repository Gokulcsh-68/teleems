import { IsOptional, IsString, IsISO8601, IsUUID, IsNumberString } from 'class-validator';

export class TripQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  vehicle_id?: string;

  @IsOptional()
  @IsUUID()
  driver_id?: string;

  @IsOptional()
  @IsUUID()
  emt_id?: string;

  @IsOptional()
  @IsISO8601()
  date_from?: string;

  @IsOptional()
  @IsISO8601()
  date_to?: string;

  @IsOptional()
  @IsUUID()
  incident_id?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
