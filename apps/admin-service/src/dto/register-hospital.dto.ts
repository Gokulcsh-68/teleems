import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsPhoneNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateHospitalDto } from '../../../hospital-service/src/dto/hospital.dto';

export class HospitalAdminDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsEmail()
  email: string;

  @IsPhoneNumber('IN')
  phone: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class RegisterHospitalDto {
  @ValidateNested()
  @Type(() => CreateHospitalDto)
  hospital: CreateHospitalDto;

  @ValidateNested()
  @Type(() => HospitalAdminDto)
  admin: HospitalAdminDto;
}
