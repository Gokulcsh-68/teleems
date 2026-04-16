import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddPatientDto } from './add-patient.dto';

export class BulkAddPatientsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddPatientDto)
  patients: AddPatientDto[];
}
