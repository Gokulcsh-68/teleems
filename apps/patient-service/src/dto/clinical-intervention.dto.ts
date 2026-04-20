import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEnum, IsBoolean, IsInt, Min, IsObject } from 'class-validator';

export enum InterventionType {
  CPR = 'CPR',
  DEFIB = 'DEFIB',
  IV_ACCESS = 'IV_ACCESS',
  INTUBATION = 'INTUBATION',
  OXYGEN = 'OXYGEN',
  SPLINT = 'SPLINT',
  TOURNIQUET = 'TOURNIQUET',
  CATHETER = 'CATHETER',
  OTHER = 'OTHER',
}

export class CreateInterventionDto {
  @IsEnum(InterventionType)
  type: InterventionType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  dosage?: string;

  @IsObject()
  @IsOptional()
  detail_json?: any;

  @IsDateString()
  @IsOptional()
  timestamp?: string;

  @IsString()
  @IsOptional()
  emt_id?: string;
}

export class RecordCprDto {
  @IsDateString()
  start_time: string;

  @IsDateString()
  @IsOptional()
  end_time?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  cycles?: number;

  @IsBoolean()
  rosc_achieved: boolean;

  @IsDateString()
  @IsOptional()
  rosc_time?: string;
}

export class RecordDefibDto {
  @IsDateString()
  @IsOptional()
  timestamp?: string;

  @IsInt()
  @Min(1)
  energy_joules: number;

  @IsInt()
  @Min(1)
  shock_number: number;

  @IsString()
  rhythm_before: string;

  @IsString()
  rhythm_after: string;
}

export class RecordIntubationDto {
  @IsDateString()
  @IsOptional()
  timestamp?: string;

  @IsString()
  tube_size_mm: string;

  @IsString()
  confirmation_method: string;

  @IsString()
  @IsOptional()
  emt_id?: string;
}
