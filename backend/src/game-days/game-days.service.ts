import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameDay } from '../entities/game-day.entity';
import { CreateGameDayDto } from './dto/create-game-day.dto';
import { UpdateGameDayDto } from './dto/update-game-day.dto';

@Injectable()
export class GameDaysService {
  constructor(
    @InjectRepository(GameDay)
    private gameDayRepository: Repository<GameDay>,
  ) {}

  async findAll() {
    return await this.gameDayRepository.find({
      order: { date: 'DESC' },
    });
  }

  async findToday(): Promise<GameDay | null> {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
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

    return await this.gameDayRepository.save(gameDay);
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

    return await this.gameDayRepository.save(gameDay);
  }

  async delete(id: number) {
    const row = await this.gameDayRepository.findOne({ where: { id } });
    if (!row) {
      return { success: false };
    }
    await this.gameDayRepository.remove(row);
    return { success: true };
  }

  async isWithinTimeWindow(): Promise<boolean> {
    const gameDay = await this.findToday();
    if (!gameDay) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
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

  ymdLocal(d: Date): string {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d
      .getDate()
      .toString()
      .padStart(2, '0')}`;
  }

  /**
   * Utolsó ütemezett játéknap záró pillanata: a naptári `date` + `endTime` a szerver helyi idejében
   * (ugyanúgy, mint a játékablak ellenőrzés).
   */
  getLocalEndOfGameDay(gameDay: GameDay): Date {
    return this.combineDateAndTimeLocal(new Date(gameDay.date), gameDay.endTime);
  }

  /**
   * A legkésőbbi játéknap (dátum szerint) záró időpontja; nincs játéknap → null.
   */
  async getEndOfLastScheduledGameDayAt(): Promise<Date | null> {
    const last = await this.findLatestScheduled();
    if (!last) return null;
    return this.getLocalEndOfGameDay(last);
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

  private combineDateAndTimeLocal(dayDate: Date, hhmm: string): Date {
    const normalized = this.normalizeTimeToHm(hhmm);
    const m = /^(\d{2}):(\d{2})$/.exec(normalized);
    const hh = m ? Math.min(23, Math.max(0, parseInt(m[1], 10))) : 0;
    const mm = m ? Math.min(59, Math.max(0, parseInt(m[2], 10))) : 0;
    const y = dayDate.getFullYear();
    const mo = dayDate.getMonth();
    const d = dayDate.getDate();
    return new Date(y, mo, d, hh, mm, 0, 0);
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

