import { IsNotEmpty, IsNumber, Min, Max, IsString, IsOptional } from 'class-validator';

export class CreateFeedbackDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
