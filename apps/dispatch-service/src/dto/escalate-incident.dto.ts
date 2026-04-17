import { IsString, IsNotEmpty } from 'class-validator';

export class EscalateIncidentDto {
  @IsString()
  @IsNotEmpty()
  escalate_to: string; // Target User ID

  @IsString()
  @IsNotEmpty()
  reason: string;
}
