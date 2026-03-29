import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { Device } from '../entities/device.entity';
import { Pair } from '../entities/pair.entity';
import { FcmModule } from '../fcm/fcm.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DeviceAuthGuard } from '../auth/device-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Device, Pair]),
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
    FcmModule,
  ],
  controllers: [DevicesController],
  providers: [DevicesService, DeviceAuthGuard],
  exports: [DevicesService],
})
export class DevicesModule {}