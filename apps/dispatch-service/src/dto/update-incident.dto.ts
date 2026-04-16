import { IsString, IsEnum, IsOptional, IsInt, Min } from 'class-validator';

export enum IncidentStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  EN_ROUTE = 'EN_ROUTE',
  ON_SCENE = 'ON_SCENE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class UpdateIncidentStatusDto {
  @IsEnum(IncidentStatus)
  status: IncidentStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class AssignVehicleDto {
  @IsString()
  vehicle_id: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  eta_seconds?: number;
}
