import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class CreateGeofenceDto {
  @IsString()
  name: string;

  @IsNumber()
  centerLat: number;

  @IsNumber()
  centerLon: number;

  @IsNumber()
  radiusM: number;

  @IsOptional()
  @IsDateString()
  activeFrom?: string;

  @IsOptional()
  @IsDateString()
  activeUntil?: string;

  @IsOptional()
  @IsString()
  geofenceType?: string;

  @IsOptional()
  metadataJson?: any;
}






