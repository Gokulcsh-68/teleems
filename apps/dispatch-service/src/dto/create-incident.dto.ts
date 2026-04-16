import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum IncidentCategory {
  MEDICAL = 'MEDICAL',
  TRAUMA = 'TRAUMA',
  MATERNITY = 'MATERNITY',
  FIRE = 'FIRE',
  POLICE = 'POLICE',
  OTHER = 'OTHER',
}

export enum IncidentSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export class PatientDto {
  @IsString()
  name: string;

  @IsNumber()
  @IsOptional()
  age?: number;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  symptoms?: string[];
}

export class CreateIncidentDto {
  @IsEnum(IncidentCategory)
  category: IncidentCategory;

  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;

  @IsString()
  @IsOptional()
  caller_id?: string;

  @IsNumber()
  gps_lat: number;

  @IsNumber()
  gps_lon: number;

  @IsString()
  address: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatientDto)
  patients: PatientDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}
