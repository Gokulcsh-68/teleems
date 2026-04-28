import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateFleetOrganisationDto } from '../../../fleet-service/src/dto/fleet-organisation.dto';

export class FleetOperatorAdminDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class RegisterFleetOperatorDto {
  @ValidateNested()
  @Type(() => CreateFleetOrganisationDto)
  organisation: CreateFleetOrganisationDto;

  @ValidateNested()
  @Type(() => FleetOperatorAdminDto)
  admin: FleetOperatorAdminDto;
}
