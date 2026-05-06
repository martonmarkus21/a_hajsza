import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCkFlagDto {
  @IsNumber()
  pairId: number;

  @IsOptional()
  @IsNumber()
  userId?: number; // Set by controller from JWT (body value ignored)

  @IsOptional()
  @IsString()
  username?: string; // Set by controller from JWT (body value ignored)
}