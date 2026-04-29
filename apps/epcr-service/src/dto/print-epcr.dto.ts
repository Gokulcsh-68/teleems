import { IsString, IsNotEmpty } from 'class-validator';

export class PrintEpcrDto {
  @IsString()
  @IsNotEmpty()
  printer_device_id: string;
}
