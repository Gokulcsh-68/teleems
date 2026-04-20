import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class RecordAllergyDto {
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
