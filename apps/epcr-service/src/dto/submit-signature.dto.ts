import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class SubmitSignatureDto {
  @IsString()
  @IsNotEmpty()
  signer_id: string; // User ID or Name

  @IsString()
  @IsNotEmpty()
  signature_image_base64: string;

  @IsNumber()
  @IsOptional()
  gps_lat?: number;

  @IsNumber()
  @IsOptional()
  gps_lon?: number;

  @IsString()
  @IsNotEmpty()
  timestamp: string;
}
