import { IsInt, Min, Max, IsOptional, IsString, IsEnum, IsArray, IsDateString, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

class GcsDto {
  @IsInt()
  @Min(1)
  @Max(4)
  eye: number;

  @IsInt()
  @Min(1)
  @Max(5)
  verbal: number;

  @IsInt()
  @Min(1)
  @Max(6)
  motor: number;
}

class PupilSideDto {
  @IsInt()
  @Min(1)
  @Max(10)
  size: number;

  @IsString()
  reactivity: string;
}

class PupilsDto {
  @ValidateNested()
  @Type(() => PupilSideDto)
  left: PupilSideDto;

  @ValidateNested()
  @Type(() => PupilSideDto)
  right: PupilSideDto;
}

class HpiDto {
  @IsString()
  @IsOptional()
  onset?: string;

  @IsString()
  @IsOptional()
  duration?: string;

  @IsString()
  @IsOptional()
  character?: string;

  @IsString()
  @IsOptional()
  severity?: string;

  @IsString()
  @IsOptional()
  radiation?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  associated_symptoms?: string[];
}

export class CreateClinicalAssessmentDto {
  @ValidateNested()
  @Type(() => GcsDto)
  @IsOptional()
  gcs?: GcsDto;

  @IsEnum(['A', 'V', 'P', 'U'])
  @IsOptional()
  avpu?: 'A' | 'V' | 'P' | 'U';

  @ValidateNested()
  @Type(() => PupilsDto)
  @IsOptional()
  pupils?: PupilsDto;

  @IsString()
  @IsOptional()
  triage_code?: string;

  @IsString()
  @IsOptional()
  chief_complaint?: string;

  @ValidateNested()
  @Type(() => HpiDto)
  @IsOptional()
  hpi?: HpiDto;

  @IsOptional()
  trauma_json?: any;

  @IsDateString()
  @IsOptional()
  taken_at?: string;
}

export class UpdateClinicalAssessmentDto extends CreateClinicalAssessmentDto {}

export class CreateAssessmentNoteDto {
  @IsString()
  @IsNotEmpty()
  note_text: string;

  @IsEnum(['VOICE', 'TEXT'])
  source: 'VOICE' | 'TEXT';

  @IsDateString()
  @IsOptional()
  timestamp?: string;
}
