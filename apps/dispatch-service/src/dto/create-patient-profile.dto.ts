import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
} from 'class-validator';

export class CreatePatientProfileDto {
  @IsUUID()
  @IsNotEmpty()
  incident_id: string;

  @IsUUID()
  @IsOptional()
  id?: string;

  @IsUUID()
  @IsOptional()
  trip_id?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  age?: number;

  @IsString()
  @IsOptional()
  age_range?: string;

  @IsString()
  @IsNotEmpty()
  gender: string;

  @IsString()
  @IsNotEmpty()
  triage_code: string;

  @IsBoolean()
  is_unknown: boolean;

  @IsString()
  @IsOptional()
  mrn?: string;

  @IsString()
  @IsOptional()
  photo_url?: string;

  @IsString()
  @IsOptional()
  organisationId?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  informer_name?: string;

  @IsString()
  @IsOptional()
  informer_relation?: string;

  @IsString()
  @IsOptional()
  informer_phone?: string;

  @IsBoolean()
  @IsOptional()
  is_mlc?: boolean;

  @IsString()
  @IsOptional()
  mlc_fir_number?: string;

  @IsString()
  @IsOptional()
  mlc_police_station?: string;

  @IsString()
  @IsOptional()
  mlc_officer_contact?: string;

  @IsOptional()
  conditions?: string[];

  @IsOptional()
  medications?: string[];

  @IsOptional()
  surgeries?: string[];

  @IsOptional()
  allergies?: {name: string; severity: string}[];

  @IsOptional()
  chief_complaint?: string;

  @IsOptional()
  hpi?: {
    onset?: string;
    duration?: string;
    character?: string;
    severity?: string;
    radiation?: string;
    associated_symptoms?: string;
  };

  @IsOptional()
  gcs?: {
    eye?: number;
    verbal?: number;
    motor?: number;
    total?: number;
  };

  @IsOptional()
  avpu?: string;

  @IsOptional()
  pupils?: {
    left?: string;
    right?: string;
  };

  @IsOptional()
  trauma?: {
    injury_type?: string;
    mechanism?: string;
    region?: string;
  };
}
