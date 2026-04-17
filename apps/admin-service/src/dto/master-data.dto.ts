import { IsString, IsNotEmpty, IsOptional, IsEnum, IsObject, IsBoolean, IsNumber, IsArray } from 'class-validator';
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
