import { clockToMinutes, normalizeClockHm } from './scheduled-game-push.util';

/**
 * Admin/beállító által elvárt falióra (cron + HH:mm stringek), nem a Node process TZ-je.
 * Docker-ben gyakran UTC a process — így párosítsuk a játéknap időket IANA zónára.
 */
export function gameScheduleTimeZone(): string {
  const raw = process.env.APP_TIMEZONE || process.env.TZ;
  const z = typeof raw === 'string' ? raw.trim() : '';
  return z || 'Europe/Budapest';
}

/** TypeORM/pg `DATE` sor — naptári nap yyyy-mm-dd (UTC naptárkomponensek). */
export function calendarYmdFromDbDateOnly(value: Date | string): string {
  if (typeof value === 'string') return value.trim().slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

export function hmInGameTimeZone(now: Date, tz: string = gameScheduleTimeZone()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const ho = Number(parts.find((p) => p.type === 'hour')?.value ?? 'NaN');
  const mo = Number(parts.find((p) => p.type === 'minute')?.value ?? 'NaN');
  if (!Number.isFinite(ho) || !Number.isFinite(mo)) return '00:00';
  return `${String(ho).padStart(2, '0')}:${String(mo).padStart(2, '0')}`;
}

export function minuteOfDayInGameTimeZone(now: Date, tz?: string): number {
  const hm = hmInGameTimeZone(now, tz ?? gameScheduleTimeZone());
  const m = clockToMinutes(normalizeClockHm(hm));
  return m ?? 0;
}

export function calendarYmdInGameTimeZone(now: Date, tz?: string): string {
  const t = tz ?? gameScheduleTimeZone();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: t,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  return `${year}-${month}-${day}`;
}

/**
 * A megadott naptári nap + falió HH:mm pillanata az adott TZ-ben (UTC `Date`).
 */
export function utcInstantFromWallCalendar(
  calendarYmd: string,
  wallHm: string,
  tz: string = gameScheduleTimeZone(),
): Date {
  const wantMin = clockToMinutes(normalizeClockHm(wallHm));
  if (wantMin == null) {
    return new Date(`${calendarYmd}T12:00:00.000Z`);
  }
  const [ys, mos, ds] = calendarYmd.split('-').map((x) => Number(x.trim()));
  if (!Number.isFinite(ys) || !Number.isFinite(mos) || !Number.isFinite(ds)) {
    return new Date();
  }
  const baseUtc = Date.UTC(ys, mos - 1, ds, 0, 0, 0, 0);
  for (let k = -14 * 60; k <= 36 * 60; k += 1) {
    const t = new Date(baseUtc + k * 60 * 1000);
    if (calendarYmdInGameTimeZone(t, tz) !== calendarYmd) continue;
    if (minuteOfDayInGameTimeZone(t, tz) === wantMin) return t;
  }
  return new Date(baseUtc + 12 * 3600 * 1000);
}
