import { IsOptional, IsString, IsISO8601, IsUUID } from 'class-validator';

export class IncidentAnalyticsQueryDto {
  @IsOptional()
  @IsISO8601()
  date_from?: string;

  @IsOptional()
  @IsISO8601()
  date_to?: string;

  @IsOptional()
  @IsUUID()
  org_id?: string;
}
