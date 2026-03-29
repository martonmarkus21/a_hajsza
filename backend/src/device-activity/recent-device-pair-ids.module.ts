import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { RecentDevicePairIdsService } from './recent-device-pair-ids.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Device])],
  providers: [RecentDevicePairIdsService],
  exports: [RecentDevicePairIdsService],
})
export class RecentDevicePairIdsModule {}
