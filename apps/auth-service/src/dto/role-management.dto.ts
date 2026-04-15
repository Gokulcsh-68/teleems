import { IsString, IsArray, IsOptional, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MaxLength(50)
  name: string;

  @IsString()
  @IsOptional()
  scope?: string = 'GLOBAL';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[] = [];
}

export class UpdateRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
