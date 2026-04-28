import {
  IsNumber,
  IsOptional,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';

export class RecordVitalsDto {
  @IsNumber()
  @IsNotEmpty()
  bp_systolic: number;

  @IsNumber()
  @IsNotEmpty()
  bp_diastolic: number;

  @IsNumber()
  @IsNotEmpty()
  heart_rate: number;

  @IsNumber()
  @IsNotEmpty()
  spo2: number;

  @IsNumber()
  @IsOptional()
  respiratory_rate?: number;

  @IsNumber()
  @IsOptional()
  temp_celsius?: number;

  @IsDateString()
  @IsOptional()
  taken_at?: string;
}
