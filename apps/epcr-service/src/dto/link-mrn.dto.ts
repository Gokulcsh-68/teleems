import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class LinkMrnDto {
  @IsString()
  @IsNotEmpty()
  mrn: string;

  @IsString()
  @IsOptional()
  hmis_record_id?: string;
}
