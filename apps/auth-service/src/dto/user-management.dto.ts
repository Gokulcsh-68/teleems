import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsUUID,
  IsArray,
  IsPhoneNumber,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsPhoneNumber('IN')
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  role: string;

  @IsString()
  @IsOptional()
  org_id?: string;

  @IsString()
  @IsOptional()
  hospital_id?: string;

  @IsString()
  password: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  employee_id?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  designation?: string;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsPhoneNumber('IN')
  @IsOptional()
  phone?: string;

  @IsEnum(['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING'])
  @IsOptional()
  status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'PENDING';

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  org_id?: string;

  @IsString()
  @IsOptional()
  hospital_id?: string;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  employee_id?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  designation?: string;
}

export class MedicalProfileDto {
  @IsString()
  @IsOptional()
  blood_group?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  conditions?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  medications?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allergies?: string[];

  @IsString()
  @IsOptional()
  insurance?: string;

  @IsString()
  @IsOptional()
  aadhaar?: string;
}

export class EmergencyContactDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsString()
  @IsOptional()
  relation?: string;
}

export class SavedLocationDto {
  @IsString()
  address: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lon: number;
}

export class UpdateMeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsPhoneNumber('IN')
  @IsOptional()
  phone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MedicalProfileDto)
  medical_profile?: MedicalProfileDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  emergency_contacts?: EmergencyContactDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SavedLocationDto)
  saved_locations?: SavedLocationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SavedLocationDto)
  favourite_locations?: SavedLocationDto[];

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UserQueryDto {
  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  organisation_id?: string;

  @IsOptional()
  @IsString()
  search?: string; // Search by name, username, or email

  @IsOptional()
  @IsString()
  employee_id?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING'])
  status?: string;

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  limit?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
