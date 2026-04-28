import { IsString, IsEnum, IsOptional } from 'class-validator';
import { PatientDocumentType } from '@app/common';

export class UploadDocumentDto {
  @IsEnum(PatientDocumentType)
  doc_type: PatientDocumentType;

  @IsString()
  @IsOptional()
  description?: string;
}
