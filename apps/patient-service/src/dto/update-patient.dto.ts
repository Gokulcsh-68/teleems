import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
} from 'class-validator';

export class UpdatePatientDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  age?: number;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  triage_code?: string;

  @IsString()
  @IsOptional()
  photo_url?: string;

  @IsString()
  @IsOptional()
  mrn?: string;

  @IsString()
  @IsOptional()
  abha_id?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  informer_name?: string;

  @IsString()
  @IsOptional()
  informer_relation?: string;

  @IsBoolean()
  @IsOptional()
  is_unknown?: boolean;
}
