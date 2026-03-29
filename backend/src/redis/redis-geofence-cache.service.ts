import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Geofence } from '../entities/geofence.entity';
import { RedisConnectionService } from './redis-connection.service';

const KEY_GAME_AREA = 'mw:cache:geofences:active:game_area';
const KEY_SCENARIO = 'mw:cache:geofences:active:scenario';
/** Safety TTL if invalidation is missed; admin geofence changes call invalidate immediately */
const CACHE_TTL_SECONDS = 600;

type CachedGeofenceRow = {
  id: number;
  name: string;
  centerLat: number;
  centerLon: number;
  radiusM: number;
  geofenceType: string;
  active: boolean;
  metadataJson: unknown;
  activeFrom: string | null;
  activeUntil: string | null;
};

@Injectable()
export class RedisGeofenceCacheService {
  constructor(
    private redisConnection: RedisConnectionService,
    @InjectRepository(Geofence)
    private geofenceRepository: Repository<Geofence>,
  ) {}

  private get redis() {
    return this.redisConnection.getClient();
  }

  private entityToRow(g: Geofence): CachedGeofenceRow {
    return {
      id: g.id,
      name: g.name,
      centerLat: parseFloat(String(g.centerLat)),
      centerLon: parseFloat(String(g.centerLon)),
      radiusM: g.radiusM,
      geofenceType: g.geofenceType,
      active: g.active,
      metadataJson: g.metadataJson ?? null,
      activeFrom: g.activeFrom ? new Date(g.activeFrom).toISOString() : null,
      activeUntil: g.activeUntil ? new Date(g.activeUntil).toISOString() : null,
    };
  }

  private rowToGeofence(row: CachedGeofenceRow): Geofence {
    const g = new Geofence();
    g.id = row.id;
    g.name = row.name;
    g.centerLat = row.centerLat as unknown as number;
    g.centerLon = row.centerLon as unknown as number;
    g.radiusM = row.radiusM;
    g.geofenceType = row.geofenceType;
    g.active = row.active;
    g.metadataJson = row.metadataJson;
    g.activeFrom = row.activeFrom ? new Date(row.activeFrom) : null;
    g.activeUntil = row.activeUntil ? new Date(row.activeUntil) : null;
    return g;
  }

  private async loadAndCache(key: string, type: 'game_area' | 'scenario'): Promise<Geofence[]> {
    const list = await this.geofenceRepository.find({
      where: { geofenceType: type, active: true },
    });
    const rows = list.map((g) => this.entityToRow(g));
    await this.redis.set(key, JSON.stringify(rows), { EX: CACHE_TTL_SECONDS });
    return list;
  }

  async getActiveGameAreaGeofences(): Promise<Geofence[]> {
    const raw = await this.redis.get(KEY_GAME_AREA);
    if (raw) {
      try {
        const rows = JSON.parse(raw) as CachedGeofenceRow[];
        return rows.map((r) => this.rowToGeofence(r));
      } catch {
        /* fall through */
      }
    }
    return this.loadAndCache(KEY_GAME_AREA, 'game_area');
  }

  async getActiveScenarioGeofences(): Promise<Geofence[]> {
    const raw = await this.redis.get(KEY_SCENARIO);
    if (raw) {
      try {
        const rows = JSON.parse(raw) as CachedGeofenceRow[];
        return rows.map((r) => this.rowToGeofence(r));
      } catch {
        /* fall through */
      }
    }
    return this.loadAndCache(KEY_SCENARIO, 'scenario');
  }

  async invalidateActiveGeofences(): Promise<void> {
    await this.redis.del([KEY_GAME_AREA, KEY_SCENARIO]);
  }
}
