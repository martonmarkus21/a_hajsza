import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePairDto {
  @IsNumber()
  assignedNumber: number;

  @IsOptional()
  @IsString()
  name?: string;
}





