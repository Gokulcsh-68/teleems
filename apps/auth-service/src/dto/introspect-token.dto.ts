import { IsNotEmpty, IsString } from 'class-validator';

export class IntrospectTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
