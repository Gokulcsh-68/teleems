import { IsNumber, IsString, IsEnum } from 'class-validator';

export enum BreakdownCategory {
  MECHANICAL = 'MECHANICAL',
  TYRE = 'TYRE',
  ACCIDENT = 'ACCIDENT',
  FUEL = 'FUEL',
}

export class BreakdownDto {
  @IsNumber()
  gps_lat: number;

  @IsNumber()
  gps_lon: number;

  @IsString()
  reason: string;

  @IsEnum(BreakdownCategory)
  category: BreakdownCategory;
}
