import { useMemo } from 'react';
import {
  FiActivity,
  FiCalendar,
  FiChevronRight,
  FiClock,
  FiCompass,
  FiMap,
  FiSmartphone,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import {
  liveGameStatusHeadline,
  motorPhaseLabelHu,
  mapPositionWindowLabelHu,
} from '@/utils/liveGameLabels';

interface GameDayBrief {
  id: number;
  date: string;
  specialRulesJson?: unknown;
}

interface DashboardHomeProps {
  gameSettings: any;
  gameDays: GameDayBrief[];
  activePairsCount: number;
  activeDevicesCount: number;
  activeGeofencesCount: number;
  onGoToGameControl: () => void;
  onGoToPairs: () => void;
  onGoToDevices: () => void;
  onGoToGeofences: () => void;
}

function formatGameDayDate(iso: string): string {
  if (!iso?.trim()) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

function formatClock(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatCountdownLabel(minutes: number, seconds: number): string {
  const mm = Math.max(0, Number(minutes) || 0);
  const ss = Math.max(0, Number(seconds) || 0);
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function isFinalDayFlag(raw: unknown): boolean {
  if (!raw) return false;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as { isFinalDay?: boolean };
      return parsed?.isFinalDay === true;
    } catch {
      return false;
    }
  }
  if (typeof raw === 'object') {
    return (raw as { isFinalDay?: boolean })?.isFinalDay === true;
  }
  return false;
}

export default function DashboardHome({
  gameSettings,
  gameDays,
  activePairsCount,
  activeDevicesCount,
  activeGeofencesCount,
  onGoToGameControl,
  onGoToPairs,
  onGoToDevices,
  onGoToGeofences,
}: DashboardHomeProps) {
  const statusUi = liveGameStatusHeadline({
    gameEnabled: gameSettings?.gameEnabled,
    isGameActive: gameSettings?.runtime?.isGameActive,
    motorPhase: gameSettings?.runtime?.campaignStatus ?? gameSettings?.campaignStatus,
    isPastLastScheduledGameEnd: gameSettings?.runtime?.isPastLastScheduledGameEnd,
  });
  const mapWin =
    gameSettings?.gameEnabled &&
    (gameSettings?.runtime?.campaignStatus === 'RUNNING' || gameSettings?.runtime?.isGameActive)
      ? mapPositionWindowLabelHu(
            gameSettings?.runtime?.allowPositionUpdatesForMap ?? gameSettings?.allowPositionUpdatesForMap,
        )
      : null;

  const activeDayId = gameSettings?.runtime?.activeGameDayId as number | undefined | null;
  const activeDayLabel = useMemo(() => {
    if (activeDayId == null) return 'Jelenleg nincs aktív játéknap-azonosító a motorban.';
    const found = gameDays.find((g) => g.id === activeDayId);
    if (!found?.date) return 'Az aktív játéknap dátuma jelenleg nem azonosítható.';
    return formatGameDayDate(found.date);
  }, [activeDayId, gameDays]);

  const nextCycleAt = formatClock(gameSettings?.nextLocationUpdate);
  const lastCycleAt = formatClock(gameSettings?.lastLocationUpdate);
  const scheduleEnded = gameSettings?.runtime?.isPastLastScheduledGameEnd === true;

  const sortedDays = useMemo(() => {
    return [...gameDays].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  }, [gameDays]);
  const todayYmd = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);
  const upcomingDays = useMemo(
    () => sortedDays.filter((d) => String(d.date || '').slice(0, 10) >= todayYmd),
    [sortedDays, todayYmd],
  );
  const MAX_SCHEDULE_DAYS = 4;

  return (
    <div className="space-y-6">
      <section className="mw-card !p-0 overflow-hidden">
        <div className="relative px-6 py-7 sm:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),transparent_56%),linear-gradient(120deg,rgba(255,255,255,0.03),transparent_45%,rgba(255,255,255,0.02))]" />
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`inline-flex h-2.5 w-2.5 rounded-full ${
                    gameSettings?.gameEnabled ? 'animate-pulse bg-emerald-400' : 'bg-red-400'
                  }`}
                />
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Áttekintés</span>
              </div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">{statusUi.headline}</h1>
              <p className="mt-2 text-sm text-gray-300">
                {statusUi.detail ||
                  'A motor aktuális működési állapota, ciklusinformációk és napi ütemezés egy helyen.'}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StatusPill label="Motor" value={gameSettings?.gameEnabled ? 'Aktív' : 'Leállítva'} tone={gameSettings?.gameEnabled ? 'ok' : 'danger'} />
                <StatusPill
                  label="Fázis"
                  value={motorPhaseLabelHu(gameSettings?.runtime?.campaignStatus ?? gameSettings?.campaignStatus)}
                />
                <StatusPill
                  label="Térkép"
                  value={mapWin?.label ?? 'Nincs aktív fogadási ablak'}
                  tone={mapWin?.variant === 'open' ? 'ok' : 'muted'}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={onGoToGameControl}
              onMouseUp={(e) => e.currentTarget.blur()}
              className="mw-btn mw-btn-primary inline-flex items-center justify-center gap-2 self-start lg:self-auto"
            >
              Játék vezérlés
              <FiChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {gameSettings?.gameEnabled && gameSettings.countdown && (
        <div className="mw-card !p-0 overflow-hidden relative">
          <div className="relative px-6 py-10 sm:px-8">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-orange-500/5 animate-pulse" />
            <div className="relative z-10 text-center">
              <div className="mb-4 flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-orange-300">
                  <FiClock className="h-4 w-4" />
                  Következő ciklusig
                </div>
              </div>
              <div className="font-mono text-6xl font-bold tracking-tight text-white sm:text-7xl md:text-8xl">
                {formatCountdownLabel(gameSettings.countdown.minutes, gameSettings.countdown.seconds)}
              </div>
              <p className="mx-auto mt-3 max-w-lg text-sm text-gray-400">
                A hátralévő idő a következő pozíciófogadási ciklusig. A fogadás állapota a motor és a napi szabályok
                szerint változik.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FiUsers className="h-6 w-6" />}
          title="Aktív párok"
          value={activePairsCount}
          hint="Még játékban lévő, nem elfogott párok"
          tone="blue"
          onClick={onGoToPairs}
        />
        <StatCard
          icon={<FiSmartphone className="h-6 w-6" />}
          title="Élő eszközök"
          value={activeDevicesCount}
          hint="Aktív klienskapcsolatot fenntartó appok"
          tone="violet"
          onClick={onGoToDevices}
        />
        <StatCard
          icon={<FiMap className="h-6 w-6" />}
          title="Aktív zónák"
          value={activeGeofencesCount}
          hint="Bekapcsolt geokerítések és játéktér elemek"
          tone="emerald"
          onClick={onGoToGeofences}
        />
        <StatCard
          icon={<FiActivity className="h-6 w-6" />}
          title="Aktív játéknap"
          value={activeDayId != null ? formatGameDayDate(gameDays.find((d) => d.id === activeDayId)?.date || '') : '—'}
          hint={activeDayId != null ? 'A motorban jelenleg aktív nap' : activeDayLabel}
          tone="orange"
          onClick={onGoToGameControl}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
        <div className="mw-card xl:col-span-2">
          <button
            type="button"
            onClick={onGoToGameControl}
            className="group mb-4 inline-flex h-9 items-center gap-2 rounded-lg text-left text-white transition-colors hover:text-orange-300"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
              <FiActivity className="h-4.5 w-4.5" />
            </div>
            <h2 className="text-lg font-bold text-white transition-colors group-hover:text-orange-300">Motor állapot és ütemezés</h2>
            <FiChevronRight className="h-4 w-4 text-gray-500 transition-colors group-hover:text-orange-300" />
          </button>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoTile label="Játék fázisa" value={motorPhaseLabelHu(gameSettings?.runtime?.campaignStatus ?? gameSettings?.campaignStatus)} icon={<FiActivity className="h-4 w-4" />} />
            <InfoTile label="Aktív játéknap" value={activeDayLabel} icon={<FiCalendar className="h-4 w-4" />} />
            <InfoTile
              label="Utolsó ciklusforduló"
              value={lastCycleAt}
              icon={<FiClock className="h-4 w-4" />}
              mono
            />
            <InfoTile
              label="Következő ciklusforduló"
              value={nextCycleAt}
              icon={<FiClock className="h-4 w-4" />}
              mono
            />
            <InfoTile
              label="Aktív ciklus intervallum"
              value={`${gameSettings?.runtime?.currentIntervalMinutes ?? gameSettings?.locationUpdateIntervalMinutes ?? '—'} perc`}
              icon={<FiZap className="h-4 w-4" />}
            />
            <InfoTile
              label="Maradási szabály"
              value={
                gameSettings?.stayRuleEnabled
                  ? `Bekapcsolva (${gameSettings?.stayRadiusKm ?? '—'} km)`
                  : 'Kikapcsolva'
              }
              icon={<FiCompass className="h-4 w-4" />}
            />
          </div>
          {gameSettings?.runtime?.isPastLastScheduledGameEnd ? (
            <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Az utolsó ütemezett játéknap záróideje lejárt — a szezon lezárult.
            </div>
          ) : null}
        </div>

        <div className="mw-card">
          <button
            type="button"
            onClick={onGoToGameControl}
            className="group mb-4 inline-flex h-9 items-center gap-3 rounded-lg text-left text-white transition-colors hover:text-orange-300"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
              <FiCalendar className="h-4.5 w-4.5" />
            </div>
            <h2 className="text-lg font-bold leading-none text-white transition-colors group-hover:text-orange-300">
              Játék idővonal
            </h2>
            <FiChevronRight className="h-4 w-4 text-gray-500 transition-colors group-hover:text-orange-300" />
          </button>
          {upcomingDays.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-5 text-sm text-gray-500">
              Nincs ütemezett játéknap.
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingDays.slice(0, MAX_SCHEDULE_DAYS).map((d) => {
                const isActive = activeDayId != null && activeDayId === d.id;
                const dayYmd = String(d.date || '').slice(0, 10);
                const isToday = dayYmd === todayYmd;
                const isEnded = scheduleEnded && isToday && !isActive;
                const hasNext =
                  upcomingDays.findIndex((x) => x.id === d.id) <
                  Math.min(MAX_SCHEDULE_DAYS, upcomingDays.length) - 1;
                const isFinalDay = isFinalDayFlag(d.specialRulesJson);
                const nodeClass = isEnded
                  ? 'border-rose-300/70 bg-rose-500/25'
                  : isFinalDay
                    ? 'border-orange-300 bg-orange-500/30'
                  : isActive
                    ? 'border-emerald-300 bg-emerald-500/30'
                    : 'border-blue-300/50 bg-blue-500/20';
                const rowClass = isEnded
                  ? 'border-rose-400/35 bg-gradient-to-br from-rose-500/16 to-rose-500/6'
                  : isFinalDay
                    ? 'border-orange-400/35 bg-gradient-to-br from-orange-500/16 to-orange-500/6'
                  : isActive
                    ? 'border-emerald-400/35 bg-gradient-to-br from-emerald-500/16 to-emerald-500/6'
                    : 'border-white/10 bg-gradient-to-br from-white/[0.04] to-black/25';
                const statusClass = isEnded
                  ? 'text-rose-200'
                  : isFinalDay
                    ? 'text-orange-200'
                  : isActive
                    ? 'text-emerald-200'
                    : 'text-blue-200/90';
                const calendarIconClass = isEnded
                  ? 'text-rose-300/95'
                  : isFinalDay
                    ? 'text-orange-300/95'
                  : isActive
                    ? 'text-emerald-300/95'
                    : 'text-blue-300/90'
                return (
                  <div key={d.id} className="relative pl-8">
                    <span
                      className={`absolute left-0 top-3.5 h-3.5 w-3.5 rounded-full border-2 ${nodeClass}`}
                    />
                    <div
                      className={`rounded-2xl border px-3.5 py-3 ${rowClass}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                          <FiCalendar className={`h-3.5 w-3.5 shrink-0 ${calendarIconClass}`} />
                          {formatGameDayDate(d.date)}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${statusClass}`}>
                          {isEnded ? 'Lezárult' : isFinalDay ? 'Utolsó nap' : isActive ? 'Élő nap' : 'Ütemezett'}
                        </span>
                      </div>
                    </div>
                    {hasNext ? (
                      <div className="absolute left-[6px] top-7 h-[calc(100%+18px)] w-px bg-gradient-to-b from-blue-300/40 to-transparent" />
                    ) : null}
                  </div>
                );
              })}
              {upcomingDays.length > MAX_SCHEDULE_DAYS ? (
                <div className="pt-1 text-xs text-gray-500">
                  +{upcomingDays.length - MAX_SCHEDULE_DAYS} további játéknap
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'ok' | 'danger' | 'muted';
}) {
  const classes =
    tone === 'ok'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : tone === 'danger'
        ? 'border-red-500/30 bg-red-500/10 text-red-200'
        : tone === 'muted'
          ? 'border-white/10 bg-white/[0.03] text-gray-400'
          : 'border-orange-500/30 bg-orange-500/10 text-orange-200';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${classes}`}>
      <span className="font-semibold text-gray-300">{label}:</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function StatCard({
  icon,
  title,
  value,
  hint,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  value: number | string;
  hint: string;
  tone: 'blue' | 'violet' | 'emerald' | 'orange';
  onClick?: () => void;
}) {
  const toneClass =
    tone === 'blue'
      ? 'text-blue-300 bg-blue-500/15'
      : tone === 'violet'
        ? 'text-violet-300 bg-violet-500/15'
        : tone === 'emerald'
          ? 'text-emerald-300 bg-emerald-500/15'
          : 'text-orange-300 bg-orange-500/15';
  return (
    <div className="mw-card !p-0 overflow-hidden">
      <div className="grid min-h-[150px] content-center gap-3 px-6 py-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={onClick}
              className="group inline-flex appearance-none items-center gap-1 rounded bg-transparent p-0 text-xs font-semibold uppercase leading-none tracking-[0.14em] text-gray-500 transition-colors hover:text-orange-300"
            >
              <span>{title}</span>
              <FiChevronRight className="h-3.5 w-3.5 transition-colors group-hover:text-orange-300" />
            </button>
            <div className="mt-1 text-lg font-bold leading-tight text-white sm:text-xl">{value}</div>
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
            {icon}
          </div>
        </div>
        <p className="-mt-2 min-h-[2.5rem] text-sm leading-snug text-gray-500">{hint}</p>
      </div>
    </div>
  );
}

function InfoTile({
  label,
  value,
  icon,
  mono = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
        <span className="text-gray-400">{icon}</span>
        {label}
      </div>
      <div className={`text-sm font-semibold text-white ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</div>
    </div>
  );
}
