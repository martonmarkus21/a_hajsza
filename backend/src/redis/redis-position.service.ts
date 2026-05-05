import { Injectable } from '@nestjs/common';
import { RedisConnectionService } from './redis-connection.service';
import { PositionSnapshot } from '../positions/position-snapshot';

const LIVE_KEY_PREFIX = 'ck:live:position:';
const STAY_ANCHOR_PREFIX = 'ck:stay:anchor:';
/** Longer than the 30-minute "active device" window so keys stay while pairs are online */
const LIVE_TTL_SECONDS = 45 * 60;
/** Lehet több nap a két ütemezett játéknap között — a maradást ugyanahhoz a naphoz kötjük (`anchorYmd`) addig */
const STAY_ANCHOR_TTL_SECONDS = 14 * 24 * 60 * 60;

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

function stayAnchorKey(ymd: string, pairId: number): string {
  return `${STAY_ANCHOR_PREFIX}${ymd}:${pairId}`;
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

  /**
   * Játéknap végének pillanatában: bázisponthoz használt (első) minta — ugyanarra a (nap, pár) kulcsra csak egyszer ír.
   */
  async setEndOfDayStayAnchorIfAbsent(
    ymd: string,
    pairId: number,
    lat: number,
    lon: number,
  ): Promise<boolean> {
    const k = stayAnchorKey(ymd, pairId);
    const res = await this.redis.set(
      k,
      JSON.stringify({ lat, lon, setAt: new Date().toISOString() }),
      { EX: STAY_ANCHOR_TTL_SECONDS, NX: true },
    );
    return res === 'OK';
  }

  async getEndOfDayStayAnchor(ymd: string, pairId: number): Promise<{ lat: number; lon: number } | null> {
    const raw = await this.redis.get(stayAnchorKey(ymd, pairId));
    if (!raw) return null;
    try {
      const o = JSON.parse(raw) as { lat?: number; lon?: number };
      if (typeof o.lat === 'number' && typeof o.lon === 'number' && Number.isFinite(o.lat) && Number.isFinite(o.lon)) {
        return { lat: o.lat, lon: o.lon };
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Játéknap zárása pillanatában: pontos bázis felülírása (pl. élő pozíció a zárás percben). */
  async overwriteEndOfDayStayAnchor(ymd: string, pairId: number, lat: number, lon: number): Promise<void> {
    const k = stayAnchorKey(ymd, pairId);
    await this.redis.set(k, JSON.stringify({ lat, lon, setAt: new Date().toISOString() }), {
      EX: STAY_ANCHOR_TTL_SECONDS,
    });
  }
}
