/**
 * Abszolút időpont (ISO 8601, UTC) megjelenítése magyar formátumban,
 * mindig Europe/Budapest időzónában — függetlenül a felhasználó gépének / böngészőjének TZ-jétől.
 */
export function formatDateTimeBudapest(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('hu-HU', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Dátum és idő külön sorokhoz (pl. táblázatcella), szintén Europe/Budapest. */
export function formatDateTimeBudapestParts(
  iso: string | null | undefined,
): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString('hu-HU', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const time = d.toLocaleTimeString('hu-HU', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return { date, time };
}

/** Budapest TZ, dátum felül + idő alul — pl. táblázatcellák. */
export function DateTimeStackCell({
  iso,
  align = 'center',
}: {
  iso: string | null | undefined;
  align?: 'center' | 'start';
}) {
  const parts = formatDateTimeBudapestParts(iso);
  if (!parts) return <span className="text-gray-500">—</span>;
  const rowAlign = align === 'start' ? 'items-start' : 'items-center';
  return (
    <div className={`inline-flex flex-col ${rowAlign} justify-center gap-0.5 leading-tight text-xs font-mono`}>
      <span className="text-gray-300">{parts.date}</span>
      <span className="text-gray-500 tabular-nums">{parts.time}</span>
    </div>
  );
}
