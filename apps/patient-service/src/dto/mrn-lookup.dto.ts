import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class MrnLookupDto {
  @IsString()
  @IsNotEmpty()
  mrn: string;

  @IsUUID()
  @IsOptional()
  hospitalId?: string;
}
