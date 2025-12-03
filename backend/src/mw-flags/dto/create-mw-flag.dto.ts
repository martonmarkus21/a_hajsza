import { IsNumber, IsOptional } from 'class-validator';

export class CreateMwFlagDto {
  @IsNumber()
  pairId: number;

  @IsOptional()
  @IsNumber()
  userId?: number; // Optional, will be set by controller from req.user
}






