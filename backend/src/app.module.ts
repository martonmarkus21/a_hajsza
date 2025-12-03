import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { PairsModule } from './pairs/pairs.module';
import { PositionsModule } from './positions/positions.module';
import { CapturesModule } from './captures/captures.module';
import { MwFlagsModule } from './mw-flags/mw-flags.module';
import { GeofencesModule } from './geofences/geofences.module';
import { GameDaysModule } from './game-days/game-days.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { WebSocketModule } from './websocket/websocket.module';
import { FcmModule } from './fcm/fcm.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { GameAreaModule } from './game-area/game-area.module';
import { MessagesModule } from './messages/messages.module';
import { DevicesModule } from './devices/devices.module';
import { UsersModule } from './users/users.module';
import { GameSettingsModule } from './game-settings/game-settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'most_wanted',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_DATABASE || 'most_wanted',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
      retryAttempts: 3,
      retryDelay: 3000,
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    DatabaseModule,
    AuthModule,
    PairsModule,
    PositionsModule,
    CapturesModule,
    MwFlagsModule,
    GeofencesModule,
    GameDaysModule,
    AuditLogsModule,
    WebSocketModule,
    FcmModule,
    SchedulerModule,
    GameAreaModule,
    MessagesModule,
    DevicesModule,
    UsersModule,
    GameSettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

