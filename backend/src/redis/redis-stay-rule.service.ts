import { Injectable } from '@nestjs/common';
import { RedisConnectionService } from './redis-connection.service';

/** Maradás: folyamatos „kinti” állapot mérföldköve és értesítés dedupe; térképreveláció TTL. */
const OUTSIDE_PREFIX = 'ck:stay:outside_since:';
const EXIT_WARN_PREFIX = 'ck:stay:exit_warn:';
const MAP_REVEAL_PREFIX = 'ck:stay:map_reveal_until:';

const TTL_SECONDS = 14 * 24 * 3600;

/** A scheduler ugyanezt a tartományt állítja: következő nap kezdésétől számított térképláthatóság hossza. */
const MAP_REVEAL_AFTER_START_MS = 30 * 60 * 1000;

function outsideKey(anchorYmd: string, pairId: number): string {
  return `${OUTSIDE_PREFIX}${anchorYmd}:${pairId}`;
}

function exitWarnKey(anchorYmd: string, pairId: number): string {
  return `${EXIT_WARN_PREFIX}${anchorYmd}:${pairId}`;
}

function mapRevealKey(pairId: number): string {
  return `${MAP_REVEAL_PREFIX}${pairId}`;
}

@Injectable()
export class RedisStayRuleService {
  constructor(private redisConnection: RedisConnectionService) {}

  private get redis() {
    return this.redisConnection.getClient();
  }

  async getOutsideSince(anchorYmd: string, pairId: number): Promise<Date | null> {
    const raw = await this.redis.get(outsideKey(anchorYmd, pairId));
    if (!raw) return null;
    const t = Date.parse(raw);
    return Number.isFinite(t) ? new Date(t) : null;
  }

  /**
   * Első kinti pillanathoz állítjuk a „outside_since” bélyeget — későbbi percekben ez nem változik.
   */
  async getOrCreateOutsideSince(anchorYmd: string, pairId: number): Promise<Date> {
    const k = outsideKey(anchorYmd, pairId);
    const existing = await this.redis.get(k);
    if (existing) {
      const t = Date.parse(existing);
      if (Number.isFinite(t)) return new Date(t);
    }
    const iso = new Date().toISOString();
    await this.redis.set(k, iso, { EX: TTL_SECONDS });
    return new Date(iso);
  }

  async clearOutsideAndWarn(anchorYmd: string, pairId: number): Promise<void> {
    await this.redis.del(outsideKey(anchorYmd, pairId));
    await this.redis.del(exitWarnKey(anchorYmd, pairId));
  }

  async hasExitWarnSent(anchorYmd: string, pairId: number): Promise<boolean> {
    const v = await this.redis.get(exitWarnKey(anchorYmd, pairId));
    return v != null && v !== '';
  }

  async markExitWarnSent(anchorYmd: string, pairId: number): Promise<void> {
    await this.redis.set(exitWarnKey(anchorYmd, pairId), '1', { EX: TTL_SECONDS });
  }

  async setMapRevealUntil(pairId: number, until: Date): Promise<void> {
    await this.redis.set(mapRevealKey(pairId), until.toISOString(), {
      PXAT: until.getTime(),
    });
  }

  /**
   * Csak az utolsó beállítás szerinti [játéknap kezdete, kezdete + 30 perc] között él — nem egész kampányszünet alatt egészen a záró időpillanatig.
   * Redis érték: `untilISO` = következő nap kezdés + MAP_REVEAL_AFTER_START_MS.
   */
  async isMapRevealActive(pairId: number, now: Date): Promise<boolean> {
    const raw = await this.redis.get(mapRevealKey(pairId));
    if (!raw) return false;
    const untilMs = Date.parse(raw);
    if (!Number.isFinite(untilMs)) return false;
    const startMs = untilMs - MAP_REVEAL_AFTER_START_MS;
    const n = now.getTime();
    return n >= startMs && n <= untilMs;
  }

  async clearMapReveal(pairId: number): Promise<void> {
    await this.redis.del(mapRevealKey(pairId));
  }
}
