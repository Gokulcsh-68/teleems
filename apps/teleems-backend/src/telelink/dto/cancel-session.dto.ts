import { IsString, IsNotEmpty } from 'class-validator';

export class CancelTeleLinkSessionDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
