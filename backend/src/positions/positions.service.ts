import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Position, type SavedAreaContext, type SavedScenarioZone } from '../entities/position.entity';
import { Device } from '../entities/device.entity';
import { GameSettings } from '../entities/game-settings.entity';
import { Geofence } from '../entities/geofence.entity';
import { RuleViolation } from '../entities/rule-violation.entity';
import { CreatePositionDto } from './dto/create-position.dto';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { RuleViolationsService } from '../rule-violations/rule-violations.service';
import { RedisPositionService } from '../redis/redis-position.service';
import { RecentDevicePairIdsService } from '../device-activity/recent-device-pair-ids.service';
import { PositionSnapshot } from './position-snapshot';
import { logVerbose } from '../common/verbose-log';
import { parsePairsSentIds } from '../common/pairs-sent.util';
import { QueryAdminPositionsDto } from './dto/query-admin-positions.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditRequestMeta } from '../common/audit-request.util';

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
    @InjectRepository(GameSettings)
    private gameSettingsRepository: Repository<GameSettings>,
    @InjectRepository(Geofence)
    private geofenceRepository: Repository<Geofence>,
    @InjectRepository(RuleViolation)
    private ruleViolationRepository: Repository<RuleViolation>,
    private webSocketGateway: WebSocketGateway,
    private ruleViolationsService: RuleViolationsService,
    private redisPositionService: RedisPositionService,
    private recentDevicePairIdsService: RecentDevicePairIdsService,
    private auditLogsService: AuditLogsService,
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
    logVerbose('[Position] Received position:', {
      deviceId: createPositionDto.deviceId,
      pairId: createPositionDto.pairId,
      lat: createPositionDto.lat,
      lon: createPositionDto.lon,
      devicePayload: devicePayload ? { deviceId: devicePayload.deviceId, pairId: devicePayload.pairId } : null,
    });

    let device;
    if (devicePayload?.authenticated && devicePayload?.deviceId) {
      device = await this.deviceRepository.findOne({
        where: { imeiOrDeviceId: devicePayload.deviceId },
      });
      if (device) {
        if (devicePayload.pairId && device.pairId !== devicePayload.pairId) {
          device.pairId = devicePayload.pairId;
        }
      }
    } else {
      device = await this.deviceRepository.findOne({
        where: { imeiOrDeviceId: createPositionDto.deviceId },
      });
    }

    if (!device) {
      const pairId = createPositionDto.pairId || devicePayload?.pairId;
      logVerbose('[Position] Creating new device with pairId:', pairId);
      device = this.deviceRepository.create({
        pairId: pairId,
        imeiOrDeviceId: createPositionDto.deviceId || devicePayload?.deviceId,
        lastSeenAt: new Date(),
        loggedOutAt: null,
      });
      device = await this.deviceRepository.save(device);
    } else {
      device.lastSeenAt = new Date();
      if (devicePayload?.pairId && device.pairId !== devicePayload.pairId) {
        logVerbose('[Position] Updating device pairId from', device.pairId, 'to', devicePayload.pairId);
        device.pairId = devicePayload.pairId;
      }
      device = await this.deviceRepository.save(device);
    }

    this.recentDevicePairIdsService.invalidateSnapshot();

    const pairId = createPositionDto.pairId || device.pairId;

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
    logVerbose('[Position] Live position stored in Redis for pairId:', pairId);

    const { violations, gameAreaExitViolationActive } =
      await this.ruleViolationsService.checkViolations(pairId, snapshot);

    // Straight-line distance for pursuers is computed in the browser (geolocation + pair coords).
    logVerbose('[Position] Broadcasting distance update via WebSocket for pairId:', pairId);
    this.webSocketGateway.broadcastDistanceUpdate({
      pairId: pairId,
      lat: createPositionDto.lat,
      lon: createPositionDto.lon,
      distanceToNearestOfficer: null,
      timestamp: serverTimestamp.toISOString(),
    });

    const currentSettings = await this.gameSettingsRepository.findOne({ where: {} });
    let shouldShowOnMap = false;
    let pairAddedToCycleThisRequest = false;

    if (!currentSettings) {
      logVerbose('[Position] No game settings found, not broadcasting position update for map');
    } else if (!currentSettings.isTimerRunning) {
      logVerbose('[Position] Timer is not running, not broadcasting position update for map. pairId:', pairId);
    } else {
      shouldShowOnMap = gameAreaExitViolationActive;

      if (currentSettings.allowPositionUpdatesForMap === true) {
        const freshSettings = await this.gameSettingsRepository.findOne({ where: {} });
        if (!freshSettings || freshSettings.allowPositionUpdatesForMap !== true) {
          // window closed concurrently
        } else {
          const pairsSentArray = parsePairsSentIds(freshSettings.pairsSentPositionThisCycle);

          const pairIdInArray = pairsSentArray.some((id) => Number(id) === Number(pairId));

          if (!pairIdInArray) {
            const updatedPairsSent = [...pairsSentArray, pairId];
            freshSettings.pairsSentPositionThisCycle = updatedPairsSent;
            await this.gameSettingsRepository.save(freshSettings);

            shouldShowOnMap = true;
            pairAddedToCycleThisRequest = true;
            logVerbose('[Position] Pair position update allowed. pairId:', pairId, 'pairsSent:', updatedPairsSent);

            const activePairIds = await this.recentDevicePairIdsService.getDistinctRecentDevicePairIds();

            const allPairsSent =
              activePairIds.length > 0 && activePairIds.every((id: number) => updatedPairsSent.includes(id));

            if (allPairsSent) {
              freshSettings.allowPositionUpdatesForMap = false;
              await this.gameSettingsRepository.save(freshSettings);
              logVerbose(
                '[Position] All active pairs have sent position. Closing position update window IMMEDIATELY. Positions will stay on map until next timer cycle.',
              );
            }
          }
        }
      } else {
        if (!gameAreaExitViolationActive) {
          logVerbose(
            '[Position] Position updates for map are not allowed (allowPositionUpdatesForMap = false). pairId:',
            pairId,
          );
        }
      }
    }

    let savedPosition: Position | null = null;
    if (pairAddedToCycleThisRequest && currentSettings?.isTimerRunning) {
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
      logVerbose('[Position] Sampled position persisted to PostgreSQL (counter cycle):', {
        id: savedPosition.id,
        pairId: savedPosition.pairId,
      });
      this.webSocketGateway.broadcastSavedPositionSample({
        pairId: savedPosition.pairId,
        id: savedPosition.id,
      });
    }

    const mapTimestamp = savedPosition?.timestamp?.toISOString() ?? serverTimestamp.toISOString();

    if (shouldShowOnMap) {
      logVerbose('[Position] Broadcasting position update for map via WebSocket for pairId:', pairId, 'at:', mapTimestamp);
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
    } else {
      const allowUpdates = currentSettings?.allowPositionUpdatesForMap ?? false;
      const timerRunning = currentSettings?.isTimerRunning ?? false;
      logVerbose(
        '[Position] Position update NOT broadcasted for map (timer not allowing or pair already sent) for pairId:',
        pairId,
        'allowPositionUpdatesForMap:',
        allowUpdates,
        'isTimerRunning:',
        timerRunning,
      );
    }

    return {
      success: true,
      message: 'Position recorded',
      violationDetected: violations.length > 0,
      continuousMode: gameAreaExitViolationActive,
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
