import { IsArray, IsOptional, IsString, IsEnum, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

class ConditionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  icd10_code?: string;

  @IsString()
  @IsOptional()
  since?: string;
}

class MedicationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  dose?: string;

  @IsString()
  @IsOptional()
  frequency?: string;

  @IsString()
  @IsOptional()
  route?: string;

  @IsString()
  @IsOptional()
  since?: string;
}

class AllergyDto {
  @IsString()
  @IsNotEmpty()
  allergen: string;

  @IsEnum(['MILD', 'MODERATE', 'SEVERE', 'ANAPHYLACTIC'])
  @IsOptional()
  severity?: string;

  @IsString()
  @IsOptional()
  reaction?: string;
}

class SurgeryDto {
  @IsString()
  @IsNotEmpty()
  surgery_name: string;

  @IsString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

class HospitalisationDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  admission_date?: string;

  @IsString()
  @IsOptional()
  discharge_date?: string;

  @IsString()
  @IsOptional()
  hospital_name?: string;
}

export class UpdateMedicalHistoryDto {
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MedicationDto)
  medications?: MedicationDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AllergyDto)
  allergies?: AllergyDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SurgeryDto)
  surgeries?: SurgeryDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => HospitalisationDto)
  hospitalisations?: HospitalisationDto[];
}
