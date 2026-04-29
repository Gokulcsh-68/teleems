import { IsArray, IsEnum, IsString, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export enum DeliveryChannel {
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
}

export enum RecipientType {
  HOSPITAL = 'HOSPITAL',
  FAMILY = 'FAMILY',
  CUSTOM = 'CUSTOM',
}

export class RecipientDto {
  @IsEnum(RecipientType)
  @IsNotEmpty()
  type: RecipientType;

  @IsString()
  @IsNotEmpty()
  contact: string;
}

export class SendEpcrDto {
  @IsArray()
  @IsEnum(DeliveryChannel, { each: true })
  channels: DeliveryChannel[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients: RecipientDto[];
}
