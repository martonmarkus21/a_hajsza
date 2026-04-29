import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameRuntimeService } from './game-runtime.service';
import { GameRuntimeState } from '../entities/game-runtime-state.entity';
import { GameSettings } from '../entities/game-settings.entity';
import { GameDaysModule } from '../game-days/game-days.module';
import { GameAreaModule } from '../game-area/game-area.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { FcmModule } from '../fcm/fcm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameRuntimeState, GameSettings]),
    GameDaysModule,
    GameAreaModule,
    WebSocketModule,
    FcmModule,
  ],
  providers: [GameRuntimeService],
  exports: [GameRuntimeService],
})
export class GameRuntimeModule {}

