import { IsString, IsObject, IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum IftUrgency {
  BASIC = 'BASIC',
  ADVANCED = 'ADVANCED',
  CRITICAL = 'CRITICAL',
}

export class CreateIftTripDto {
  @IsString()
  origin_hospital_id: string;

  @IsString()
  destination_hospital_id: string;

  @IsObject()
  patient_summary: Record<string, any>;

  @IsEnum(IftUrgency)
  urgency: IftUrgency;

  @IsString()
  requested_vehicle_type: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  organisationId?: string;
}
