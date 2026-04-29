import { IsBoolean, IsOptional } from 'class-validator';

export class ExportEpcrDto {
  @IsBoolean()
  @IsOptional()
  include_media?: boolean;
}
