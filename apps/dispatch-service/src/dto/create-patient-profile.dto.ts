import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsUUID } from 'class-validator';

export class CreatePatientProfileDto {
  @IsUUID()
  @IsNotEmpty()
  incident_id: string;

  @IsUUID()
  @IsOptional()
  trip_id?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  age?: number;

  @IsString()
  @IsNotEmpty()
  gender: string;

  @IsString()
  @IsNotEmpty()
  triage_code: string;

  @IsBoolean()
  is_unknown: boolean;

  @IsString()
  @IsOptional()
  photo_url?: string;

  @IsString()
  @IsOptional()
  organisationId?: string;
}
