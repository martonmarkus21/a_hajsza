import { IsNumber } from 'class-validator';

export class CreateCaptureDto {
  @IsNumber()
  pairId: number;

  @IsNumber()
  userId: number;
}






