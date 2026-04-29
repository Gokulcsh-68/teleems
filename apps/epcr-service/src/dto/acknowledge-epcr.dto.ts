import { IsString, IsNotEmpty } from 'class-validator';

export class AcknowledgeEpcrDto {
  @IsString()
  @IsNotEmpty()
  acknowledged_by: string;

  @IsString()
  @IsNotEmpty()
  department: string;

  @IsString()
  @IsNotEmpty()
  timestamp: string;
}
