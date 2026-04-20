import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString, IsObject, IsBoolean } from 'class-validator';
import { StaffType, StaffStatus } from '@app/common';

export class CreateStaffDto {
  // --- User / Auth Info ---
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsNotEmpty()
  password?: string; // Initial password

  // --- Profile Info ---
  @IsEnum(StaffType)
  @IsNotEmpty()
  type: StaffType;

  @IsEnum(StaffStatus)
  @IsOptional()
  status?: StaffStatus;

  @IsString()
  @IsOptional()
  organisationId?: string; // For Super Admin override

  @IsString()
  @IsOptional()
  aadhaar_number?: string;

  @IsDateString()
  @IsOptional()
  dob?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  photo_url?: string;

  @IsString()
  @IsOptional()
  blood_group?: string;

  @IsString()
  @IsOptional()
  emergency_contact_phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsObject()
  @IsOptional()
  professional_details?: Record<string, any>;
}

export class UpdateStaffDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(StaffStatus)
  @IsOptional()
  status?: StaffStatus;

  @IsString()
  @IsOptional()
  photo_url?: string;

  @IsString()
  @IsOptional()
  emergency_contact_phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsObject()
  @IsOptional()
  professional_details?: Record<string, any>;
}
