import { IsInt, Min, Max, IsOptional, IsDateString, IsString, IsEnum } from 'class-validator';

export class RecordAssessmentDto {
  // GCS
  @IsInt() @IsOptional() @Min(1) @Max(4) gcs_eye?: number;
  @IsInt() @IsOptional() @Min(1) @Max(5) gcs_verbal?: number;
  @IsInt() @IsOptional() @Min(1) @Max(6) gcs_motor?: number;

  // AVPU
  @IsEnum(['Alert', 'Voice', 'Pain', 'Unresponsive']) @IsOptional() avpu?: string;

  // Pupils
  @IsString() @IsOptional() pupil_left?: string;
  @IsString() @IsOptional() pupil_right?: string;

  // Trauma
  @IsOptional() trauma?: {
    injury_type?: string;
    mechanism?: string;
    region?: string;
  };

  // Chief Complaint & Triage
  @IsString() @IsOptional() chief_complaint?: string;
  @IsString() @IsOptional() triage_code?: string;

  @IsDateString()
  @IsOptional()
  taken_at?: string;
}
