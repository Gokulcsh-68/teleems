import { IsObject, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddClinicalNotesDto {
  @IsObject()
  @IsNotEmpty()
  clinical_record!: Record<string, any>;

  @IsString()
  @IsOptional()
  notes?: string;
}
