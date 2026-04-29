import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameDaysController } from './game-days.controller';
import { GameDaysService } from './game-days.service';
import { GameDay } from '../entities/game-day.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([GameDay]), AuditLogsModule],
  controllers: [GameDaysController],
  providers: [GameDaysService],
  exports: [GameDaysService],
})
export class GameDaysModule {}

