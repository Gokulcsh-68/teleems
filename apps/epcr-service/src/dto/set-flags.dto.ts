import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';

export enum SpecialFlag {
  DOA = 'DOA',
  REFUSAL = 'REFUSAL',
  MLC = 'MLC',
  UNKNOWN_PATIENT = 'UNKNOWN_PATIENT',
}

export class SetSpecialFlagsDto {
  @IsEnum(SpecialFlag)
  @IsNotEmpty()
  flag: SpecialFlag;

  @IsDateString()
  @IsNotEmpty()
  timestamp: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
