import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';

export class CreateDoctorConsultDto {
  @IsString()
  @IsNotEmpty()
  patient_id!: string;

  @IsString()
  @IsOptional()
  patient_name?: string;

  @IsString()
  @IsOptional()
  patient_phone?: string;

  @IsEmail()
  @IsOptional()
  patient_email?: string;

  @IsString()
  @IsNotEmpty()
  consult_reason!: string;

  @IsString()
  @IsOptional()
  consult_type?: string; // 'virtual' | 'home' | 'clinic'

  @IsString()
  @IsOptional()
  scheduled_at?: string;

  @IsString()
  @IsOptional()
  trip_id?: string;

  @IsString()
  @IsOptional()
  incident_id?: string;

  @IsString()
  @IsOptional()
  doctor_mobile?: string;

  @IsString()
  @IsOptional()
  doctor_email?: string;
}
