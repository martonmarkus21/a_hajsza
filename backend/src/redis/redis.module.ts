import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Geofence } from '../entities/geofence.entity';
import { RedisConnectionService } from './redis-connection.service';
import { RedisPositionService } from './redis-position.service';
import { RedisGeofenceCacheService } from './redis-geofence-cache.service';

@Global()
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Geofence])],
  providers: [RedisConnectionService, RedisPositionService, RedisGeofenceCacheService],
  exports: [RedisConnectionService, RedisPositionService, RedisGeofenceCacheService],
})
export class RedisModule {}
