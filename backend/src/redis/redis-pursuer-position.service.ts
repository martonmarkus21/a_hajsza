import { Injectable } from '@nestjs/common';
import { RedisConnectionService } from './redis-connection.service';

const KEY_PREFIX = 'ck:pursuer:pos:';
const TTL_SECONDS = 120;

export type PursuerLocationPoint = {
  userId: number;
  lat: number;
  lon: number;
};

@Injectable()
export class RedisPursuerPositionService {
  constructor(private redisConnection: RedisConnectionService) {}

  private get redis() {
    return this.redisConnection.getClient();
  }

  private key(userId: number): string {
    return `${KEY_PREFIX}${userId}`;
  }

  async reportPosition(userId: number, lat: number, lon: number): Promise<void> {
    const payload = JSON.stringify({ lat, lon, ts: new Date().toISOString() });
    await this.redis.set(this.key(userId), payload, { EX: TTL_SECONDS });
  }

  /** All pursuers with fresh browser GPS (TTL not expired). */
  async listActiveLocations(): Promise<PursuerLocationPoint[]> {
    const keys = await this.redis.keys(`${KEY_PREFIX}*`);
    if (keys.length === 0) return [];
    const values = await this.redis.mGet(keys);
    const out: PursuerLocationPoint[] = [];
    for (let i = 0; i < keys.length; i++) {
      const raw = values[i];
      if (!raw) continue;
      const suffix = keys[i]?.slice(KEY_PREFIX.length);
      const userId = Number(suffix);
      if (!Number.isFinite(userId)) continue;
      try {
        const j = JSON.parse(raw) as { lat?: unknown; lon?: unknown };
        const lat = typeof j.lat === 'number' ? j.lat : Number(j.lat);
        const lon = typeof j.lon === 'number' ? j.lon : Number(j.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        out.push({ userId, lat, lon });
      } catch {
        /* skip */
      }
    }
    return out;
  }
}
