import { useEffect, useMemo, useRef, useState } from 'react';
import { Fragment } from 'react';
import {
  FiActivity,
  FiAlertTriangle,
  FiCalendar,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsRight,
  FiClock,
  FiCompass,
  FiEdit3,
  FiFlag,
  FiLayers,
  FiMap,
  FiMinus,
  FiPause,
  FiPlayCircle,
  FiPlus,
  FiPower,
  FiRefreshCw,
  FiRepeat,
  FiRotateCcw,
  FiSave,
  FiStopCircle,
  FiTrash2,
  FiX,
  FiZap,
} from 'react-icons/fi';
import { apiUrl } from '@/config/env';
import CkSwitch from '../../components/admin/CkSwitch';
import GameDayEditorPanel, {
  type GameDayDraft as EditorDraft,
} from '../../components/admin/gameControl/GameDayEditorPanel';
import { FloatingHoverTip } from '../../components/admin/FloatingHoverTip';
import type {
  CountyPickerOption,
  CustomZoneOption,
} from '../../components/admin/gameControl/CountyPickerModal';
import {
  liveGameStatusHeadline,
  motorPhaseLabelHu,
  mapPositionWindowLabelHu,
} from '@/utils/liveGameLabels';

export type GameDayDraft = EditorDraft;

interface GameDay {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  specialRulesJson?: unknown;
}

interface GameControlProps {
  gameSettings: any;
  startTimer: () => void;
  stopTimer: () => void;
  gameDays: GameDay[];
  createGameDay: (draft: GameDayDraft) => Promise<boolean>;
  updateGameDay: (id: number, payload: GameDayDraft) => Promise<boolean>;
  deleteGameDay: (id: number) => Promise<boolean>;
  intervalInputValue: number;
  isEditingInterval: boolean;
  setIntervalInputValue: (value: number) => void;
  setIsEditingInterval: (value: boolean) => void;
  updateInterval: (value: number) => void;
  stayRadiusInput: number;
  setStayRadiusInput: (value: number) => void;
  isEditingStay: boolean;
  setIsEditingStay: (value: boolean) => void;
  updateStaySettings: (payload: { stayRuleEnabled?: boolean; stayRadiusKm?: number }) => void;
}

type SpecialRulesSummary = {
  isFinalDay: boolean;
  intervalCount: number;
  areaCount: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseHmToMinutes(hm?: string): number {
  if (!hm) return 0;
  const [h, m] = hm.split(':');
  return (Number.parseInt(h, 10) || 0) * 60 + (Number.parseInt(m, 10) || 0);
}

function normalizeHm(hm?: string): string {
  const raw = String(hm ?? '').trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (!match) return '00:00';
  const hh = Math.max(0, Math.min(23, Number(match[1]) || 0));
  const mm = Math.max(0, Math.min(59, Number(match[2]) || 0));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function normalizeYmd(value?: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  if (match) return match[1];
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return raw.slice(0, 10);
}

function formatHuLongDate(isoYmd: string): string {
  if (!isoYmd?.trim()) return '—';
  const d = new Date(`${isoYmd.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoYmd;
  return d.toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatHuWeekday(isoYmd: string): string {
  if (!isoYmd?.trim()) return '';
  const d = new Date(`${isoYmd.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('hu-HU', { weekday: 'long' });
}

function parseSpecialRulesObject(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function summarizeSpecialRules(raw: unknown): SpecialRulesSummary {
  const obj = parseSpecialRulesObject(raw);
  const isFinalDay = obj?.isFinalDay === true;
  const interval = Array.isArray(obj?.locationIntervalSchedule) ? obj.locationIntervalSchedule.length : 0;
  const area = Array.isArray(obj?.areaSchedule) ? obj.areaSchedule.length : 0;
  return { isFinalDay, intervalCount: interval, areaCount: area };
}

/** Percintervallum sávok – külön tooltip a ciklus jelvényhez. */
function formatIntervalRulesTooltip(raw: unknown): string | null {
  const obj = parseSpecialRulesObject(raw);
  if (!obj) return null;
  const loc = obj.locationIntervalSchedule;
  if (!Array.isArray(loc) || loc.length === 0) return null;
  const lines: string[] = [];
  loc.forEach((row, i) => {
    const r = row as { from?: string; to?: string; intervalMinutes?: number };
    const a = r.from ?? '?';
    const b = r.to ?? '?';
    const p = r.intervalMinutes ?? '?';
    lines.push(
      `Percintervallum ${i + 1}.: ${a}–${b} — a helymeghatározás ciklusideje minden ${p}. percben (felülírja az alap ciklust).`,
    );
  });
  return lines.length > 0 ? lines.join('\n\n') : null;
}

function countyNamesFromCodes(codes: string[] | undefined, nameByCode: Record<string, string>): string {
  if (!Array.isArray(codes) || codes.length === 0) {
    return 'a teljes ország (nincs külön vármegye kijelölve)';
  }
  return codes
    .map((c) => nameByCode[c]?.trim() || c)
    .filter(Boolean)
    .join(', ');
}

function regionNamesFromIds(ids: string[] | undefined, nameById: Record<string, string>): string {
  if (!Array.isArray(ids) || ids.length === 0) return '';
  return ids
    .map((id) => nameById[id]?.trim() || id)
    .filter(Boolean)
    .join(', ');
}

/** Területi váltások – külön tooltip; konkrét vármegyenevek. */
function formatAreaRulesTooltip(
  raw: unknown,
  nameByCode: Record<string, string>,
  zoneNameById: Record<string, string>,
): string | null {
  const obj = parseSpecialRulesObject(raw);
  if (!obj) return null;
  const area = obj.areaSchedule;
  if (!Array.isArray(area) || area.length === 0) return null;
  const lines: string[] = [];
  area.forEach((row, i) => {
    const r = row as {
      from?: string;
      activeCounties?: string[];
      activeRegions?: string[];
    };
    const t = r.from ?? '?';
    const countyCodes = Array.isArray(r.activeCounties) ? r.activeCounties : [];
    const regionIds = Array.isArray(r.activeRegions) ? r.activeRegions : [];
    const hasCounties = countyCodes.length > 0;
    const hasRegions = regionIds.length > 0;
    const clauses: string[] = [];
    if (hasCounties) {
      clauses.push(`vármegyék: ${countyNamesFromCodes(countyCodes, nameByCode)}`);
    } else if (hasRegions) {
      clauses.push('vármegyék: teljes ország');
    } else {
      clauses.push('vármegyék: nincs kijelölve');
    }
    if (hasRegions) {
      clauses.push(`egyéni zónák: ${regionNamesFromIds(regionIds, zoneNameById)}`);
    }
    lines.push(`Területi váltás ${i + 1}.: ${t} — ${clauses.join(' · ')}.`);
  });
  return lines.length > 0 ? lines.join('\n\n') : null;
}

function formatFinalDayTooltip(raw: unknown): string | null {
  const obj = parseSpecialRulesObject(raw);
  if (!obj || obj.isFinalDay !== true) return null;
  return 'Utolsó játéknap — a lezárási szabályok szerint működik a játékmotor.';
}

function useDateDropdownBounds(): { minLocal?: string; maxLocal?: string } {
  return useMemo(() => {
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    const min = new Date(base);
    min.setFullYear(base.getFullYear() - 5);
    const max = new Date(base);
    max.setFullYear(base.getFullYear() + 5);
    const toYmd = (d: Date) =>
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    return {
      minLocal: `${toYmd(min)}T00:00`,
      maxLocal: `${toYmd(max)}T23:59`,
    };
  }, []);
}

export default function GameControl({
  gameSettings,
  startTimer,
  stopTimer,
  gameDays,
  createGameDay,
  updateGameDay,
  deleteGameDay,
  intervalInputValue,
  isEditingInterval,
  setIntervalInputValue,
  setIsEditingInterval,
  updateInterval,
  stayRadiusInput,
  setStayRadiusInput,
  isEditingStay,
  setIsEditingStay,
  updateStaySettings,
}: GameControlProps) {
  const [countyOptions, setCountyOptions] = useState<CountyPickerOption[]>([]);
  const [customZoneOptions, setCustomZoneOptions] = useState<CustomZoneOption[]>([]);
  const [editor, setEditor] = useState<
    | null
    | { mode: 'create' }
    | { mode: 'edit'; id: number }
  >(null);
  const [initialDraft, setInitialDraft] = useState<GameDayDraft>({
    date: '',
    startTime: '08:00',
    endTime: '16:00',
    specialRulesText: '',
  });
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const countyNameByCode = useMemo(() => {
    const o: Record<string, string> = {};
    for (const c of countyOptions) o[c.code] = c.name;
    return o;
  }, [countyOptions]);

  const customZoneNameById = useMemo(() => {
    const o: Record<string, string> = {};
    for (const z of customZoneOptions) o[z.id] = z.name;
    return o;
  }, [customZoneOptions]);

  const datePickerBounds = useDateDropdownBounds();

  const savedInterval = gameSettings?.locationUpdateIntervalMinutes ?? 20;
  const savedStayKm =
    typeof gameSettings?.stayRadiusKm === 'number' && Number.isFinite(gameSettings.stayRadiusKm)
      ? gameSettings.stayRadiusKm
      : 1;

  useEffect(() => {
    if (!isEditingInterval) setIntervalInputValue(savedInterval);
  }, [savedInterval, isEditingInterval, setIntervalInputValue]);

  useEffect(() => {
    if (!isEditingStay) setStayRadiusInput(savedStayKm);
  }, [savedStayKm, isEditingStay, setStayRadiusInput]);

  useEffect(() => {
    if (intervalInputValue === savedInterval) setIsEditingInterval(false);
  }, [intervalInputValue, savedInterval, setIsEditingInterval]);

  useEffect(() => {
    if (Math.abs(stayRadiusInput - savedStayKm) <= 0.0001) setIsEditingStay(false);
  }, [stayRadiusInput, savedStayKm, setIsEditingStay]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(apiUrl('/api/game-area/counties'), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) return [];
        const data = (await res.json()) as { code: string; name: string; polygon?: number[][] }[];
        return (Array.isArray(data) ? data : [])
          .map((c) => ({
            code: String(c.code || '').trim(),
            name: String(c.name || '').trim(),
            polygon: Array.isArray(c.polygon) ? c.polygon : undefined,
          }))
          .filter((c) => c.code && c.name)
          .sort((a, b) => a.name.localeCompare(b.name, 'hu'));
      })
      .then(setCountyOptions)
      .catch(() => setCountyOptions([]));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(apiUrl('/api/geofence'), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) return [];
        const data = (await res.json()) as {
          id: number;
          name: string;
          geofenceType: string;
        }[];
        if (!Array.isArray(data)) return [];
        return data
          .filter((g) => g.geofenceType !== 'game_area')
          .map((g) => ({ id: String(g.id), name: String(g.name || `Zóna ${g.id}`) }))
          .sort((a, b) => a.name.localeCompare(b.name, 'hu'));
      })
      .then(setCustomZoneOptions)
      .catch(() => setCustomZoneOptions([]));
  }, []);

  const statusUi = liveGameStatusHeadline({
    gameEnabled: gameSettings?.gameEnabled,
    isGameActive: gameSettings?.runtime?.isGameActive,
    motorPhase: gameSettings?.runtime?.campaignStatus,
    isPastLastScheduledGameEnd: gameSettings?.runtime?.isPastLastScheduledGameEnd,
  });
  const mapWin = mapPositionWindowLabelHu(
    gameSettings?.runtime?.allowPositionUpdatesForMap ?? gameSettings?.allowPositionUpdatesForMap,
  );

  const enabled = gameSettings?.gameEnabled === true;
  const motor = gameSettings?.runtime?.campaignStatus;
  const liveDay = gameSettings?.runtime?.isGameActive === true;
  const intervalDirty = intervalInputValue !== savedInterval;
  const stayDirty = Math.abs(stayRadiusInput - savedStayKm) > 0.0001;

  const sortedDays = useMemo(
    () =>
      [...gameDays].sort((a, b) => {
        const ad = `${a.date ?? ''} ${a.startTime ?? ''}`;
        const bd = `${b.date ?? ''} ${b.startTime ?? ''}`;
        return ad.localeCompare(bd);
      }),
    [gameDays],
  );
  const existingFinalDayId = useMemo(() => {
    const final = sortedDays.find((d) => summarizeSpecialRules(d.specialRulesJson).isFinalDay);
    return final?.id ?? null;
  }, [sortedDays]);

  const activeGameDayId = gameSettings?.runtime?.activeGameDayId as number | null | undefined;

  const openCreate = () => {
    setInitialDraft({ date: '', startTime: '08:00', endTime: '16:00', specialRulesText: '' });
    setEditor({ mode: 'create' });
  };

  const openEdit = (day: GameDay) => {
    setInitialDraft({
      date: normalizeYmd(day.date),
      startTime: normalizeHm(day.startTime),
      endTime: normalizeHm(day.endTime),
      specialRulesText: day.specialRulesJson ? JSON.stringify(day.specialRulesJson, null, 2) : '',
    });
    setEditor({ mode: 'edit', id: day.id });
  };

  const closeEditor = () => setEditor(null);

  const handleSave = async (draft: GameDayDraft): Promise<boolean> => {
    if (!editor) return false;
    if (editor.mode === 'create') return createGameDay(draft);
    return updateGameDay(editor.id, draft);
  };

  return (
    <div className="space-y-5 text-gray-200">
      <EngineHero
        enabled={enabled}
        headline={statusUi.headline}
        detail={statusUi.detail}
        motorLabel={motor != null ? motorPhaseLabelHu(motor) : '—'}
        liveDay={liveDay}
        mapWindowLabel={mapWin.label}
        mapWindowVariant={mapWin.variant}
        lastCycle={gameSettings?.lastLocationUpdate}
        nextCycle={gameSettings?.nextLocationUpdate}
        pastEnd={gameSettings?.runtime?.isPastLastScheduledGameEnd === true}
        onToggle={enabled ? stopTimer : startTimer}
      />

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TrackingIntervalCard
          current={savedInterval}
          value={intervalInputValue}
          dirty={intervalDirty}
          onValueChange={(v) => {
            setIntervalInputValue(v);
            setIsEditingInterval(true);
          }}
          onApply={() => {
            updateInterval(intervalInputValue);
            setIsEditingInterval(false);
          }}
          onRevert={() => {
            setIntervalInputValue(savedInterval);
            setIsEditingInterval(false);
          }}
        />
        <StayRuleCard
          enabled={gameSettings?.stayRuleEnabled === true}
          savedKm={savedStayKm}
          value={stayRadiusInput}
          dirty={stayDirty}
          onToggle={(next) => updateStaySettings({ stayRuleEnabled: next })}
          onValueChange={(v) => {
            setStayRadiusInput(v);
            setIsEditingStay(true);
          }}
          onApply={() => {
            updateStaySettings({ stayRadiusKm: stayRadiusInput });
            setIsEditingStay(false);
          }}
          onRevert={() => {
            setStayRadiusInput(savedStayKm);
            setIsEditingStay(false);
          }}
        />
      </section>

      <GameDayTimeline
        days={sortedDays}
        activeDayId={activeGameDayId}
        isGameActive={liveDay}
        pastLastScheduledEnd={gameSettings?.runtime?.isPastLastScheduledGameEnd === true}
        pendingDeleteId={pendingDeleteId}
        countyNameByCode={countyNameByCode}
        customZoneNameById={customZoneNameById}
        onCreate={openCreate}
        onEdit={openEdit}
        onRequestDelete={setPendingDeleteId}
        onConfirmDelete={async (id) => {
          const ok = await deleteGameDay(id);
          if (ok) setPendingDeleteId(null);
        }}
      />

      <GameDayEditorPanel
        isOpen={editor != null}
        mode={editor?.mode ?? 'create'}
        editingId={editor?.mode === 'edit' ? editor.id : null}
        initialDraft={initialDraft}
        datePickerBounds={datePickerBounds}
        countyOptions={countyOptions}
        customZoneOptions={customZoneOptions}
        existingFinalDayId={existingFinalDayId}
        onClose={closeEditor}
        onSave={handleSave}
      />
    </div>
  );
}

function EngineHero({
  enabled,
  headline,
  detail,
  motorLabel,
  liveDay,
  mapWindowLabel,
  mapWindowVariant,
  lastCycle,
  nextCycle,
  pastEnd,
  onToggle,
}: {
  enabled: boolean;
  headline: string;
  detail?: string;
  motorLabel: string;
  liveDay: boolean;
  mapWindowLabel: string;
  mapWindowVariant: 'open' | 'closed';
  lastCycle?: string | null;
  nextCycle?: string | null;
  pastEnd: boolean;
  onToggle: () => void;
}) {
  const lastCycleText = lastCycle ? new Date(lastCycle).toLocaleTimeString('hu-HU') : '—';
  const nextCycleText = nextCycle ? new Date(nextCycle).toLocaleTimeString('hu-HU') : '—';

  return (
    <section className="ck-card !p-0 overflow-hidden">
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border transition-colors ${
                enabled
                  ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-400/25 bg-red-500/10 text-red-300'
              }`}
            >
              <FiZap className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">Játékmotor</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    enabled
                      ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
                      : 'border-red-400/25 bg-red-500/10 text-red-200'
                  }`}
                >
                  <span
                    className={`inline-flex h-1.5 w-1.5 rounded-full ${
                      enabled ? 'animate-pulse bg-emerald-400' : 'bg-red-400'
                    }`}
                  />
                  {enabled ? 'Aktív' : 'Leállítva'}
                </span>
              </div>
              <h2 className="mt-2 text-2xl font-bold leading-tight text-white sm:text-[26px]">
                {headline}
              </h2>
              {detail ? <p className="mt-1.5 max-w-xl text-sm text-amber-300/95">{detail}</p> : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onToggle}
            onMouseUp={(e) => e.currentTarget.blur()}
            className={`ck-btn text-sm justify-center px-6 py-3 ${
              enabled ? 'ck-btn-danger' : 'ck-btn-primary'
            }`}
          >
            <FiPower className="h-4 w-4" />
            <span className="font-bold">{enabled ? 'Motor leállítása' : 'Motor indítása'}</span>
          </button>
        </div>

        {pastEnd ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">
            <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>
              Az utolsó ütemezett játéknap lezárult. Vegyen fel új napot az idővonalon, vagy állítsa le a motort,
              ha vége a szezonnak.
            </span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetricChip icon={<FiActivity className="h-4 w-4" />} label="Fázis" value={motorLabel} />
          <MetricChip
            icon={<FiZap className="h-4 w-4" />}
            label="Élő napablak"
            value={liveDay ? 'Aktív' : 'Nincs'}
            tone={liveDay ? 'emerald' : 'muted'}
          />
          <MetricChip
            icon={<FiMap className="h-4 w-4" />}
            label="Térkép fogadás"
            value={mapWindowLabel}
            tone={mapWindowVariant === 'open' ? 'emerald' : 'muted'}
          />
          <MetricChip icon={<FiClock className="h-4 w-4" />} label="Utolsó ciklus" value={lastCycleText} mono />
          <MetricChip icon={<FiRefreshCw className="h-4 w-4" />} label="Következő ciklus" value={nextCycleText} mono />
        </div>
      </div>
    </section>
  );
}

function MetricChip({
  icon,
  label,
  value,
  tone = 'default',
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'default' | 'emerald' | 'muted';
  mono?: boolean;
}) {
  const valueTone =
    tone === 'emerald' ? 'text-emerald-300' : tone === 'muted' ? 'text-gray-400' : 'text-white';
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">
        <span className="text-gray-400">{icon}</span>
        {label}
      </div>
      <p
        className={`mt-1 truncate text-sm font-semibold ${valueTone} ${mono ? 'font-mono tabular-nums' : ''}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function SliderTicks({
  min,
  max,
  ticks,
}: {
  min: number;
  max: number;
  ticks: { value: number; label: string }[];
}) {
  const range = max - min;
  if (range <= 0) return null;
  return (
    <div className="relative mt-2 h-4 text-[10px] font-mono font-semibold text-gray-600">
      {ticks.map((t, i) => {
        const pct = ((t.value - min) / range) * 100;
        const transform =
          i === 0
            ? 'translateX(0)'
            : i === ticks.length - 1
              ? 'translateX(-100%)'
              : 'translateX(-50%)';
        return (
          <span
            key={t.value}
            className="absolute top-0 whitespace-nowrap"
            style={{ left: `${pct}%`, transform }}
          >
            {t.label}
          </span>
        );
      })}
    </div>
  );
}

function StepperButtonPair({
  onDec,
  onInc,
  decDisabled,
  incDisabled,
  decTitle,
  incTitle,
  accent = 'orange',
}: {
  onDec: () => void;
  onInc: () => void;
  decDisabled?: boolean;
  incDisabled?: boolean;
  decTitle?: string;
  incTitle?: string;
  accent?: 'orange' | 'emerald';
}) {
  const hover =
    accent === 'emerald'
      ? 'hover:text-emerald-200 hover:bg-emerald-500/10'
      : 'hover:text-white hover:bg-white/10';
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/5 p-0.5">
      <button
        type="button"
        onClick={onDec}
        disabled={decDisabled}
        title={decTitle}
        aria-label={decTitle ?? 'Csökkentés'}
        className={`h-10 w-10 flex items-center justify-center text-gray-300 rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent ${hover}`}
      >
        <FiMinus className="h-4 w-4" />
      </button>
      <span className="w-px h-4 bg-white/10" />
      <button
        type="button"
        onClick={onInc}
        disabled={incDisabled}
        title={incTitle}
        aria-label={incTitle ?? 'Növelés'}
        className={`h-10 w-10 flex items-center justify-center text-gray-300 rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent ${hover}`}
      >
        <FiPlus className="h-4 w-4" />
      </button>
    </div>
  );
}

function CardActionFooter({
  currentLabel,
  currentValue,
  dirty,
  onApply,
  onRevert,
  applyLabel = 'Alkalmaz',
}: {
  currentLabel: string;
  currentValue: string;
  dirty: boolean;
  onApply: () => void;
  onRevert: () => void;
  applyLabel?: string;
}) {
  return (
    <footer className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 bg-black/20 px-6 py-4">
      <div className="text-sm whitespace-nowrap">
        <span className="text-gray-500">{currentLabel}:</span>
        <span className="ml-2 font-semibold text-gray-100">{currentValue}</span>
      </div>
      <div className="ml-auto flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onRevert}
          disabled={!dirty}
          aria-hidden={!dirty}
          tabIndex={dirty ? 0 : -1}
          className={`ck-btn ck-btn-secondary text-sm transition-opacity duration-300 ${
            dirty ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <FiRotateCcw className="h-3.5 w-3.5" />
          Visszaállítás
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={!dirty}
          className="ck-btn ck-btn-primary text-sm transition-opacity duration-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FiSave className="h-4 w-4" />
          {applyLabel}
        </button>
      </div>
    </footer>
  );
}

function TrackingIntervalCard({
  current,
  value,
  dirty,
  onValueChange,
  onApply,
  onRevert,
}: {
  current: number;
  value: number;
  dirty: boolean;
  onValueChange: (v: number) => void;
  onApply: () => void;
  onRevert: () => void;
}) {
  const presets = [5, 10, 20, 30, 60];
  return (
    <article className="ck-card !p-0 overflow-hidden flex flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl shrink-0 bg-orange-500/20 text-orange-500">
            <FiRepeat className="w-6 h-6" />
          </div>
          <div className="min-w-0 leading-tight">
            <h3 className="text-xl font-bold text-white">Követési ciklus</h3>
            <p className="mt-0.5 text-xs font-medium text-gray-500">
              Globális pozíciófrissítési ütemezés
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Érték</p>
            <p className="mt-1 flex items-baseline gap-1.5 font-mono text-4xl font-bold tabular-nums text-white">
              {value}
              <span className="font-sans text-sm font-medium text-gray-500">perc</span>
            </p>
          </div>
          <StepperButtonPair
            onDec={() => onValueChange(Math.max(1, value - 1))}
            onInc={() => onValueChange(Math.min(120, value + 1))}
            decDisabled={value <= 1}
            incDisabled={value >= 120}
            decTitle="-1 perc"
            incTitle="+1 perc"
          />
        </div>

        <div>
          <input
            type="range"
            min={1}
            max={120}
            step={1}
            value={value}
            onChange={(e) => onValueChange(Number(e.target.value))}
            className="ck-range-slider w-full"
            style={{ ['--ck-range-progress' as any]: `${((value - 1) / 119) * 100}%` }}
            aria-label="Követési ciklus perce"
          />
          <SliderTicks
            min={1}
            max={120}
            ticks={[
              { value: 1, label: '1' },
              { value: 30, label: '30' },
              { value: 60, label: '60' },
              { value: 90, label: '90' },
              { value: 120, label: '120' },
            ]}
          />
        </div>

        <div className="grid grid-cols-5 gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onValueChange(p)}
              className={`rounded-lg border px-2 py-2 text-[12px] font-semibold transition-colors ${
                value === p
                  ? 'border-orange-400/50 bg-orange-500/15 text-orange-200'
                  : 'border-white/5 bg-white/[0.04] text-gray-400 hover:border-white/20 hover:text-white'
              }`}
            >
              {p} perc
            </button>
          ))}
        </div>
      </div>

      <CardActionFooter
        currentLabel="Jelenlegi beállítás"
        currentValue={`${current} perc`}
        dirty={dirty}
        onApply={onApply}
        onRevert={onRevert}
      />
    </article>
  );
}

function StayRuleCard({
  enabled,
  savedKm,
  value,
  dirty,
  onToggle,
  onValueChange,
  onApply,
  onRevert,
}: {
  enabled: boolean;
  savedKm: number;
  value: number;
  dirty: boolean;
  onToggle: (next: boolean) => void;
  onValueChange: (v: number) => void;
  onApply: () => void;
  onRevert: () => void;
}) {
  const presets = [0.5, 1, 2, 5, 10];

  const MAX_KM = 25;
  const stepDown = () => {
    const next = Math.max(0.1, Math.round((value - 0.1) * 10) / 10);
    onValueChange(next);
  };
  const stepUp = () => {
    const next = Math.min(MAX_KM, Math.round((value + 0.1) * 10) / 10);
    onValueChange(next);
  };

  const sliderValue = Math.min(MAX_KM, value);
  const sliderProgress = (sliderValue / MAX_KM) * 100;
  const isExact = (p: number) => Math.abs(value - p) < 0.05;

  return (
    <article className="ck-card !p-0 overflow-hidden flex flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-2 rounded-xl shrink-0 transition-colors ${
              enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'
            }`}
          >
            <FiCompass className="w-6 h-6" />
          </div>
          <div className="min-w-0 leading-tight">
            <h3 className="text-xl font-bold text-white">Maradási szabály</h3>
            <p className="mt-0.5 text-xs font-medium text-gray-500">
              Maximális mozgástér a játéknapok végén
            </p>
          </div>
        </div>
        <CkSwitch checked={enabled} onChange={onToggle} srLabel="Maradási szabály kapcsoló" size="lg" />
      </header>

      <div className={`flex-1 p-6 space-y-5 transition-opacity ${enabled ? '' : 'opacity-60'}`}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Sugár</p>
            <p className="mt-1 flex items-baseline gap-1.5 font-mono text-4xl font-bold tabular-nums text-white">
              {value.toFixed(1)}
              <span className="font-sans text-sm font-medium text-gray-500">km</span>
            </p>
          </div>
          <StepperButtonPair
            onDec={stepDown}
            onInc={stepUp}
            decDisabled={value <= 0.1}
            incDisabled={value >= MAX_KM}
            decTitle="-0,1 km"
            incTitle="+0,1 km"
            accent="emerald"
          />
        </div>

        <div>
          <input
            type="range"
            min={0.1}
            max={MAX_KM}
            step={0.1}
            value={sliderValue}
            onChange={(e) => onValueChange(Number(e.target.value))}
            className="ck-range-slider ck-range-slider--emerald w-full"
            style={{ ['--ck-range-progress' as any]: `${sliderProgress}%` }}
            aria-label="Maradási sugár (km)"
          />
          <SliderTicks
            min={0}
            max={MAX_KM}
            ticks={[
              { value: 0, label: '0' },
              { value: 5, label: '5' },
              { value: 10, label: '10' },
              { value: 15, label: '15' },
              { value: 20, label: '20' },
              { value: 25, label: '25' },
            ]}
          />
        </div>

        <div className="grid grid-cols-5 gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onValueChange(p)}
              className={`rounded-lg border px-2 py-2 text-[12px] font-semibold transition-colors ${
                isExact(p)
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/5 bg-white/[0.04] text-gray-400 hover:border-white/20 hover:text-white'
              }`}
            >
              {p % 1 === 0 ? `${p}` : p.toString().replace('.', ',')} km
            </button>
          ))}
        </div>
      </div>

      <CardActionFooter
        currentLabel="Jelenlegi beállítás"
        currentValue={`${savedKm.toFixed(1)} km`}
        dirty={dirty}
        onApply={onApply}
        onRevert={onRevert}
      />
    </article>
  );
}

function GameDayTimeline({
  days,
  activeDayId,
  isGameActive = false,
  pastLastScheduledEnd = false,
  pendingDeleteId,
  countyNameByCode,
  customZoneNameById,
  onCreate,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
}: {
  days: GameDay[];
  activeDayId?: number | null;
  isGameActive?: boolean;
  pastLastScheduledEnd?: boolean;
  pendingDeleteId: number | null;
  countyNameByCode: Record<string, string>;
  customZoneNameById: Record<string, string>;
  onCreate: () => void;
  onEdit: (day: GameDay) => void;
  onRequestDelete: (id: number | null) => void;
  onConfirmDelete: (id: number) => void | Promise<void>;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: 'smooth' });
  };

  const hasDays = days.length > 0;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const dayStates = useMemo(() => {
    void tick;
    const todayMid = new Date();
    todayMid.setHours(0, 0, 0, 0);
    const nowDate = new Date();
    const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
    const nowSec = nowDate.getSeconds();
    const nowTotalSec = nowMin * 60 + nowSec;
    return days.map((day) => {
      const isLive =
        isGameActive && activeDayId != null && day.id === activeDayId;
      const ymd = normalizeYmd(day.date);
      const dayDate = ymd ? new Date(`${ymd}T00:00:00`) : null;
      const isPast = !!dayDate && !isLive && dayDate < todayMid;
      const isToday =
        !!dayDate && dayDate.getTime() === todayMid.getTime();
      const startMin = parseHmToMinutes(day.startTime);
      const endMin = parseHmToMinutes(day.endTime);
      const startTotalSec = startMin * 60;
      const endTotalSec = endMin * 60;
      const isAfterWindow =
        isToday && !isLive && !!day.endTime && nowMin >= endMin;
      const isScheduleEnded = pastLastScheduledEnd && isAfterWindow;
      const isOnBreak = isAfterWindow && !pastLastScheduledEnd;
      return {
        day,
        isLive,
        isPast,
        isToday,
        isAfterWindow,
        isOnBreak,
        isScheduleEnded,
        startMin,
        endMin,
        nowMin,
        secondsUntilStart:
          isToday && nowTotalSec < startTotalSec ? startTotalSec - nowTotalSec : null,
        secondsUntilEnd:
          isToday && nowTotalSec < endTotalSec ? endTotalSec - nowTotalSec : null,
      };
    });
  }, [days, isGameActive, activeDayId, pastLastScheduledEnd, tick]);

  const nextIdx = dayStates.findIndex(
    (s) => !s.isPast && !s.isLive && !s.isAfterWindow,
  );

  const liveIdx = isGameActive
    ? days.findIndex((d) => activeDayId != null && d.id === activeDayId)
    : -1;

  return (
    <section className="ck-card !p-0 overflow-hidden flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl shrink-0 bg-orange-500/20 text-orange-500">
            <FiCalendar className="w-6 h-6" />
          </div>
          <div className="min-w-0 leading-tight">
            <h3 className="text-xl font-bold text-white">Játéknap menetrend</h3>
            <p className="mt-0.5 text-xs font-medium text-gray-500">
              Ütemezett játéknapok időrendben
            </p>
          </div>
        </div>
        <button type="button" onClick={onCreate} className="ck-btn ck-btn-primary text-sm">
          <FiPlus className="h-4 w-4" />
          Új játéknap
        </button>
      </header>

      <div className="flex-1 py-6">
        {!hasDays ? (
          <div className="px-6">
            <button
              type="button"
              onClick={onCreate}
              className="group flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-black/20 px-6 py-14 text-center transition-all hover:border-orange-400/50 hover:bg-orange-500/5"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-gray-500 transition-all group-hover:bg-orange-500/15 group-hover:text-orange-300">
                <FiPlus className="h-7 w-7" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">Első játéknap ütemezése</p>
                <p className="mt-1 max-w-xl text-sm text-gray-500">
                  Hozzon létre egy napot dátummal és játékablakkal. Az idővonal automatikusan időrendbe rendezi a napokat.
                </p>
              </div>
            </button>
          </div>
        ) : (
          <div
            ref={scrollerRef}
            className="custom-scrollbar ck-edge-fade-x flex snap-x snap-proximity items-stretch gap-0 overflow-x-auto overflow-y-hidden px-6 pb-2 scroll-px-6"
          >
            {days.map((day, idx) => {
              const state = dayStates[idx];
              const nextDay = days[idx + 1];
              const isNext = idx === nextIdx;
              const secondsUntilStart =
                isNext && state.isToday && state.secondsUntilStart != null
                  ? state.secondsUntilStart
                  : null;
              const nextIsLive =
                isGameActive &&
                activeDayId != null &&
                nextDay?.id === activeDayId;
              const connectorActive =
                state.isLive ||
                isNext ||
                nextIsLive ||
                idx + 1 === nextIdx;
              const connectorPulse = liveIdx >= 0 && idx + 1 === liveIdx;
              const gapDays =
                nextDay && day.date && nextDay.date
                  ? Math.max(
                      0,
                      Math.round(
                        (new Date(nextDay.date).getTime() -
                          new Date(day.date).getTime()) /
                          (1000 * 60 * 60 * 24),
                      ),
                    )
                  : 0;
              return (
                <Fragment key={day.id}>
                  <GameDayTimelineCard
                    index={idx + 1}
                    total={days.length}
                    day={day}
                    isLiveDay={state.isLive}
                    isPast={state.isPast}
                    isOnBreak={state.isOnBreak}
                    isScheduleEnded={state.isScheduleEnded}
                    isNext={isNext}
                    secondsUntilStart={secondsUntilStart ?? undefined}
                    secondsUntilEnd={state.secondsUntilEnd ?? undefined}
                    pendingDelete={pendingDeleteId === day.id}
                    countyNameByCode={countyNameByCode}
                    customZoneNameById={customZoneNameById}
                    onEdit={() => onEdit(day)}
                    onRequestDelete={() => onRequestDelete(day.id)}
                    onCancelDelete={() => onRequestDelete(null)}
                    onConfirmDelete={() => onConfirmDelete(day.id)}
                  />
                  {idx < days.length - 1 ? (
                    <DayConnector
                      active={connectorActive}
                      pulse={connectorPulse}
                      gapDays={gapDays}
                    />
                  ) : null}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {hasDays ? (
        <footer className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 bg-black/20 px-6 py-4">
          <div className="text-sm whitespace-nowrap">
            <span className="text-gray-500">Összesen:</span>
            <span className="ml-2 font-semibold text-gray-100">
              {days.length} ütemezett nap
            </span>
            {liveIdx >= 0 ? (
              <span className="ml-3 text-emerald-300/90">• élő nap: {liveIdx + 1}.</span>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scroll(-1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
              aria-label="Görgetés balra"
            >
              <FiChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
              aria-label="Görgetés jobbra"
            >
              <FiChevronRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}

function fmtHm(t?: string): string {
  if (!t) return '—';
  const [h, m] = t.split(':');
  return `${h ?? '00'}:${m ?? '00'}`;
}

function DayConnector({
  active,
  pulse,
  gapDays,
}: {
  active?: boolean;
  pulse?: boolean;
  gapDays?: number;
}) {
  const lineLeft = active
    ? 'bg-gradient-to-r from-transparent to-emerald-400/70'
    : 'bg-gradient-to-r from-transparent to-white/15';
  const lineRight = active
    ? 'bg-gradient-to-l from-transparent to-emerald-400/70'
    : 'bg-gradient-to-l from-transparent to-white/15';
  const pillStyle = active
    ? 'border-emerald-400/40 from-emerald-500/25 to-emerald-500/5 text-emerald-200'
    : 'border-white/10 from-white/[0.06] to-white/[0.02] text-gray-400';
  const gapLabel =
    gapDays && gapDays > 0
      ? gapDays === 1
        ? 'másnap'
        : `+${gapDays} nap`
      : null;

  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center gap-1.5 self-center px-2"
      aria-hidden="true"
    >
      <div className="flex items-center">
        <span className={`block h-[2px] w-4 rounded-full ${lineLeft}`} />
        <span
          className={`relative flex h-8 w-8 items-center justify-center rounded-full border bg-gradient-to-br ${pillStyle}`}
        >
          {pulse ? (
            <span className="absolute -inset-0.5 animate-ping rounded-full bg-emerald-400/15" />
          ) : null}
          <FiChevronsRight className="relative h-3.5 w-3.5" />
        </span>
        <span className={`block h-[2px] w-4 rounded-full ${lineRight}`} />
      </div>
      {gapLabel ? (
        <span
          className={`text-[10px] font-medium italic tracking-wide ${
            active ? 'text-emerald-300/80' : 'text-gray-500'
          }`}
        >
          {gapLabel}
        </span>
      ) : null}
    </div>
  );
}

function GameDayTimelineCard({
  index,
  total,
  day,
  isLiveDay,
  isPast = false,
  isOnBreak = false,
  isScheduleEnded = false,
  isNext = false,
  secondsUntilStart,
  secondsUntilEnd,
  pendingDelete,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  countyNameByCode,
  customZoneNameById,
}: {
  index: number;
  total: number;
  day: GameDay;
  isLiveDay: boolean;
  isPast?: boolean;
  isOnBreak?: boolean;
  isScheduleEnded?: boolean;
  isNext?: boolean;
  secondsUntilStart?: number;
  secondsUntilEnd?: number;
  pendingDelete: boolean;
  countyNameByCode: Record<string, string>;
  customZoneNameById: Record<string, string>;
  onEdit: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const ymd = normalizeYmd(day.date);
  const longDate = ymd ? formatHuLongDate(ymd) : `Azonosító: ${day.id}`;
  const weekday = ymd ? formatHuWeekday(ymd) : '';
  const summary = summarizeSpecialRules(day.specialRulesJson);
  const intervalDetail = useMemo(
    () => formatIntervalRulesTooltip(day.specialRulesJson),
    [day.specialRulesJson],
  );
  const areaDetail = useMemo(
    () => formatAreaRulesTooltip(day.specialRulesJson, countyNameByCode, customZoneNameById),
    [day.specialRulesJson, countyNameByCode, customZoneNameById],
  );
  const finalDayDetail = useMemo(
    () => formatFinalDayTooltip(day.specialRulesJson),
    [day.specialRulesJson],
  );

  const startMin = parseHmToMinutes(day.startTime);
  const endMin = parseHmToMinutes(day.endTime);
  const startPct = (startMin / (24 * 60)) * 100;
  const endPct = (endMin / (24 * 60)) * 100;
  const rangeLeft = Math.min(startPct, endPct);
  const rangeWidth = Math.max(0, Math.abs(endPct - startPct));

  const nowDate = new Date();
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const nowSeconds = nowDate.getSeconds();
  const nowTotalSec = nowMinutes * 60 + nowSeconds;
  const showLiveProgress =
    isLiveDay && endMin > startMin && nowMinutes >= startMin && nowMinutes < endMin;
  const nowPct = (nowMinutes / (24 * 60)) * 100;
  const liveDoneWidth = showLiveProgress
    ? Math.max(0, Math.min(rangeWidth, nowPct - rangeLeft))
    : 0;
  const liveRemainingSec = showLiveProgress && secondsUntilEnd != null ? secondsUntilEnd : 0;
  const durationMin = Math.max(0, endMin - startMin);
  const formatDuration = (m: number): string => {
    if (m <= 0) return '0 p';
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    if (hh === 0) return `${mm} p`;
    if (mm === 0) return `${hh} ó`;
    return `${hh}:${String(mm).padStart(2, '0')} ó`;
  };
  const formatLiveRemaining = (m: number): string => {
    if (m <= 0) return '0 p';
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    if (hh === 0) return `${mm} p`;
    if (mm === 0) return `${hh} ó`;
    return `${hh}:${String(mm).padStart(2, '0')}`;
  };
  const formatRemainingWithSeconds = (sec: number): string => {
    if (sec <= 0) return '0 mp';
    if (sec < 60) return `${sec} mp`;
    const wholeMinutes = Math.floor(sec / 60);
    return formatLiveRemaining(wholeMinutes);
  };
  const durationLabel = durationMin <= 0 ? '—' : formatDuration(durationMin);

  const intervalBadge = (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-gradient-to-br from-blue-500/12 to-blue-500/[0.04] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-200 ring-1 ring-inset ring-blue-500/10">
      <FiRepeat className="h-3 w-3" />
      {summary.intervalCount} ciklus sáv
    </span>
  );
  const areaBadge = (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-gradient-to-br from-violet-500/12 to-violet-500/[0.04] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-200 ring-1 ring-inset ring-violet-500/10">
      <FiLayers className="h-3 w-3" />
      {summary.areaCount} terület váltás
    </span>
  );
  const finalDayBadge = (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/20 bg-gradient-to-br from-orange-500/12 to-orange-500/[0.04] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-200 ring-1 ring-inset ring-orange-500/10">
      <FiFlag className="h-3 w-3" />
      Utolsó nap
    </span>
  );
  const noRulesLine = (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium italic text-gray-600">
      <FiActivity className="h-3 w-3" />
      Nincs külön szabály.
    </span>
  );

  const isNextOnly =
    isNext &&
    !isLiveDay &&
    !isPast &&
    !isOnBreak &&
    !isScheduleEnded &&
    !summary.isFinalDay;

  const stepGradient = isPast
    ? 'from-white/10 to-white/[0.04]'
    : isLiveDay
      ? 'from-emerald-500 to-cyan-500'
      : isScheduleEnded
        ? 'from-rose-600 to-slate-700'
        : isOnBreak
          ? 'from-amber-500 to-yellow-600'
          : isNextOnly
            ? 'from-blue-500 to-indigo-500'
            : summary.isFinalDay
              ? 'from-orange-500 to-amber-500'
              : 'from-white/20 to-white/[0.06]';

  const stepRing = isPast
    ? 'ring-white/5'
    : isLiveDay
      ? 'ring-emerald-400/30'
      : isScheduleEnded
        ? 'ring-rose-400/35'
        : isOnBreak
          ? 'ring-amber-400/30'
          : isNextOnly
            ? 'ring-blue-400/30'
            : summary.isFinalDay
              ? 'ring-orange-400/30'
              : 'ring-white/10';

  const stepText = isPast ? 'text-gray-500' : 'text-white';

  const cardBorder = isLiveDay
    ? 'border-emerald-500/40'
    : isScheduleEnded
      ? 'border-rose-500/35'
      : isOnBreak
        ? 'border-amber-500/30'
        : isNextOnly
          ? 'border-blue-500/35'
          : summary.isFinalDay
            ? 'border-orange-500/30'
            : isPast
              ? 'border-white/[0.06]'
              : 'border-white/10 hover:border-white/25';

  const cardBg = isLiveDay
    ? 'bg-gradient-to-br from-emerald-500/[0.08] via-[#181818] to-[#121212]'
    : isScheduleEnded
      ? 'bg-gradient-to-br from-rose-500/[0.08] via-[#181818] to-[#121212]'
      : isOnBreak
        ? 'bg-gradient-to-br from-amber-500/[0.07] via-[#181818] to-[#121212]'
        : isNextOnly
          ? 'bg-gradient-to-br from-blue-500/[0.07] via-[#181818] to-[#121212]'
          : summary.isFinalDay
            ? 'bg-gradient-to-br from-orange-500/[0.07] via-[#181818] to-[#121212]'
            : isPast
              ? 'bg-gradient-to-br from-white/[0.02] via-[#141414] to-[#0f0f0f]'
              : 'bg-gradient-to-br from-white/[0.04] via-[#181818] to-[#121212]';

  const headerBg = isLiveDay
    ? 'border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.08] to-transparent'
    : isScheduleEnded
      ? 'border-rose-500/20 bg-gradient-to-b from-rose-500/[0.08] to-transparent'
      : isOnBreak
        ? 'border-amber-500/20 bg-gradient-to-b from-amber-500/[0.08] to-transparent'
        : isNextOnly
          ? 'border-blue-500/20 bg-gradient-to-b from-blue-500/[0.08] to-transparent'
          : summary.isFinalDay
            ? 'border-orange-500/20 bg-gradient-to-b from-orange-500/[0.08] to-transparent'
            : isPast
              ? 'border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent'
              : 'border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent';

  const accentLine = isLiveDay
    ? 'bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent'
    : isScheduleEnded
      ? 'bg-gradient-to-r from-transparent via-rose-400/80 to-transparent'
      : isOnBreak
        ? 'bg-gradient-to-r from-transparent via-amber-400/80 to-transparent'
        : isNextOnly
          ? 'bg-gradient-to-r from-transparent via-blue-400/80 to-transparent'
          : summary.isFinalDay
            ? 'bg-gradient-to-r from-transparent via-orange-400/80 to-transparent'
            : null;

  return (
    <article
      className={`group relative flex min-h-[280px] w-[300px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border ring-1 ring-inset ring-white/[0.04] transition-colors ${cardBorder} ${cardBg} ${
        isPast ? 'opacity-80' : ''
      }`}
    >
      {accentLine ? (
        <span
          className={`absolute inset-x-0 top-0 h-[2px] ${accentLine}`}
          aria-hidden="true"
        />
      ) : null}
      <div
        className={`relative flex items-center justify-between gap-2 border-b px-4 py-3 ${headerBg}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${stepGradient} text-sm font-bold ${stepText} ring-2 ring-inset ${stepRing}`}
          >
            {isPast ? (
              <FiCheck className="h-4 w-4" />
            ) : isScheduleEnded ? (
              <FiStopCircle className="h-4 w-4" />
            ) : isOnBreak ? (
              <FiPause className="h-4 w-4" />
            ) : summary.isFinalDay ? (
              <FiFlag className="h-4 w-4" />
            ) : (
              index
            )}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="flex items-baseline gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em]">
              <span className={isPast ? 'text-gray-500' : 'text-gray-300'}>
                {index}. nap
              </span>
              <span className="text-[10px] font-medium normal-case tracking-normal text-gray-600">
                {index}/{total}
              </span>
            </p>
          </div>
        </div>
        {isLiveDay ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
            <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Élő
          </span>
        ) : isPast ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            <FiCheck className="h-3 w-3" />
            Lezárult
          </span>
        ) : isScheduleEnded ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-100">
            <FiStopCircle className="h-3 w-3" />
            Ütemezés vége
          </span>
        ) : isOnBreak ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
            <FiPause className="h-3 w-3" />
            Napi szünet
          </span>
        ) : isNextOnly ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-blue-400/40 bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-200">
            <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
            Következő
          </span>
        ) : summary.isFinalDay ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-orange-400/30 bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-200">
            <FiFlag className="h-3 w-3" />
            Utolsó
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3.5 p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-300">
            <FiCalendar className="h-4 w-4" />
          </div>
          <div className="min-w-0 leading-tight">
            {weekday ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                {weekday}
              </p>
            ) : null}
            <p className="mt-0.5 text-[15px] font-bold text-white">{longDate}</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-black/40 p-3 ring-1 ring-inset ring-white/[0.03]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <FiPlayCircle className="h-3.5 w-3.5 text-emerald-300/80" />
              <span className="font-mono text-[15px] font-bold tabular-nums text-white">
                {fmtHm(day.startTime)}
              </span>
            </div>
            <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-gray-600">
              <FiChevronsRight className="h-3.5 w-3.5 shrink-0" />
            </span>
            <div className="flex items-center gap-1.5">
              <FiStopCircle className="h-3.5 w-3.5 text-red-300/80" />
              <span className="font-mono text-[15px] font-bold tabular-nums text-white">
                {fmtHm(day.endTime)}
              </span>
            </div>
            <span
              className={`ml-auto inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                secondsUntilStart != null
                  ? 'border-blue-400/40 bg-blue-500/10 text-blue-200'
                  : showLiveProgress
                    ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
                    : 'border-white/10 bg-black/30 uppercase tracking-[0.14em] text-gray-400'
              }`}
            >
              <FiClock className="h-3 w-3" />
              {secondsUntilStart != null
                ? `${formatRemainingWithSeconds(secondsUntilStart)} múlva`
                : showLiveProgress
                  ? `${formatRemainingWithSeconds(liveRemainingSec)} hátra`
                  : durationLabel}
            </span>
          </div>
          <div className="relative mt-3 h-2 w-full">
            <div className="absolute inset-0 overflow-hidden rounded-full bg-white/5 ring-1 ring-inset ring-white/[0.04]">
              <div
                className={`absolute inset-y-0 rounded-full ${
                  showLiveProgress
                    ? 'bg-emerald-500/25'
                    : isLiveDay
                      ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400'
                      : isScheduleEnded
                        ? 'bg-gradient-to-r from-rose-600/50 via-rose-500/40 to-slate-600/50'
                        : 'bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400'
                }`}
                style={{ left: `${rangeLeft}%`, width: `${rangeWidth}%` }}
              />
              {showLiveProgress ? (
                <div
                  className="absolute inset-y-0 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400"
                  style={{ left: `${rangeLeft}%`, width: `${liveDoneWidth}%` }}
                />
              ) : null}
            </div>
            {showLiveProgress ? (
              <div
                className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${(nowTotalSec / (24 * 60 * 60)) * 100}%` }}
              >
                <span className="relative block h-3 w-3 rounded-full border-2 border-emerald-400 bg-white" />
              </div>
            ) : null}
          </div>
          <div className="relative mt-1.5 h-3 text-[9px] font-mono font-semibold tabular-nums text-gray-600">
            {[0, 6, 12, 18, 24].map((h, i, arr) => (
              <span
                key={h}
                className="absolute top-0"
                style={{
                  left: `${(h / 24) * 100}%`,
                  transform:
                    i === 0
                      ? 'translateX(0)'
                      : i === arr.length - 1
                        ? 'translateX(-100%)'
                        : 'translateX(-50%)',
                }}
              >
                {String(h).padStart(2, '0')}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-auto flex min-h-[28px] w-full flex-wrap items-center gap-1.5">
          {summary.intervalCount > 0 ? (
            intervalDetail ? (
              <FloatingHoverTip content={intervalDetail} className="inline-flex max-w-full">
                {intervalBadge}
              </FloatingHoverTip>
            ) : (
              intervalBadge
            )
          ) : null}
          {summary.areaCount > 0 ? (
            areaDetail ? (
              <FloatingHoverTip content={areaDetail} className="inline-flex max-w-full">
                {areaBadge}
              </FloatingHoverTip>
            ) : (
              areaBadge
            )
          ) : null}
          {summary.isFinalDay ? (
            finalDayDetail ? (
              <FloatingHoverTip content={finalDayDetail} className="inline-flex max-w-full">
                {finalDayBadge}
              </FloatingHoverTip>
            ) : (
              finalDayBadge
            )
          ) : null}
          {summary.intervalCount === 0 && summary.areaCount === 0 && !summary.isFinalDay
            ? noRulesLine
            : null}
        </div>
      </div>

      <div
        className={`relative h-[52px] border-t transition-colors duration-200 ${
          pendingDelete
            ? 'border-red-500/30 bg-gradient-to-b from-red-500/[0.18] to-red-500/[0.10]'
            : 'border-white/[0.06] bg-black/20'
        }`}
      >
        <div
          className={`absolute inset-0 flex items-center justify-end gap-1.5 px-3 transition-opacity duration-200 ${
            pendingDelete ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
          aria-hidden={pendingDelete}
        >
          <button
            type="button"
            onClick={onEdit}
            tabIndex={pendingDelete ? -1 : 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[12px] font-semibold text-gray-200 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            <FiEdit3 className="h-3.5 w-3.5" />
            Szerkeszt
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            tabIndex={pendingDelete ? -1 : 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-[12px] font-semibold text-red-200 transition-colors hover:border-red-400/60 hover:bg-red-500/20 hover:text-red-100"
          >
            <FiTrash2 className="h-3.5 w-3.5" />
            Törlés
          </button>
        </div>
        <div
          className={`absolute inset-0 flex items-center justify-between gap-2 px-3 transition-opacity duration-200 ${
            pendingDelete ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          aria-hidden={!pendingDelete}
        >
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-200">
            <FiAlertTriangle className="h-3.5 w-3.5" />
            Biztosan törli?
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onCancelDelete}
              tabIndex={pendingDelete ? 0 : -1}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-[12px] font-semibold text-gray-200 transition-colors hover:border-white/25 hover:bg-white/15 hover:text-white"
            >
              <FiX className="h-3.5 w-3.5" />
              Mégsem
            </button>
            <button
              type="button"
              onClick={() => void onConfirmDelete()}
              tabIndex={pendingDelete ? 0 : -1}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-400/50 bg-gradient-to-br from-red-500/30 to-red-600/30 px-3 text-[12px] font-semibold text-red-100 transition-colors hover:border-red-400/70 hover:from-red-500/45 hover:to-red-600/45 hover:text-white"
            >
              <FiTrash2 className="h-3.5 w-3.5" />
              Törlés
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
