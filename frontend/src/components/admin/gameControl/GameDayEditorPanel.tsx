import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiAlertTriangle,
  FiCalendar,
  FiChevronDown,
  FiClock,
  FiFlag,
  FiMap,
  FiMinus,
  FiNavigation,
  FiPlus,
  FiRepeat,
  FiSave,
  FiSettings,
  FiSliders,
  FiTarget,
  FiTrash2,
  FiX,
  FiZap,
} from 'react-icons/fi';
import MwDateTimePicker from '../../MwDateTimePicker';
import MwSwitch from '../MwSwitch';
import TimeWindowInput from './TimeWindowInput';
import CompactTimeField from './CompactTimeField';
import { FloatingHoverTip } from '../FloatingHoverTip';
import { useNotification } from '../../../contexts/NotificationContext';
import CountyPickerModal, {
  CountyShapePreview,
  type CountyPickerOption,
  type CustomZoneOption,
} from './CountyPickerModal';

export type GameDayDraft = {
  date: string;
  startTime: string;
  endTime: string;
  specialRulesText: string;
};

type IntervalScheduleItem = { from: string; to?: string; intervalMinutes: number };
type AreaScheduleItem = {
  from: string;
  activeCounties?: string[];
  activeRegions?: string[];
};
type SpecialRules = {
  isFinalDay?: boolean;
  locationIntervalSchedule?: IntervalScheduleItem[];
  areaSchedule?: AreaScheduleItem[];
};

const HU_CODE = 'magyarorszag';
const normCode = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');

function parseSpecialRules(text: string): SpecialRules {
  if (!text?.trim()) return {};
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed == null) return {};
    const out: SpecialRules = {};
    if (parsed.isFinalDay === true) out.isFinalDay = true;
    if (Array.isArray(parsed.locationIntervalSchedule)) {
      out.locationIntervalSchedule = parsed.locationIntervalSchedule as IntervalScheduleItem[];
    }
    if (Array.isArray(parsed.areaSchedule)) {
      out.areaSchedule = (parsed.areaSchedule as unknown[]).map((r) => {
        const row = r as {
          from?: unknown;
          activeCounties?: unknown;
          activeRegions?: unknown;
        };
        const ac = Array.isArray(row?.activeCounties) ? row.activeCounties.map((v) => normCode(String(v))) : [];
        const ar = Array.isArray(row?.activeRegions) ? row.activeRegions.map(String) : [];
        return {
          from: typeof row?.from === 'string' ? row.from : '08:00',
          activeCounties: ac,
          activeRegions: ar,
        };
      });
    }
    return out;
  } catch {
    return {};
  }
}

function stringifySpecialRules(rules: SpecialRules): string {
  const clean: SpecialRules = {};
  if (rules.isFinalDay === true) clean.isFinalDay = true;
  if ((rules.locationIntervalSchedule || []).length > 0) clean.locationIntervalSchedule = rules.locationIntervalSchedule;
  if ((rules.areaSchedule || []).length > 0) {
    const serialized = (rules.areaSchedule || []).map((r) => {
      const row: { from: string; activeCounties?: string[]; activeRegions?: string[] } = {
        from: r.from,
      };
      if (Array.isArray(r.activeCounties)) row.activeCounties = r.activeCounties;
      if (Array.isArray(r.activeRegions)) row.activeRegions = r.activeRegions;
      return row;
    });
    if (serialized.length > 0) clean.areaSchedule = serialized;
  }
  return Object.keys(clean).length ? JSON.stringify(clean, null, 2) : '';
}

interface GameDayEditorPanelProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  editingId?: number | null;
  initialDraft: GameDayDraft;
  datePickerBounds?: { minLocal?: string; maxLocal?: string };
  countyOptions: CountyPickerOption[];
  customZoneOptions: CustomZoneOption[];
  existingFinalDayId?: number | null;
  onClose: () => void;
  onSave: (draft: GameDayDraft) => Promise<boolean> | boolean;
}

export default function GameDayEditorPanel({
  isOpen,
  mode,
  editingId = null,
  initialDraft,
  datePickerBounds,
  countyOptions,
  customZoneOptions,
  existingFinalDayId = null,
  onClose,
  onSave,
}: GameDayEditorPanelProps) {
  const { addNotification } = useNotification();
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [draft, setDraft] = useState<GameDayDraft>(initialDraft);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [countyModal, setCountyModal] = useState<{ rowIdx: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(initialDraft);
      const rules = parseSpecialRules(initialDraft.specialRulesText);
      const hasAdvanced =
        (rules.locationIntervalSchedule?.length ?? 0) > 0 ||
        (rules.areaSchedule?.length ?? 0) > 0 ||
        rules.isFinalDay === true;
      setAdvancedOpen(hasAdvanced);
    }
  }, [isOpen, initialDraft]);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    const t = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const rules = useMemo(() => parseSpecialRules(draft.specialRulesText), [draft.specialRulesText]);
  const intervalRows = rules.locationIntervalSchedule ?? [];
  const areaRows = rules.areaSchedule ?? [];
  const hasOtherFinalDay =
    existingFinalDayId != null &&
    (mode === 'create' || editingId == null || existingFinalDayId !== editingId);

  const updateRules = (next: SpecialRules) => {
    setDraft((cur) => ({ ...cur, specialRulesText: stringifySpecialRules(next) }));
  };

  const save = async () => {
    if (saving) return;
    if (!draft.date || !draft.startTime || !draft.endTime) return;
    const invalidArea = areaRows.some((row) => {
      const hasArrays = Array.isArray(row.activeCounties) && Array.isArray(row.activeRegions);
      if (!hasArrays) return true;
      return (row.activeCounties?.length ?? 0) + (row.activeRegions?.length ?? 0) === 0;
    });
    if (invalidArea) {
      addNotification(
        'error',
        'A területi váltás soroknál kötelező legalább egy vármegyét vagy egyéni zónát kiválasztani.',
      );
      return;
    }
    setSaving(true);
    try {
      const ok = await onSave(draft);
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!mounted && !isOpen) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[10000]">
      <div
        className={`pointer-events-auto absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen && entered ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'create' ? 'Új játéknap létrehozása' : 'Játéknap szerkesztése'}
        className={`pointer-events-auto absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col p-3 transition-transform duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-4 ${
          isOpen && entered ? 'translate-x-0' : 'translate-x-[calc(100%+12px)]'
        }`}
      >
        <div className="relative flex flex-1 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#121212]/92 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent" />

          <header className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] p-6">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  mode === 'create' ? 'bg-orange-500/20 text-orange-500' : 'bg-blue-500/20 text-blue-400'
                }`}
              >
                <FiCalendar className="h-5 w-5" />
              </div>
              <div className="min-w-0 leading-tight">
                <h3 className="truncate text-xl font-bold text-white">
                  {mode === 'create' ? 'Új játéknap' : 'Játéknap szerkesztése'}
                </h3>
                <p className="mt-0.5 text-xs font-medium text-gray-500">
                  {mode === 'create' ? 'Új nap hozzáadása a menetrendhez' : 'Meglévő nap módosítása'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-gray-400 transition-all hover:bg-white/10 hover:text-white"
              aria-label="Bezárás"
            >
              <FiX className="h-5 w-5" />
            </button>
          </header>

          <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar">
            <div className="space-y-5 px-5 py-5">
              <section className="space-y-3">
                <SectionLabel step={1} icon={<FiCalendar className="h-4 w-4" />}>
                  Dátum
                </SectionLabel>
                <MwDateTimePicker
                  label="Játéknap dátuma"
                  value={draft.date ? `${draft.date}T12:00` : ''}
                  minLocal={datePickerBounds?.minLocal}
                  maxLocal={datePickerBounds?.maxLocal}
                  dateOnly
                  onChange={(v) => setDraft((cur) => ({ ...cur, date: v ? v.slice(0, 10) : '' }))}
                />
              </section>

              <section className="space-y-3">
                <SectionLabel step={2} icon={<FiZap className="h-4 w-4" />}>
                  Játékablak
                </SectionLabel>
                <TimeWindowInput
                  start={draft.startTime}
                  end={draft.endTime}
                  onChange={({ start, end }) => setDraft((cur) => ({ ...cur, startTime: start, endTime: end }))}
                />
              </section>

              <section className="space-y-3">
                <SectionLabel step={3} icon={<FiSettings className="h-4 w-4" />}>
                  Speciális beállítások
                </SectionLabel>

                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          rules.isFinalDay ? 'bg-orange-500/20 text-orange-300' : 'bg-white/5 text-gray-500'
                        }`}
                      >
                        <FiFlag className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">Utolsó játéknap</p>
                        <p className="mt-0.5 text-[12px] leading-snug text-gray-500">
                          Lezárási viselkedés a motorban. Kapcsolja be, ha ez a játéksorozat utolsó napja.
                        </p>
                      </div>
                    </div>
                    <MwSwitch
                      checked={rules.isFinalDay === true}
                      disabled={hasOtherFinalDay}
                      onChange={(next) => {
                        if (hasOtherFinalDay && next) return;
                        updateRules({ ...rules, isFinalDay: next || undefined });
                      }}
                      srLabel="Utolsó játéknap jelölése"
                    />
                  </div>
                  {hasOtherFinalDay ? (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
                      <FiAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                      <p>Már van kijelölt utolsó játéknap. Egyszerre csak egy lehet.</p>
                    </div>
                  ) : null}
                </div>

                <CollapsibleCard
                  open={advancedOpen}
                  onToggle={() => setAdvancedOpen((o) => !o)}
                  title="Haladó napon belüli ütemezés"
                  subtitle="Percintervallum és aktív vármegyék időzítése"
                  icon={<FiSliders className="h-4 w-4" />}
                >
                  <div className="space-y-5">
                    <IntervalScheduleEditor
                      rows={intervalRows}
                      gameWindowStartHm={draft.startTime}
                      gameWindowEndHm={draft.endTime}
                      onNotify={(message) => addNotification('error', message)}
                      onChange={(rows) => updateRules({ ...rules, locationIntervalSchedule: rows })}
                    />

                    <AreaScheduleEditor
                      rows={areaRows}
                      countyOptions={countyOptions}
                      customZoneOptions={customZoneOptions}
                      gameWindowStartHm={draft.startTime}
                      gameWindowEndHm={draft.endTime}
                      onNotify={(message) => addNotification('error', message)}
                      onChange={(rows) => updateRules({ ...rules, areaSchedule: rows })}
                      onOpenCountyPicker={(rowIdx) => setCountyModal({ rowIdx })}
                    />
                  </div>
                </CollapsibleCard>
              </section>
            </div>
          </div>

          <footer className="relative z-10 flex items-center justify-end gap-2 border-t border-white/10 bg-black/20 px-6 py-4">
            <button type="button" onClick={onClose} className="mw-btn mw-btn-secondary text-sm">
              Mégsem
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !draft.date}
              className="mw-btn mw-btn-primary text-sm transition-opacity duration-300 disabled:pointer-events-none disabled:opacity-40"
            >
              <FiSave className="h-4 w-4" />
              {mode === 'create' ? 'Létrehozás' : 'Mentés'}
            </button>
          </footer>
        </div>
      </aside>

      <CountyPickerModal
        isOpen={countyModal != null}
        title="Játéktér kiválasztása"
        counties={countyOptions}
        customZoneOptions={customZoneOptions}
        initialCounties={countyModal != null ? areaRows[countyModal.rowIdx]?.activeCounties ?? [] : []}
        initialRegionIds={countyModal != null ? areaRows[countyModal.rowIdx]?.activeRegions ?? [] : []}
        onClose={() => setCountyModal(null)}
        onSave={(nextCounties, nextRegions) => {
          if (countyModal == null) return;
          const rowsCopy = [...areaRows];
          const idx = countyModal.rowIdx;
          if (rowsCopy[idx]) {
            rowsCopy[idx] = {
              ...rowsCopy[idx],
              activeCounties: nextCounties,
              activeRegions: nextRegions,
            };
            updateRules({ ...rules, areaSchedule: rowsCopy });
          }
        }}
      />
    </div>,
    document.body,
  );
}

function SectionLabel({
  step,
  icon,
  children,
}: {
  step: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/15 text-orange-300">
        <span className="text-[11px] font-bold leading-none">{step}</span>
      </div>
      <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
        <span className="text-gray-500">{icon}</span>
        {children}
      </div>
    </div>
  );
}

function CollapsibleCard({
  open,
  onToggle,
  title,
  subtitle,
  icon,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            {icon ? <span className="text-gray-500">{icon}</span> : null}
            {title}
          </p>
          {subtitle ? <p className="mt-0.5 text-[12px] text-gray-500">{subtitle}</p> : null}
        </div>
        <FiChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <div
        className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0">
          <div className="border-t border-white/10 bg-black/20 px-4 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function IntStepper({
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const n = parseInt(raw.replace(/\D/g, ''), 10);
    if (Number.isNaN(n)) {
      setText(String(value));
      return;
    }
    const next = Math.max(min, Math.min(max, n));
    onChange(next);
    setText(String(next));
  };

  return (
      <div
        className="mx-auto flex h-11 w-max min-w-0 max-w-full select-none items-stretch overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
        role="group"
        aria-label="Perc intervallum"
      >
        <button
          type="button"
          className="flex w-10 shrink-0 items-center justify-center text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-30"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label="Csökkentés"
        >
          <FiMinus className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center border-x border-white/10 bg-black/20 px-3">
          <div className="inline-flex min-w-0 max-w-full items-center justify-center gap-1.5">
            <input
              type="text"
              inputMode="numeric"
              name="interval-minutes"
              autoComplete="off"
              className="m-0 h-8 w-12 shrink-0 border-0 bg-transparent p-0 text-center font-mono text-base font-semibold leading-none tabular-nums text-white placeholder:text-gray-600 focus:outline-none focus:ring-0"
              value={text}
              onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ''))}
              onBlur={() => (text.trim() === '' ? commit(String(min)) : commit(text))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
            {suffix ? (
              <span className="shrink-0 text-sm font-medium leading-none text-gray-500">
                {suffix === 'p' ? 'perc' : suffix}
              </span>
            ) : null}
          </div>
        </div>
      <button
        type="button"
        className="flex w-10 shrink-0 items-center justify-center text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-30"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Növelés"
      >
        <FiPlus className="h-4 w-4" />
      </button>
    </div>
  );
}

function IntervalScheduleEditor({
  rows,
  onChange,
  gameWindowStartHm,
  gameWindowEndHm,
  onNotify,
}: {
  rows: IntervalScheduleItem[];
  onChange: (rows: IntervalScheduleItem[]) => void;
  gameWindowStartHm: string;
  gameWindowEndHm: string;
  onNotify: (message: string) => void;
}) {
  const [collapsedRows, setCollapsedRows] = useState<Set<number>>(new Set());
  const fromExclusionsByIndex = rows.map((_, idx) =>
    rows.filter((__, i) => i !== idx).map((r) => r.from).filter(Boolean),
  );
  useEffect(() => {
    setCollapsedRows((prev) => {
      const next = new Set<number>();
      prev.forEach((idx) => {
        if (idx >= 0 && idx < rows.length) next.add(idx);
      });
      return next;
    });
  }, [rows.length]);
  const removeRow = (idx: number) => {
    setCollapsedRows((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < idx) next.add(i);
        if (i > idx) next.add(i - 1);
      });
      return next;
    });
    onChange(rows.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/20 text-orange-300">
              <FiRepeat className="h-3.5 w-3.5" />
            </span>
            Percintervallum sávok
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">Felülírja az alap követési ciklust.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const nextFrom = nextAvailableFrom(
              rows.map((r) => r.from),
              gameWindowStartHm,
              gameWindowEndHm,
            );
            if (!nextFrom) {
              onNotify('Nincs több szabad időpont az új intervallum sáv hozzáadásához.');
              return;
            }
            onChange([
              ...rows,
              {
                from: nextFrom,
                to: gameWindowEndHm,
                intervalMinutes: 20,
              },
            ]);
          }}
          className="mw-btn mw-btn-primary whitespace-nowrap text-xs py-2"
        >
          <FiPlus className="h-3.5 w-3.5" />
          Új sáv
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2.5 text-center text-[12px] text-gray-500">
          Nincs felülírás — az alap ciklus érvényes.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, idx) => (
            <article
              key={`iv-${idx}`}
              className="rounded-xl border border-white/10 bg-black/30 p-3.5"
            >
              {(() => {
                const collapsed = collapsedRows.has(idx);
                return (
                  <>
              <div className={`${collapsed ? 'mb-0' : 'mb-3'} flex min-h-8 items-center justify-between gap-2`}>
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedRows((prev) => {
                        const next = new Set(prev);
                        if (next.has(idx)) next.delete(idx);
                        else next.add(idx);
                        return next;
                      })
                    }
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-gray-400 transition-colors hover:bg-white/[0.08] hover:text-white"
                    aria-label={collapsed ? 'Sáv kibontása' : 'Sáv összecsukása'}
                  >
                    <FiChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
                    />
                  </button>
                  <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1">
                    <FiRepeat className="h-3.5 w-3.5 text-orange-300/80" />
                    <span className="text-[10px] font-semibold text-gray-400">Intervallum</span>
                    <span className="font-mono text-xs font-semibold text-white">{idx + 1}.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.03] text-gray-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                  aria-label="Sáv törlése"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>

              <div
                className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${
                  collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
                }`}
              >
                <div className="min-h-0">
              <div className="space-y-3 pb-0.5">
                <div className="grid items-end gap-3 md:grid-cols-2">
                  <div className="min-w-0">
                    <p className="mb-1 flex min-h-5 items-center gap-1.5 text-xs font-medium text-gray-500">
                      <FiClock className="h-3.5 w-3.5 shrink-0 text-orange-300/80" />
                      Mettől
                    </p>
                    <CompactTimeField
                      value={row.from}
                      onChange={(t) => {
                        const copy = [...rows];
                        copy[idx] = { ...row, from: t };
                        onChange(copy);
                      }}
                      minHm={gameWindowStartHm}
                      maxHm={gameWindowEndHm}
                      excludeHm={fromExclusionsByIndex[idx]}
                      className="w-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 flex min-h-5 items-center gap-1.5 text-xs font-medium text-gray-500">
                      <FiClock className="h-3.5 w-3.5 shrink-0 text-orange-300/80" />
                      Meddig
                    </p>
                    <CompactTimeField
                      value={row.to || row.from}
                      onChange={(t) => {
                        const copy = [...rows];
                        copy[idx] = { ...row, to: t };
                        onChange(copy);
                      }}
                      minHm={gameWindowStartHm}
                      maxHm={gameWindowEndHm}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="mb-1 flex min-h-5 items-center gap-1.5 text-xs font-medium text-gray-500">
                    <FiRepeat className="h-3.5 w-3.5 shrink-0 text-orange-300/80" />
                    Percenként
                  </p>
                  <IntStepper
                    value={row.intervalMinutes}
                    min={1}
                    max={180}
                    onChange={(v) => {
                      const copy = [...rows];
                      copy[idx] = { ...row, intervalMinutes: v };
                      onChange(copy);
                    }}
                    suffix="p"
                  />
                </div>
              </div>
                </div>
              </div>
                  </>
                );
              })()}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

const MAX_COUNTY_PREVIEW = 5;

function SelectedAreaSummary({
  codes,
  regionIds,
  countyOptions,
  customZoneOptions,
}: {
  codes: string[];
  regionIds: string[];
  countyOptions: CountyPickerOption[];
  customZoneOptions: CustomZoneOption[];
}) {
  const rows = useMemo(
    () =>
      codes.map((code) => {
        const norm = normCode(code);
        const opt = countyOptions.find((c) => normCode(c.code) === norm);
        return { code, opt, name: opt?.name ?? code };
      }),
    [codes, countyOptions],
  );
  const head = rows.slice(0, MAX_COUNTY_PREVIEW);
  const rest = rows.slice(MAX_COUNTY_PREVIEW);
  const restLabel = rest.map((r) => r.name).join(', ');

  const zoneRows = useMemo(
    () =>
      regionIds.map((id) => {
        const z = customZoneOptions.find((c) => c.id === id);
        return { id, name: z?.name ?? id };
      }),
    [regionIds, customZoneOptions],
  );
  const zHead = zoneRows.slice(0, MAX_COUNTY_PREVIEW);
  const zRest = zoneRows.slice(MAX_COUNTY_PREVIEW);
  const zRestLabel = zRest.map((r) => r.name).join(', ');

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/30 p-3.5">
      <p className="mb-1 flex min-h-5 items-center gap-1.5 text-xs font-medium text-gray-500">
        <FiMap className="h-3.5 w-3.5 shrink-0 text-violet-300/80" />
        Vármegyék
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">Nincs külön vármegye.</p>
      ) : (
        <>
          <ul className="mt-2 space-y-2">
            {head.map(({ code, opt, name }) => (
              <li
                key={code}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2"
              >
                <div className="shrink-0 text-white/50">
                  <CountyShapePreview
                    polygon={opt?.polygon}
                    className="h-8 w-8 text-white/25"
                    iconClassName="h-5 w-5 text-white/50"
                  />
                </div>
                <span className="min-w-0 text-[15px] font-semibold leading-snug text-white">{name}</span>
              </li>
            ))}
          </ul>
          {rest.length > 0 ? (
            <div className="mt-3">
              <FloatingHoverTip className="block" content={restLabel}>
                <span
                  className="inline-block cursor-default rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-gray-200"
                  aria-label={`További kiválasztott vármegyék: ${restLabel}`}
                >
                  +{rest.length} további
                </span>
              </FloatingHoverTip>
            </div>
          ) : null}
        </>
      )}

      {zoneRows.length > 0 ? (
        <>
          <p className="mb-1 mt-4 flex min-h-5 items-center gap-1.5 text-xs font-medium text-gray-500">
            <FiTarget className="h-3.5 w-3.5 shrink-0 text-emerald-300/80" />
            Egyéni zónák
          </p>
          <ul className="mt-2 space-y-2">
            {zHead.map(({ id, name }) => (
              <li
                key={id}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                  <FiTarget className="h-4 w-4" />
                </div>
                <span className="min-w-0 text-[15px] font-semibold leading-snug text-white">{name}</span>
              </li>
            ))}
          </ul>
          {zRest.length > 0 ? (
            <div className="mt-3">
              <FloatingHoverTip className="block" content={zRestLabel}>
                <span
                  className="inline-block cursor-default rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-gray-200"
                  aria-label={`További egyéni zónák: ${zRestLabel}`}
                >
                  +{zRest.length} további
                </span>
              </FloatingHoverTip>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function areaRowLabel(row: AreaScheduleItem) {
  const c = row.activeCounties?.length ?? 0;
  const r = row.activeRegions?.length ?? 0;
  if (c === 0 && r === 0) {
    return 'Játéktér kiválasztása';
  }
  const parts: string[] = [];
  const huOnly =
    c === 1 &&
    row.activeCounties != null &&
    normCode(String(row.activeCounties[0])) === HU_CODE;
  if (huOnly) parts.push('Magyarország');
  else if (c > 0) parts.push(`${c} vármegye`);
  if (r > 0) parts.push(r === 1 ? '1 zóna' : `${r} zóna`);
  return parts.join(' és ');
}

function nextAvailableFrom(
  existingFroms: string[],
  gameWindowStartHm: string,
  gameWindowEndHm: string,
): string | null {
  const used = new Set(existingFroms);
  const parseHm = (hm: string): number | null => {
    const m = /^(\d{2}):(\d{2})$/.exec(String(hm || '').trim());
    if (!m) return null;
    const h = Number.parseInt(m[1], 10);
    const mm = Number.parseInt(m[2], 10);
    if (!Number.isFinite(h) || !Number.isFinite(mm) || h < 0 || h > 23 || mm < 0 || mm > 59) {
      return null;
    }
    return h * 60 + mm;
  };

  const start = parseHm(gameWindowStartHm);
  const end = parseHm(gameWindowEndHm);
  const useWindow = start != null && end != null && start <= end;
  const rangeStart = useWindow ? start : 0;
  const rangeEnd = useWindow ? end : 24 * 60 - 1;

  for (let t = rangeStart; t <= rangeEnd; t += 1) {
    const hm = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    if (!used.has(hm)) return hm;
  }
  return null;
}

function AreaScheduleEditor({
  rows,
  countyOptions,
  customZoneOptions,
  onChange,
  onOpenCountyPicker,
  gameWindowStartHm,
  gameWindowEndHm,
  onNotify,
}: {
  rows: AreaScheduleItem[];
  countyOptions: CountyPickerOption[];
  customZoneOptions: CustomZoneOption[];
  onChange: (rows: AreaScheduleItem[]) => void;
  onOpenCountyPicker: (rowIdx: number) => void;
  gameWindowStartHm: string;
  gameWindowEndHm: string;
  onNotify: (message: string) => void;
}) {
  const [collapsedRows, setCollapsedRows] = useState<Set<number>>(new Set());
  const fromExclusionsByIndex = rows.map((_, idx) =>
    rows.filter((__, i) => i !== idx).map((r) => r.from).filter(Boolean),
  );
  useEffect(() => {
    setCollapsedRows((prev) => {
      const next = new Set<number>();
      prev.forEach((idx) => {
        if (idx >= 0 && idx < rows.length) next.add(idx);
      });
      return next;
    });
  }, [rows.length]);
  const removeRow = (idx: number) => {
    setCollapsedRows((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < idx) next.add(i);
        if (i > idx) next.add(i - 1);
      });
      return next;
    });
    onChange(rows.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
              <FiMap className="h-3.5 w-3.5" />
            </span>
            Területi váltások
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">Egy adott időponttól más vármegyék legyenek aktívak.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const nextFrom = nextAvailableFrom(
              rows.map((r) => r.from),
              gameWindowStartHm,
              gameWindowEndHm,
            );
            if (!nextFrom) {
              onNotify('Nincs több szabad időpont az új területi váltás hozzáadásához.');
              return;
            }
            onChange([
              ...rows,
              {
                from: nextFrom,
              },
            ]);
          }}
          className="mw-btn mw-btn-primary whitespace-nowrap text-xs py-2"
        >
          <FiPlus className="h-3.5 w-3.5" />
          Új váltás
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2.5 text-center text-[12px] text-gray-500">
          Nincs ütemezett váltás — egész napon az alap játéktér érvényes.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, idx) => (
            <article
              key={`area-${idx}`}
              className="rounded-xl border border-white/10 bg-black/30 p-3.5"
            >
              {(() => {
                const collapsed = collapsedRows.has(idx);
                return (
                  <>
              <div className={`${collapsed ? 'mb-0' : 'mb-3'} flex min-h-8 items-center justify-between gap-2`}>
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedRows((prev) => {
                        const next = new Set(prev);
                        if (next.has(idx)) next.delete(idx);
                        else next.add(idx);
                        return next;
                      })
                    }
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-gray-400 transition-colors hover:bg-white/[0.08] hover:text-white"
                    aria-label={collapsed ? 'Sor kibontása' : 'Sor összecsukása'}
                  >
                    <FiChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
                    />
                  </button>
                  <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1">
                    <FiMap className="h-3.5 w-3.5 text-violet-300/80" />
                    <span className="text-[10px] font-semibold text-gray-400">Terület</span>
                    <span className="font-mono text-xs font-semibold text-white">{idx + 1}.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.03] text-gray-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                  aria-label="Sor törlése"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>

              <div
                className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${
                  collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
                }`}
              >
                <div className="min-h-0">
              <div className="space-y-3 pb-0.5">
              <div className="grid items-end gap-3 md:grid-cols-2">
                <div className="min-w-0">
                  <p className="mb-1 flex min-h-5 items-center gap-1.5 text-xs font-medium text-gray-500">
                    <FiClock className="h-3.5 w-3.5 shrink-0 text-violet-300/80" />
                    Mettől
                  </p>
                  <CompactTimeField
                    value={row.from}
                    onChange={(t) => {
                      const copy = [...rows];
                      copy[idx] = { ...row, from: t };
                      onChange(copy);
                    }}
                    minHm={gameWindowStartHm}
                    maxHm={gameWindowEndHm}
                    excludeHm={fromExclusionsByIndex[idx]}
                    className="w-full"
                  />
                </div>
                <div className="min-w-0">
                  <p className="mb-1 flex min-h-5 items-center gap-1.5 text-xs font-medium text-gray-500">
                    <FiMap className="h-3.5 w-3.5 shrink-0 text-violet-300/80" />
                    Játéktér
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenCountyPicker(idx)}
                    className="mw-btn mw-btn-secondary flex h-11 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap text-xs"
                  >
                    <FiNavigation className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{areaRowLabel(row)}</span>
                  </button>
                </div>
              </div>
              <SelectedAreaSummary
                codes={row.activeCounties ?? []}
                regionIds={row.activeRegions ?? []}
                countyOptions={countyOptions}
                customZoneOptions={customZoneOptions}
              />
              </div>
                </div>
              </div>
                  </>
                );
              })()}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
