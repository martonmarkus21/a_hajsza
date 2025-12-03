import { IsString, IsOptional } from 'class-validator';

export class UpdatePairNameDto {
  @IsOptional()
  @IsString()
  name: string | null;
}






