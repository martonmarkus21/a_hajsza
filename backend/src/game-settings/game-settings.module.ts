import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameSettings } from '../entities/game-settings.entity';
import { Device } from '../entities/device.entity';
import { GameSettingsService } from './game-settings.service';
import { GameSettingsController } from './game-settings.controller';
import { FcmModule } from '../fcm/fcm.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameSettings, Device]),
    FcmModule,
    AuditLogsModule,
  ],
  controllers: [GameSettingsController],
  providers: [GameSettingsService],
  exports: [GameSettingsService],
})
export class GameSettingsModule {}

