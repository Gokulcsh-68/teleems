import { IsInt, Min, Max, IsOptional, IsDateString } from 'class-validator';

export class RecordGcsDto {
  @IsInt()
  @Min(1)
  @Max(4)
  eye: number;

  @IsInt()
  @Min(1)
  @Max(5)
  verbal: number;

  @IsInt()
  @Min(1)
  @Max(6)
  motor: number;

  @IsDateString()
  @IsOptional()
  taken_at?: string;
}
