import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum IncidentCategory {
  MEDICAL = 'MEDICAL',
  TRAUMA = 'TRAUMA',
  MATERNITY = 'MATERNITY',
  FIRE = 'FIRE',
  POLICE = 'POLICE',
  OTHER = 'OTHER',
}

export enum TriageLevel {
  RED = 'RED',       // Most Urgent - Life Threatening
  YELLOW = 'YELLOW', // Urgent - Potential Life Threat
  ORANGE = 'ORANGE', // Urgent - Not Life Threatening
  GREEN = 'GREEN',   // Less Urgent - Walking Wounded
  WHITE = 'WHITE',   // Non-Emergency
  BLUE = 'BLUE',     // Specialty/Protocol Transfer
  BLACK = 'BLACK',   // Dead/Deceased
}

export enum IncidentSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export class SymptomDto {
  @IsString()
  name: string;

  @IsNumber()
  @IsOptional()
  duration_minutes?: number;
}

export class PatientDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  age?: number;

  @IsString()
  gender: string;

  @IsEnum(TriageLevel)
  @IsOptional()
  triage_level?: TriageLevel;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SymptomDto)
  @IsOptional()
  symptoms?: SymptomDto[];
}

export class CreateIncidentDto {
  @IsEnum(IncidentCategory)
  category: IncidentCategory;

  @IsEnum(TriageLevel)
  @IsOptional()
  triage_level?: TriageLevel;

  @IsEnum(IncidentSeverity)
  @IsOptional()
  severity?: IncidentSeverity;

  @IsString()
  @IsOptional()
  caller_id?: string;

  @IsString()
  @IsOptional()
  organisationId?: string;

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

  @IsString()
  @IsOptional()
  guest_name?: string;

  @IsString()
  @IsOptional()
  guest_phone?: string;
}
