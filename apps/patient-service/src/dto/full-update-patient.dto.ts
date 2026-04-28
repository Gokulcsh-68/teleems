import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  IsBoolean,
} from 'class-validator';

export class FullUpdatePatientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsNotEmpty()
  age: number;

  @IsString()
  @IsNotEmpty()
  gender: string;

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
