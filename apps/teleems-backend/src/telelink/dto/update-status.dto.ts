import { IsEnum, IsNotEmpty } from 'class-validator';
import { TeleLinkSessionStatus } from '@app/common';

export class UpdateTeleLinkStatusDto {
  @IsEnum(TeleLinkSessionStatus)
  @IsNotEmpty()
  status!: TeleLinkSessionStatus;
}
