import { IsString, IsOptional } from 'class-validator';

export class DispatchIncidentDto {
  @IsString()
  @IsOptional()
  manual_vehicle_id?: string;

  @IsString()
  @IsOptional()
  override_reason?: string;
}
