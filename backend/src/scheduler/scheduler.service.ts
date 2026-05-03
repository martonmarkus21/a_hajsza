import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Position } from '../entities/position.entity';
import { RuleViolation } from '../entities/rule-violation.entity';
import { Pair } from '../entities/pair.entity';
import { Capture } from '../entities/capture.entity';
import { GameSettings } from '../entities/game-settings.entity';
import { RuleViolationsService } from '../rule-violations/rule-violations.service';
import { RedisPositionService } from '../redis/redis-position.service';
import { PositionSnapshot } from '../positions/position-snapshot';
import { GameRuntimeService } from '../game-runtime/game-runtime.service';
import { GameDaysService } from '../game-days/game-days.service';
import { FcmService } from '../fcm/fcm.service';
import { GameDayScheduledFcmService } from './game-day-scheduled-fcm.service';
import { RedisPursuerPositionService } from '../redis/redis-pursuer-position.service';
import { formatKmHu, haversineDistanceM } from '../common/haversine';
import { haversineKm } from '../common/haversine-km';
import { calendarYmdFromDbDateOnly, gameScheduleTimeZone, hmInGameTimeZone } from '../common/game-schedule-wall-clock';
import { RedisStayRuleService } from '../redis/redis-stay-rule.service';
import type { LivePositionPayload } from '../redis/redis-position.service';

const GAME_CRON_OPTIONS = Object.freeze({
  timeZone: gameScheduleTimeZone(),
});

/** Játéknapok között a kinti idő ehhez kapcsolódik: ennyi folyamatos „kinti” állapot után szabályszegés */
const STAY_OUTSIDE_VIOLATION_MS = 30 * 60 * 1000;

@Injectable()
export class SchedulerService {
  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(RuleViolation)
    private ruleViolationRepository: Repository<RuleViolation>,
    @InjectRepository(Pair)
    private pairRepository: Repository<Pair>,
    @InjectRepository(Capture)
    private captureRepository: Repository<Capture>,
    @InjectRepository(GameSettings)
    private gameSettingsRepository: Repository<GameSettings>,
    private ruleViolationsService: RuleViolationsService,
    private redisPositionService: RedisPositionService,
    private gameRuntimeService: GameRuntimeService,
    private gameDaysService: GameDaysService,
    private fcmService: FcmService,
    private redisPursuerPositionService: RedisPursuerPositionService,
    private gameDayScheduledFcmService: GameDayScheduledFcmService,
    private redisStayRuleService: RedisStayRuleService,
  ) {}

  @Cron('* * * * *', GAME_CRON_OPTIONS)
  async tickGameRuntime() {
    const now = new Date();
    await this.gameRuntimeService.tick(now);
    await this.gameDayScheduledFcmService.runMinute(now);
  }

  @Cron('* * * * *', GAME_CRON_OPTIONS)
  async resolveVehicleContinuousWindows() {
    await this.ruleViolationsService.resolveVehicleViolationsPastWindow();
  }

  @Cron('*/5 * * * *', GAME_CRON_OPTIONS)
  async checkRuleViolations() {
    const context = await this.gameRuntimeService.getRuntimeContext();
    if (!context.isGameActive) return;

    const violations = await this.ruleViolationRepository.find({
      where: { resolved: false, violationType: 'game_area_exit' },
      select: ['id', 'pairId', 'violationType'],
    });
    if (violations.length === 0) return;

    const pairIds = [...new Set(violations.map((v) => v.pairId))];
    const liveMap = await this.redisPositionService.getLivePositionsForPairIds(pairIds);

    const needPg: number[] = [];
    for (const pid of pairIds) {
      if (!liveMap.has(pid)) needPg.push(pid);
    }

    let pgByPair = new Map<number, Position>();
    if (needPg.length > 0) {
      const rows = await this.positionRepository
        .createQueryBuilder('position')
        .where('position.pairId IN (:...ids)', { ids: needPg })
        .distinctOn(['position.pairId'])
        .orderBy('position.pairId', 'ASC')
        .addOrderBy('position.timestamp', 'DESC')
        .getMany();
      pgByPair = new Map(rows.map((r) => [r.pairId, r]));
    }

    for (const violation of violations) {
      const live = liveMap.get(violation.pairId);
      let snapshot: PositionSnapshot | null = null;

      if (live) {
        snapshot = {
          lat: live.lat,
          lon: live.lon,
          accuracy: live.accuracy ?? null,
          speed: live.speed ?? null,
          vehicleMode: live.vehicleMode ?? false,
          vehicleSessionRemaining: live.vehicleSessionRemaining ?? null,
          timestamp: new Date(live.timestamp),
        };
      } else {
        const lastPosition = pgByPair.get(violation.pairId);
        if (lastPosition) {
          snapshot = {
            lat: parseFloat(lastPosition.lat.toString()),
            lon: parseFloat(lastPosition.lon.toString()),
            accuracy:
              lastPosition.accuracy != null ? parseFloat(lastPosition.accuracy.toString()) : null,
            speed: lastPosition.speed != null ? parseFloat(lastPosition.speed.toString()) : null,
            vehicleMode: lastPosition.vehicleMode,
            vehicleSessionRemaining: lastPosition.vehicleSessionRemaining,
            timestamp: lastPosition.timestamp,
          };
        }
      }

      if (snapshot) {
        await this.ruleViolationsService.checkViolations(violation.pairId, snapshot, { applyGameRules: true });
      }
    }
  }

  @Cron('* * * * *', GAME_CRON_OPTIONS)
  async endOfDayStayWindowTick() {
    let settings = await this.gameSettingsRepository.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!settings) {
      settings = this.gameSettingsRepository.create({
        gameEnabled: false,
        locationUpdateIntervalMinutes: 20,
        stayRuleEnabled: false,
        stayRadiusKm: 5,
      });
      await this.gameSettingsRepository.save(settings);
    }

    if (!settings.stayRuleEnabled || !settings.gameEnabled) {
      await this.ruleViolationsService.resolveAllEndOfDayStayViolations();
      return;
    }

    const now = new Date();
    if (await this.gameDaysService.isPastEndOfLastScheduledGameDay(now)) {
      await this.ruleViolationsService.resolveAllEndOfDayStayViolations();
      return;
    }

    const ctx = await this.gameDaysService.getStayRuleEnforcementContext(now);
    if (!ctx) {
      return;
    }

    const anchorYmd = ctx.anchorYmd;
    const radiusKm = Math.max(0.1, Math.min(500, Number(settings.stayRadiusKm) || 5));

    const activePairs = await this.pairRepository.find({ where: { active: true }, select: ['id'] });
    const pairIds = activePairs.map((p) => p.id);
    if (pairIds.length === 0) return;

    const capturedRows = await this.captureRepository.find({
      where: { pairId: In(pairIds) },
      select: ['pairId'],
    });
    const captured = new Set(capturedRows.map((c) => c.pairId));

    const liveMapAll = await this.redisPositionService.getLivePositionsForPairIds(pairIds);
    const needPgIds = pairIds.filter((pid) => !captured.has(pid) && !liveMapAll.has(pid));
    const pgByPair = await this.latestPositionsByPairId(needPgIds);

    for (const pid of pairIds) {
      if (captured.has(pid)) continue;
      const pt = this.resolveStayPointForStayRule(pid, liveMapAll, pgByPair);
      if (!pt) continue;
      await this.redisPositionService.setEndOfDayStayAnchorIfAbsent(
        anchorYmd,
        pid,
        pt.lat,
        pt.lon,
      );
    }

    for (const pid of pairIds) {
      if (captured.has(pid)) continue;
      const anchor = await this.redisPositionService.getEndOfDayStayAnchor(anchorYmd, pid);
      if (!anchor) continue;
      const pt = this.resolveStayPointForStayRule(pid, liveMapAll, pgByPair);
      if (!pt) continue;

      const d = haversineKm(anchor.lat, anchor.lon, pt.lat, pt.lon);

      if (d <= radiusKm) {
        await this.redisStayRuleService.clearOutsideAndWarn(anchorYmd, pid);
        await this.ruleViolationsService.resolveUnresolvedEndOfDayStayViolationForPair(pid);
        continue;
      }

      const outsideSince = await this.redisStayRuleService.getOrCreateOutsideSince(anchorYmd, pid);
      const elapsed = now.getTime() - outsideSince.getTime();

      if (!(await this.redisStayRuleService.hasExitWarnSent(anchorYmd, pid))) {
        await this.fcmService.sendToPair(pid, {
          title: 'Maradási szabály',
          body: `Az esti/lezárt játék után legfeljebb 30 percig lehettek a megadott (${radiusKm.toFixed(
            1,
          )} km) maradási körön kívül. Ha ennyi idő elteltével még odakint vagytok, szabályszegés.`,
          data: { type: 'stay_rule_exit_warning', priority: 'warning' },
        });
        await this.redisStayRuleService.markExitWarnSent(anchorYmd, pid);
      }

      if (elapsed >= STAY_OUTSIDE_VIOLATION_MS) {
        const nextGd = await this.gameDaysService.findEarliestStrictlyAfterCalendarDate(
          ctx.anchorGameDay.date,
        );
        let mapRevealUntil: Date | null = null;
        if (nextGd) {
          const start = this.gameDaysService.getLocalStartOfGameDay(nextGd);
          mapRevealUntil = new Date(start.getTime() + 30 * 60 * 1000);
        }
        await this.ruleViolationsService.finalizeStayRuleViolation(pid, mapRevealUntil);
      }
    }
  }

  /**
   * Játéknap zárása (nem utolsó / TV-nem-záró nap): FCM az aktív pároknak a legközelebbi üldöző távolságával,
   * ha van friss böngésző-GPS egy admin/officer-ben; egyébként csak „véget ért” szöveg.
   */
  @Cron('* * * * *', GAME_CRON_OPTIONS)
  async endOfGameDayPursuerDistancePush(): Promise<void> {
    const now = new Date();
    if (await this.gameDaysService.isPastEndOfLastScheduledGameDay(now)) return;

    const gameDay = await this.gameDaysService.findToday();
    if (!gameDay) return;

    if (await this.gameDaysService.isFinalDay()) return;

    const clockNow = this.normalizeHm(hmInGameTimeZone(now));
    const clockEnd = this.normalizeHm(gameDay.endTime as unknown as string | Date | number);
    if (!clockEnd || clockNow !== clockEnd) return;

    const pursuers = await this.redisPursuerPositionService.listActiveLocations();
    const activePairs = await this.pairRepository.find({ where: { active: true }, select: ['id'] });
    if (activePairs.length === 0) return;

    const pairIds = activePairs.map((p) => p.id);
    const capturedRows = await this.captureRepository.find({
      where: { pairId: In(pairIds) },
      select: ['pairId'],
    });
    const captured = new Set(capturedRows.map((c) => c.pairId));

    const liveMap = await this.redisPositionService.getLivePositionsForPairIds(pairIds);
    const needPgIds = pairIds.filter((pid) => !liveMap.has(pid));
    const pgByPair = await this.latestPositionsByPairId(needPgIds);

    const settingsForStay = await this.gameSettingsRepository.findOne({
      where: {},
      order: { id: 'ASC' },
    });

    const title = 'Most Wanted';
    const bodyEndOnly = 'A mai játéknap véget ért.';

    await Promise.all(
      activePairs.map(async ({ id: pairId }) => {
        if (captured.has(pairId)) return;

        let pairLat: number | undefined;
        let pairLon: number | undefined;

        const live = liveMap.get(pairId);
        if (live) {
          pairLat = live.lat;
          pairLon = live.lon;
        } else {
          const pg = pgByPair.get(pairId);
          if (pg) {
            pairLat = parseFloat(pg.lat.toString());
            pairLon = parseFloat(pg.lon.toString());
          }
        }

        let body = bodyEndOnly;

        const pairPoint =
          pairLat != null && pairLon != null && Number.isFinite(pairLat) && Number.isFinite(pairLon)
            ? { lat: pairLat, lon: pairLon }
            : null;

        if (
          pairPoint &&
          settingsForStay?.stayRuleEnabled === true &&
          settingsForStay.gameEnabled === true
        ) {
          const anchorYmd = calendarYmdFromDbDateOnly(gameDay.date);
          await this.redisPositionService.overwriteEndOfDayStayAnchor(
            anchorYmd,
            pairId,
            pairPoint.lat,
            pairPoint.lon,
          );
          await this.redisStayRuleService.clearOutsideAndWarn(anchorYmd, pairId);
        }

        if (pursuers.length > 0 && pairPoint) {
          let bestM = Number.POSITIVE_INFINITY;
          for (const pu of pursuers) {
            const m = haversineDistanceM(pairPoint, { lat: pu.lat, lon: pu.lon });
            if (m < bestM) bestM = m;
          }
          if (Number.isFinite(bestM)) {
            body = `A mai játéknap véget ért. Az üldözők távolsága tőletek: ${formatKmHu(bestM)} km`;
          }
        }

        await this.fcmService.sendToPair(pairId, {
          title,
          body,
          data: { type: 'game_day_ended' },
        });
      }),
    );
  }

  /**
   * Maradás: először Redis élő pont (függ a kliens küldéseitől); ha az nincs, PostgreSQL utolsó mintázott pont —
   * különben senki böngészője nélkül nem futna az ellenőrzés percenként.
   */
  private resolveStayPointForStayRule(
    pairId: number,
    liveMap: Map<number, LivePositionPayload>,
    pgByPair: Map<number, Position>,
  ): { lat: number; lon: number } | null {
    const live = liveMap.get(pairId);
    if (live != null && Number.isFinite(live.lat) && Number.isFinite(live.lon)) {
      return { lat: live.lat, lon: live.lon };
    }
    const pg = pgByPair.get(pairId);
    if (!pg) return null;
    const lat = parseFloat(pg.lat.toString());
    const lon = parseFloat(pg.lon.toString());
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  }

  private async latestPositionsByPairId(pairIds: number[]): Promise<Map<number, Position>> {
    const map = new Map<number, Position>();
    if (pairIds.length === 0) return map;
    const rows = await this.positionRepository
      .createQueryBuilder('position')
      .where('position.pairId IN (:...ids)', { ids: pairIds })
      .distinctOn(['position.pairId'])
      .orderBy('position.pairId', 'ASC')
      .addOrderBy('position.timestamp', 'DESC')
      .getMany();
    for (const r of rows) {
      map.set(r.pairId, r);
    }
    return map;
  }

  /** HH:mm normalized (first two time fields from DB TIME or HH:mm:ss). */
  private normalizeHm(value: unknown): string {
    const s = String(value ?? '').trim();
    const m = /^(\d{1,2}):(\d{2})/.exec(s);
    if (!m) return '';
    const hh = Math.min(23, Math.max(0, Number(m[1])));
    const mm = Math.min(59, Math.max(0, Number(m[2])));
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

}
