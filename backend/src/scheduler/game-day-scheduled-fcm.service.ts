import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameSettings } from '../entities/game-settings.entity';
import { GameDaysService } from '../game-days/game-days.service';
import { FcmService } from '../fcm/fcm.service';
import { gameScheduleTimeZone, hmInGameTimeZone, minuteOfDayInGameTimeZone } from '../common/game-schedule-wall-clock';
import {
  clockToMinutes,
  collectUniqueBoundaryHm,
  isMinutesWithinSemiOpenWindow,
  normalizeClockHm,
  parseGameDayMinutesRange,
  resolveIntervalMinutes,
  subtractOneMinuteFromClockHm,
  transitionSummaryHu,
} from '../common/scheduled-game-push.util';

const PRELUDE_OFFSETS = [
  { offsetMin: 180, hu: '3 órával az érvénybe lépés előtt' },
  { offsetMin: 120, hu: '2 órával az érvénybe lépés előtt' },
  { offsetMin: 60, hu: '1 órával az érvénybe lépés előtt' },
  { offsetMin: 30, hu: '30 perccel az érvénybe lépés előtt' },
  { offsetMin: 15, hu: '15 perccel az érvénybe lépés előtt' },
] as const;

@Injectable()
export class GameDayScheduledFcmService {
  constructor(
    @InjectRepository(GameSettings)
    private readonly gameSettingsRepository: Repository<GameSettings>,
    private readonly gameDaysService: GameDaysService,
    private readonly fcmService: FcmService,
  ) {}

  /**
   * A játékmotor tick() után hívjuk (percenként): játéknap indulás és ütemezett szabályváltozások FCM-je.
   */
  async runMinute(now: Date): Promise<void> {
    const rows = await this.gameSettingsRepository.find({
      order: { id: 'ASC' },
    });
    let settings = rows[0];
    if (!settings) {
      settings = this.gameSettingsRepository.create({
        gameEnabled: false,
        locationUpdateIntervalMinutes: 20,
        stayRuleEnabled: false,
        stayRadiusKm: 5,
      });
      settings = await this.gameSettingsRepository.save(settings);
    } else if (rows.length > 1) {
      const duplicateIds = rows.slice(1).map((r) => r.id);
      if (duplicateIds.length > 0) {
        await this.gameSettingsRepository.delete(duplicateIds);
      }
    }

    if (settings.gameEnabled !== true) return;

    if (await this.gameDaysService.isPastEndOfLastScheduledGameDay(now)) return;

    const gd = await this.gameDaysService.findToday();
    if (!gd) return;

    const rng = parseGameDayMinutesRange(gd.startTime, gd.endTime);
    if (!rng) return;

    const fb = Math.max(1, Math.floor(Number(settings.locationUpdateIntervalMinutes) || 1));
    const tz = gameScheduleTimeZone();
    const curHm = hmInGameTimeZone(now, tz);
    const curTot = minuteOfDayInGameTimeZone(now, tz);
    const inside = isMinutesWithinSemiOpenWindow(curTot, rng.startMinutes, rng.endMinutes);
    const sr = gd.specialRulesJson;
    const startHm = normalizeClockHm(gd.startTime);
    if (!startHm) return;

    const boundaries = collectUniqueBoundaryHm(sr);

    const title = 'Célkereszt';

    if (inside && curHm === startHm) {
      const ivAtStart = resolveIntervalMinutes(sr, curHm, fb);
      let body = `A mai játéknap elindult. Az üldözök először körülbelül ${ivAtStart} perc múlva kaphatnak pozíciót (a jelenlegi helyzetfrissítési beállítás szerint).`;
      const startDeltas = transitionSummaryHu(sr, fb, null, startHm);
      if (startDeltas.length > 0) {
        body += `\n\nEkkortól érvényes ütemezett változások:\n${startDeltas.join('\n')}`;
      }
      void this.fcmService
        .sendBroadcastToAllStoredDevices({
          title,
          body,
          data: { type: 'game_day_started' },
        })
        .catch(() => undefined);
    }

    if (!inside) return;

    const preludeSections: string[] = [];
    for (const B of boundaries) {
      const bN = normalizeClockHm(B);
      if (!bN || bN === startHm) continue;

      const bm = clockToMinutes(bN);
      if (bm == null) continue;

      const leftHm = subtractOneMinuteFromClockHm(bN);
      const deltasPre = transitionSummaryHu(sr, fb, leftHm, bN);
      if (deltasPre.length === 0) continue;

      for (const po of PRELUDE_OFFSETS) {
        if (bm < po.offsetMin) continue;
        const pm = bm - po.offsetMin;
        if (pm < rng.startMinutes || pm >= rng.endMinutes) continue;
        if (pm !== curTot) continue;
        preludeSections.push(
          `${po.hu} (**${bN}** órakor lép életbe):\n${deltasPre.join('\n')}`,
        );
      }
    }

    if (preludeSections.length > 0) {
      void this.fcmService
        .sendBroadcastToAllStoredDevices({
          title,
          body: preludeSections.join('\n\n———\n\n'),
          data: { type: 'scheduled_change_prelude' },
        })
        .catch(() => undefined);
    }

    const actChunks: string[] = [];
    for (const B of boundaries) {
      const bN = normalizeClockHm(B);
      if (!bN || curHm !== bN) continue;
      if (bN === startHm) continue;

      const leftHm = subtractOneMinuteFromClockHm(bN);
      const d = transitionSummaryHu(sr, fb, leftHm, bN);
      if (d.length === 0) continue;
      actChunks.push(`**${bN}** órakor életbe lépett ütemezés:\n${d.join('\n')}`);
    }

    if (actChunks.length > 0) {
      void this.fcmService
        .sendBroadcastToAllStoredDevices({
          title,
          body: actChunks.join('\n\n———\n\n'),
          data: { type: 'scheduled_change_applied' },
        })
        .catch(() => undefined);
    }
  }

}
