import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { PatientPhotoCategory } from '@app/common';

export class UploadPhotoDto {
  @IsEnum(PatientPhotoCategory)
  @IsNotEmpty()
  category: PatientPhotoCategory;

  @IsString()
  @IsOptional()
  description?: string;
}
