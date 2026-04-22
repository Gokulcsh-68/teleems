import { IsString, IsNumber, IsOptional, IsArray, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TriageLevel, SymptomDto } from './create-incident.dto';

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

  @IsEnum(TriageLevel)
  @IsOptional()
  triage_level?: TriageLevel;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SymptomDto)
  @IsOptional()
  symptoms?: SymptomDto[];
}
