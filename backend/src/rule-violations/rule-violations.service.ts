import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RuleViolation } from '../entities/rule-violation.entity';
import { Geofence } from '../entities/geofence.entity';
import { PositionSnapshot } from '../positions/position-snapshot';
import { RedisGeofenceCacheService } from '../redis/redis-geofence-cache.service';
import { GeofenceCompletion } from '../entities/geofence-completion.entity';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { GameDaysService } from '../game-days/game-days.service';
import { FcmService } from '../fcm/fcm.service';
import { Pair } from '../entities/pair.entity';
import { MwFlag } from '../entities/mw-flag.entity';

@Injectable()
export class RuleViolationsService {
  constructor(
    @InjectRepository(RuleViolation)
    private ruleViolationRepository: Repository<RuleViolation>,
    private redisGeofenceCache: RedisGeofenceCacheService,
    @InjectRepository(GeofenceCompletion)
    private geofenceCompletionRepository: Repository<GeofenceCompletion>,
    @InjectRepository(Pair)
    private pairRepository: Repository<Pair>,
    @InjectRepository(MwFlag)
    private mwFlagRepository: Repository<MwFlag>,
    private webSocketGateway: WebSocketGateway,
    private gameDaysService: GameDaysService,
    private fcmService: FcmService,
  ) {}

  async getActiveGameAreaViolations() {
    const active = await this.ruleViolationRepository.find({
      where: {
        violationType: 'game_area_exit',
        resolved: false,
      },
      order: { createdAt: 'DESC' },
    });

    const pairIds = Array.from(new Set(active.map((v) => v.pairId)));
    const pairs = pairIds.length ? await this.pairRepository.findBy({ id: In(pairIds) }) : [];
    const pairMap = new Map(pairs.map((p) => [p.id, p]));

    return {
      count: active.length,
      violations: active.map((v) => {
        const pair = pairMap.get(v.pairId);
        const created = v.createdAt ? new Date(v.createdAt as Date) : null;
        return {
          id: v.id,
          pairId: v.pairId,
          assignedNumber: pair?.assignedNumber ?? null,
          pairName: pair?.name ?? null,
          violationType: v.violationType,
          description: v.description,
          // Mindig egyértelmű UTC ISO, hogy a kliens ne tévessze össze a helyi idővel
          createdAt: created ? created.toISOString() : null,
          resolved: v.resolved,
          continuousMode: true,
        };
      }),
    };
  }

  /**
   * Admin: lapozott lista, keresés, állapot/típus szűrő, rendezés.
   */
  async listViolationsForAdmin(options: {
    page?: number;
    pageSize?: number;
    violationType?: string;
    resolvedFilter?: 'all' | 'active' | 'resolved';
    search?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }): Promise<{
    violations: Array<{
      id: number;
      pairId: number;
      assignedNumber: number | null;
      pairName: string | null;
      pairMostWanted: boolean;
      violationType: string;
      description: string | null;
      createdAt: string | null;
      resolved: boolean;
      resolvedAt: string | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    stats: { total: number; active: number; resolved: number };
  }> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(Math.max(5, options.pageSize ?? 20), 5000);
    const sortDir: 'ASC' | 'DESC' = options.sortDir === 'asc' ? 'ASC' : 'DESC';
    const sortBy = options.sortBy || 'createdAt';

    // leftJoinAndSelect: ORDER BY pair.* nélkül PostgreSQL DISTINCT + getMany() hibát dobhat
    const qb = this.ruleViolationRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.pair', 'pair');

    if (options.violationType && options.violationType !== 'all') {
      qb.andWhere('v.violationType = :vt', { vt: options.violationType });
    }
    if (options.resolvedFilter === 'active') {
      qb.andWhere('v.resolved = :rf', { rf: false });
    } else if (options.resolvedFilter === 'resolved') {
      qb.andWhere('v.resolved = :rf2', { rf2: true });
    }

    const rawSearch = options.search?.trim();
    if (rawSearch) {
      const safe = rawSearch.replace(/%/g, '').replace(/_/g, '').slice(0, 80);
      if (safe.length > 0) {
        const like = `%${safe}%`;
        const norm = safe
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        const typeHints: string[] = [];
        if (
          norm.includes('jatek') ||
          norm.includes('terulet') ||
          norm.includes('game_area') ||
          norm.includes('elhagy')
        ) {
          typeHints.push(`v.violationType = 'game_area_exit'`);
        }
        if (
          norm.includes('jarmu') ||
          norm.includes('vehicle') ||
          norm.includes('hasznalat') ||
          norm.includes('limit') ||
          norm.includes('40 perc')
        ) {
          typeHints.push(`v.violationType = 'vehicle_time_exceeded'`);
        }
        const hintSql = typeHints.length ? ` OR (${typeHints.join(' OR ')})` : '';
        qb.andWhere(
          '(v.description ILIKE :like OR CAST(v.pairId AS text) ILIKE :like OR pair.name ILIKE :like OR CAST(pair.assignedNumber AS text) ILIKE :like OR v.violationType ILIKE :like' +
            hintSql +
            ')',
          { like },
        );
      }
    }

    const sortMap: Record<string, string> = {
      createdAt: 'v.createdAt',
      resolvedAt: 'v.resolvedAt',
      pairNumber: 'pair.assignedNumber',
      pairName: 'pair.name',
      violationType: 'v.violationType',
      description: 'v.description',
      resolved: 'v.resolved',
      id: 'v.id',
    };
    const col = sortMap[sortBy] || 'v.createdAt';

    const idTie = sortDir;
    if (sortBy === 'pairNumber' || sortBy === 'pairName') {
      qb.orderBy(col, sortDir);
      qb.addOrderBy('v.id', idTie);
    } else if (sortBy === 'resolvedAt') {
      qb.orderBy('v.resolvedAt', sortDir);
      qb.addOrderBy('v.id', idTie);
    } else if (sortBy === 'id') {
      qb.orderBy('v.id', sortDir);
    } else {
      qb.orderBy(col, sortDir);
      qb.addOrderBy('v.id', idTie);
    }

    const total = await qb.clone().getCount();
    const rows = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    const pairIds = Array.from(new Set(rows.map((r) => r.pairId)));
    const pairs = pairIds.length ? await this.pairRepository.findBy({ id: In(pairIds) }) : [];
    const pairMap = new Map(pairs.map((p) => [p.id, p]));

    const mwRows = await this.mwFlagRepository.find({
      where: { active: true },
      select: ['pairId'],
    });
    const mwSet = new Set(mwRows.map((m) => m.pairId));

    const [statsTotal, statsActive, statsResolved] = await Promise.all([
      this.ruleViolationRepository.count(),
      this.ruleViolationRepository.count({ where: { resolved: false } }),
      this.ruleViolationRepository.count({ where: { resolved: true } }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      violations: rows.map((v) => {
        const pair = pairMap.get(v.pairId);
        const created = v.createdAt ? new Date(v.createdAt as Date) : null;
        const resolvedAt = v.resolvedAt ? new Date(v.resolvedAt as Date) : null;
        return {
          id: v.id,
          pairId: v.pairId,
          assignedNumber: pair?.assignedNumber ?? null,
          pairName: pair?.name ?? null,
          pairMostWanted: mwSet.has(v.pairId),
          violationType: v.violationType,
          description: v.description ?? null,
          createdAt: created ? created.toISOString() : null,
          resolved: v.resolved,
          resolvedAt: resolvedAt ? resolvedAt.toISOString() : null,
        };
      }),
      total,
      page,
      pageSize,
      totalPages,
      stats: { total: statsTotal, active: statsActive, resolved: statsResolved },
    };
  }

  async deleteViolationById(id: number): Promise<boolean> {
    const row = await this.ruleViolationRepository.findOne({ where: { id } });
    if (!row || !row.resolved) {
      return false;
    }
    const res = await this.ruleViolationRepository.delete({ id });
    return (res.affected ?? 0) > 0;
  }

  async checkViolations(
    pairId: number,
    position: PositionSnapshot,
  ): Promise<{ violations: RuleViolation[]; gameAreaExitViolationActive: boolean }> {
    const violations: RuleViolation[] = [];
    let gameAreaExitViolationActive = false;

    // Check game area exit
    const gameAreaGeofences = await this.redisGeofenceCache.getActiveGameAreaGeofences();

    if (gameAreaGeofences.length > 0) {
      const lat = Number(position.lat);
      const lon = Number(position.lon);
      const isInsideGameArea = gameAreaGeofences.some((geofence) =>
        this.isInsideGameAreaGeofence(lat, lon, geofence),
      );

      gameAreaExitViolationActive = !isInsideGameArea;

      if (!isInsideGameArea) {
        // Check if violation already exists and is not resolved
        const existingViolation = await this.ruleViolationRepository.findOne({
          where: {
            pairId,
            violationType: 'game_area_exit',
            resolved: false,
          },
        });

        if (!existingViolation) {
          const violation = this.ruleViolationRepository.create({
            pairId,
            violationType: 'game_area_exit',
            description: 'Pár kilépett a játéktérből',
            resolved: false,
          });

          const savedViolation = await this.ruleViolationRepository.save(violation);
          violations.push(savedViolation);

          // Broadcast — createdAt a DB-ből (azonos pillanat, mint a rekord), ISO UTC
          const createdIso = savedViolation.createdAt
            ? new Date(savedViolation.createdAt).toISOString()
            : new Date().toISOString();
          this.webSocketGateway.broadcastRuleViolation({
            pairId,
            violationType: 'game_area_exit',
            description: 'Pár kilépett a játéktérből',
            continuousMode: true,
            resolved: false,
            timestamp: createdIso,
            createdAt: createdIso,
          });

          // Push — tegező (Android / mobil)
          await this.fcmService.sendToPair(pairId, {
            title: 'Szabálysértés',
            body: 'Kiléptetek a játéktérből. Az üldözők folyamatosan látnak titeket a térképen.',
          });
        }
      } else {
        // Resolve existing violation if back in game area
        const existingViolation = await this.ruleViolationRepository.findOne({
          where: {
            pairId,
            violationType: 'game_area_exit',
            resolved: false,
          },
        });

        if (existingViolation) {
          // Nem mentünk positions sort visszatéréskor: a tábla csak az időzítő szerinti mintákat tartja.

          await this.ruleViolationRepository.update(
            {
              pairId,
              violationType: 'game_area_exit',
              resolved: false,
            },
            { resolved: true, resolvedAt: new Date() },
          );

          // Notify frontend to stop active warning
          this.webSocketGateway.broadcastRuleViolation({
            pairId,
            violationType: 'game_area_exit',
            description: 'A pár visszatért a játéktérre',
            continuousMode: false,
            resolved: true,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });

          const pair = await this.pairRepository.findOne({ where: { id: pairId } });
          const pairShort =
            pair != null
              ? `${pair.assignedNumber}. pár${pair.name ? ` (${pair.name})` : ''}`
              : 'Egy pár';

          await this.fcmService.sendToPair(pairId, {
            title: 'Szabályszegés megszűnt',
            body: 'Újra a játékterületen vagytok. A pozíciótok ismét a szokásos módon frissül a térképen.',
          });

          await this.fcmService.sendToAllPairsExceptPair(pairId, {
            title: 'Szabályszegés megszűnt',
            body: `A(z) ${pairShort} visszatért a játékterületre — megszűnt a folyamatos követés.`,
          });
        }
      }
    }

    // Check vehicle time limit violations
    if (position.vehicleMode && position.vehicleSessionRemaining !== null) {
      if (position.vehicleSessionRemaining <= 0) {
        const existingViolation = await this.ruleViolationRepository.findOne({
          where: {
            pairId,
            violationType: 'vehicle_time_exceeded',
            resolved: false,
          },
        });

        if (!existingViolation) {
          const violation = this.ruleViolationRepository.create({
            pairId,
            violationType: 'vehicle_time_exceeded',
            description: 'Járműhasználati idő limit túllépve (40 perc)',
            resolved: false,
          });

          const savedViolation = await this.ruleViolationRepository.save(violation);
          violations.push(savedViolation);

          this.webSocketGateway.broadcastRuleViolation({
            pairId,
            violationType: 'vehicle_time_exceeded',
            description: 'Járműhasználati idő limit túllépve',
            continuousMode: true,
            timestamp: new Date().toISOString(),
          });

          // Send push notification
          await this.fcmService.sendToPair(pairId, {
            title: 'Szabálysértés',
            body: 'Lejárt a 40 perces járműhasználati időtök!',
          });
        }
      }
    }


    // Check geofence completions (scenarios)
    await this.checkGeofenceCompletions(pairId, position);

    return { violations, gameAreaExitViolationActive };
  }

  private async checkGeofenceCompletions(pairId: number, position: PositionSnapshot) {
    const activeGeofences = await this.redisGeofenceCache.getActiveScenarioGeofences();

    for (const geofence of activeGeofences) {
      // Check if already completed
      const existing = await this.geofenceCompletionRepository.findOne({
        where: { geofenceId: geofence.id, pairId },
      });

      if (existing) continue;

      // Check if within geofence
      const isInside = this.isPointInCircle(
        Number(position.lat),
        Number(position.lon),
        parseFloat(geofence.centerLat.toString()),
        parseFloat(geofence.centerLon.toString()),
        geofence.radiusM,
      );

      if (isInside) {
        // Check time window if specified
        const now = new Date();
        if (geofence.activeFrom && now < geofence.activeFrom) continue;
        if (geofence.activeUntil && now > geofence.activeUntil) continue;

        // Create completion
        const completion = this.geofenceCompletionRepository.create({
          geofenceId: geofence.id,
          pairId,
        });
        await this.geofenceCompletionRepository.save(completion);

        // Broadcast completion
        this.webSocketGateway.broadcastGeofenceAlert({
          type: 'completion',
          geofenceId: geofence.id,
          geofenceName: geofence.name,
          pairId,
          timestamp: new Date().toISOString(),
        });

        // Send push notification
        await this.fcmService.sendToPair(pairId, {
          title: 'Feladat teljesítve!',
          body: `Sikeresen teljesítetted: ${geofence.name}`,
        });
      }
    }
  }

  private isPointInCircle(
    lat: number,
    lon: number,
    centerLat: number,
    centerLon: number,
    radiusM: number,
  ): boolean {
    const distance = this.calculateDistance(lat, lon, centerLat, centerLon);
    return distance <= radiusM;
  }

  private isInsideGameAreaGeofence(lat: number, lon: number, geofence: Geofence): boolean {
    const polygon = geofence?.metadataJson?.polygon;
    if (Array.isArray(polygon) && polygon.length >= 3) {
      return this.isPointInPolygon(lat, lon, polygon);
    }

    return this.isPointInCircle(
      lat,
      lon,
      parseFloat(geofence.centerLat.toString()),
      parseFloat(geofence.centerLon.toString()),
      geofence.radiusM,
    );
  }

  private isPointInPolygon(lat: number, lon: number, polygon: number[][]): boolean {
    // polygon format: [[lon, lat], [lon, lat], ...]
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = Number(polygon[i][0]);
      const yi = Number(polygon[i][1]);
      const xj = Number(polygon[j][0]);
      const yj = Number(polygon[j][1]);

      const intersects =
        yi > lat !== yj > lat &&
        lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;

      if (intersects) inside = !inside;
    }

    return inside;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

