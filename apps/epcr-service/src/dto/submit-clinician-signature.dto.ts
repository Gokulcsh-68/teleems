import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SubmitClinicianSignatureDto {
  @IsString()
  @IsNotEmpty()
  clinician_name: string;

  @IsString()
  @IsNotEmpty()
  designation: string;

  @IsString()
  @IsNotEmpty()
  signature_image_base64: string;

  @IsString()
  @IsNotEmpty()
  timestamp: string;
}
