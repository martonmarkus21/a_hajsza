import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Pair } from '../entities/pair.entity';
import { Position } from '../entities/position.entity';
import { Capture } from '../entities/capture.entity';
import { MwFlag } from '../entities/mw-flag.entity';
import { Device } from '../entities/device.entity';
import { RuleViolation } from '../entities/rule-violation.entity';
import { User } from '../entities/user.entity';
import { RedisPositionService } from '../redis/redis-position.service';
import { CreatePairDto } from './dto/create-pair.dto';
import { UpdatePairDto } from './dto/update-pair.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditRequestMeta } from '../common/audit-request.util';
import { FcmService } from '../fcm/fcm.service';
import { RecentDevicePairIdsService } from '../device-activity/recent-device-pair-ids.service';
import { parsePairsSentIds } from '../common/pairs-sent.util';
import { GameRuntimeService } from '../game-runtime/game-runtime.service';

@Injectable()
export class PairsService {
  constructor(
    @InjectRepository(Pair)
    private pairRepository: Repository<Pair>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Capture)
    private captureRepository: Repository<Capture>,
    @InjectRepository(MwFlag)
    private mwFlagRepository: Repository<MwFlag>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(RuleViolation)
    private ruleViolationRepository: Repository<RuleViolation>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private auditLogsService: AuditLogsService,
    private fcmService: FcmService,
    private gameRuntimeService: GameRuntimeService,
    private redisPositionService: RedisPositionService,
    private recentDevicePairIdsService: RecentDevicePairIdsService,
  ) {}

  async findAll(active?: boolean) {
    const query = this.pairRepository.createQueryBuilder('pair');

    if (active !== undefined) {
      query.where('pair.active = :active', { active });
    }

    const pairs = await query.getMany();
    if (pairs.length === 0) {
      return { pairs: [] };
    }

    const pairIds = pairs.map((p) => p.id);

    const activeExitViolations = await this.ruleViolationRepository.find({
      where: { violationType: 'game_area_exit', resolved: false },
      select: ['pairId'],
    });
    const exitViolationPairIds = new Set(activeExitViolations.map((v) => v.pairId));

    const liveByPairId = await this.redisPositionService.getLivePositionsForPairIds(pairIds);
    const runtimeContext = await this.gameRuntimeService.getRuntimeContext();
    const runtimeState = runtimeContext.state;

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const devices = await this.deviceRepository.find({
      where: { pairId: In(pairIds) },
    });
    const deviceByPairId = new Map<number, Device>();
    for (const d of devices) {
      const cur = deviceByPairId.get(d.pairId);
      if (!cur) {
        deviceByPairId.set(d.pairId, d);
        continue;
      }
      const curT = cur.lastSeenAt ? new Date(cur.lastSeenAt).getTime() : 0;
      const dT = d.lastSeenAt ? new Date(d.lastSeenAt).getTime() : 0;
      if (dT > curT) deviceByPairId.set(d.pairId, d);
    }

    const captures = await this.captureRepository.find({
      where: { pairId: In(pairIds) },
      select: ['id', 'pairId', 'capturedByUserId', 'timestamp', 'locationId', 'capturedLat', 'capturedLon'],
    });
    const captureByPairId = new Map(captures.map((c) => [c.pairId, c]));

    const captureLocIds = [
      ...new Set(
        captures.map((c) => c.locationId).filter((id): id is number => id != null && Number(id) > 0),
      ),
    ];
    const capturePositions =
      captureLocIds.length > 0
        ? await this.positionRepository.find({
            where: { id: In(captureLocIds) },
            select: ['id', 'lat', 'lon'],
          })
        : [];
    const capturePositionById = new Map(capturePositions.map((p) => [p.id, p]));

    const captureUserIds = [...new Set(captures.map((c) => c.capturedByUserId))];
    const captureUsers =
      captureUserIds.length > 0
        ? await this.userRepository.find({
            where: { id: In(captureUserIds) },
            select: ['id', 'username', 'role'],
          })
        : [];
    const captureUserById = new Map(captureUsers.map((u) => [u.id, u]));

    const mwRows = await this.mwFlagRepository.find({
      where: { pairId: In(pairIds), active: true },
      select: ['pairId'],
    });
    const mwPairIds = new Set(mwRows.map((m) => m.pairId));

    const latestByPairId = await this.loadLatestPositionPerPair(pairIds);

    const pairsSentArray = parsePairsSentIds(runtimeState.pairsSentPositionThisCycle);
    const firstInCycleByPairId = await this.loadFirstPositionInCycleForPairs(pairs, pairsSentArray, {
      motorRunning: runtimeState.campaignStatus === 'RUNNING',
      cycleStartAt: runtimeState.currentCycleStartAt,
    });

    const pairIdsToDeactivate: number[] = [];
    const results: Array<{
      id: number;
      assignedNumber: number;
      name: string | null;
      active: boolean;
      captured: boolean;
      mostWanted: boolean;
      hasActiveDevice: boolean;
      lastPosition: { lat: number; lon: number; timestamp: string } | null;
      captureNote: string | null;
      captureTimestamp: string | null;
      captureId: number | null;
      capturedByUserId: number | null;
      capturedByUsername: string | null;
      capturedByRole: string | null;
      captureLocation: { lat: number; lon: number } | null;
      /** Always null from API; pursuers’ straight-line distance is computed in the browser (GPS + pair position). */
      distanceToNearestOfficer: number | null;
    } | null> = [];

    for (const pair of pairs) {
      const activeDevice = deviceByPairId.get(pair.id);
      const hasActiveDevice = !!(
        activeDevice &&
        activeDevice.loggedOutAt == null &&
        activeDevice.lastSeenAt &&
        new Date(activeDevice.lastSeenAt) > thirtyMinutesAgo
      );

      if (!hasActiveDevice && pair.active) {
        pairIdsToDeactivate.push(pair.id);
      }

      if (active === true && !hasActiveDevice) {
        results.push(null);
        continue;
      }

      const lastPosition = latestByPairId.get(pair.id) ?? null;
      let allowedLastPosition: { lat: number; lon: number; timestamp: string } | null = null;

      if (
        lastPosition &&
        runtimeState.campaignStatus === 'RUNNING' &&
        runtimeState.currentCycleStartAt
      ) {
        const pairIdInArray = pairsSentArray.some((id) => Number(id) === Number(pair.id));
        if (pairIdInArray) {
          const firstPositionInCycle = firstInCycleByPairId.get(pair.id);
          if (firstPositionInCycle) {
            allowedLastPosition = {
              lat: parseFloat(firstPositionInCycle.lat.toString()),
              lon: parseFloat(firstPositionInCycle.lon.toString()),
              timestamp: firstPositionInCycle.timestamp.toISOString(),
            };
            // Ha ugyanebben a ciklusban újabb PG-s sor készült az elsőnél, a legfrissebbet használjuk.
            if (lastPosition) {
              const tFirst = new Date(firstPositionInCycle.timestamp).getTime();
              const tLatest = new Date(lastPosition.timestamp).getTime();
              if (tLatest > tFirst) {
                allowedLastPosition = {
                  lat: parseFloat(lastPosition.lat.toString()),
                  lon: parseFloat(lastPosition.lon.toString()),
                  timestamp: lastPosition.timestamp.toISOString(),
                };
              }
            }
          }
        }
      }

      if (!allowedLastPosition && exitViolationPairIds.has(pair.id)) {
        const live = liveByPairId.get(pair.id);
        if (live) {
          allowedLastPosition = {
            lat: live.lat,
            lon: live.lon,
            timestamp: live.timestamp,
          };
        }
      }

      // Ha nincs ciklusbeli / élő pozíció: mindig a legutóbbi mentett (positions) — számláló alatt is
      // (új ciklusban cycleStartAt még null, vagy a pár még nem küldött a ciklusban; ilyenkor se tűnjön el a térképről).
      if (!allowedLastPosition && lastPosition) {
        allowedLastPosition = {
          lat: parseFloat(lastPosition.lat.toString()),
          lon: parseFloat(lastPosition.lon.toString()),
          timestamp: lastPosition.timestamp.toISOString(),
        };
      }

      const capRow = captureByPairId.get(pair.id);
      const capPos = capRow?.locationId ? capturePositionById.get(capRow.locationId) : undefined;
      const capUser = capRow ? captureUserById.get(capRow.capturedByUserId) : undefined;
      results.push({
        id: pair.id,
        assignedNumber: pair.assignedNumber,
        name: pair.name,
        active: hasActiveDevice,
        captured: captureByPairId.has(pair.id),
        mostWanted: mwPairIds.has(pair.id),
        hasActiveDevice,
        lastPosition: allowedLastPosition,
        captureNote:
          captureByPairId.has(pair.id) && hasActiveDevice
            ? 'Elfogva: kijelentkezésükig a pár továbbra is követhető a térképen.'
            : captureByPairId.has(pair.id)
              ? 'Elfogva: nincs bejelentkezett eszköz, élő követés nincs.'
              : null,
        captureTimestamp: capRow?.timestamp?.toISOString?.() ?? null,
        captureId: capRow?.id ?? null,
        capturedByUserId: capRow?.capturedByUserId ?? null,
        capturedByUsername: capUser?.username ?? null,
        capturedByRole: capUser?.role ?? null,
        captureLocation:
          capRow != null &&
          capRow.capturedLat != null &&
          capRow.capturedLon != null &&
          Number.isFinite(Number(capRow.capturedLat)) &&
          Number.isFinite(Number(capRow.capturedLon))
            ? { lat: Number(capRow.capturedLat), lon: Number(capRow.capturedLon) }
            : capPos != null
              ? { lat: parseFloat(String(capPos.lat)), lon: parseFloat(String(capPos.lon)) }
              : null,
        distanceToNearestOfficer: null,
      });
    }

    if (pairIdsToDeactivate.length > 0) {
      await this.pairRepository.update({ id: In(pairIdsToDeactivate) }, { active: false });
      for (const p of pairs) {
        if (pairIdsToDeactivate.includes(p.id)) p.active = false;
      }
    }

    return { pairs: results.filter((p): p is NonNullable<typeof p> => p !== null) };
  }

  private async loadLatestPositionPerPair(pairIds: number[]): Promise<Map<number, Position>> {
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

  private async loadFirstPositionInCycleForPairs(
    pairs: Pair[],
    pairsSentArray: number[],
    cycle: { motorRunning: boolean; cycleStartAt: Date | null },
  ): Promise<Map<number, Position>> {
    const map = new Map<number, Position>();
    if (!cycle.motorRunning || !cycle.cycleStartAt || pairsSentArray.length === 0) {
      return map;
    }
    const eligibleIds = pairs
      .filter((p) => pairsSentArray.some((id) => Number(id) === Number(p.id)))
      .map((p) => p.id);
    if (eligibleIds.length === 0) return map;
    const cycleStartAt = new Date(cycle.cycleStartAt);
    const rows = await this.positionRepository
      .createQueryBuilder('position')
      .where('position.pairId IN (:...ids)', { ids: eligibleIds })
      .andWhere('position.timestamp >= :cycleStartAt', { cycleStartAt })
      .distinctOn(['position.pairId'])
      .orderBy('position.pairId', 'ASC')
      .addOrderBy('position.timestamp', 'ASC')
      .getMany();
    for (const r of rows) {
      map.set(r.pairId, r);
    }
    return map;
  }

  async create(createPairDto: CreatePairDto, userId: number, audit?: AuditRequestMeta) {
    // Check if assigned number already exists
    const existing = await this.pairRepository.findOne({
      where: { assignedNumber: createPairDto.assignedNumber },
    });

    if (existing) {
      throw new BadRequestException('Pair with this number already exists');
    }

    const pair = this.pairRepository.create({
      assignedNumber: createPairDto.assignedNumber,
      name: createPairDto.name || null,
      active: false, // Inactive until device logs in
    });

    const savedPair = await this.pairRepository.save(pair);

    await this.auditLogsService.log({
      userId,
      actionType: 'pair_create',
      entityType: 'pair',
      entityId: savedPair.id,
      dataJson: { assignedNumber: savedPair.assignedNumber },
      ...audit,
    });

    return {
      success: true,
      pair: {
        id: savedPair.id,
        assignedNumber: savedPair.assignedNumber,
        name: savedPair.name,
        active: savedPair.active,
      },
    };
  }

  async update(id: number, updatePairDto: UpdatePairDto, userId: number, audit?: AuditRequestMeta) {
    const pair = await this.pairRepository.findOne({ where: { id } });
    if (!pair) {
      throw new BadRequestException('Pair not found');
    }

    if (updatePairDto.assignedNumber !== undefined) {
      // Check if new number already exists
      const existing = await this.pairRepository.findOne({
        where: { assignedNumber: updatePairDto.assignedNumber },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Pair with this number already exists');
      }
      pair.assignedNumber = updatePairDto.assignedNumber;
    }

    if (updatePairDto.name !== undefined) {
      pair.name = updatePairDto.name;
    }

    if (updatePairDto.active !== undefined) {
      pair.active = updatePairDto.active;
    }

    await this.pairRepository.save(pair);
    if (updatePairDto.active !== undefined) {
      this.recentDevicePairIdsService.invalidateSnapshot();
    }

    await this.auditLogsService.log({
      userId,
      actionType: 'pair_update',
      entityType: 'pair',
      entityId: id,
      dataJson: updatePairDto,
      ...audit,
    });

    return {
      success: true,
      pair: {
        id: pair.id,
        assignedNumber: pair.assignedNumber,
        name: pair.name,
        active: pair.active,
      },
    };
  }

  async delete(id: number, userId: number, audit?: AuditRequestMeta) {
    const pair = await this.pairRepository.findOne({ where: { id } });
    if (!pair) {
      throw new BadRequestException('Pair not found');
    }

    // Get all devices associated with this pair before deleting
    const devices = await this.deviceRepository.find({
      where: { pairId: id },
    });
    
    // Send FCM notifications to devices before deleting them
    if (devices.length > 0) {
      for (const device of devices) {
        if (device.fcmToken) {
          try {
            await this.fcmService.sendToDevice(device.fcmToken, {
              title: '',
              body: '',
              data: {
                type: 'pair_deleted',
                action: 'logout',
              },
              dataOnly: true,
            });
            console.log(`[Pair] Sent pair deletion FCM notification to device ${device.imeiOrDeviceId}`);
          } catch (error) {
            console.error(`[Pair] Failed to send FCM notification to device ${device.imeiOrDeviceId}:`, error);
          }
        }
      }
    }

    // Delete all devices associated with this pair
    if (devices.length > 0) {
      await this.deviceRepository.remove(devices);
      console.log(`[Pair] Deleted ${devices.length} device(s) associated with pair ${id}`);
    }

    // Delete all positions associated with this pair
    const positions = await this.positionRepository.find({
      where: { pairId: id },
    });
    
    if (positions.length > 0) {
      await this.positionRepository.remove(positions);
      console.log(`[Pair] Deleted ${positions.length} position(s) associated with pair ${id}`);
    }

    await this.redisPositionService.deleteLivePosition(id);
    this.recentDevicePairIdsService.invalidateSnapshot();

    await this.pairRepository.remove(pair);

    await this.auditLogsService.log({
      userId,
      actionType: 'pair_delete',
      entityType: 'pair',
      entityId: id,
      dataJson: { assignedNumber: pair.assignedNumber },
      ...audit,
    });

    return {
      success: true,
      message: 'Pair deleted',
    };
  }

  async updateName(id: number, name: string | null, userId: number, audit?: AuditRequestMeta) {
    // Handle empty string as null
    const nameToSet = name === '' || name === null || name === undefined ? null : name;
    return await this.update(id, { name: nameToSet }, userId, audit);
  }

}

