import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ReassignVehicleDto {
  @IsString()
  @IsNotEmpty()
  new_vehicle_id: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Reason must be at least 10 characters long' })
  reason: string;
}
