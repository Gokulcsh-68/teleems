import { IsString, IsNotEmpty } from 'class-validator';

export class EscalateSessionDto {
  @IsString()
  @IsNotEmpty()
  escalated_to!: string; // e.g., 'EDP', 'Specialist'
}
