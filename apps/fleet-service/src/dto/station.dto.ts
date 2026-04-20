import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateStationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  gps_lat?: number;

  @IsNumber()
  @IsOptional()
  gps_lon?: number;

  @IsString()
  @IsOptional()
  incharge_name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  organisationId?: string; // For Super Admins to specify
}

export class UpdateStationDto extends CreateStationDto {}
