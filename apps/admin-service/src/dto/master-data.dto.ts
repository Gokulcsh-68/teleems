import { IsString, IsNotEmpty, IsOptional, IsEnum, IsObject, IsBoolean, IsNumber, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { SymptomSeverity, InventoryItemCategory, HospitalType } from '@app/common';

export class CreateSymptomDto {
  @IsObject()
  @IsNotEmpty()
  names: Record<string, string>;

  @IsEnum(SymptomSeverity)
  @IsNotEmpty()
  severity: SymptomSeverity;

  @IsObject()
  @IsOptional()
  first_aid_instructions?: Record<string, string>;
}

export class CreateIncidentCategoryDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  color_code?: string;

  @IsString()
  @IsOptional()
  hex_color?: string;

  @IsObject()
  @IsOptional()
  auto_escalation_rules?: {
    enabled: boolean;
    timer_minutes?: number;
    upgrade_to?: string;
  };
}

export class CreateInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(InventoryItemCategory)
  @IsNotEmpty()
  category: InventoryItemCategory;

  @IsString()
  @IsOptional()
  unit_of_measure?: string;

  @IsString()
  @IsOptional()
  hsn_code?: string;

  @IsBoolean()
  @IsOptional()
  gstin_applicable?: boolean;

  @IsNumber()
  @IsOptional()
  min_stock_threshold?: number;

  @IsNumber()
  @IsOptional()
  max_stock_level?: number;

  @IsBoolean()
  @IsOptional()
  is_expiry_tracked?: boolean;

  @IsBoolean()
  @IsOptional()
  batch_number_required?: boolean;
}

export class UpdateHospitalMasterDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(HospitalType)
  @IsOptional()
  type?: HospitalType;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  emergency_phone?: string;

  @IsString()
  @IsOptional()
  contact_phone?: string;

  @IsString()
  @IsOptional()
  contact_email?: string;

  @IsString()
  @IsOptional()
  medical_director?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsArray()
  @IsOptional()
  specialties?: string[];
}
export class MasterQueryDto {
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  limit?: number = 50;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isCommon?: boolean;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateChiefComplaintDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsEnum(['RED', 'YELLOW', 'GREEN', 'BLACK'])
  @IsOptional()
  default_triage?: string;

  @IsBoolean()
  @IsOptional()
  isCommon?: boolean;
}

export class CreateInterventionMasterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsBoolean()
  @IsOptional()
  requires_specialized_logging?: boolean;

  @IsBoolean()
  @IsOptional()
  isCommon?: boolean;
}

export class CreateMedicationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  default_route?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  common_dosages?: string[];

  @IsBoolean()
  @IsOptional()
  isCommon?: boolean;
}

export class CreateSurgeryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsBoolean()
  @IsOptional()
  isCommon?: boolean;
}

export class CreateHospitalisationReasonDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsBoolean()
  @IsOptional()
  isCommon?: boolean;
}

export * from './register-hospital.dto';

export class CreateAllergenDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsBoolean()
  @IsOptional()
  isCommon?: boolean;
}

export class CreateMedicationRouteDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsBoolean()
  @IsOptional()
  isCommon?: boolean;
}

