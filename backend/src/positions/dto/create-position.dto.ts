import { IsNumber, IsString, IsBoolean, IsOptional, IsDateString } from 'class-validator';

export class CreatePositionDto {
  @IsString()
  deviceId: string;

  @IsNumber()
  pairId: number;

  @IsNumber()
  lat: number;

  @IsNumber()
  lon: number;

  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @IsOptional()
  @IsNumber()
  speed?: number;

  @IsDateString()
  timestamp: string;

  @IsOptional()
  @IsBoolean()
  vehicleMode?: boolean;

  @IsOptional()
  @IsNumber()
  vehicleSessionRemaining?: number;
}






