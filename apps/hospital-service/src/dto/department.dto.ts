import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  headOfDepartment?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  totalBedsCapacity?: number;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsNotEmpty()
  hospitalId: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateDepartmentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  headOfDepartment?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  totalBedsCapacity?: number;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class DepartmentQueryDto {
  @IsString()
  @IsOptional()
  hospitalId?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;
}
