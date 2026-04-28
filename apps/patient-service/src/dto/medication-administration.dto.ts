import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class LogMedicationDto {
  @IsString()
  @IsNotEmpty()
  drug_name: string;

  @IsString()
  @IsNotEmpty()
  dose_mg: string;

  @IsString()
  @IsNotEmpty()
  route: string; // IV, IM, PO, SL, INH, NASAL

  @IsDateString()
  @IsOptional()
  time?: string;

  @IsString()
  @IsOptional()
  emt_id?: string;

  @ValidateIf((o) => o.inventory_item_id && o.inventory_item_id !== '')
  @IsUUID()
  @IsOptional()
  inventory_item_id?: string;
}
