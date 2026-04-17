import { IsArray, ValidateNested, IsBoolean, IsString } from 'class-validator';
import { Type } from 'class-transformer';

class IftDocumentItem {
  @IsString()
  name: string;

  @IsBoolean()
  verified: boolean;
}

export class VerifyIftDocumentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IftDocumentItem)
  documents: IftDocumentItem[];
}
