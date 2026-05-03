/**
 * Ütemezett játéknap (speciális szabályok) — FCM emlékeztetők és hatálylépés leírások.
 */

export type IntervalScheduleRow = {
  from: string;
  to?: string;
  intervalMinutes: number;
};

export type AreaScheduleRow = {
  from: string;
  activeCounties?: string[];
  activeRegions?: string[];
};

/** HH:mm lokálisan, páros számjeggyel */
export function normalizeClockHm(value: unknown): string {
  const s = String(value ?? '').trim();
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return '';
  const hh = Math.min(23, Math.max(0, Number(m[1])));
  const mm = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function clockToMinutes(clockHm: string): number | null {
  const normalized = normalizeClockHm(clockHm);
  const m = /^(\d{2}):(\d{2})$/.exec(normalized);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function minutesToClockHm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Egy perc visszalépés HH:mm-ban (napi teendőablak keretében). */
export function subtractOneMinuteFromClockHm(clockHm: string): string {
  const t = clockToMinutes(clockHm);
  if (t == null) return clockHm;
  return minutesToClockHm(t - 1);
}

export function parseGameDayMinutesRange(
  startHm: unknown,
  endHm: unknown,
): { startMinutes: number; endMinutes: number } | null {
  const ss = normalizeClockHm(startHm);
  const ee = normalizeClockHm(endHm);
  const sm = clockToMinutes(ss);
  const em = clockToMinutes(ee);
  if (sm == null || em == null || sm >= em) return null;
  return { startMinutes: sm, endMinutes: em };
}

/** [start,end) — végpont zárt a jelenlegi játéknap logikában (end perc kizáró). */
export function isMinutesWithinSemiOpenWindow(
  curMinutes: number,
  startMinutes: number,
  endMinutes: number,
): boolean {
  return curMinutes >= startMinutes && curMinutes < endMinutes;
}

/** Megjegyzés: a szerver process TZ-jét használja; production-ben inkább isMinutesWithinSemiOpenWindow + game-schedule-wall-clock. */
export function isNowWithinSemiOpenDayWindow(now: Date, startMinutes: number, endMinutes: number): boolean {
  const cur = now.getHours() * 60 + now.getMinutes();
  return isMinutesWithinSemiOpenWindow(cur, startMinutes, endMinutes);
}

export function resolveIntervalMinutes(
  specialRules: unknown,
  currentClockHm: string,
  fallbackInterval: number,
): number {
  const schedule = Array.isArray((specialRules as any)?.locationIntervalSchedule)
    ? ((specialRules as any).locationIntervalSchedule as IntervalScheduleRow[])
    : [];

  const clockNorm = normalizeClockHm(currentClockHm);
  const fb = Math.max(1, Math.floor(Number(fallbackInterval) || 1));

  for (const item of schedule) {
    if (!item?.from || !Number.isFinite(Number(item.intervalMinutes))) continue;
    const fromNorm = normalizeClockHm(item.from);
    const toNorm = item.to ? normalizeClockHm(item.to) : null;
    const inSlot =
      clockNorm.localeCompare(fromNorm) >= 0 && (toNorm == null ? true : clockNorm.localeCompare(toNorm) < 0);
    if (inSlot) {
      return Math.max(1, Math.floor(Number(item.intervalMinutes)));
    }
  }
  return fb;
}

export function collectUniqueBoundaryHm(specialRules: unknown): string[] {
  const out = new Set<string>();
  const si = Array.isArray((specialRules as any)?.locationIntervalSchedule)
    ? ((specialRules as any).locationIntervalSchedule as IntervalScheduleRow[])
    : [];
  for (const r of si) {
    const h = normalizeClockHm(r?.from);
    if (h) out.add(h);
  }
  const sa = Array.isArray((specialRules as any)?.areaSchedule)
    ? ((specialRules as any).areaSchedule as AreaScheduleRow[])
    : [];
  for (const r of sa) {
    const h = normalizeClockHm(r?.from);
    if (h) out.add(h);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

function scheduleAreaEffectiveRow(
  rows: AreaScheduleRow[],
  clockHmNorm: string,
): AreaScheduleRow | null {
  const active = rows
    .filter((s) => s?.from && normalizeClockHm(s.from) <= clockHmNorm)
    .sort((a, b) => normalizeClockHm(a.from).localeCompare(normalizeClockHm(b.from)));
  return active.length ? active.pop()! : null;
}

export type AreaBrief = string;

export function describeAreaRowHu(row: AreaScheduleRow): AreaBrief {
  const counties = row.activeCounties || [];
  const regions = row.activeRegions || [];
  const countyCount = counties.length;
  const regionCount = regions.length;
  const huOnly =
    countyCount === 1 && String(counties[0]).toLowerCase().replace(/á/g, 'a') === 'magyarorszag';

  const parts: string[] = [];
  if (huOnly) {
    parts.push('Magyarország');
  } else if (countyCount > 0) {
    parts.push(countyCount === 1 ? 'egy vármegye aktív' : `${countyCount} vármegye aktív`);
  }
  if (regionCount > 0) {
    parts.push(regionCount === 1 ? 'egy egyéni zóna aktív' : `${regionCount} egyéni zóna aktív`);
  }
  return parts.join(' · ') || 'útiterület visszaállítva';
}

export function transitionSummaryHu(
  specialRules: unknown,
  fallbackInterval: number,
  leftClockHmBeforeOrNull: string | null,
  rightClockHmBoundary: string,
): string[] {
  const lines: string[] = [];

  const ivBefore =
    leftClockHmBeforeOrNull === null
      ? Math.max(1, Math.floor(Number(fallbackInterval) || 1))
      : resolveIntervalMinutes(specialRules, leftClockHmBeforeOrNull, fallbackInterval);
  const ivAfter = resolveIntervalMinutes(specialRules, rightClockHmBoundary, fallbackInterval);
  if (ivBefore !== ivAfter) {
    lines.push(`Helyzetfrissítési számláló: ${ivBefore} perc → ${ivAfter} perc.`);
  }

  const sa = Array.isArray((specialRules as any)?.areaSchedule)
    ? ((specialRules as any).areaSchedule as AreaScheduleRow[])
    : [];
  if (sa.length === 0) return lines;

  const rightN = normalizeClockHm(rightClockHmBoundary);
  const rowAfter = scheduleAreaEffectiveRow(sa, rightN);
  let rowBefore: AreaScheduleRow | null = null;
  if (leftClockHmBeforeOrNull === null) {
    rowBefore = null;
  } else {
    const leftN = normalizeClockHm(leftClockHmBeforeOrNull);
    rowBefore = scheduleAreaEffectiveRow(sa, leftN);
  }

  const key = (x: AreaScheduleRow | null) =>
    `${(x?.activeCounties || []).join('|')}:${(x?.activeRegions || []).join('|')}`;
  if (key(rowBefore) !== key(rowAfter) && rowAfter) {
    lines.push(`Játéktér: ${describeAreaRowHu(rowAfter)}.`);
  } else if (key(rowBefore) !== key(rowAfter) && !rowAfter) {
    lines.push('Játéktér-váltás (ütemezés).');
  }

  return lines;
}
