import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateDestinationDto {
  @IsString()
  @IsNotEmpty()
  hospital_id: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
