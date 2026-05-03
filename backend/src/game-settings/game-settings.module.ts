import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameSettings } from '../entities/game-settings.entity';
import { Capture } from '../entities/capture.entity';
import { RuleViolation } from '../entities/rule-violation.entity';
import { Device } from '../entities/device.entity';
import { GameSettingsService } from './game-settings.service';
import { GameSettingsController } from './game-settings.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { GameRuntimeModule } from '../game-runtime/game-runtime.module';
import { GameDaysModule } from '../game-days/game-days.module';
import { AuthModule } from '../auth/auth.module';
import { MobileModule } from '../mobile/mobile.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameSettings, Capture, RuleViolation, Device]),
    AuditLogsModule,
    GameRuntimeModule,
    GameDaysModule,
    AuthModule,
    MobileModule,
  ],
  controllers: [GameSettingsController],
  providers: [GameSettingsService],
  exports: [GameSettingsService],
})
export class GameSettingsModule {}

