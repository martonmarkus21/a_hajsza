import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PositionsController } from './positions.controller';
import { AdminPositionsController } from './admin-positions.controller';
import { LatestSavedPositionsController } from './latest-saved-positions.controller';
import { PositionsService } from './positions.service';
import { Position } from '../entities/position.entity';
import { Geofence } from '../entities/geofence.entity';
import { RuleViolation } from '../entities/rule-violation.entity';
import { Device } from '../entities/device.entity';
import { GameSettings } from '../entities/game-settings.entity';
import { Capture } from '../entities/capture.entity';
import { WebSocketModule } from '../websocket/websocket.module';
import { RuleViolationsModule } from '../rule-violations/rule-violations.module';
import { DeviceAuthGuard } from '../auth/device-auth.guard';
import { JwtModule } from '@nestjs/jwt';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Position,
      Device,
      GameSettings,
      Geofence,
      RuleViolation,
      Capture,
    ]),
    WebSocketModule,
    RuleViolationsModule,
    AuditLogsModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '7d') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [PositionsController, AdminPositionsController, LatestSavedPositionsController],
  providers: [PositionsService, DeviceAuthGuard],
  exports: [PositionsService],
})
export class PositionsModule {}

