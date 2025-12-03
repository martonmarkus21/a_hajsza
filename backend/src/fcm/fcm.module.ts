import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FcmService } from './fcm.service';
import { Device } from '../entities/device.entity';
import { Pair } from '../entities/pair.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Device, Pair])],
  providers: [FcmService],
  exports: [FcmService],
})
export class FcmModule {}






