import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, IsObject, IsNumber, IsUUID } from 'class-validator';
import { RoutingStrategy } from '@app/common';

export class CreateCCEDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateCCEProfileDto {
  @IsArray()
  @IsOptional()
  assigned_zones?: {
    state?: string;
    city?: string;
    pincode?: string;
  }[];

  @IsEnum(RoutingStrategy)
  @IsOptional()
  routing_strategy?: RoutingStrategy;

  @IsObject()
  @IsOptional()
  sla_config?: {
    max_hold_seconds: number;
    max_dispatch_seconds: number;
  };
}
