import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuleViolationsService } from './rule-violations.service';
import { RuleViolation } from '../entities/rule-violation.entity';
import { GeofenceCompletion } from '../entities/geofence-completion.entity';
import { WebSocketModule } from '../websocket/websocket.module';
import { GameDaysModule } from '../game-days/game-days.module';
import { FcmModule } from '../fcm/fcm.module';
import { Pair } from '../entities/pair.entity';
import { MwFlag } from '../entities/mw-flag.entity';
import { RuleViolationsController } from './rule-violations.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RuleViolation, GeofenceCompletion, Pair, MwFlag]),
    WebSocketModule,
    GameDaysModule,
    FcmModule,
    AuditLogsModule,
  ],
  controllers: [RuleViolationsController],
  providers: [RuleViolationsService],
  exports: [RuleViolationsService],
})
export class RuleViolationsModule {}

