import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString, IsUUID } from 'class-validator';
import { ShiftType } from '@app/common';

export class CreateRosterDto {
  @IsUUID()
  @IsNotEmpty()
  vehicleId: string;

  @IsUUID()
  @IsNotEmpty()
  driverId: string;

  @IsUUID()
  @IsNotEmpty()
  staffId: string; // EMT or Doctor

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsEnum(ShiftType)
  @IsOptional()
  shiftType?: ShiftType;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  organisationId?: string; // For super admin override
}

export class RosterQueryDto {
  @IsUUID()
  @IsOptional()
  vehicleId?: string;

  @IsDateString()
  @IsOptional()
  date?: string;
}
