import { IsEmail, IsNotEmpty } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty()
  email: string;
}
