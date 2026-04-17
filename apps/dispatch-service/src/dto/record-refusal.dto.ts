import { IsString, IsNumber, IsOptional, IsNotEmpty } from 'class-validator';

export class RecordRefusalDto {
  @IsString()
  @IsNotEmpty()
  refusing_party_name: string;

  @IsString()
  @IsNotEmpty()
  relationship: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsNotEmpty()
  witness_name: string;

  @IsString()
  @IsNotEmpty()
  signature_image_base64: string;

  @IsNumber()
  gps_lat: number;

  @IsNumber()
  gps_lon: number;
}
