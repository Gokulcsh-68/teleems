import { IsString, IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { IncidentCategory } from './create-incident.dto';

export class SlaBreachQueryDto {
  @IsString()
  @IsOptional()
  org_id?: string;

  @IsEnum(IncidentCategory)
  @IsOptional()
  category?: IncidentCategory;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit: number = 50;

  @IsString()
  @IsOptional()
  cursor?: string;
}
