import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateCaptureDto {
  @IsInt()
  @Min(1)
  pairId: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  requestId?: string;

  @IsOptional()
  @IsISO8601()
  clientTimestamp?: string;

  /** Üldözői felületen a rögzítéskor mutatott pár-pozíció (WGS‑84), ha van. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  pairLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  pairLon?: number;
}






