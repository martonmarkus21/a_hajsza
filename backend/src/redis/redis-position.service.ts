import { Injectable } from '@nestjs/common';
import { RedisConnectionService } from './redis-connection.service';
import { PositionSnapshot } from '../positions/position-snapshot';

const LIVE_KEY_PREFIX = 'mw:live:position:';
/** Longer than the 30-minute "active device" window so keys stay while pairs are online */
const LIVE_TTL_SECONDS = 45 * 60;

export type LivePositionPayload = {
  lat: number;
  lon: number;
  accuracy?: number | null;
  speed?: number | null;
  vehicleMode?: boolean;
  vehicleSessionRemaining?: number | null;
  timestamp: string;
};

function liveKey(pairId: number): string {
  return `${LIVE_KEY_PREFIX}${pairId}`;
}

@Injectable()
export class RedisPositionService {
  constructor(private redisConnection: RedisConnectionService) {}

  private get redis() {
    return this.redisConnection.getClient();
  }

  async setLivePosition(pairId: number, snapshot: PositionSnapshot): Promise<void> {
    const payload: LivePositionPayload = {
      lat: snapshot.lat,
      lon: snapshot.lon,
      accuracy: snapshot.accuracy ?? null,
      speed: snapshot.speed ?? null,
      vehicleMode: snapshot.vehicleMode ?? false,
      vehicleSessionRemaining: snapshot.vehicleSessionRemaining ?? null,
      timestamp: snapshot.timestamp.toISOString(),
    };
    await this.redis.set(liveKey(pairId), JSON.stringify(payload), { EX: LIVE_TTL_SECONDS });
  }

  async getLivePosition(pairId: number): Promise<LivePositionPayload | null> {
    const raw = await this.redis.get(liveKey(pairId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LivePositionPayload;
    } catch {
      return null;
    }
  }

  async getLivePositionsForPairIds(pairIds: number[]): Promise<Map<number, LivePositionPayload>> {
    const map = new Map<number, LivePositionPayload>();
    if (pairIds.length === 0) return map;
    const keys = pairIds.map(liveKey);
    const values = await this.redis.mGet(keys);
    for (let i = 0; i < pairIds.length; i++) {
      const raw = values[i];
      if (!raw) continue;
      try {
        map.set(pairIds[i], JSON.parse(raw) as LivePositionPayload);
      } catch {
        /* skip */
      }
    }
    return map;
  }

  async deleteLivePosition(pairId: number): Promise<void> {
    await this.redis.del(liveKey(pairId));
  }
}
