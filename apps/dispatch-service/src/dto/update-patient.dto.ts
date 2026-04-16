import { IsString, IsNumber, IsOptional, IsArray } from 'class-validator';

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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  symptoms?: string[];
}
