import { IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class UpdateGameSettingsDto {
  @IsOptional()
  @IsNumber()
  locationUpdateIntervalMinutes?: number;

  @IsOptional()
  @IsBoolean()
  gameEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  stayRuleEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  stayRadiusKm?: number;
}



