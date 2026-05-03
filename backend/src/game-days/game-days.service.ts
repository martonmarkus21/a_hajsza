import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameDay } from '../entities/game-day.entity';
import { CreateGameDayDto } from './dto/create-game-day.dto';
import { UpdateGameDayDto } from './dto/update-game-day.dto';
import {
  calendarYmdFromDbDateOnly,
  calendarYmdInGameTimeZone,
  hmInGameTimeZone,
  minuteOfDayInGameTimeZone,
  utcInstantFromWallCalendar,
} from '../common/game-schedule-wall-clock';
import { clockToMinutes, normalizeClockHm } from '../common/scheduled-game-push.util';

const LAST_SCHEDULED_END_CACHE_MS = 15_000;

@Injectable()
export class GameDaysService {
  private lastScheduledDayEndCache: { expiresAtMs: number; value: Date | null } | null = null;

  constructor(
    @InjectRepository(GameDay)
    private gameDayRepository: Repository<GameDay>,
  ) {}

  private invalidateLastScheduledDayEndCache(): void {
    this.lastScheduledDayEndCache = null;
  }

  async findAll() {
    return await this.gameDayRepository.find({
      order: { date: 'DESC' },
    });
  }

  async findToday(): Promise<GameDay | null> {
    const todayStr = calendarYmdInGameTimeZone(new Date());
    return await this.gameDayRepository
      .createQueryBuilder('gameDay')
      .where('DATE(gameDay.date) = :date', { date: todayStr })
      .getOne();
  }

  async create(createGameDayDto: CreateGameDayDto) {
    const normalizedStartTime = this.normalizeTimeToHm(createGameDayDto.startTime);
    const normalizedEndTime = this.normalizeTimeToHm(createGameDayDto.endTime);
    this.validateTimeRange(normalizedStartTime, normalizedEndTime);
    this.validateSpecialRules(createGameDayDto.specialRules);

    const dateKey = createGameDayDto.date;
    const existing = await this.gameDayRepository
      .createQueryBuilder('gameDay')
      .where('DATE(gameDay.date) = :date', { date: dateKey })
      .getOne();
    if (existing) {
      throw new BadRequestException('Erre a napra már létezik játéknap beállítás.');
    }

    const gameDay = this.gameDayRepository.create({
      date: new Date(createGameDayDto.date),
      startTime: normalizedStartTime,
      endTime: normalizedEndTime,
      specialRulesJson: createGameDayDto.specialRules,
    });

    const saved = await this.gameDayRepository.save(gameDay);
    this.invalidateLastScheduledDayEndCache();
    return saved;
  }

  async update(id: number, dto: UpdateGameDayDto) {
    const gameDay = await this.gameDayRepository.findOne({ where: { id } });
    if (!gameDay) {
      return null;
    }

    const nextStart = this.normalizeTimeToHm(dto.startTime ?? gameDay.startTime);
    const nextEnd = this.normalizeTimeToHm(dto.endTime ?? gameDay.endTime);
    this.validateTimeRange(nextStart, nextEnd);
    this.validateSpecialRules(dto.specialRules ?? gameDay.specialRulesJson ?? {});

    if (dto.date !== undefined) {
      const existingSameDate = await this.gameDayRepository
        .createQueryBuilder('gameDay')
        .where('DATE(gameDay.date) = :date', { date: dto.date })
        .andWhere('gameDay.id != :id', { id })
        .getOne();
      if (existingSameDate) {
        throw new BadRequestException('Erre a napra már létezik játéknap beállítás.');
      }
    }

    if (dto.date !== undefined) {
      gameDay.date = new Date(dto.date);
    }
    if (dto.startTime !== undefined) {
      gameDay.startTime = this.normalizeTimeToHm(dto.startTime);
    }
    if (dto.endTime !== undefined) {
      gameDay.endTime = this.normalizeTimeToHm(dto.endTime);
    }
    if (dto.specialRules !== undefined) {
      gameDay.specialRulesJson = dto.specialRules;
    }

    const saved = await this.gameDayRepository.save(gameDay);
    this.invalidateLastScheduledDayEndCache();
    return saved;
  }

  async delete(id: number) {
    const row = await this.gameDayRepository.findOne({ where: { id } });
    if (!row) {
      return { success: false };
    }
    await this.gameDayRepository.remove(row);
    this.invalidateLastScheduledDayEndCache();
    return { success: true };
  }

  async isWithinTimeWindow(): Promise<boolean> {
    const gameDay = await this.findToday();
    if (!gameDay) return false;

    const now = new Date();
    const currentTime = hmInGameTimeZone(now);
    return currentTime >= gameDay.startTime && currentTime <= gameDay.endTime;
  }

  async isFinalDay(): Promise<boolean> {
    const gameDay = await this.findToday();
    return gameDay?.specialRulesJson?.isFinalDay === true;
  }

  /**
   * Legkésőbbi ütemezett játéknap (a naptár szerinti utolsó játéknap).
   */
  async findLatestScheduled(): Promise<GameDay | null> {
    return await this.gameDayRepository
      .createQueryBuilder('gameDay')
      .orderBy('gameDay.date', 'DESC')
      .getOne();
  }

  /** Mai naptári naptól vagy későbbi első beütemezett játéknap. */
  async findEarliestFromTodayOnward(): Promise<GameDay | null> {
    const ymd = calendarYmdInGameTimeZone(new Date());
    return await this.gameDayRepository
      .createQueryBuilder('g')
      .where('DATE(g.date) >= :ymd', { ymd })
      .orderBy('g.date', 'ASC')
      .addOrderBy('g.id', 'ASC')
      .getOne();
  }

  /** Egy adott naptári nap UTÁNI első ütemezett játéknap (másik naptári nap). */
  async findEarliestStrictlyAfterCalendarDate(dayDate: Date): Promise<GameDay | null> {
    const base = calendarYmdFromDbDateOnly(dayDate);
    const [yy, mm, dd] = base.split('-').map((s) => Number(s.trim()));
    const u = new Date(Date.UTC(yy, mm - 1, dd + 1));
    const ymd = `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, '0')}-${String(u.getUTCDate()).padStart(2, '0')}`;
    return await this.gameDayRepository
      .createQueryBuilder('g')
      .where('DATE(g.date) >= :ymd', { ymd })
      .orderBy('g.date', 'ASC')
      .addOrderBy('g.id', 'ASC')
      .getOne();
  }

  /**
   * A megadott naptári napnál korábbi, legsűrűbben ütemezett utolsó játéknap.
   */
  async findLatestStrictlyBeforeCalendarYmd(ymd: string): Promise<GameDay | null> {
    return await this.gameDayRepository
      .createQueryBuilder('g')
      .where('DATE(g.date) < :ymd', { ymd })
      .orderBy('g.date', 'DESC')
      .addOrderBy('g.id', 'DESC')
      .getOne();
  }

  /** Játéknap kezdőpillanata a naptár + startTime szerint (`APP_TIMEZONE`). */
  getLocalStartOfGameDay(gameDay: GameDay): Date {
    const ymd = calendarYmdFromDbDateOnly(gameDay.date);
    const hm = normalizeClockHm(gameDay.startTime) || '00:00';
    return utcInstantFromWallCalendar(ymd, hm);
  }

  /** `specialRulesJson.isFinalDay`: utolsó hivatalos játéknap (kampányvége előtti zárás). */
  isFinalScheduledGameDayRow(gameDay: GameDay): boolean {
    const v = gameDay?.specialRulesJson?.isFinalDay;
    return v === true;
  }

  /**
   * Maradási szabály: csak játszódnapok között (egy nap vége → következő nap közti kezdete között).
   * Játéknap aktív óráiban és az utolsó ütemezett nap lezárása után nem érvényes.
   */
  async getStayRuleEnforcementContext(now: Date = new Date()): Promise<{
    anchorGameDay: GameDay;
    anchorYmd: string;
  } | null> {
    if (await this.isPastEndOfLastScheduledGameDay(now)) {
      return null;
    }

    const nowMs = now.getTime();
    const gdToday = await this.findToday();
    const todayYmd = calendarYmdInGameTimeZone(now);

    if (gdToday) {
      // Ugyanaz a percbeli logika, mint az isWithinTimeWindow: a záró HH:mm percében még játék van.
      const nowMo = minuteOfDayInGameTimeZone(now);
      const startMo = clockToMinutes(normalizeClockHm(gdToday.startTime));
      const endMo = clockToMinutes(normalizeClockHm(gdToday.endTime));
      if (startMo == null || endMo == null) return null;

      if (nowMo >= startMo && nowMo <= endMo) {
        return null;
      }

      if (nowMo > endMo) {
        if (this.isFinalScheduledGameDayRow(gdToday)) return null;
        return {
          anchorGameDay: gdToday,
          anchorYmd: calendarYmdFromDbDateOnly(gdToday.date),
        };
      }

      // Reggel, a mai kezdés előtt: előző lezárt nap bázisához kötött maradás
      const prevGd = await this.findLatestStrictlyBeforeCalendarYmd(todayYmd);
      if (!prevGd || this.isFinalScheduledGameDayRow(prevGd)) return null;
      const startTodayMs = this.getLocalStartOfGameDay(gdToday).getTime();
      const prevEndMs = this.getLocalEndOfGameDay(prevGd).getTime();
      if (nowMs >= prevEndMs && nowMs < startTodayMs) {
        return {
          anchorGameDay: prevGd,
          anchorYmd: calendarYmdFromDbDateOnly(prevGd.date),
        };
      }
      return null;
    }

    const nextGd = await this.findEarliestFromTodayOnward();
    const prevGd = await this.findLatestStrictlyBeforeCalendarYmd(todayYmd);
    if (!nextGd || !prevGd || this.isFinalScheduledGameDayRow(prevGd)) return null;
    const nextStartMs = this.getLocalStartOfGameDay(nextGd).getTime();
    const prevEndMs = this.getLocalEndOfGameDay(prevGd).getTime();
    if (nowMs >= prevEndMs && nowMs < nextStartMs) {
      return {
        anchorGameDay: prevGd,
        anchorYmd: calendarYmdFromDbDateOnly(prevGd.date),
      };
    }

    return null;
  }

  ymdLocal(d: Date): string {
    return calendarYmdInGameTimeZone(d);
  }

  /**
   * Utolsó ütemezett játéknap záró pillanata: naptári `date` + `endTime` falióra (`APP_TIMEZONE`).
   */
  getLocalEndOfGameDay(gameDay: GameDay): Date {
    const ymd = calendarYmdFromDbDateOnly(gameDay.date);
    const hm = normalizeClockHm(gameDay.endTime) || '23:59';
    return utcInstantFromWallCalendar(ymd, hm);
  }

  /**
   * A legkésőbbi játéknap (dátum szerint) záró időpontja; nincs játéknap → null.
   */
  async getEndOfLastScheduledGameDayAt(): Promise<Date | null> {
    const nowMs = Date.now();
    if (
      this.lastScheduledDayEndCache !== null &&
      nowMs < this.lastScheduledDayEndCache.expiresAtMs
    ) {
      return this.lastScheduledDayEndCache.value;
    }
    const last = await this.findLatestScheduled();
    const value = last ? this.getLocalEndOfGameDay(last) : null;
    this.lastScheduledDayEndCache = {
      expiresAtMs: nowMs + LAST_SCHEDULED_END_CACHE_MS,
      value,
    };
    return value;
  }

  /**
   * A játéknapok beütemezése lejárt: most már túl vagyunk az utolsó játéknapon megadott
   * zárási időn (FINISHED), nem kell a következő naptári napra várni.
   */
  async isPastEndOfLastScheduledGameDay(now: Date = new Date()): Promise<boolean> {
    const endAt = await this.getEndOfLastScheduledGameDayAt();
    if (!endAt) return false;
    return now.getTime() > endAt.getTime();
  }

  private validateTimeRange(start: string, end: string) {
    const s = this.toMinutes(start);
    const e = this.toMinutes(end);
    if (s == null || e == null) {
      throw new BadRequestException('Érvénytelen időformátum. Használj HH:mm formátumot.');
    }
    if (s >= e) {
      throw new BadRequestException('A kezdési időnek korábbinak kell lennie, mint a zárási idő.');
    }
  }

  private validateSpecialRules(specialRules: any) {
    if (!specialRules || typeof specialRules !== 'object') return;
    this.validateIntervalSchedule(specialRules.locationIntervalSchedule);
    this.validateAreaSchedule(specialRules.areaSchedule);
  }

  private validateIntervalSchedule(schedule: any) {
    if (!Array.isArray(schedule)) return;
    const rows = schedule
      .map((row: any) => ({
        from: this.toMinutes(row?.from),
        to: row?.to ? this.toMinutes(row.to) : null,
        intervalMinutes: Number(row?.intervalMinutes),
      }))
      .sort((a, b) => (a.from ?? 0) - (b.from ?? 0));

    for (const row of rows) {
      if (row.from == null) {
        throw new BadRequestException(
          'A helyzetfrissítési intervallum ütemezésben a „Mettől” időpont megadása kötelező (HH:mm).',
        );
      }
      if (!Number.isFinite(row.intervalMinutes) || row.intervalMinutes < 1) {
        throw new BadRequestException(
          'A helyzetfrissítési intervallum értéke legalább 1 perc kell legyen.',
        );
      }
      if (row.to != null && row.to <= row.from) {
        throw new BadRequestException(
          'A helyzetfrissítési intervallum ütemezésben a „Meddig” időpontnak a „Mettől” után kell lennie.',
        );
      }
    }

    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const current = rows[i];
      if (prev.to != null && current.from != null && current.from < prev.to) {
        throw new BadRequestException(
          'A helyzetfrissítési intervallum ütemezés sorai nem fedhetik át egymást.',
        );
      }
    }
  }

  private validateAreaSchedule(schedule: any) {
    if (!Array.isArray(schedule)) return;
    const fromSet = new Set<number>();
    for (const row of schedule) {
      const from = this.toMinutes(row?.from);
      if (from == null) {
        throw new BadRequestException(
          'A területi váltás ütemezésben a „Mettől” időpont megadása kötelező (HH:mm).',
        );
      }
      if (fromSet.has(from)) {
        throw new BadRequestException(
          'A területi váltás ütemezés sorai nem fedhetik át egymást.',
        );
      }
      fromSet.add(from);
      if (row?.activeCounties != null && !Array.isArray(row.activeCounties)) {
        throw new BadRequestException(
          'A területi váltás ütemezés activeCounties mezőjének tömb típusúnak kell lennie.',
        );
      }
      if (row?.activeRegions != null && !Array.isArray(row.activeRegions)) {
        throw new BadRequestException(
          'A területi váltás ütemezés activeRegions mezőjének tömb típusúnak kell lennie.',
        );
      }
      const countyCount = Array.isArray(row?.activeCounties) ? row.activeCounties.length : 0;
      const regionCount = Array.isArray(row?.activeRegions) ? row.activeRegions.length : 0;
      if (countyCount + regionCount === 0) {
        throw new BadRequestException(
          'Az area schedule soroknál legalább egy vármegye vagy egyéni zóna kiválasztása kötelező.',
        );
      }
    }
  }

  private toMinutes(value: string | undefined): number | null {
    if (!value || typeof value !== 'string') return null;
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = m[3] == null ? 0 : Number(m[3]);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null;
    return hh * 60 + mm;
  }

  private normalizeTimeToHm(value: string | undefined): string {
    const s = String(value ?? '').trim();
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
    if (!m) {
      throw new BadRequestException('Érvénytelen időformátum. Használj HH:mm formátumot.');
    }
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = m[3] == null ? 0 : Number(m[3]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) {
      throw new BadRequestException('Érvénytelen időformátum. Használj HH:mm formátumot.');
    }
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) {
      throw new BadRequestException('Érvénytelen időformátum. Használj HH:mm formátumot.');
    }
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

}

