import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameSettings } from '../entities/game-settings.entity';
import { GameRuntimeState } from '../entities/game-runtime-state.entity';
import { GameDaysService } from '../game-days/game-days.service';
import { parsePairsSentIds } from '../common/pairs-sent.util';
import { GameAreaService } from '../game-area/game-area.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { FcmService } from '../fcm/fcm.service';
import { GameDay } from '../entities/game-day.entity';
import { hmInGameTimeZone, minuteOfDayInGameTimeZone } from '../common/game-schedule-wall-clock';
import { normalizeClockHm } from '../common/scheduled-game-push.util';
import { RuleViolationsService } from '../rule-violations/rule-violations.service';

type IntervalScheduleItem = {
  from: string;
  to?: string;
  intervalMinutes: number;
};

type AreaScheduleItem = {
  from: string;
  activeCounties?: string[];
  activeRegions?: string[];
};

const FINAL_DAY_CAPTURE_WINDOW_MS = 2 * 60 * 1000;

@Injectable()
export class GameRuntimeService {
  constructor(
    @InjectRepository(GameRuntimeState)
    private readonly gameRuntimeRepository: Repository<GameRuntimeState>,
    @InjectRepository(GameSettings)
    private readonly gameSettingsRepository: Repository<GameSettings>,
    private readonly gameDaysService: GameDaysService,
    private readonly gameAreaService: GameAreaService,
    private readonly webSocketGateway: WebSocketGateway,
    private readonly fcmService: FcmService,
    private readonly ruleViolationsService: RuleViolationsService,
  ) {}

  async getRuntimeContext(now: Date = new Date()) {
    const state = await this.ensureRuntimeState();
    const settings = await this.ensureGameSettings();
    const gameDay = await this.gameDaysService.findToday();

    const gameEnabled = settings.gameEnabled === true;
    const withinWindow = gameDay ? this.isWithinWindow(now, gameDay.startTime, gameDay.endTime) : false;
    const isPastLastScheduledGameEnd = await this.gameDaysService.isPastEndOfLastScheduledGameDay(now);
    /** A perces időpontfoglaló ablaknál a záró pillanat után a játéknap-ablak már nincs aktív, még ha a HH:mm sztring szerint a sor percében még "belül" lennénk. */
    const isGameActive = gameEnabled && withinWindow && !isPastLastScheduledGameEnd;

    const intervalMinutes = gameDay
      ? this.resolveIntervalMinutes(gameDay.specialRulesJson, this.toTimeString(now), settings.locationUpdateIntervalMinutes)
      : settings.locationUpdateIntervalMinutes;

    return {
      state,
      settings,
      gameDay,
      gameEnabled,
      isGameActive,
      isPastLastScheduledGameEnd,
      intervalMinutes: Math.max(1, Math.floor(intervalMinutes || 1)),
    };
  }

  async tick(now: Date = new Date()) {
    const context = await this.getRuntimeContext(now);
    const { state, gameDay, gameEnabled, isGameActive, intervalMinutes, isPastLastScheduledGameEnd } = context;
    const previousSnapshot = {
      campaignStatus: state.campaignStatus,
      activeGameDayId: state.activeGameDayId,
      currentCycleStartAt: state.currentCycleStartAt?.toISOString?.() ?? null,
      currentCycleEndAt: state.currentCycleEndAt?.toISOString?.() ?? null,
      allowPositionUpdatesForMap: state.allowPositionUpdatesForMap,
      intervalMinutes,
    };

    if (!gameEnabled) {
      state.campaignStatus = 'IDLE';
      state.activeGameDayId = null;
      state.currentCycleStartAt = null;
      state.currentCycleEndAt = null;
      state.allowPositionUpdatesForMap = false;
      state.lastCycleTurnAt = null;
      state.pairsSentPositionThisCycle = [];
      state.lastAppliedAreaScheduleKey = null;
      const saved = await this.gameRuntimeRepository.save(state);
      await this.broadcastRuntimeIfChanged(
        saved,
        previousSnapshot,
        intervalMinutes,
        isGameActive,
        isPastLastScheduledGameEnd,
      );
      return saved;
    }

    if (isPastLastScheduledGameEnd) {
      state.campaignStatus = 'FINISHED';
      state.activeGameDayId = null;
      state.currentCycleStartAt = null;
      state.currentCycleEndAt = null;
      state.allowPositionUpdatesForMap = false;
      state.lastCycleTurnAt = null;
      state.pairsSentPositionThisCycle = [];
      state.lastAppliedAreaScheduleKey = null;
      const saved = await this.gameRuntimeRepository.save(state);
      await this.broadcastRuntimeIfChanged(
        saved,
        previousSnapshot,
        intervalMinutes,
        false,
        isPastLastScheduledGameEnd,
      );
      return saved;
    }

    if (!isGameActive) {
      const finalWindowHandled = this.applyFinalDayCaptureWindowIfNeeded(state, gameDay, now);
      if (finalWindowHandled) {
        const saved = await this.gameRuntimeRepository.save(state);
        await this.broadcastRuntimeIfChanged(
          saved,
          previousSnapshot,
          intervalMinutes,
          isGameActive,
          isPastLastScheduledGameEnd,
        );
        return saved;
      }

      state.campaignStatus = gameDay ? 'PAUSED_BETWEEN_DAYS' : 'IDLE';
      state.activeGameDayId = gameDay?.id ?? null;
      state.currentCycleStartAt = null;
      state.currentCycleEndAt = null;
      state.allowPositionUpdatesForMap = false;
      state.lastCycleTurnAt = null;
      state.pairsSentPositionThisCycle = [];
      state.lastAppliedAreaScheduleKey = null;
      const saved = await this.gameRuntimeRepository.save(state);
      await this.broadcastRuntimeIfChanged(
        saved,
        previousSnapshot,
        intervalMinutes,
        isGameActive,
        isPastLastScheduledGameEnd,
      );
      return saved;
    }

    state.campaignStatus = 'RUNNING';
    state.activeGameDayId = gameDay?.id ?? null;

    const enteringRunningPhase =
      previousSnapshot.campaignStatus !== 'RUNNING' ||
      previousSnapshot.activeGameDayId !== (gameDay?.id ?? null) ||
      !state.currentCycleStartAt ||
      !state.currentCycleEndAt;

    const cycleExpired = state.currentCycleEndAt
      ? new Date(state.currentCycleEndAt).getTime() <= now.getTime()
      : false;

    if (enteringRunningPhase) {
      // Delayed first send: when day/motor becomes RUNNING, wait one full interval,
      // and only then open the first position-upload window.
      const cycleStart = new Date(now);
      const cycleEnd = new Date(now.getTime() + intervalMinutes * 60 * 1000);
      state.currentCycleStartAt = cycleStart;
      state.currentCycleEndAt = cycleEnd;
      state.allowPositionUpdatesForMap = false;
      state.pairsSentPositionThisCycle = [];
    } else if (cycleExpired) {
      const cycleStart = new Date(now);
      const cycleEnd = new Date(now.getTime() + intervalMinutes * 60 * 1000);
      state.currentCycleStartAt = cycleStart;
      state.currentCycleEndAt = cycleEnd;
      state.allowPositionUpdatesForMap = true;
      state.lastCycleTurnAt = cycleStart;
      state.pairsSentPositionThisCycle = [];
    }

    if (gameDay) {
      await this.applyAreaScheduleIfNeeded(gameDay.specialRulesJson, now, state);
    }

    const saved = await this.gameRuntimeRepository.save(state);
    await this.broadcastRuntimeIfChanged(
      saved,
      previousSnapshot,
      intervalMinutes,
      isGameActive,
      isPastLastScheduledGameEnd,
    );
    return saved;
  }

  /**
   * A hívónak előtte friss állapotra kell hívnia {@link tick}-et (`createPosition` már teszi).
   * Dupla tick elkerülése — ez a függvény ezrért nem hív motort.
   */
  async tryConsumePairCycleSlot(pairId: number): Promise<{ allowed: boolean; allPairsSent: boolean }> {
    return await this.gameRuntimeRepository.manager.transaction(async (tx) => {
      const runtime = await tx.findOne(GameRuntimeState, {
        where: {},
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!runtime) {
        return { allowed: false, allPairsSent: false };
      }
      if (runtime.allowPositionUpdatesForMap !== true) {
        return { allowed: false, allPairsSent: false };
      }
      const alreadySent = parsePairsSentIds(runtime.pairsSentPositionThisCycle).some(
        (id) => Number(id) === Number(pairId),
      );
      if (alreadySent) {
        return { allowed: false, allPairsSent: false };
      }
      runtime.pairsSentPositionThisCycle = [
        ...parsePairsSentIds(runtime.pairsSentPositionThisCycle),
        pairId,
      ];
      runtime.lastMapPositionAt = new Date();
      await tx.save(GameRuntimeState, runtime);
      return { allowed: true, allPairsSent: false };
    });
  }

  async closeCycleWindowIfAllPairsSent(activePairIds: number[]) {
    const runtime = await this.ensureRuntimeState();
    if (runtime.allowPositionUpdatesForMap !== true) return;
    const sent = parsePairsSentIds(runtime.pairsSentPositionThisCycle);
    const allPairsSent = activePairIds.length > 0 && activePairIds.every((id) => sent.includes(id));
    if (!allPairsSent) return;
    runtime.allowPositionUpdatesForMap = false;
    await this.gameRuntimeRepository.save(runtime);
  }

  private async ensureRuntimeState(): Promise<GameRuntimeState> {
    let state = await this.gameRuntimeRepository.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!state) {
      state = this.gameRuntimeRepository.create({
        campaignStatus: 'IDLE',
        activeGameDayId: null,
        currentCycleStartAt: null,
        currentCycleEndAt: null,
        allowPositionUpdatesForMap: false,
        lastCycleTurnAt: null,
        lastMapPositionAt: null,
        pairsSentPositionThisCycle: [],
        lastAppliedAreaScheduleKey: null,
      });
      state = await this.gameRuntimeRepository.save(state);
    }
    return state;
  }

  private async ensureGameSettings(): Promise<GameSettings> {
    /* Ugyanaz a kulcsminta mint a GameSettingsService: több véletlen sor esetén is az első (id ASC) egy legyen. */
    const rows = await this.gameSettingsRepository.find({
      order: { id: 'ASC' },
    });
    let settings = rows[0];
    if (!settings) {
      settings = this.gameSettingsRepository.create({
        gameEnabled: false,
        locationUpdateIntervalMinutes: 20,
        stayRuleEnabled: false,
        stayRadiusKm: 5,
      });
      settings = await this.gameSettingsRepository.save(settings);
    } else if (rows.length > 1) {
      const duplicateIds = rows.slice(1).map((r) => r.id);
      if (duplicateIds.length > 0) {
        await this.gameSettingsRepository.delete(duplicateIds);
      }
    }
    return settings;
  }

  private isWithinWindow(now: Date, start: string, end: string): boolean {
    const currentMinutes = minuteOfDayInGameTimeZone(now);
    const startMinutes = this.parseClockMinutes(start);
    const endMinutes = this.parseClockMinutes(end);
    if (startMinutes == null || endMinutes == null) return false;
    // End is exclusive to avoid one-minute visual/runtime lag at exact closing minute.
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  private toTimeString(d: Date): string {
    return hmInGameTimeZone(d);
  }

  private parseClockMinutes(value: string | undefined): number | null {
    if (!value || typeof value !== 'string') return null;
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = m[3] == null ? 0 : Number(m[3]);
    if (
      !Number.isFinite(hh) ||
      !Number.isFinite(mm) ||
      !Number.isFinite(ss) ||
      hh < 0 ||
      hh > 23 ||
      mm < 0 ||
      mm > 59 ||
      ss < 0 ||
      ss > 59
    ) {
      return null;
    }
    return hh * 60 + mm;
  }

  private applyFinalDayCaptureWindowIfNeeded(
    state: GameRuntimeState,
    gameDay: GameDay | null,
    now: Date,
  ): boolean {
    if (!gameDay) return false;
    const endAt = this.gameDaysService.getLocalEndOfGameDay(gameDay);
    const endMs = endAt.getTime();
    const nowMs = now.getTime();
    if (nowMs < endMs) return false;

    const windowEndMs = endMs + FINAL_DAY_CAPTURE_WINDOW_MS;
    if (nowMs >= windowEndMs) return false;

    const existingStartMs = state.currentCycleStartAt ? new Date(state.currentCycleStartAt).getTime() : null;
    const isFinalWindowState =
      state.activeGameDayId === gameDay.id && existingStartMs === endMs;

    // If the closing snapshot window already ran and was closed after all pairs sent, don't reopen.
    if (isFinalWindowState && state.allowPositionUpdatesForMap === false) {
      return false;
    }

    if (!isFinalWindowState) {
      state.pairsSentPositionThisCycle = [];
    }

    state.campaignStatus = 'PAUSED_BETWEEN_DAYS';
    state.activeGameDayId = gameDay.id;
    state.currentCycleStartAt = endAt;
    state.currentCycleEndAt = new Date(windowEndMs);
    state.allowPositionUpdatesForMap = true;
    return true;
  }

  private resolveIntervalMinutes(
    specialRules: any,
    currentTime: string,
    fallbackInterval: number,
  ): number {
    const schedule: IntervalScheduleItem[] = Array.isArray(specialRules?.locationIntervalSchedule)
      ? specialRules.locationIntervalSchedule
      : [];
    const clockNorm = normalizeClockHm(currentTime);
    for (const item of schedule) {
      if (!item?.from || !item?.intervalMinutes) continue;
      const fromNorm = normalizeClockHm(item.from);
      const toNorm = item.to ? normalizeClockHm(item.to) : '';
      const inSlot =
        !!clockNorm &&
        !!fromNorm &&
        clockNorm.localeCompare(fromNorm) >= 0 &&
        (!item.to ? true : !!toNorm && clockNorm.localeCompare(toNorm) < 0);
      if (inSlot) {
        return item.intervalMinutes;
      }
    }
    return fallbackInterval;
  }

  private async applyAreaScheduleIfNeeded(
    specialRules: any,
    now: Date,
    runtime: GameRuntimeState,
  ) {
    const schedule: AreaScheduleItem[] = Array.isArray(specialRules?.areaSchedule)
      ? specialRules.areaSchedule
      : [];
    if (schedule.length === 0) return;

    const currentTime = this.toTimeString(now);
    const curN = normalizeClockHm(currentTime);
    const activeItem = schedule
      .filter((s) => {
        const fn = normalizeClockHm(s.from);
        return s?.from && !!fn && !!curN && fn.localeCompare(curN) <= 0;
      })
      .sort((a, b) => normalizeClockHm(a.from).localeCompare(normalizeClockHm(b.from)))
      .pop();
    if (!activeItem) return;

    const counties = activeItem.activeCounties || [];
    const regions = activeItem.activeRegions || [];

    const key = `${activeItem.from}|${counties.join(',')}|${regions.join(',')}`;
    if (runtime.lastAppliedAreaScheduleKey === key) return;

    await this.gameAreaService.updateGameArea({
      activeCounties: counties,
      activeRegions: regions,
    });
    runtime.lastAppliedAreaScheduleKey = key;
    /** FCM-et a GameDayScheduledFcmService küldi (jószándékú előzetes üzenetek + hatályonkénti részletes). */
  }

  private async broadcastRuntimeIfChanged(
    runtime: GameRuntimeState,
    previousSnapshot: {
      campaignStatus: string;
      activeGameDayId: number | null;
      currentCycleStartAt: string | null;
      currentCycleEndAt: string | null;
      allowPositionUpdatesForMap: boolean;
      intervalMinutes: number;
    },
    intervalMinutes: number,
    isGameActive: boolean,
    isPastLastScheduledGameEnd: boolean,
  ) {
    const changed =
      previousSnapshot.campaignStatus !== runtime.campaignStatus ||
      previousSnapshot.activeGameDayId !== runtime.activeGameDayId ||
      previousSnapshot.currentCycleStartAt !== (runtime.currentCycleStartAt?.toISOString?.() ?? null) ||
      previousSnapshot.currentCycleEndAt !== (runtime.currentCycleEndAt?.toISOString?.() ?? null) ||
      previousSnapshot.allowPositionUpdatesForMap !== runtime.allowPositionUpdatesForMap ||
      previousSnapshot.intervalMinutes !== intervalMinutes;

    if (!changed) return;

    this.webSocketGateway.broadcastGameRuntimeUpdate({
      campaignStatus: runtime.campaignStatus,
      activeGameDayId: runtime.activeGameDayId,
      currentCycleStartAt: runtime.currentCycleStartAt,
      currentCycleEndAt: runtime.currentCycleEndAt,
      allowPositionUpdatesForMap: runtime.allowPositionUpdatesForMap,
      currentIntervalMinutes: intervalMinutes,
      isGameActive,
      isPastLastScheduledGameEnd,
      timestamp: new Date().toISOString(),
    });

    if (
      runtime.campaignStatus === 'FINISHED' &&
      previousSnapshot.campaignStatus !== 'FINISHED'
    ) {
      void this.fcmService
        .sendToAllPairs({
          title: 'Játék lezárva',
          body: 'Az utolsó játéknap ütemezett időablaka lejárt. A játékmotor lezárta az élő követést.',
        })
        .catch(() => undefined);
    }

    if (
      runtime.campaignStatus === 'RUNNING' &&
      previousSnapshot.campaignStatus !== 'RUNNING'
    ) {
      void this.ruleViolationsService.broadcastStayRevealMapToastIfActive(new Date()).catch(() => undefined);
    }

    /** Helyzetfrissítő intervallum-váltások FCM-je GameDayScheduledFcmService szerint történik. */
  }
}

