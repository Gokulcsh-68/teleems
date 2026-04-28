import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsUUID,
  IsArray,
  IsPhoneNumber,
} from 'class-validator';

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
