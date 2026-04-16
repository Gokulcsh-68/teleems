import { IsNotEmpty, IsString, IsBoolean, MinLength } from 'class-validator';

export class CancelDispatchDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Reason must be at least 10 characters long' })
  reason: string;

  @IsBoolean()
  request_backup: boolean;
}
