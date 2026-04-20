import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AddConditionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  icd10_code?: string;

  @IsString()
  @IsOptional()
  since?: string; // e.g. "2010" or "YYYY-MM"
}
