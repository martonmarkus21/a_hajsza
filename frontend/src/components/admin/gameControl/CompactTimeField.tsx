import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown, FiClock } from 'react-icons/fi';
import { MwTimeScrollWheel } from '../../MwTimeScrollWheel';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseHm(hm: string): { h: number; m: number } {
  const [h, m] = (hm || '00:00').split(':');
  return {
    h: Math.min(23, Math.max(0, Number.parseInt(h, 10) || 0)),
    m: Math.min(59, Math.max(0, Number.parseInt(m, 10) || 0)),
  };
}

function toMinutesFromHm(h: number, m: number): number {
  return h * 60 + Math.min(59, Math.max(0, m));
}

function toHmString(h: number, m: number): string {
  return `${pad2(h)}:${pad2(Math.min(59, Math.max(0, m)))}`;
}

/**
 * A játéknap ablakán (azonos napon, start ≤ end) belülre szorít. Éjfélen átnyúló ablaknál nincs szorítás.
 */
function clampMinutesToWindow(
  t: number,
  minHm: string | undefined,
  maxHm: string | undefined,
): number {
  if (minHm == null && maxHm == null) return t;
  let minM = 0;
  let maxM = 24 * 60 - 1;
  if (minHm) {
    const p = parseHm(minHm);
    minM = toMinutesFromHm(p.h, p.m);
  }
  if (maxHm) {
    const p = parseHm(maxHm);
    maxM = toMinutesFromHm(p.h, p.m);
  }
  if (minM > maxM) return t;
  return Math.max(minM, Math.min(maxM, t));
}

/** Az adott órához: minden perc (0–59), ami a [minT, maxT] játékablakba esik. */
function minutesForHourInWindow(h: number, minT: number, maxT: number): number[] {
  const out: number[] = [];
  for (let m = 0; m < 60; m += 1) {
    const t = h * 60 + m;
    if (t >= minT && t <= maxT) out.push(m);
  }
  return out;
}

function buildWindowConstraint(
  minHm: string | undefined,
  maxHm: string | undefined,
): { minT: number; maxT: number; hours: number[] } | null {
  if (minHm == null || maxHm == null) return null;
  const a = parseHm(minHm);
  const b = parseHm(maxHm);
  const minT = toMinutesFromHm(a.h, a.m);
  const maxT = toMinutesFromHm(b.h, b.m);
  if (minT > maxT) return null;
  const hours: number[] = [];
  for (let h = 0; h < 24; h++) {
    if (h * 60 + 59 >= minT && h * 60 <= maxT) hours.push(h);
  }
  if (hours.length === 0) return null;
  return { minT, maxT, hours };
}

type Coords = {
  top: number;
  left: number;
  width: number;
  placeAbove: boolean;
};

interface CompactTimeFieldProps {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  className?: string;
  /** Ha megadod mindkettőt (azonos napon, mettől ≤ meddig), az idő a játékablakon belül marad. */
  minHm?: string;
  maxHm?: string;
  /** Ezek az időpontok nem választhatók (pl. duplikált "Mettől" tiltása). */
  excludeHm?: string[];
}

const GAP = 6;
const VIEW_PAD = 8;
const PANEL_HEIGHT_EST = 300;

/**
 * Egyetlen időgomb, portálon görgős választó. Ha alul nincs hely, a panel a trigger fölé kerül.
 * A beúszó animáció csak a pozíció véglegesítése után indul.
 */
export default function CompactTimeField({
  value,
  onChange,
  label,
  className = '',
  minHm,
  maxHm,
  excludeHm,
}: CompactTimeFieldProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  /** Egy képkocka késleltetés, hogy a lenyitás legyen enyhe animáció, ne pattanjon be */
  const [enterReady, setEnterReady] = useState(false);
  const [coords, setCoords] = useState<Coords>({
    top: 0,
    left: 0,
    width: 0,
    placeAbove: false,
  });
  const layoutPanelRef = useRef<() => void>(() => {});

  const { h, m } = parseHm(value);
  const clampedTotal = useMemo(
    () => clampMinutesToWindow(toMinutesFromHm(h, m), minHm, maxHm),
    [h, m, minHm, maxHm],
  );
  const wh = Math.floor(clampedTotal / 60) % 24;
  const wm = clampedTotal % 60;

  const windowC = useMemo(() => buildWindowConstraint(minHm, maxHm), [minHm, maxHm]);
  const currentHm = toHmString(wh, wm);
  const excludedSet = useMemo(() => {
    const out = new Set<string>();
    for (const hm of excludeHm || []) {
      const parsed = parseHm(hm);
      out.add(toHmString(parsed.h, parsed.m));
    }
    return out;
  }, [excludeHm]);

  const hourOptions = useMemo(() => {
    const base = windowC ? windowC.hours : Array.from({ length: 24 }, (_, i) => i);
    const filtered = base.filter((hour) => {
      for (let minute = 0; minute < 60; minute += 1) {
        const hm = toHmString(hour, minute);
        if (hm === currentHm || !excludedSet.has(hm)) return true;
      }
      return false;
    });
    return filtered.length > 0 ? filtered : base;
  }, [windowC, excludedSet, currentHm]);
  const minuteOptions = useMemo(() => {
    const base = windowC ? minutesForHourInWindow(wh, windowC.minT, windowC.maxT) : Array.from({ length: 60 }, (_, i) => i);
    const filtered = base.filter((minute) => {
      const hm = toHmString(wh, minute);
      return hm === currentHm || !excludedSet.has(hm);
    });
    return filtered.length > 0 ? filtered : base;
  }, [windowC, wh, excludedSet, currentHm]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (minHm == null && maxHm == null) return;
    const cur = toHmString(h, m);
    const next = toHmString(wh, wm);
    if (cur !== next) onChangeRef.current(next);
  }, [minHm, maxHm, h, m, wh, wm]);

  const layoutPanel = useCallback(() => {
    const tr = triggerRef.current;
    if (!tr) return;
    const r = tr.getBoundingClientRect();
    const w = Math.max(r.width, 200);
    const maxL = Math.max(VIEW_PAD, window.innerWidth - w - VIEW_PAD);
    const left = Math.min(Math.max(r.left, VIEW_PAD), maxL);
    const pan = panelRef.current;
    // offsetHeight: transform (scale) nélküli tényleges magasság — a nyitó animáció scale-je
    // csökkentheti a getBoundingClientRect() magasságát, emiatt „placeAbove” eset pár pixellel lejjebb esett.
    let measured = 0;
    if (pan) {
      void pan.offsetHeight; // kényszerített layout, mielőtt mérnénk
      const oh = pan.offsetHeight;
      const rh = pan.getBoundingClientRect().height;
      const sh = pan.scrollHeight;
      measured = Math.max(oh, rh, sh, 0);
    }
    const hPanel = measured > 12 ? measured : PANEL_HEIGHT_EST;
    const bottomY = r.bottom + GAP + hPanel;
    let top: number;
    let placeAbove = false;
    if (bottomY > window.innerHeight - VIEW_PAD) {
      const topCandidate = r.top - GAP - hPanel;
      if (topCandidate >= VIEW_PAD) {
        top = topCandidate;
        placeAbove = true;
      } else {
        top = Math.max(VIEW_PAD, window.innerHeight - hPanel - VIEW_PAD);
        placeAbove = false;
      }
    } else {
      top = r.bottom + GAP;
    }
    setCoords((prev) => {
      if (
        prev.top === top &&
        prev.left === left &&
        prev.width === w &&
        prev.placeAbove === placeAbove
      ) {
        return prev;
      }
      return { top, left, width: w, placeAbove };
    });
  }, []);

  layoutPanelRef.current = layoutPanel;

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
      setCoords({ top: 0, left: 0, width: 0, placeAbove: false });
    }, 200);
    return () => clearTimeout(t);
  }, [open, menuVisible]);

  // Fontos: ne függjünk az aktuális időtől (wh/wm) — különben minden húzásnál újraanimál/eltűnik a panel
  useLayoutEffect(() => {
    if (!menuVisible) {
      return;
    }
    const run = () => layoutPanel();
    run();
    const r1 = requestAnimationFrame(() => {
      run();
      requestAnimationFrame(() => {
        run();
      });
    });
    return () => cancelAnimationFrame(r1);
  }, [menuVisible, layoutPanel]);

  useEffect(() => {
    if (!menuVisible) return;
    const onScroll = () => layoutPanelRef.current();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [menuVisible]);

  useEffect(() => {
    if (!menuVisible || !open) return;
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      layoutPanelRef.current();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [menuVisible, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    const canShow = open && menuVisible && coords.width > 0;
    if (!canShow) {
      setEnterReady(false);
      return;
    }
    setEnterReady(false);
    let alive = true;
    const id1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (alive) setEnterReady(true);
      });
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id1);
    };
  }, [open, menuVisible, coords.width]);

  useLayoutEffect(() => {
    if (!enterReady || !open || !menuVisible) return;
    const run = () => layoutPanelRef.current();
    run();
    const id1 = requestAnimationFrame(() => {
      run();
      requestAnimationFrame(() => {
        run();
      });
    });
    return () => cancelAnimationFrame(id1);
  }, [enterReady, open, menuVisible]);

  const emit = (nh: number, nm: number) => {
    const t = clampMinutesToWindow(toMinutesFromHm(nh, nm), minHm, maxHm);
    const th = Math.floor(t / 60) % 24;
    const tm = t % 60;
    onChange(toHmString(th, tm));
  };

  const showPanel = menuVisible && coords.width > 0;
  const headerText = label || 'Idő';
  const origin = coords.placeAbove ? 'bottom center' : 'top center';
  const panelOpenVisual = open && showPanel && enterReady;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`group inline-flex h-11 w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 px-3 transition-colors hover:border-white/18 ${
          open
            ? 'border-orange-400/45 bg-orange-500/10 text-white'
            : 'text-gray-200 hover:bg-black/55'
        } ${className}`}
      >
        <span className="min-w-0 truncate font-mono text-sm font-semibold tabular-nums text-white">
          {pad2(wh)}:{pad2(wm)}
        </span>
        <FiChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 ease-out ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {showPanel &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            className={`fixed z-[10060] max-h-[min(80vh,420px)] overflow-hidden rounded-xl border border-white/10 bg-zinc-950/55 text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.6)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-md backdrop-saturate-100 ${
              panelOpenVisual
                ? 'pointer-events-auto translate-y-0 scale-100 opacity-100 transition-[opacity,transform] duration-220 ease-[cubic-bezier(0.2,0.9,0.2,1)]'
                : 'pointer-events-none scale-[0.98] opacity-0 ' +
                  (coords.placeAbove ? 'translate-y-1' : '-translate-y-1') +
                  ' transition-[opacity,transform] duration-150 ease-out'
            } `}
            style={{
              top: coords.top,
              left: coords.left,
              minWidth: coords.width,
              transformOrigin: origin,
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-gradient-to-b from-white/[0.04] to-transparent"
              aria-hidden
            />
            <div className="relative z-10 flex flex-col items-stretch gap-2.5 px-4 py-3.5">
              <div className="flex items-center justify-center gap-2">
                <FiClock className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
                <span className="text-[10px] font-bold uppercase leading-none tracking-[0.16em] text-zinc-500">
                  {headerText}
                </span>
              </div>
              <div className="flex justify-center py-0.5">
                <MwTimeScrollWheel
                  hour={wh}
                  minute={wm}
                  onHourChange={(nh) => emit(nh, wm)}
                  onMinuteChange={(nm) => emit(wh, nm)}
                  hourOptions={hourOptions}
                  minuteOptions={minuteOptions}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
