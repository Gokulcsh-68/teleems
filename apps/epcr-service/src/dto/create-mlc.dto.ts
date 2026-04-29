import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreateMlcRecordDto {
  @IsString()
  @IsOptional()
  fir_number?: string;

  @IsString()
  @IsOptional()
  police_station?: string;

  @IsString()
  @IsOptional()
  officer_name?: string;

  @IsString()
  @IsOptional()
  officer_contact?: string;

  @IsDateString()
  @IsNotEmpty()
  intimation_time: string;

  @IsString()
  @IsNotEmpty()
  intimated_by: string;
}
