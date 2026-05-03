import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameSettings } from '../entities/game-settings.entity';
import { MobileEnrollmentService } from './mobile-enrollment.service';
import { MobileEnrollmentGuard } from './mobile-enrollment.guard';
import { MobileEnrollmentDeviceContextGuard } from './mobile-enrollment-device-context.guard';
import { MobileController } from './mobile.controller';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([GameSettings])],
  controllers: [MobileController],
  providers: [MobileEnrollmentService, MobileEnrollmentGuard, MobileEnrollmentDeviceContextGuard],
  exports: [MobileEnrollmentService, MobileEnrollmentGuard, MobileEnrollmentDeviceContextGuard],
})
export class MobileModule {}
