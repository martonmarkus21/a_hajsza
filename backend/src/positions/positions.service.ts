import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Position, type SavedAreaContext, type SavedScenarioZone } from '../entities/position.entity';
import { Device } from '../entities/device.entity';
import { Geofence } from '../entities/geofence.entity';
import { RuleViolation } from '../entities/rule-violation.entity';
import { Capture } from '../entities/capture.entity';
import { CreatePositionDto } from './dto/create-position.dto';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { RuleViolationsService } from '../rule-violations/rule-violations.service';
import { RedisPositionService } from '../redis/redis-position.service';
import { RedisStayRuleService } from '../redis/redis-stay-rule.service';
import { RecentDevicePairIdsService } from '../device-activity/recent-device-pair-ids.service';
import { PositionSnapshot } from './position-snapshot';
import { logVerbosePosition, logVerbosePositionThrottled } from '../common/verbose-log';
import { QueryAdminPositionsDto } from './dto/query-admin-positions.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditRequestMeta } from '../common/audit-request.util';
import { GameRuntimeService } from '../game-runtime/game-runtime.service';

function parseOptionalDateInput(raw?: string): Date | undefined {
  if (raw == null || String(raw).trim() === '') return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return undefined;
  }
  return d;
}

@Injectable()
export class PositionsService {
  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(Geofence)
    private geofenceRepository: Repository<Geofence>,
    @InjectRepository(RuleViolation)
    private ruleViolationRepository: Repository<RuleViolation>,
    @InjectRepository(Capture)
    private captureRepository: Repository<Capture>,
    private webSocketGateway: WebSocketGateway,
    private ruleViolationsService: RuleViolationsService,
    private redisPositionService: RedisPositionService,
    private redisStayRuleService: RedisStayRuleService,
    private recentDevicePairIdsService: RecentDevicePairIdsService,
    private auditLogsService: AuditLogsService,
    private gameRuntimeService: GameRuntimeService,
  ) {}

  /** Mentéskor: fix game_area geofence ID-k + scenario körök — egy jsonb oszlopban. */
  private async buildSavedSnapshotParts(): Promise<SavedAreaContext | null> {
    const rows = await this.geofenceRepository.find({ where: { active: true }, order: { id: 'ASC' } });
    if (rows.length === 0) return null;

    const gameAreaGeofenceIds: number[] = [];
    const scenarioZones: SavedScenarioZone[] = [];

    for (const g of rows) {
      if (g.geofenceType === 'game_area') {
        gameAreaGeofenceIds.push(g.id);
        continue;
      }
      if (g.geofenceType === 'scenario') {
        scenarioZones.push({
          name: g.name?.trim() ? g.name.trim() : 'Egyedi zóna',
          lat: parseFloat(String(g.centerLat)),
          lon: parseFloat(String(g.centerLon)),
          radiusM: g.radiusM,
        });
      }
    }

    if (gameAreaGeofenceIds.length === 0 && scenarioZones.length === 0) return null;
    return { gameAreaGeofenceIds, scenarioZones };
  }

  private geofenceToLegacySnapshotItem(g: Geofence): Record<string, unknown> {
    const meta = (g.metadataJson ?? null) as Record<string, unknown> | null;
    return {
      id: g.id,
      name: g.name,
      centerLat: parseFloat(String(g.centerLat)),
      centerLon: parseFloat(String(g.centerLon)),
      radiusM: g.radiusM,
      active: true,
      geofenceType: g.geofenceType,
      metadataJson: meta,
    };
  }

  private async expandSavedContextsForPositions(
    rows: Position[],
  ): Promise<Map<number, Record<string, unknown>[] | null>> {
    const out = new Map<number, Record<string, unknown>[] | null>();
    const allIds = new Set<number>();
    for (const p of rows) {
      const ids = p.savedAreaContextJson?.gameAreaGeofenceIds;
      if (ids?.length) ids.forEach((id) => allIds.add(id));
    }

    const geos = allIds.size ? await this.geofenceRepository.findBy({ id: In([...allIds]) }) : [];
    const byId = new Map(geos.map((g) => [g.id, g]));

    for (const p of rows) {
      const ctx = p.savedAreaContextJson;
      const areaIds = ctx?.gameAreaGeofenceIds ?? [];
      const scenarioZones = ctx?.scenarioZones ?? [];
      if (areaIds.length === 0 && scenarioZones.length === 0) {
        out.set(p.id, null);
        continue;
      }

      const items: Record<string, unknown>[] = [];
      for (const id of areaIds) {
        const g = byId.get(id);
        if (g) items.push(this.geofenceToLegacySnapshotItem(g));
      }

      scenarioZones.forEach((z, idx) => {
        const zoneName =
          typeof z.name === 'string' && z.name.trim() !== '' ? z.name.trim() : 'Egyedi zóna';
        items.push({
          id: -(idx + 1),
          name: zoneName,
          centerLat: z.lat,
          centerLon: z.lon,
          radiusM: z.radiusM,
          active: true,
          geofenceType: 'scenario',
          metadataJson: null,
        });
      });

      out.set(p.id, items.length ? items : null);
    }

    return out;
  }

  async create(createPositionDto: CreatePositionDto, devicePayload?: any) {
    if (!devicePayload?.authenticated || !devicePayload?.deviceId) {
      throw new UnauthorizedException('Authenticated device token required');
    }

    const tokenPairId = Number(devicePayload.pairId);
    if (
      Number(createPositionDto.pairId) !== tokenPairId ||
      createPositionDto.deviceId !== devicePayload.deviceId
    ) {
      throw new UnauthorizedException('Position payload does not match authenticated device');
    }

    const device = await this.deviceRepository.findOne({
      where: { imeiOrDeviceId: devicePayload.deviceId },
    });

    if (!device) {
      throw new UnauthorizedException('Device not registered; please log in again');
    }

    if (device.loggedOutAt != null) {
      throw new UnauthorizedException('Device session ended; please log in again');
    }

    if (Number(device.pairId) !== tokenPairId) {
      throw new UnauthorizedException('Device session invalid; please log in again');
    }

    device.lastSeenAt = new Date();
    await this.deviceRepository.save(device);

    this.recentDevicePairIdsService.invalidateSnapshot();

    const pairId = tokenPairId;

    if (!pairId || pairId === 0) {
      console.warn('[Position] WARNING: No pairId available! Device may be logged out or pair was deleted.', {
        createPositionDtoPairId: createPositionDto.pairId,
        devicePairId: device.pairId,
        devicePayloadPairId: devicePayload?.pairId,
        deviceId: device.imeiOrDeviceId,
      });
      return {
        success: false,
        message: 'PairId is required. Please login again.',
      };
    }

    const serverTimestamp = new Date();
    const pairCaptured = await this.captureRepository.exist({ where: { pairId } });
    const snapshot: PositionSnapshot = {
      lat: createPositionDto.lat,
      lon: createPositionDto.lon,
      accuracy: createPositionDto.accuracy ?? null,
      speed: createPositionDto.speed ?? null,
      vehicleMode: createPositionDto.vehicleMode || false,
      vehicleSessionRemaining: createPositionDto.vehicleSessionRemaining ?? null,
      timestamp: serverTimestamp,
    };

    await this.redisPositionService.setLivePosition(pairId, snapshot);

    const gameCtx = await this.gameRuntimeService.getRuntimeContext();
    const { violations, gameAreaExitViolationActive } = await this.ruleViolationsService.checkViolations(
      pairId,
      snapshot,
      { applyGameRules: gameCtx.isGameActive },
    );

    const vehicleTimeExceededActive =
      (await this.ruleViolationRepository.count({
        where: { pairId, violationType: 'vehicle_time_exceeded', resolved: false },
      })) > 0;

    // Straight-line distance for pursuers is computed in the browser (geolocation + pair coords).
    this.webSocketGateway.broadcastDistanceUpdate({
      pairId: pairId,
      lat: createPositionDto.lat,
      lon: createPositionDto.lon,
      distanceToNearestOfficer: null,
      timestamp: serverTimestamp.toISOString(),
    });

    const runtime = await this.gameRuntimeService.tick();
    let shouldShowOnMap = false;
    let pairAddedToCycleThisRequest = false;

    const stayRuleMapRevealActive = await this.redisStayRuleService.isMapRevealActive(
      pairId,
      serverTimestamp,
    );

    if (pairCaptured) {
      shouldShowOnMap = true;
      pairAddedToCycleThisRequest = false;
    } else if (runtime.campaignStatus !== 'RUNNING' && runtime.allowPositionUpdatesForMap !== true) {
      logVerbosePosition(
        '[Position] Runtime does not allow sampled map position now. pairId:',
        pairId,
        'motorPhase:',
        runtime.campaignStatus,
      );
    } else {
      shouldShowOnMap =
        gameAreaExitViolationActive || vehicleTimeExceededActive || stayRuleMapRevealActive;

      if (runtime.allowPositionUpdatesForMap === true) {
        const consume = await this.gameRuntimeService.tryConsumePairCycleSlot(pairId);
        if (consume.allowed) {
          shouldShowOnMap = true;
          pairAddedToCycleThisRequest = true;

          const activePairIdsRaw = await this.recentDevicePairIdsService.getDistinctRecentDevicePairIds();
          const capturedRows = activePairIdsRaw.length
            ? await this.captureRepository.find({
                where: { pairId: In(activePairIdsRaw) },
                select: ['pairId'],
              })
            : [];
          const capturedIds = new Set(capturedRows.map((r) => r.pairId));
          const activePairIds = activePairIdsRaw.filter((id: number) => !capturedIds.has(id));
          await this.gameRuntimeService.closeCycleWindowIfAllPairsSent(activePairIds);
        }
      } else {
        if (!gameAreaExitViolationActive && !vehicleTimeExceededActive) {
          logVerbosePosition(
            '[Position] Position updates for map are not allowed (allowPositionUpdatesForMap = false). pairId:',
            pairId,
          );
        }
      }
    }

    let savedPosition: Position | null = null;
    if (!pairCaptured && pairAddedToCycleThisRequest) {
      const hadRuleViolationAtSave =
        (await this.ruleViolationRepository.count({ where: { pairId, resolved: false } })) > 0;
      const savedAreaContextJson = await this.buildSavedSnapshotParts();
      const positionRow = this.positionRepository.create({
        pairId: pairId,
        lat: createPositionDto.lat,
        lon: createPositionDto.lon,
        accuracy: createPositionDto.accuracy,
        speed: createPositionDto.speed,
        vehicleMode: createPositionDto.vehicleMode || false,
        vehicleSessionRemaining: createPositionDto.vehicleSessionRemaining,
        timestamp: serverTimestamp,
        savedAreaContextJson,
        hadRuleViolationAtSave,
      });
      savedPosition = await this.positionRepository.save(positionRow);
      this.webSocketGateway.broadcastSavedPositionSample({
        pairId: savedPosition.pairId,
        id: savedPosition.id,
      });
    }

    const mapTimestamp = savedPosition?.timestamp?.toISOString() ?? serverTimestamp.toISOString();

    if (shouldShowOnMap) {
      this.webSocketGateway.broadcastPositionUpdate({
        pairId: pairId,
        lat: createPositionDto.lat,
        lon: createPositionDto.lon,
        accuracy: createPositionDto.accuracy,
        speed: createPositionDto.speed,
        timestamp: mapTimestamp,
        vehicleMode: createPositionDto.vehicleMode || false,
        distanceToNearestOfficer: null,
      });
    }

    logVerbosePositionThrottled(
      `position:${pairId}`,
      '[Position]',
      {
        pairId,
        deviceId: createPositionDto.deviceId,
        lat: createPositionDto.lat,
        lon: createPositionDto.lon,
        liveRedisStored: true,
        distanceWsBroadcast: true,
        mapWsSent: shouldShowOnMap,
        motorPhase: runtime.campaignStatus,
        allowPositionUpdatesForMap: runtime.allowPositionUpdatesForMap ?? false,
        pairAlreadyCaptured: pairCaptured,
        sampledDbRowId: savedPosition?.id ?? null,
        pairAddedCycleThisRequest: pairAddedToCycleThisRequest,
      },
    );

    return {
      success: true,
      message: 'Position recorded',
      violationDetected: violations.length > 0,
      continuousMode:
        gameAreaExitViolationActive || vehicleTimeExceededActive || stayRuleMapRevealActive,
    };
  }

  /**
   * Admin: mentett (PostgreSQL) pozíciók — ugyanazok, mint amik a térképre kerültek és mintába mentődtek.
   */
  async listPositionsForAdmin(query: QueryAdminPositionsDto) {
    const from = parseOptionalDateInput(query.from);
    const to = parseOptionalDateInput(query.to);
    if (query.from != null && String(query.from).trim() !== '' && from === undefined) {
      throw new BadRequestException('Érvénytelen „from” időpont.');
    }
    if (query.to != null && String(query.to).trim() !== '' && to === undefined) {
      throw new BadRequestException('Érvénytelen „to” időpont.');
    }
    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException('A „from” időpont nem lehet későbbi, mint a „to”.');
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const sortBy = query.sortBy ?? 'timestamp';
    const sortDir = (query.sortDir ?? 'desc').toUpperCase() as 'ASC' | 'DESC';

    const qb = this.positionRepository
      .createQueryBuilder('position')
      .leftJoinAndSelect('position.pair', 'pair');

    if (query.pairId != null) {
      qb.andWhere('position.pairId = :pairId', { pairId: query.pairId });
    }
    if (from) {
      qb.andWhere('position.timestamp >= :from', { from });
    }
    if (to) {
      qb.andWhere('position.timestamp <= :to', { to });
    }

    const sortColumn =
      sortBy === 'id' ? 'position.id' : sortBy === 'pairId' ? 'position.pairId' : 'position.timestamp';
    qb.orderBy(sortColumn, sortDir);

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [rows, total] = await qb.getManyAndCount();
    const snapshotByPositionId = await this.expandSavedContextsForPositions(rows);

    const items = rows.map((p) => ({
      id: p.id,
      pairId: p.pairId,
      assignedNumber: p.pair?.assignedNumber ?? null,
      pairName: p.pair?.name ?? null,
      lat: Number(p.lat),
      lon: Number(p.lon),
      accuracy: p.accuracy != null ? Number(p.accuracy) : null,
      speed: p.speed != null ? Number(p.speed) : null,
      vehicleMode: p.vehicleMode,
      vehicleSessionRemaining: p.vehicleSessionRemaining,
      timestamp: p.timestamp instanceof Date ? p.timestamp.toISOString() : String(p.timestamp),
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
      gameAreaSnapshot: snapshotByPositionId.get(p.id) ?? null,
      hadRuleViolationAtSave: !!p.hadRuleViolationAtSave,
    }));

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  /** Admin: egy pár összes mentett pozíciójának törlése (PostgreSQL). */
  async deleteAllSavedPositionsForPair(
    pairId: number,
    audit?: { userId?: number } & AuditRequestMeta,
  ): Promise<{ deleted: number }> {
    const result = await this.positionRepository.delete({ pairId });
    const deleted = result.affected ?? 0;
    this.webSocketGateway.broadcastSavedPositionsDeleted({ pairId, deleted });
    if (audit?.userId != null && deleted > 0) {
      await this.auditLogsService.log({
        userId: audit.userId,
        actionType: 'position_delete_pair',
        entityType: 'pair',
        entityId: pairId,
        dataJson: { deleted },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      });
    }
    return { deleted };
  }

  /**
   * Admin: megadott ID-k törlése, ha mindegyik ehhez a párhez tartozik.
   * Duplikált ID-k egyszer számítanak.
   */
  async deleteSavedPositionsByIdsForPair(
    pairId: number,
    ids: number[],
    audit?: { userId?: number } & AuditRequestMeta,
  ): Promise<{ deleted: number }> {
    const uniq = [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 1))];
    if (uniq.length === 0) {
      throw new BadRequestException('Legalább egy érvényes pozíció-ID megadása kötelező.');
    }

    const rows = await this.positionRepository.find({
      where: { pairId, id: In(uniq) },
      select: ['id'],
    });

    if (rows.length !== uniq.length) {
      throw new BadRequestException(
        'Egy vagy több megadott pozíció nem található, vagy nem ehhez a párhez tartozik.',
      );
    }

    const del = await this.positionRepository.delete({ id: In(uniq), pairId });
    const deleted = del.affected ?? uniq.length;
    this.webSocketGateway.broadcastSavedPositionsDeleted({ pairId, deleted });
    if (audit?.userId != null && deleted > 0) {
      await this.auditLogsService.log({
        userId: audit.userId,
        actionType: 'position_delete_batch',
        entityType: 'pair',
        entityId: pairId,
        dataJson: { deleted, positionIds: uniq },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      });
    }
    return { deleted };
  }

  /** Legutóbbi mentett pozíció egy párhoz (pár részletei / térkép modál). */
  async getLatestSavedPositionForPair(pairId: number) {
    const p = await this.positionRepository.findOne({
      where: { pairId },
      order: { timestamp: 'DESC' },
      relations: ['pair'],
    });
    if (!p) return null;
    const snapshotById = await this.expandSavedContextsForPositions([p]);
    return {
      id: p.id,
      pairId: p.pairId,
      assignedNumber: p.pair?.assignedNumber ?? null,
      pairName: p.pair?.name ?? null,
      lat: Number(p.lat),
      lon: Number(p.lon),
      accuracy: p.accuracy != null ? Number(p.accuracy) : null,
      speed: p.speed != null ? Number(p.speed) : null,
      vehicleMode: p.vehicleMode,
      vehicleSessionRemaining: p.vehicleSessionRemaining,
      timestamp: p.timestamp instanceof Date ? p.timestamp.toISOString() : String(p.timestamp),
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
      gameAreaSnapshot: snapshotById.get(p.id) ?? null,
      hadRuleViolationAtSave: !!p.hadRuleViolationAtSave,
    };
  }
}
