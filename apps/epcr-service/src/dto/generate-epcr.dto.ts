import { IsBoolean, IsOptional } from 'class-validator';

export class GenerateEpcrDto {
  @IsOptional()
  @IsBoolean()
  preview_only?: boolean;
}
