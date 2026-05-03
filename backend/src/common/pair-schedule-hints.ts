import type { GameDay } from '../entities/game-day.entity';

export type PairScheduleInput = {
  gameEnabled: boolean;
  isGameActive: boolean;
  isPastLastScheduledGameEnd: boolean;
  campaignStatus: string | null;
  gameDay: GameDay | null;
  /** Következő naptári játéknap (ha van), ami még előttünk áll. */
  nextCalendarGameDay: GameDay | null;
  nowMs: number;
};

function hhmmAtOnDay(baseDate: Date, hhmm: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const d = new Date(baseDate);
  d.setHours(h, min, 0, 0);
  return d.getTime();
}

/**
 * Mobil / páros alkalmazásnak: rövid, természetes magyar sorok a naptár + motorállapot alapján.
 */
export function buildPairScheduleLines(input: PairScheduleInput): string[] {
  const lines: string[] = [];
  const {
    gameEnabled,
    isGameActive,
    isPastLastScheduledGameEnd,
    campaignStatus,
    gameDay,
    nextCalendarGameDay,
    nowMs,
  } = input;

  if (isPastLastScheduledGameEnd) {
    lines.push('A teljes kampány lezárult — több kötelező követési nap nincs ütemezve.');
    return lines;
  }

  if (!gameEnabled) {
    lines.push('A játékvezérlő jelenleg ki van kapcsolva — ehhez kapcsolt kötelező követés nincs.');
    return lines;
  }

  if (gameDay) {
    const d = new Date(gameDay.date);
    const dateLabel = d.toLocaleDateString('hu-HU', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    const final = !!(gameDay as any)?.specialRulesJson?.isFinalDay;

    lines.push(
      `${dateLabel} — játék időablaka (helyi idő szerint): ${gameDay.startTime}–${gameDay.endTime}${
        final ? ' • utolsó játéknap' : ''
      }`,
    );

    const startMs = hhmmAtOnDay(d, gameDay.startTime);
    const endMs = hhmmAtOnDay(d, gameDay.endTime);
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
      if (!isGameActive && nowMs < startMs && campaignStatus === 'PAUSED_BETWEEN_DAYS') {
        lines.push(`A mai játék még nem indult — ${gameDay.startTime} körül indul az ütem szerinti rész.`);

        if (
          nextCalendarGameDay &&
          nextCalendarGameDay.id !== gameDay.id &&
          new Date(nextCalendarGameDay.date).getTime() > new Date(gameDay.date).getTime()
        ) {
          const nd = new Date(nextCalendarGameDay.date).toLocaleDateString('hu-HU', {
            month: 'short',
            day: 'numeric',
          });
          lines.push(`Utána következő beütemezett nap: kb. ${nd} (${nextCalendarGameDay.startTime}–${nextCalendarGameDay.endTime}).`);
        }
      } else if (!isGameActive && nowMs >= endMs && campaignStatus === 'PAUSED_BETWEEN_DAYS') {
        lines.push('A mai nap beütemezett játékideje véget ért — most játéknapok közötti pihenő van.');
        if (nextCalendarGameDay) {
          const nd = new Date(nextCalendarGameDay.date).toLocaleDateString('hu-HU', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          });
          lines.push(
            `A következő beütemezett nap: ${nd}, ${nextCalendarGameDay.startTime}–${nextCalendarGameDay.endTime}.`,
          );
        }
      } else if (isGameActive) {
        lines.push('Most zajlik az élő követési nap — küldjetek helyzetjelentéseket a feladósáv szerint.');
      }
    }

    return lines;
  }

  lines.push('A mai napon nincs beütemezett játéknap a naptárban.');
  if (nextCalendarGameDay) {
    const nd = new Date(nextCalendarGameDay.date).toLocaleDateString('hu-HU', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    lines.push(`Következő beütemezett nap: ${nd}, ${nextCalendarGameDay.startTime}–${nextCalendarGameDay.endTime}.`);
  }

  return lines;
}
