import { IsDateString, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateGameDayDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsObject()
  specialRules?: {
    isFinalDay?: boolean;
    timeWindow?: { start: string; end: string };
    locationIntervalSchedule?: Array<{
      from: string;
      to?: string;
      intervalMinutes: number;
    }>;
    areaSchedule?: Array<{
      from: string;
      activeCounties?: string[];
      activeRegions?: string[];
    }>;
  };
}

