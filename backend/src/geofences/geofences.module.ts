import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeofencesController } from './geofences.controller';
import { GeofencesService } from './geofences.service';
import { Geofence } from '../entities/geofence.entity';
import { FcmModule } from '../fcm/fcm.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PairsModule } from '../pairs/pairs.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Geofence]),
    FcmModule,
    AuditLogsModule,
    PairsModule,
    WebSocketModule,
  ],
  controllers: [GeofencesController],
  providers: [GeofencesService],
  exports: [GeofencesService],
})
export class GeofencesModule {}

