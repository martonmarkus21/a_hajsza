import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameAreaController } from './game-area.controller';
import { GameAreaService } from './game-area.service';
import { Geofence } from '../entities/geofence.entity';
import { WebSocketModule } from '../websocket/websocket.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Geofence]),
    WebSocketModule,
    AuditLogsModule,
  ],
  controllers: [GameAreaController],
  providers: [GameAreaService],
  exports: [GameAreaService],
})
export class GameAreaModule {}






