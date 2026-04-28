import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum UploadTargetType {
  AVATAR = 'avatar',
  DOCUMENT = 'document',
}

export class PresignRequestDto {
  @IsEnum(UploadTargetType)
  @IsNotEmpty()
  target_type: UploadTargetType;

  @IsString()
  @IsNotEmpty()
  content_type: string;

  @IsString()
  @IsNotEmpty()
  file_extension: string;
}

export class Base64UploadDto {
  @IsEnum(UploadTargetType)
  @IsNotEmpty()
  target_type: UploadTargetType;

  @IsString()
  @IsNotEmpty()
  base64_data: string;

  @IsString()
  @IsOptional()
  file_extension?: string;
}
