import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class RecordInterventionDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  dosage?: string;

  @IsDateString()
  @IsOptional()
  administered_at?: string;
}
