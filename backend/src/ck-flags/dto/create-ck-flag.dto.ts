import { IsNumber, IsOptional } from 'class-validator';

export class CreateCkFlagDto {
  @IsNumber()
  pairId: number;

  @IsOptional()
  @IsNumber()
  userId?: number; // Optional, will be set by controller from req.user
}






