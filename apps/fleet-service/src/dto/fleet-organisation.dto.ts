import { IsString, IsNotEmpty, IsOptional, IsEnum, IsObject, IsNumber, Min } from 'class-validator';
import { SubscriptionPlan, OrganisationStatus } from '@app/common';

export class CreateFleetOrganisationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  status?: OrganisationStatus;

  @IsString()
  @IsOptional()
  gstin?: string;

  @IsString()
  @IsOptional()
  reg_number?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  zip?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  contact_name?: string;

  @IsString()
  @IsOptional()
  contact_designation?: string;

  @IsString()
  @IsOptional()
  contact_phone?: string;

  @IsString()
  @IsOptional()
  contact_email?: string;

  @IsEnum(SubscriptionPlan)
  @IsOptional()
  subscription_plan?: SubscriptionPlan;

  @IsNumber()
  @Min(1)
  @IsOptional()
  vehicle_capacity?: number;
}
