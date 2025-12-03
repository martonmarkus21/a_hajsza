import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateGameAreaDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  activeCounties?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  activeRegions?: string[];
}






