import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulerService } from './scheduler.service';
import { Position } from '../entities/position.entity';
import { RuleViolation } from '../entities/rule-violation.entity';
import { Device } from '../entities/device.entity';
import { RuleViolationsModule } from '../rule-violations/rule-violations.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Position, RuleViolation, Device]),
    RuleViolationsModule,
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}

