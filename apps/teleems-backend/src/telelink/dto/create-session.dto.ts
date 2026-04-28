import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateTeleLinkSessionDto {
  @IsString()
  @IsNotEmpty()
  trip_id!: string;

  @IsString()
  @IsNotEmpty()
  incident_id!: string;

  @IsBoolean()
  @IsOptional()
  sos_flag?: boolean;

  @IsString()
  @IsOptional()
  consult_type?: string;

  @IsString()
  @IsOptional()
  consult_reason?: string;

  @IsString()
  @IsOptional()
  scheduled_at?: string;

  @IsString()
  @IsOptional()
  professional_id?: string;
}
