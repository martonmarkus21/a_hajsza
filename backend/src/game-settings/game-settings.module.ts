import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameSettings } from '../entities/game-settings.entity';
import { Device } from '../entities/device.entity';
import { GameSettingsService } from './game-settings.service';
import { GameSettingsController } from './game-settings.controller';
import { FcmModule } from '../fcm/fcm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameSettings, Device]),
    FcmModule,
  ],
  controllers: [GameSettingsController],
  providers: [GameSettingsService],
  exports: [GameSettingsService],
})
export class GameSettingsModule {}

