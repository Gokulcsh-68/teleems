import { IsString, IsNotEmpty } from 'class-validator';

export class AbhaLookupDto {
  @IsString()
  @IsNotEmpty()
  abha_id: string;

  @IsString()
  @IsNotEmpty()
  consent_artefact_id: string;
}
