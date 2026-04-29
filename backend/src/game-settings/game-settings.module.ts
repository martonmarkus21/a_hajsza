import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameSettings } from '../entities/game-settings.entity';
import { GameSettingsService } from './game-settings.service';
import { GameSettingsController } from './game-settings.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { GameRuntimeModule } from '../game-runtime/game-runtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameSettings]),
    AuditLogsModule,
    GameRuntimeModule,
  ],
  controllers: [GameSettingsController],
  providers: [GameSettingsService],
  exports: [GameSettingsService],
})
export class GameSettingsModule {}

