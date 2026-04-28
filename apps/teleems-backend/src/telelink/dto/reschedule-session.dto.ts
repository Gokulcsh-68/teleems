import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class RescheduleTeleLinkSessionDto {
  @IsDateString()
  @IsNotEmpty()
  scheduled_at!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
