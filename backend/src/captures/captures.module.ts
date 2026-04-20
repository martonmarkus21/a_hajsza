import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CapturesController } from './captures.controller';
import { CapturesService } from './captures.service';
import { Capture } from '../entities/capture.entity';
import { Position } from '../entities/position.entity';
import { Pair } from '../entities/pair.entity';
import { Device } from '../entities/device.entity';
import { User } from '../entities/user.entity';
import { WebSocketModule } from '../websocket/websocket.module';
import { FcmModule } from '../fcm/fcm.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Capture, Pair, Device, Position, User]),
    WebSocketModule,
    FcmModule,
    AuditLogsModule,
  ],
  controllers: [CapturesController],
  providers: [CapturesService],
  exports: [CapturesService],
})
export class CapturesModule {}

