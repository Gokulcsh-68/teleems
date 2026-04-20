import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsUUID } from 'class-validator';
import { InventoryCategory } from '@app/common';

export class CreateInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(InventoryCategory)
  @IsOptional()
  category?: InventoryCategory;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateVehicleInventoryDto {
  @IsUUID()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsNumber()
  @IsOptional()
  minRequired?: number;
}
