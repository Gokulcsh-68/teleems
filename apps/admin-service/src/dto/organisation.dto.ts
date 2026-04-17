import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsEmail } from 'class-validator';
import { OrganisationStatus, SubscriptionPlan } from '@app/common';

export class CreateOrganisationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  registration_number?: string;

  @IsString()
  @IsOptional()
  gstin?: string;

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
  contact_name?: string;

  @IsString()
  @IsOptional()
  contact_designation?: string;

  @IsString()
  @IsOptional()
  contact_phone?: string;

  @IsEmail()
  @IsOptional()
  contact_email?: string;

  @IsEnum(SubscriptionPlan)
  @IsOptional()
  subscription_plan?: SubscriptionPlan;

  @IsNumber()
  @IsOptional()
  vehicle_capacity?: number;

  @IsOptional()
  metadata?: any;
}

export class UpdateOrganisationDto extends CreateOrganisationDto {
  @IsEnum(OrganisationStatus)
  @IsOptional()
  status?: OrganisationStatus;
}
