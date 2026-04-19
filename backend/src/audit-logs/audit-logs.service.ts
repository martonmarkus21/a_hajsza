import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { QueryAdminAuditLogsDto } from './dto/query-admin-audit-logs.dto';
import type { AuditRequestMeta } from '../common/audit-request.util';

export interface AuditLogData {
  userId?: number;
  actionType: string;
  entityType?: string;
  entityId?: number;
  dataJson?: any;
  ipAddress?: string;
  userAgent?: string;
}

function parseOptionalDateInput(raw?: string): Date | undefined {
  if (raw == null || String(raw).trim() === '') return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function csvEscape(value: unknown): string {
  const s = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  const needs = /[",\r\n]/.test(s);
  const doubled = s.replace(/"/g, '""');
  return needs ? `"${doubled}"` : doubled;
}

const EXPORT_MAX_ROWS = 8000;
const DELETE_CHUNK = 2000;

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(data: AuditLogData) {
    const auditLog = this.auditLogRepository.create({
      userId: data.userId,
      actionType: data.actionType,
      entityType: data.entityType,
      entityId: data.entityId,
      dataJson: data.dataJson,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });

    await this.auditLogRepository.save(auditLog);
    return auditLog;
  }

  /** Szűrő legördülőkhöz + összes sor száma az adatbázisban. */
  async listFilterMeta(): Promise<{
    actionTypes: string[];
    entityTypes: string[];
    totalRecords: number;
  }> {
    const totalRecords = await this.auditLogRepository.count();
    const atRows = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('DISTINCT log.actionType', 'v')
      .orderBy('log.actionType', 'ASC')
      .getRawMany<{ v: string }>();
    const etRows = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('DISTINCT log.entityType', 'v')
      .where('log.entityType IS NOT NULL')
      .andWhere("TRIM(log.entityType) != ''")
      .orderBy('log.entityType', 'ASC')
      .getRawMany<{ v: string }>();
    return {
      actionTypes: atRows.map((r) => r.v).filter(Boolean),
      entityTypes: etRows.map((r) => r.v).filter(Boolean),
      totalRecords,
    };
  }

  private validateDateRange(query: QueryAdminAuditLogsDto) {
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
    return { from, to };
  }

  /** Közös WHERE feltételek (user join: csak szűréshez, nem tölti be a teljes user entitást). */
  private applyListFilters(qb: SelectQueryBuilder<AuditLog>, query: QueryAdminAuditLogsDto): void {
    const { from, to } = this.validateDateRange(query);

    if (query.userId != null) {
      qb.andWhere('log.userId = :userId', { userId: query.userId });
    }

    const at = query.actionType?.trim();
    if (at && at !== 'all') {
      qb.andWhere('log.actionType = :actionType', { actionType: at });
    }

    const et = query.entityType?.trim();
    if (et && et !== 'all') {
      qb.andWhere('log.entityType = :entityType', { entityType: et });
    }

    if (from) {
      qb.andWhere('log.timestamp >= :from', { from });
    }
    if (to) {
      qb.andWhere('log.timestamp <= :to', { to });
    }

    const q = query.q?.trim();
    if (q) {
      const pat = `%${q}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('log.ipAddress ILIKE :pat', { pat })
            .orWhere('log.userAgent ILIKE :pat', { pat })
            .orWhere('CAST(log.dataJson AS TEXT) ILIKE :pat', { pat })
            .orWhere('user.username ILIKE :pat', { pat });
        }),
      );
    }
  }

  private buildFilteredQuery(query: QueryAdminAuditLogsDto): SelectQueryBuilder<AuditLog> {
    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user');
    this.applyListFilters(qb, query);
    return qb;
  }

  /** Csak ID-k lekérdezéséhez / törléshez (könnyebb chunk-olás). */
  private buildFilteredIdQuery(query: QueryAdminAuditLogsDto): SelectQueryBuilder<AuditLog> {
    const qb = this.auditLogRepository.createQueryBuilder('log').leftJoin('log.user', 'user');
    this.applyListFilters(qb, query);
    return qb;
  }

  private applySort(qb: SelectQueryBuilder<AuditLog>, query: QueryAdminAuditLogsDto) {
    const sortBy = query.sortBy ?? 'timestamp';
    const sortDir = (query.sortDir ?? 'desc').toUpperCase() as 'ASC' | 'DESC';

    const col =
      sortBy === 'id'
        ? 'log.id'
        : sortBy === 'actionType'
          ? 'log.actionType'
          : sortBy === 'username'
            ? 'user.username'
            : sortBy === 'entityType'
              ? 'log.entityType'
              : sortBy === 'entityId'
                ? 'log.entityId'
                : sortBy === 'ipAddress'
                  ? 'log.ipAddress'
                  : 'log.timestamp';

    qb.orderBy(col, sortDir);
    if (sortBy !== 'id') {
      qb.addOrderBy('log.id', 'DESC');
    }
  }

  private mapRow(log: AuditLog) {
    return {
      id: log.id,
      userId: log.userId ?? null,
      username: log.user?.username ?? null,
      actionType: log.actionType,
      entityType: log.entityType ?? null,
      entityId: log.entityId ?? null,
      dataJson: log.dataJson ?? null,
      ipAddress: log.ipAddress ?? null,
      userAgent: log.userAgent ?? null,
      timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : String(log.timestamp),
    };
  }

  private filterSnapshot(query: QueryAdminAuditLogsDto) {
    return {
      userId: query.userId ?? null,
      actionType: query.actionType ?? null,
      entityType: query.entityType ?? null,
      q: query.q?.trim() || null,
      from: query.from ?? null,
      to: query.to ?? null,
    };
  }

  /** Admin: audit sorok lapozva, szűrhető. */
  async listForAdmin(query: QueryAdminAuditLogsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const qb = this.buildFilteredQuery(query);
    this.applySort(qb, query);
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [rows, total] = await qb.getManyAndCount();
    const items = rows.map((log) => this.mapRow(log));

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  /** Admin: CSV export (legfeljebb EXPORT_MAX_ROWS sor, aktuális szűréssel és rendezéssel). */
  async exportCsvForAdmin(query: QueryAdminAuditLogsDto): Promise<string> {
    const qb = this.buildFilteredQuery(query);
    this.applySort(qb, query);
    qb.take(EXPORT_MAX_ROWS);

    const rows = await qb.getMany();
    const header = [
      'id',
      'timestamp',
      'userId',
      'username',
      'actionType',
      'entityType',
      'entityId',
      'ipAddress',
      'userAgent',
      'dataJson',
    ].join(',');

    const lines = rows.map((log) => {
      const m = this.mapRow(log);
      let dataStr = '';
      try {
        dataStr = m.dataJson == null ? '' : JSON.stringify(m.dataJson);
      } catch {
        dataStr = String(m.dataJson);
      }
      return [
        csvEscape(m.id),
        csvEscape(m.timestamp),
        csvEscape(m.userId),
        csvEscape(m.username),
        csvEscape(m.actionType),
        csvEscape(m.entityType),
        csvEscape(m.entityId),
        csvEscape(m.ipAddress),
        csvEscape(m.userAgent),
        csvEscape(dataStr),
      ].join(',');
    });

    return '\uFEFF' + [header, ...lines].join('\r\n');
  }

  /**
   * Admin: egy naplósor törlése.
   * Ha a törölt sor maga is `audit_log_delete` típusú volt, nem hozunk létre új naplóbejegyzést
   * (különben nem lenne tiszta a napló).
   */
  async deleteByIdForAdmin(
    id: number,
    actorUserId: number | undefined,
    audit?: AuditRequestMeta,
  ): Promise<{ deleted: true }> {
    const row = await this.auditLogRepository.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('A naplóbejegyzés nem található.');
    }

    const skipAuditTrail = row.actionType === 'audit_log_delete';

    await this.auditLogRepository.delete({ id });

    if (!skipAuditTrail) {
      await this.log({
        userId: actorUserId,
        actionType: 'audit_log_delete',
        entityType: 'audit_log',
        entityId: id,
        dataJson: {
          deletedActionType: row.actionType,
          deletedEntityType: row.entityType,
          deletedEntityId: row.entityId,
        },
        ...audit,
      });
    }

    return { deleted: true };
  }

  /** Admin: a szűrőnek megfelelő összes sor törlése (chunk-olva). */
  async deleteMatchingForAdmin(
    query: QueryAdminAuditLogsDto,
    actorUserId: number | undefined,
    audit?: AuditRequestMeta,
  ): Promise<{ deleted: number }> {
    let deleted = 0;
    while (true) {
      const qb = this.buildFilteredIdQuery(query);
      qb.select('log.id').orderBy('log.id', 'ASC').take(DELETE_CHUNK);
      const chunk = await qb.getMany();
      if (chunk.length === 0) break;
      await this.auditLogRepository.delete(chunk.map((c) => c.id));
      deleted += chunk.length;
      if (chunk.length < DELETE_CHUNK) break;
    }

    if (deleted > 0 && actorUserId != null) {
      await this.log({
        userId: actorUserId,
        actionType: 'audit_log_bulk_delete',
        entityType: 'audit_log',
        dataJson: {
          scope: 'filtered',
          deleted,
          filters: this.filterSnapshot(query),
        },
        ...audit,
      });
    }

    return { deleted };
  }

  /** Admin: teljes naplótábla ürítése. */
  async deleteAllForAdmin(
    actorUserId: number | undefined,
    audit?: AuditRequestMeta,
  ): Promise<{ deleted: number }> {
    const res = await this.auditLogRepository.createQueryBuilder().delete().from(AuditLog).execute();
    const deleted = res.affected ?? 0;

    if (deleted > 0 && actorUserId != null) {
      await this.log({
        userId: actorUserId,
        actionType: 'audit_log_bulk_delete',
        entityType: 'audit_log',
        dataJson: { scope: 'all', deleted },
        ...audit,
      });
    }

    return { deleted };
  }
}
