import { IsString, IsNotEmpty, IsOptional, IsObject, IsNumber } from 'class-validator';

export class StartShiftDto {
  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @IsString()
  @IsOptional()
  driverId?: string;

  @IsString()
  @IsOptional()
  staffId?: string; // EMT or Doctor

  @IsObject()
  @IsOptional()
  checklist?: {
    oxygen_level?: string;
    stretcher_condition?: string;
    inventory_checked?: boolean;
    fuel_level?: string;
    odometer_start?: number;
  };

  @IsString()
  @IsOptional()
  notes?: string;
}

export class EndShiftDto {
  @IsObject()
  @IsOptional()
  checklist?: {
    odometer_end?: number;
  };

  @IsString()
  @IsOptional()
  notes?: string;
}
