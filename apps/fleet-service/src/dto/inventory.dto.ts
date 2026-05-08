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

  @IsString()
  @IsOptional()
  supplier_details?: string;

  @IsNumber()
  @IsOptional()
  min_stock_threshold?: number;

  @IsNumber()
  @IsOptional()
  max_stock_level?: number;

  @IsNumber()
  @IsOptional()
  lead_time_days?: number;
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

  @IsString()
  @IsOptional()
  supplier_name?: string;

  @IsString()
  @IsOptional()
  invoice_number?: string;

  @IsNotEmpty()
  items: {
    itemId: string;
    quantity?: number;
    minRequired?: number;
    consumed?: number;
    added?: number;
    batch_number?: string;
    expiry_date?: string;
  }[];
}

export class CreateRestockRequestDto {
  @IsUUID()
  @IsNotEmpty()
  vehicleId: string;

  @IsNotEmpty()
  items: {
    itemId: string;
    name: string;
    quantityRequested: number;
  }[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateRestockRequestStatusDto {
  @IsString()
  @IsNotEmpty()
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
}

export class UpdateWarehouseStockDto {
  @IsUUID()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number; // Amount to ADD to warehouse

  @IsString()
  @IsOptional()
  reason?: string;
}
