import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class RecordInterventionDto {
  @IsString()
  @IsNotEmpty()
  intervention_name: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  dosage?: string;

  @IsDateString()
  @IsOptional()
  timestamp?: string;
}
