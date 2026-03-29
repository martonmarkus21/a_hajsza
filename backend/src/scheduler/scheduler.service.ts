import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position } from '../entities/position.entity';
import { RuleViolation } from '../entities/rule-violation.entity';
import { Device } from '../entities/device.entity';
import { RuleViolationsService } from '../rule-violations/rule-violations.service';
import { RedisPositionService } from '../redis/redis-position.service';
import { PositionSnapshot } from '../positions/position-snapshot';
import { logVerbose } from '../common/verbose-log';

@Injectable()
export class SchedulerService implements OnModuleInit {
  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(RuleViolation)
    private ruleViolationRepository: Repository<RuleViolation>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    private ruleViolationsService: RuleViolationsService,
    private redisPositionService: RedisPositionService,
  ) {}

  onModuleInit() {
    logVerbose('Scheduler service initialized');
  }

  @Cron('*/20 * * * *')
  async checkPositionUpdates() {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

    const devices = await this.deviceRepository
      .createQueryBuilder('device')
      .where('device.pairId IS NOT NULL')
      .select('DISTINCT device.pairId', 'pairId')
      .getRawMany();

    const pairIds = devices.map((d: { pairId: number }) => d.pairId).filter((id: number) => id != null);
    if (pairIds.length === 0) return;

    const liveMap = await this.redisPositionService.getLivePositionsForPairIds(pairIds);

    const pgRows = await this.positionRepository
      .createQueryBuilder('position')
      .where('position.pairId IN (:...ids)', { ids: pairIds })
      .distinctOn(['position.pairId'])
      .orderBy('position.pairId', 'ASC')
      .addOrderBy('position.timestamp', 'DESC')
      .getMany();
    const pgLatestTime = new Map<number, Date>();
    for (const r of pgRows) {
      pgLatestTime.set(r.pairId, new Date(r.timestamp));
    }

    for (const pairId of pairIds) {
      const live = liveMap.get(pairId);
      const liveTime = live ? new Date(live.timestamp) : null;
      const pgTime = pgLatestTime.get(pairId) ?? null;

      let lastUpdate: Date | null = null;
      if (liveTime && pgTime) {
        lastUpdate = liveTime > pgTime ? liveTime : pgTime;
      } else {
        lastUpdate = liveTime || pgTime;
      }

      if (lastUpdate && lastUpdate < twentyMinutesAgo) {
        logVerbose(`Pair ${pairId} has not sent position update in the last 20 minutes`);
      }
    }
  }

  @Cron('*/5 * * * *')
  async checkRuleViolations() {
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
        await this.ruleViolationsService.checkViolations(violation.pairId, snapshot);
      }
    }
  }
}
