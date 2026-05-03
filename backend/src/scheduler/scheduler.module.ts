import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulerService } from './scheduler.service';
import { GameDayScheduledFcmService } from './game-day-scheduled-fcm.service';
import { Position } from '../entities/position.entity';
import { RuleViolation } from '../entities/rule-violation.entity';
import { Pair } from '../entities/pair.entity';
import { Capture } from '../entities/capture.entity';
import { GameSettings } from '../entities/game-settings.entity';
import { RuleViolationsModule } from '../rule-violations/rule-violations.module';
import { GameRuntimeModule } from '../game-runtime/game-runtime.module';
import { GameDaysModule } from '../game-days/game-days.module';
import { RedisModule } from '../redis/redis.module';
import { FcmModule } from '../fcm/fcm.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Position, RuleViolation, Pair, Capture, GameSettings]),
    RuleViolationsModule,
    GameRuntimeModule,
    GameDaysModule,
    RedisModule,
    FcmModule,
  ],
  providers: [SchedulerService, GameDayScheduledFcmService],
  exports: [SchedulerService, GameDayScheduledFcmService],
})
export class SchedulerModule {}

