import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsUUID } from 'class-validator';
import { InventoryItemCategory } from '@app/common';

export class CreateInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(InventoryItemCategory)
  @IsOptional()
  category?: InventoryItemCategory;

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
  @IsOptional()
  quantity?: number;

  @IsNumber()
  @IsOptional()
  minRequired?: number;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsNumber()
  @IsOptional()
  consumed?: number;
}

export class BulkUpdateInventoryDto {
  @IsUUID()
  @IsOptional()
  vehicleId?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsNotEmpty()
  items: {
    itemId: string;
    quantity?: number;
    minRequired?: number;
    consumed?: number;
  }[];
}
