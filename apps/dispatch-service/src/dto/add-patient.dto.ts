import { IsString, IsNumber, IsOptional, IsArray, IsNotEmpty } from 'class-validator';

export class AddPatientDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  age?: number;

  @IsString()
  @IsNotEmpty()
  gender: string;

  @IsString()
  @IsNotEmpty()
  triage_code: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  symptoms?: string[];
}
