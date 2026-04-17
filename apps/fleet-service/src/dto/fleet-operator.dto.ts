import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject, IsNumber } from 'class-validator';

export class CreateFleetOperatorDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  organisationId?: string;

  @IsArray()
  @IsOptional()
  hospital_ids?: string[];

  @IsObject()
  @IsOptional()
  service_zones?: {
    states?: string[];
    districts?: string[];
    cities?: string[];
    pincodes?: string[];
  };

  @IsString()
  @IsOptional()
  cce_pool_id?: string;

  @IsNumber()
  @IsOptional()
  vehicle_count_cap?: number;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  contact_person?: string;

  @IsString()
  @IsOptional()
  contact_phone?: string;
}

export class UpdateFleetOperatorDto extends CreateFleetOperatorDto {
  @IsString()
  @IsOptional()
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}
