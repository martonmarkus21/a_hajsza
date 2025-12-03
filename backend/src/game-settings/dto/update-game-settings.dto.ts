import { IsOptional, IsNumber, IsBoolean, IsArray } from 'class-validator';

export class UpdateGameSettingsDto {
  @IsOptional()
  @IsNumber()
  locationUpdateIntervalMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isTimerRunning?: boolean;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  pairsSentPositionThisCycle?: number[];
}



