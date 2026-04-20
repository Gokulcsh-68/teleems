import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

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
}

export class DepartmentQueryDto {
  @IsString()
  @IsOptional()
  hospitalId?: string;

  @IsString()
  @IsOptional()
  search?: string;
}
