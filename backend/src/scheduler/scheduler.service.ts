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
  ) {}

  @Cron('* * * * *')
  async tickGameRuntime() {
    await this.gameRuntimeService.tick();
  }

  @Cron('*/5 * * * *')
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

  @Cron('* * * * *')
  async endOfDayStayWindowTick() {
    let settings = await this.gameSettingsRepository.findOne({ where: {} });
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

    const gameDay = await this.gameDaysService.findToday();
    if (!gameDay) {
      await this.ruleViolationsService.resolveAllEndOfDayStayViolations();
      return;
    }

    const t = this.toClockHHMM(now);
    if (t <= gameDay.endTime) {
      if (t < gameDay.startTime) {
        await this.ruleViolationsService.resolveAllEndOfDayStayViolations();
      }
      return;
    }

    const ymd = this.gameDaysService.ymdLocal(now);
    const radiusKm = Math.max(0.1, Math.min(500, Number(settings.stayRadiusKm) || 5));

    const activePairs = await this.pairRepository.find({ where: { active: true }, select: ['id'] });
    const pairIds = activePairs.map((p) => p.id);
    if (pairIds.length === 0) return;

    const capturedRows = await this.captureRepository.find({
      where: { pairId: In(pairIds) },
      select: ['pairId'],
    });
    const captured = new Set(capturedRows.map((c) => c.pairId));

    for (const pid of pairIds) {
      if (captured.has(pid)) continue;
      const live = await this.redisPositionService.getLivePosition(pid);
      if (live) {
        await this.redisPositionService.setEndOfDayStayAnchorIfAbsent(ymd, pid, live.lat, live.lon);
      }
    }

    for (const pid of pairIds) {
      if (captured.has(pid)) continue;
      const anchor = await this.redisPositionService.getEndOfDayStayAnchor(ymd, pid);
      if (!anchor) continue;
      const live = await this.redisPositionService.getLivePosition(pid);
      if (!live) continue;
      await this.ruleViolationsService.checkEndOfDayStayRule(
        pid,
        { lat: live.lat, lon: live.lon },
        anchor,
        radiusKm,
      );
    }
  }

  private toClockHHMM(d: Date): string {
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }
}
