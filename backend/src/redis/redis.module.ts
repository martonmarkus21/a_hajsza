import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Geofence } from '../entities/geofence.entity';
import { RedisConnectionService } from './redis-connection.service';
import { RedisPositionService } from './redis-position.service';
import { RedisGeofenceCacheService } from './redis-geofence-cache.service';
import { RedisPursuerPositionService } from './redis-pursuer-position.service';
import { RedisStayRuleService } from './redis-stay-rule.service';

@Global()
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Geofence])],
  providers: [
    RedisConnectionService,
    RedisPositionService,
    RedisGeofenceCacheService,
    RedisPursuerPositionService,
    RedisStayRuleService,
  ],
  exports: [
    RedisConnectionService,
    RedisPositionService,
    RedisGeofenceCacheService,
    RedisPursuerPositionService,
    RedisStayRuleService,
  ],
})
export class RedisModule {}
