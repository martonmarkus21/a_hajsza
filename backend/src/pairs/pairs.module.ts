import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PairsController } from './pairs.controller';
import { PairsService } from './pairs.service';
import { Pair } from '../entities/pair.entity';
import { Position } from '../entities/position.entity';
import { Capture } from '../entities/capture.entity';
import { MwFlag } from '../entities/mw-flag.entity';
import { Device } from '../entities/device.entity';
import { RuleViolation } from '../entities/rule-violation.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FcmModule } from '../fcm/fcm.module';
import { GameSettingsModule } from '../game-settings/game-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pair, Position, Capture, MwFlag, Device, RuleViolation]),
    AuditLogsModule,
    FcmModule,
    GameSettingsModule,
  ],
  controllers: [PairsController],
  providers: [PairsService],
  exports: [PairsService],
})
export class PairsModule {}


