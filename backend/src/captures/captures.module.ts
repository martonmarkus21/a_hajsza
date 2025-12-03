import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CapturesController } from './captures.controller';
import { CapturesService } from './captures.service';
import { Capture } from '../entities/capture.entity';
import { Position } from '../entities/position.entity';
import { WebSocketModule } from '../websocket/websocket.module';
import { FcmModule } from '../fcm/fcm.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { GameDaysModule } from '../game-days/game-days.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Capture, Position]),
    WebSocketModule,
    FcmModule,
    AuditLogsModule,
    GameDaysModule,
  ],
  controllers: [CapturesController],
  providers: [CapturesService],
  exports: [CapturesService],
})
export class CapturesModule {}

