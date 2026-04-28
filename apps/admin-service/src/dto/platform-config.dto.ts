import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsObject,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { ConfigCategory, FeatureFlagScope } from '@app/common';

export class UpdateSystemConfigDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsObject()
  @IsNotEmpty()
  value: any;

  @IsEnum(ConfigCategory)
  @IsNotEmpty()
  category: ConfigCategory;

  @IsString()
  @IsOptional()
  description?: string;
}

export class ToggleFeatureFlagDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(FeatureFlagScope)
  @IsNotEmpty()
  scope: FeatureFlagScope;

  @IsUUID()
  @IsOptional()
  scopeId?: string;

  @IsBoolean()
  @IsNotEmpty()
  isEnabled: boolean;
}

export class CreateIotProfileDto {
  @IsString()
  @IsNotEmpty()
  model_name: string;

  @IsString()
  @IsNotEmpty()
  firmware_version: string;

  @IsObject()
  @IsNotEmpty()
  capabilities: {
    vitals_streaming: boolean;
    gps_tracking: boolean;
    two_way_audio: boolean;
    network_types: string[];
  };
}
