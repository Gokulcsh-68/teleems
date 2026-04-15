import { IsNotEmpty, IsString, IsEnum } from 'class-validator';

export enum OtpPurpose {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  RESET = 'RESET',
}

export class RequestOtpDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}
