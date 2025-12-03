import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuleViolationsService } from './rule-violations.service';
import { RuleViolation } from '../entities/rule-violation.entity';
import { Geofence } from '../entities/geofence.entity';
import { GeofenceCompletion } from '../entities/geofence-completion.entity';
import { WebSocketModule } from '../websocket/websocket.module';
import { GameDaysModule } from '../game-days/game-days.module';
import { FcmModule } from '../fcm/fcm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RuleViolation, Geofence, GeofenceCompletion]),
    WebSocketModule,
    GameDaysModule,
    FcmModule,
  ],
  providers: [RuleViolationsService],
  exports: [RuleViolationsService],
})
export class RuleViolationsModule {}

