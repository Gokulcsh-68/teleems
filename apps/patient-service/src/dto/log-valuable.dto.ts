import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ValuableLocationType } from '@app/common';

export class LogValuableDto {
  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  photo_url?: string;

  @IsEnum(ValuableLocationType)
  location_type: ValuableLocationType;

  @IsDateString()
  @IsOptional()
  timestamp?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gps_lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gps_lon?: number;
}
