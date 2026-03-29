import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MwFlagsController } from './mw-flags.controller';
import { MwFlagsService } from './mw-flags.service';
import { MwFlag } from '../entities/mw-flag.entity';
import { WebSocketModule } from '../websocket/websocket.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MwFlag]),
    WebSocketModule,
    AuditLogsModule,
  ],
  controllers: [MwFlagsController],
  providers: [MwFlagsService],
  exports: [MwFlagsService],
})
export class MwFlagsModule {}

