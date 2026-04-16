import { IsNotEmpty, IsString, IsIn, IsOptional } from 'class-validator';

export class VerifyMfaDto {
  @IsString()
  @IsOptional()
  mfa_session_token?: string;

  @IsString()
  @IsOptional()
  @IsIn(['TOTP', 'SMS'], { message: 'method must be either TOTP or SMS' })
  method?: 'TOTP' | 'SMS' = 'TOTP';

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  totp_code?: string;
}
