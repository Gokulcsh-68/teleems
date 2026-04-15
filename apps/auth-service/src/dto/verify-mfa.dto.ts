import { IsNotEmpty, IsString, IsIn } from 'class-validator';

export class VerifyMfaDto {
  @IsString()
  @IsIn(['TOTP', 'SMS'], { message: 'method must be either TOTP or SMS' })
  method: 'TOTP' | 'SMS';

  @IsString()
  @IsNotEmpty()
  code: string;
}
