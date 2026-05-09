import { IsBoolean, IsNotEmpty } from 'class-validator';

export class ToggleRecordingDto {
  @IsBoolean()
  @IsNotEmpty()
  is_recording!: boolean;

  @IsBoolean()
  @IsNotEmpty()
  recording_consent!: boolean;
}
