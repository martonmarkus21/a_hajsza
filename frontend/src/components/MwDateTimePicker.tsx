import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCalendar, FiChevronDown, FiChevronLeft, FiChevronRight, FiClock } from 'react-icons/fi';

const PANEL_CLOSE_MS = 200;
const VIEWPORT_PAD = 8;

function clampPanelLeft(left: number, panelWidth: number): number {
  if (typeof window === 'undefined') return left;
  const maxL = Math.max(VIEWPORT_PAD, window.innerWidth - panelWidth - VIEWPORT_PAD);
  return Math.min(Math.max(left, VIEWPORT_PAD), maxL);
}

const MONTHS_HU = [
  'január',
  'február',
  'március',
  'április',
  'május',
  'június',
  'július',
  'augusztus',
  'szeptember',
  'október',
  'november',
  'december',
];

const WEEKDAY_LABELS: { key: string; label: string }[] = [
  { key: 'mo', label: 'H' },
  { key: 'tu', label: 'K' },
  { key: 'we', label: 'Sze' },
  { key: 'th', label: 'Cs' },
  { key: 'fr', label: 'P' },
  { key: 'sa', label: 'Szo' },
  { key: 'su', label: 'V' },
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function partsToLocalDatetimeString(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
): string {
  return `${y}-${pad2(mo)}-${pad2(d)}T${pad2(h)}:${pad2(mi)}`;
}

export function parseLocalDatetimeString(v: string): {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
} | null {
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const h = parseInt(m[4], 10);
  const mi = parseInt(m[5], 10);
  if ([y, mo, d, h, mi].some((x) => Number.isNaN(x))) return null;
  return { y, mo, d, h, mi };
}

function partsToMs(p: { y: number; mo: number; d: number; h: number; mi: number }): number {
  return new Date(p.y, p.mo - 1, p.d, p.h, p.mi).getTime();
}

/** minLocal / maxLocal: ugyanaz a `YYYY-MM-DDTHH:mm` formátum. */
export function clampLocalDatetimeString(value: string, minLocal?: string, maxLocal?: string): string {
  const v = parseLocalDatetimeString(value);
  if (!v) return value;
  let t = partsToMs(v);
  if (minLocal) {
    const m = parseLocalDatetimeString(minLocal);
    if (m && t < partsToMs(m)) return minLocal;
  }
  if (maxLocal) {
    const m = parseLocalDatetimeString(maxLocal);
    if (m && t > partsToMs(m)) return maxLocal;
  }
  return value;
}

interface MwDateTimePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Intervallum: ettől nem lehet korábbi dátum (pl. időpontig mezőhöz) */
  minLocal?: string;
  /** Intervallum: ettől nem lehet későbbi dátum (pl. időponttól mezőhöz) */
  maxLocal?: string;
}

const timeInputClass =
  'w-full rounded-lg bg-[#0c0c0c] border border-white/12 px-2.5 py-2 text-sm font-medium text-white tabular-nums shadow-inner focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/30';

export default function MwDateTimePicker({
  label,
  value,
  onChange,
  className = '',
  minLocal,
  maxLocal,
}: MwDateTimePickerProps) {
  const id = useId();
  const labelId = `${id}-lbl`;
  const panelListId = `${id}-panel`;
  const [open, setOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [panelEnter, setPanelEnter] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelEnteredThisOpen = useRef(false);

  const emit = useCallback(
    (next: string) => {
      if (!next.trim()) {
        onChange('');
        return;
      }
      onChange(clampLocalDatetimeString(next, minLocal, maxLocal));
    },
    [onChange, minLocal, maxLocal],
  );

  const parsed = useMemo(() => (value ? parseLocalDatetimeString(value) : null), [value]);

  const [viewYear, setViewYear] = useState(() => parsed?.y ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parsed?.mo ?? new Date().getMonth() + 1);

  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.y);
      setViewMonth(parsed.mo);
    }
  }, [parsed?.y, parsed?.mo, parsed]);

  const displayText = useMemo(() => {
    if (!parsed) return '—';
    return `${parsed.y}. ${MONTHS_HU[parsed.mo - 1]} ${parsed.d}. · ${pad2(parsed.h)}:${pad2(parsed.mi)}`;
  }, [parsed]);

  const panelWidth = 300;

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = Math.min(Math.max(280, panelWidth), window.innerWidth - VIEWPORT_PAD * 2);
    const left = clampPanelLeft(r.left, w);
    setCoords({ top: r.bottom + 6, left, width: w });
  }, []);

  useEffect(() => {
    if (open) {
      setMenuVisible(true);
    }
  }, [open]);

  useEffect(() => {
    if (open) return;
    if (!menuVisible) return;
    const t = window.setTimeout(() => {
      setMenuVisible(false);
      setCoords({ top: 0, left: 0, width: 0 });
    }, PANEL_CLOSE_MS);
    return () => clearTimeout(t);
  }, [open, menuVisible]);

  useLayoutEffect(() => {
    if (!menuVisible) return;
    updatePosition();
    const idRaf = requestAnimationFrame(() => {
      updatePosition();
    });
    return () => cancelAnimationFrame(idRaf);
  }, [menuVisible, updatePosition]);

  useEffect(() => {
    if (!menuVisible) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [menuVisible, updatePosition]);

  useEffect(() => {
    if (!menuVisible || !open) {
      setPanelEnter(false);
      panelEnteredThisOpen.current = false;
      return;
    }
    if (coords.width <= 0) return;
    if (panelEnteredThisOpen.current) return;
    panelEnteredThisOpen.current = true;
    setPanelEnter(false);
    const idRaf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelEnter(true));
    });
    return () => cancelAnimationFrame(idRaf);
  }, [menuVisible, open, coords.width]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const daysInMonth = (y: number, mo: number) => new Date(y, mo, 0).getDate();
  const firstWeekday = (y: number, mo: number) => {
    const js = new Date(y, mo - 1, 1).getDay();
    return js === 0 ? 6 : js - 1;
  };

  const gridDays = useMemo(() => {
    const dim = daysInMonth(viewYear, viewMonth);
    const start = firstWeekday(viewYear, viewMonth);
    const cells: ({ day: number; inMonth: boolean } | null)[] = [];
    for (let i = 0; i < start; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push({ day: d, inMonth: true });
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const pickDay = (day: number) => {
    const h = parsed?.h ?? 12;
    const mi = parsed?.mi ?? 0;
    const raw = partsToLocalDatetimeString(viewYear, viewMonth, day, h, mi);
    emit(raw);
  };

  const setTime = (h: number, mi: number) => {
    if (!parsed) {
      const now = new Date();
      const raw = partsToLocalDatetimeString(now.getFullYear(), now.getMonth() + 1, now.getDate(), h, mi);
      emit(raw);
      return;
    }
    emit(partsToLocalDatetimeString(parsed.y, parsed.mo, parsed.d, h, mi));
  };

  const setTodayNow = () => {
    const n = new Date();
    const raw = partsToLocalDatetimeString(
      n.getFullYear(),
      n.getMonth() + 1,
      n.getDate(),
      n.getHours(),
      n.getMinutes(),
    );
    emit(raw);
    setViewYear(n.getFullYear());
    setViewMonth(n.getMonth() + 1);
  };

  const clear = () => {
    onChange('');
    setOpen(false);
  };

  const hVal = parsed?.h ?? 12;
  const miVal = parsed?.mi ?? 0;

  const showPanel = menuVisible && coords.width > 0;

  const panel =
    showPanel &&
    createPortal(
      <div
        ref={panelRef}
        id={panelListId}
        className={`fixed z-[10000] overflow-hidden rounded-xl border border-white/10 bg-[#141414] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.75)] ring-1 ring-white/[0.06] flex flex-col origin-top max-h-[min(92vh,560px)] ${
          open && panelEnter
            ? 'opacity-100 translate-y-0 scale-100 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]'
            : 'opacity-0 -translate-y-1 scale-[0.98] pointer-events-none transition-[opacity,transform] duration-150 ease-out'
        }`}
        style={{
          top: coords.top,
          left: coords.left,
          width: coords.width,
          transformOrigin: 'top center',
        }}
      >
        <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-1.5 border-b border-white/5 px-2 py-2 [&>button:nth-child(3)]:self-center">
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 shrink-0 flex items-center justify-center"
            onClick={() => {
              if (viewMonth <= 1) {
                setViewMonth(12);
                setViewYear((y) => y - 1);
              } else setViewMonth((m) => m - 1);
            }}
            aria-label="Előző hónap"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-white text-center min-w-0 truncate px-1 leading-tight">
            {MONTHS_HU[viewMonth - 1]} {viewYear}
          </span>
          <button
            type="button"
            onClick={setTodayNow}
            className="inline-grid h-8 w-[3.25rem] shrink-0 cursor-pointer select-none place-items-center rounded-lg border border-orange-500/30 bg-orange-500/15 text-[11px] font-bold uppercase leading-none tracking-wide text-orange-100 [font-feature-settings:normal] hover:bg-orange-500/25 hover:text-white"
          >
            Ma
          </button>
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 shrink-0 flex items-center justify-center"
            onClick={() => {
              if (viewMonth >= 12) {
                setViewMonth(1);
                setViewYear((y) => y + 1);
              } else setViewMonth((m) => m + 1);
            }}
            aria-label="Következő hónap"
          >
            <FiChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="px-2.5 pt-2 pb-1.5">
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-gray-500 mb-1 uppercase leading-none">
            {WEEKDAY_LABELS.map((wd) => (
              <span key={wd.key}>{wd.label}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {gridDays.map((cell, idx) => {
              if (!cell) return <div key={`e-${idx}`} className="h-7" />;
              const selected =
                parsed && parsed.y === viewYear && parsed.mo === viewMonth && parsed.d === cell.day;
              return (
                <button
                  key={cell.day}
                  type="button"
                  onClick={() => pickDay(cell.day)}
                  className={`h-7 rounded-md text-xs font-medium transition-colors leading-none ${
                    selected
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-900/25'
                      : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 border-t border-white/5 px-3 pb-3 pt-3">
          <div className="flex items-center justify-center gap-2 text-[10px] font-semibold uppercase leading-none tracking-wider text-gray-500">
            <FiClock className="h-3.5 w-3.5 shrink-0 text-gray-400 opacity-80" />
            Idő
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] text-gray-500">Óra (0–23)</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={23}
                value={hVal}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isNaN(v)) return;
                  setTime(Math.min(23, Math.max(0, v)), miVal);
                }}
                className={timeInputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-gray-500">Perc (0–59)</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                value={miVal}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isNaN(v)) return;
                  setTime(hVal, Math.min(59, Math.max(0, v)));
                }}
                className={timeInputClass}
              />
            </div>
          </div>

          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              onClick={clear}
              className="text-xs font-medium text-gray-500 hover:text-red-400 transition-colors"
            >
              Időpont törlése
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div
        id={labelId}
        className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 pointer-events-none select-none"
      >
        <FiClock className="w-3.5 h-3.5 opacity-70 shrink-0" />
        {label}
      </div>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={labelId}
        aria-controls={open ? panelListId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`mw-btn mw-filter-trigger !flex h-10 w-full flex-row items-center justify-between gap-2 px-3 py-0 leading-none [&_.mw-dt-row]:items-center ${
          open
            ? 'mw-btn-primary !text-white shadow-none [&_.mw-dt-chevron]:text-white'
            : 'mw-btn-secondary text-gray-400 hover:text-white'
        }`}
      >
        <span className="mw-dt-row flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <span
            className={`flex shrink-0 items-center justify-center rounded-lg p-1 transition-none ${open ? 'text-white' : 'bg-white/5 text-orange-400'}`}
          >
            <FiCalendar className="h-4 w-4" />
          </span>
          <span
            className={`min-w-0 truncate text-sm font-semibold leading-tight ${open ? 'text-white' : parsed ? 'text-gray-100' : 'text-gray-500'}`}
          >
            {displayText}
          </span>
        </span>
        <span className="flex h-10 w-9 shrink-0 items-center justify-center">
          <FiChevronDown
            className={`mw-dt-chevron h-4 w-4 transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </span>
      </button>
      {panel}
    </div>
  );
}
