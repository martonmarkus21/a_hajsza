import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CkFlagsController } from './ck-flags.controller';
import { CkFlagsService } from './ck-flags.service';
import { CkFlag } from '../entities/ck-flag.entity';
import { WebSocketModule } from '../websocket/websocket.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { GameRuntimeModule } from '../game-runtime/game-runtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CkFlag]),
    WebSocketModule,
    AuditLogsModule,
    GameRuntimeModule,
  ],
  controllers: [CkFlagsController],
  providers: [CkFlagsService],
  exports: [CkFlagsService],
})
export class CkFlagsModule {}

