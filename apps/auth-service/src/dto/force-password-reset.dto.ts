import { IsNotEmpty, IsUUID } from 'class-validator';

export class ForcePasswordResetDto {
  @IsUUID()
  @IsNotEmpty()
  target_user_id: string;
}
