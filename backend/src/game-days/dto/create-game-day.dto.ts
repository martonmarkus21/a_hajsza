import { IsString, IsDateString, IsOptional, IsObject } from 'class-validator';

export class CreateGameDayDto {
  @IsDateString()
  date: string;

  @IsString()
  startTime: string; // HH:mm format

  @IsString()
  endTime: string; // HH:mm format

  @IsOptional()
  @IsObject()
  specialRules?: {
    isFinalDay?: boolean;
    timeWindow?: {
      start: string;
      end: string;
    };
  };
}






