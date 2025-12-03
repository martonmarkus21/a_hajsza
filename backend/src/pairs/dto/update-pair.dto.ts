import { IsOptional, IsBoolean, IsString, IsNumber } from 'class-validator';

export class UpdatePairDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber()
  assignedNumber?: number;
}





