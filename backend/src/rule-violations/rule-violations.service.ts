import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RuleViolation } from '../entities/rule-violation.entity';
import { Geofence } from '../entities/geofence.entity';
import { PositionSnapshot } from '../positions/position-snapshot';
import { RedisGeofenceCacheService } from '../redis/redis-geofence-cache.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { GameDaysService } from '../game-days/game-days.service';
import { FcmService } from '../fcm/fcm.service';
import { Pair } from '../entities/pair.entity';
import { CkFlag } from '../entities/ck-flag.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditRequestMeta } from '../common/audit-request.util';
import { RedisPositionService } from '../redis/redis-position.service';
import { RedisStayRuleService } from '../redis/redis-stay-rule.service';

@Injectable()
export class RuleViolationsService {
  constructor(
    @InjectRepository(RuleViolation)
    private ruleViolationRepository: Repository<RuleViolation>,
    private redisGeofenceCache: RedisGeofenceCacheService,
    @InjectRepository(Pair)
    private pairRepository: Repository<Pair>,
    @InjectRepository(CkFlag)
    private ckFlagRepository: Repository<CkFlag>,
    private webSocketGateway: WebSocketGateway,
    private gameDaysService: GameDaysService,
    private fcmService: FcmService,
    private auditLogsService: AuditLogsService,
    private redisPositionService: RedisPositionService,
    private redisStayRuleService: RedisStayRuleService,
  ) {}

  /** Aktív, térképen „élő követéses” szabályszegések: játékterület elhagyása + jármű idő túllépés. */
  async getActiveGameAreaViolations() {
    const active = await this.ruleViolationRepository.find({
      where: {
        violationType: In(['game_area_exit', 'vehicle_time_exceeded']),
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
      pairCelkereszt: boolean;
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
        if (
          norm.includes('marad') ||
          norm.includes('stay') ||
          norm.includes('end_of_day') ||
          norm.includes('jateknap') ||
          norm.includes('kint')
        ) {
          typeHints.push(`v.violationType = 'end_of_day_stay'`);
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

    const ckRows = await this.ckFlagRepository.find({
      where: { active: true },
      select: ['pairId'],
    });
    const ckSet = new Set(ckRows.map((m) => m.pairId));

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
          pairCelkereszt: ckSet.has(v.pairId),
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

  async deleteViolationById(
    id: number,
    audit?: { userId?: number } & AuditRequestMeta,
  ): Promise<boolean> {
    const row = await this.ruleViolationRepository.findOne({ where: { id } });
    if (!row || !row.resolved) {
      return false;
    }
    const res = await this.ruleViolationRepository.delete({ id });
    const ok = (res.affected ?? 0) > 0;
    if (ok && audit?.userId != null) {
      await this.auditLogsService.log({
        userId: audit.userId,
        actionType: 'rule_violation_delete',
        entityType: 'rule_violation',
        entityId: id,
        dataJson: { pairId: row.pairId, violationType: row.violationType },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      });
    }
    return ok;
  }

  async checkViolations(
    pairId: number,
    position: PositionSnapshot,
    options: { applyGameRules?: boolean } = {},
  ): Promise<{ violations: RuleViolation[]; gameAreaExitViolationActive: boolean }> {
    const applyGameRules = options.applyGameRules !== false;
    if (!applyGameRules) {
      return { violations: [], gameAreaExitViolationActive: false };
    }

    const violations: RuleViolation[] = [];
    let gameAreaExitViolationActive = false;

    // Kilépés szabály: „játékterület” = aktív game_area ∪ aktív scenario (ugyanazzal a geo + időablak ellenőrzéssel).
    const [gameAreaGeofences, scenarioGeofences] = await Promise.all([
      this.redisGeofenceCache.getActiveGameAreaGeofences(),
      this.redisGeofenceCache.getActiveScenarioGeofences(),
    ]);
    const boundaryGeofences = [...gameAreaGeofences, ...scenarioGeofences];

    if (boundaryGeofences.length > 0) {
      const lat = Number(position.lat);
      const lon = Number(position.lon);
      const now = new Date();
      const isInsideGameArea = boundaryGeofences.some((geofence) =>
        this.isInsidePlayableBoundaryAt(lat, lon, geofence, now),
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
          const live = await this.redisPositionService.getLivePosition(pairId);
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
            lastLivePosition:
              live && Number.isFinite(live.lat) && Number.isFinite(live.lon)
                ? { lat: live.lat, lon: live.lon, timestamp: live.timestamp }
                : null,
          });

          await this.fcmService.sendToPair(pairId, {
            title: 'Szabályszegés megszűnt',
            body: 'Újra a játékterületen vagytok. A pozíciótok ismét a szokásos módon frissül a térképen.',
          });
        }
      }
    }

    // Check vehicle time limit violations (pozíció jelzi: lejárt a számláló)
    if (position.vehicleMode && position.vehicleSessionRemaining !== null && position.vehicleSessionRemaining <= 0) {
      const created = await this.createActiveVehicleTimeExceededIfAbsent(pairId);
      if (created) {
        violations.push(created);
      }
    }

    return { violations, gameAreaExitViolationActive };
  }

  /**
   * Ha a játéknap épp RUNNING fázisba került: olyan párok, akiknél a maradás miatti térképreveláció aktív
   * (következő nap első 30 perce) — egy központi toast a kezelőfelületnek.
   */
  async broadcastStayRevealMapToastIfActive(now: Date = new Date()): Promise<void> {
    const rows = await this.ruleViolationRepository.find({
      where: { violationType: 'end_of_day_stay', resolved: false },
      select: ['pairId'],
    });
    if (rows.length === 0) return;

    const revealPairIds: number[] = [];
    for (const r of rows) {
      if (await this.redisStayRuleService.isMapRevealActive(r.pairId, now)) {
        revealPairIds.push(r.pairId);
      }
    }
    if (revealPairIds.length === 0) return;

    const pairs = await this.pairRepository.find({
      where: { id: In(revealPairIds) },
      select: ['id', 'assignedNumber', 'name'],
    });
    const labelFor = (id: number): string => {
      const p = pairs.find((x) => x.id === id);
      if (!p) return `${id}. pár`;
      return `${p.assignedNumber ?? '?'}. pár${p.name ? ` (${p.name})` : ''}`;
    };

    const labels = revealPairIds.map(labelFor);
    let message: string;
    if (labels.length === 1) {
      message = `Maradási szabály miatt a(z) ${labels[0]} mozgása a következő 30 percben folyamatosan látható a térképen.`;
    } else {
      message = `Maradási szabály miatt a(z) ${labels.join(', ')} mozgása a következő 30 percben folyamatosan látható a térképen.`;
    }

    this.webSocketGateway.broadcastGlobalToast({ message, variant: 'info' });
  }

  /** Android: 40 perc letelt, kikapcsolták a jármű módot — szerver oldali szabályszegés (ha még nincs). */
  async ensureVehicleTimeoutFromApp(pairId: number): Promise<{ created: boolean }> {
    const row = await this.createActiveVehicleTimeExceededIfAbsent(pairId);
    return { created: row != null };
  }

  /**
   * Folyamatos térképes követés jármű túllépésnél: max. 15 perc után automatikusan lezárjuk
   * (mint a játékterület elhagyásánál a „folyamatos” ablak vége).
   */
  async resolveVehicleViolationsPastWindow(windowMs: number = 15 * 60 * 1000): Promise<void> {
    const cutoff = new Date(Date.now() - windowMs);
    const rows = await this.ruleViolationRepository.find({
      where: { violationType: 'vehicle_time_exceeded', resolved: false },
    });
    for (const v of rows) {
      const created = v.createdAt ? new Date(v.createdAt as Date) : null;
      if (!created || created.getTime() > cutoff.getTime()) continue;

      await this.ruleViolationRepository.update({ id: v.id }, { resolved: true, resolvedAt: new Date() });

      const live = await this.redisPositionService.getLivePosition(v.pairId);
      this.webSocketGateway.broadcastRuleViolation({
        pairId: v.pairId,
        violationType: 'vehicle_time_exceeded',
        description: 'A járműhasználati folyamatos követési időablak lejárt.',
        continuousMode: false,
        resolved: true,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        lastLivePosition:
          live && Number.isFinite(live.lat) && Number.isFinite(live.lon)
            ? { lat: live.lat, lon: live.lon, timestamp: live.timestamp }
            : null,
      });
    }
  }

  private async createActiveVehicleTimeExceededIfAbsent(pairId: number): Promise<RuleViolation | null> {
    const existingViolation = await this.ruleViolationRepository.findOne({
      where: {
        pairId,
        violationType: 'vehicle_time_exceeded',
        resolved: false,
      },
    });
    if (existingViolation) return null;

    const violation = this.ruleViolationRepository.create({
      pairId,
      violationType: 'vehicle_time_exceeded',
      description: 'Járműhasználati idő limit túllépve (40 perc)',
      resolved: false,
    });

    const savedViolation = await this.ruleViolationRepository.save(violation);
    const createdIso = savedViolation.createdAt
      ? new Date(savedViolation.createdAt as Date).toISOString()
      : new Date().toISOString();

    this.webSocketGateway.broadcastRuleViolation({
      pairId,
      violationType: 'vehicle_time_exceeded',
      description: 'Járműhasználati idő limit túllépve',
      continuousMode: true,
      resolved: false,
      timestamp: createdIso,
      createdAt: createdIso,
    });

    await this.fcmService.sendToPair(pairId, {
      title: 'Szabálysértés',
      body: 'Lejárt a 40 perces járműhasználati időtök!',
    });

    return savedViolation;
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

  /** `game_area_exit` határ: geometriában belül, és opcionális activeFrom / activeUntil között (mindkét geofence-típusra). */
  private isInsidePlayableBoundaryAt(
    lat: number,
    lon: number,
    geofence: Geofence,
    now: Date,
  ): boolean {
    if (geofence.activeFrom != null && now < geofence.activeFrom) return false;
    if (geofence.activeUntil != null && now > geofence.activeUntil)
      return false;
    return this.isInsideGameAreaGeofence(lat, lon, geofence);
  }

  private isPointInPolygon(
    lat: number,
    lon: number,
    polygon: number[][],
  ): boolean {
    // polygon format: [[lon, lat], [lon, lat], ...]
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = Number(polygon[i][0]);
      const yi = Number(polygon[i][1]);
      const xj = Number(polygon[j][0]);
      const yj = Number(polygon[j][1]);

      const intersects =
        yi > lat !== yj > lat &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;

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

  /**
   * Elérték a maradási szabályban engedélyezett kinti időt — szabályszegés + opcionális térképreveláció a következő nap elején.
   */
  async finalizeStayRuleViolation(pairId: number, mapRevealUntil: Date | null): Promise<boolean> {
    const existing = await this.ruleViolationRepository.findOne({
      where: { pairId, violationType: 'end_of_day_stay', resolved: false },
    });
    if (existing) return false;

    const v = this.ruleViolationRepository.create({
      pairId,
      violationType: 'end_of_day_stay',
      description:
        'A játéknapok között a maradási körön kívül folyamatosan legalább 30 percig tartózkodtatok (megengedett kinti határidő túllépve).',
      resolved: false,
    });
    const saved = await this.ruleViolationRepository.save(v);

    if (mapRevealUntil != null && mapRevealUntil.getTime() > Date.now()) {
      await this.redisStayRuleService.setMapRevealUntil(pairId, mapRevealUntil);
    }

    const createdIso = saved.createdAt
      ? new Date(saved.createdAt as Date).toISOString()
      : new Date().toISOString();
    this.webSocketGateway.broadcastRuleViolation({
      pairId,
      violationType: 'end_of_day_stay',
      description: v.description,
      continuousMode: true,
      resolved: false,
      timestamp: createdIso,
      createdAt: createdIso,
    });

    await this.fcmService.sendToPair(pairId, {
      title: 'Maradási szabály — súlyosítás',
      body:
        'Túlléptétek a megengedett kinti időt. Következő játéknap kezdetétől 30 percig az üldözők folyamatosan látják a mozgásotokat a térképen.',
      data: { type: 'stay_rule_exit_violation', priority: 'high' },
    });

    return true;
  }

  /** Visszatértek a körön belülre — feloldjuk a nyitott maradás-sérülést (a térképreveláció változatlan marad és lejár). */
  async resolveUnresolvedEndOfDayStayViolationForPair(pairId: number): Promise<void> {
    const existing = await this.ruleViolationRepository.findOne({
      where: { pairId, violationType: 'end_of_day_stay', resolved: false },
    });
    if (!existing) return;
    await this.ruleViolationRepository.update(
      { id: existing.id },
      { resolved: true, resolvedAt: new Date() },
    );
    this.webSocketGateway.broadcastRuleViolation({
      pairId,
      violationType: 'end_of_day_stay',
      description: 'Újra a megengedett maradási körön belül vagytok.',
      continuousMode: false,
      resolved: true,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  }

  async resolveAllEndOfDayStayViolations(): Promise<void> {
    const rows = await this.ruleViolationRepository.find({
      where: { violationType: 'end_of_day_stay', resolved: false },
    });
    if (rows.length === 0) return;
    for (const r of rows) {
      await this.redisStayRuleService.clearMapReveal(r.pairId);
      await this.ruleViolationRepository.update(
        { id: r.id },
        { resolved: true, resolvedAt: new Date() },
      );
      this.webSocketGateway.broadcastRuleViolation({
        pairId: r.pairId,
        violationType: 'end_of_day_stay',
        description: 'A maradási ellenőrzés inaktív (ablakon kívül).',
        continuousMode: false,
        resolved: true,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
  }
}

