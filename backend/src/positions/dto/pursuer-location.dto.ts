import { IsNumber, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PursuerLocationDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon: number;
}
