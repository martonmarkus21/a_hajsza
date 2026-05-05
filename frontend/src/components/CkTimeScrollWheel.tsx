import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const ITEM_H = 40;
const VISIBLE_ROWS = 5;
const VIEWPORT_H = VISIBLE_ROWS * ITEM_H;

const DEFAULT_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const DEFAULT_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);

function centerTranslateY(index: number): number {
  const vc = VIEWPORT_H / 2;
  return vc - ITEM_H / 2 - index * ITEM_H;
}

function indexFromTranslateY(ty: number, len: number): number {
  const vc = VIEWPORT_H / 2;
  const idx = Math.round((vc - ITEM_H / 2 - ty) / ITEM_H);
  return Math.max(0, Math.min(len - 1, idx));
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function indexForValue(value: number, options: number[]): number {
  if (options.length === 0) return 0;
  const direct = options.indexOf(value);
  if (direct >= 0) return direct;
  let best = 0;
  let bestD = Infinity;
  for (let j = 0; j < options.length; j++) {
    const d = Math.abs(options[j]! - value);
    if (d < bestD) {
      bestD = d;
      best = j;
    }
  }
  return best;
}

export interface CkTimeScrollWheelProps {
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
  disabled?: boolean;
  /**
   * Ha megadod: csak ezek a (0–23) órák jelennek meg a görgőn.
   * Ha üres, visszaáll az 0..23-ra a másik helyen kezeljük a CompactTimeField-ben.
   */
  hourOptions?: number[] | null;
  /**
   * A jelenlegi órához: ezek a percek (0–59) jelennek meg a görgőn (pl. játékablak szűrésnél).
   */
  minuteOptions?: number[] | null;
}

/**
 * Két görgős oszlop (óra / perc), húzással és egérgörgővel —
 * iOS-szerű középső sáv, külső könyvtár nélkül.
 */
export function CkTimeScrollWheel({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
  disabled,
  hourOptions,
  minuteOptions,
}: CkTimeScrollWheelProps) {
  const hOpts =
    hourOptions == null
      ? DEFAULT_HOUR_OPTIONS
      : hourOptions.length > 0
        ? hourOptions
        : [0];
  const mOpts =
    minuteOptions == null
      ? DEFAULT_MINUTE_OPTIONS
      : minuteOptions.length > 0
        ? minuteOptions
        : [0];

  return (
    <div
      className={`flex items-stretch justify-center gap-1 select-none ${disabled ? 'pointer-events-none opacity-45' : ''}`}
      aria-label="Idő választása"
    >
      <WheelColumn label="Óra" options={hOpts} value={hour} onChange={onHourChange} format={pad2} />
      <div className="flex w-5 shrink-0 translate-y-[7px] items-center justify-center text-xl font-light leading-none text-gray-500">
        :
      </div>
      <WheelColumn
        label="Perc"
        options={mOpts}
        value={minute}
        onChange={onMinuteChange}
        format={pad2}
      />
    </div>
  );
}

type WheelColumnProps = {
  label: string;
  options: number[];
  value: number;
  onChange: (v: number) => void;
  format: (n: number) => string;
};

function WheelColumn({ label, options, value, onChange, format }: WheelColumnProps) {
  const len = options.length;
  const [ty, setTy] = useState(() => centerTranslateY(indexForValue(value, options)));
  const [isDragging, setIsDragging] = useState(false);
  const wheelSurfaceRef = useRef<HTMLDivElement>(null);
  const gesture = useRef(false);
  const startY = useRef(0);
  const startTy = useRef(0);
  const tyRef = useRef(ty);
  const valueRef = useRef(value);
  const optionsRef = useRef(options);
  const wheelIdle = useRef<ReturnType<typeof setTimeout> | null>(null);

  tyRef.current = ty;
  valueRef.current = value;
  optionsRef.current = options;

  const minTy = len > 0 ? centerTranslateY(len - 1) : 0;
  const maxTy = len > 0 ? centerTranslateY(0) : 0;

  const clampTy = useCallback(
    (t: number) => Math.min(maxTy, Math.max(minTy, t)),
    [minTy, maxTy],
  );

  const snapToIndex = useCallback(
    (idx: number) => {
      const i = Math.max(0, Math.min(len - 1, idx));
      const t = centerTranslateY(i);
      setTy(t);
      const v = optionsRef.current[i]!;
      if (v !== valueRef.current) onChange(v);
    },
    [len, onChange],
  );

  const finishGesture = useCallback(() => {
    if (!gesture.current) return;
    gesture.current = false;
    setIsDragging(false);
    const idx = indexFromTranslateY(tyRef.current, len);
    snapToIndex(idx);
  }, [len, snapToIndex]);

  useLayoutEffect(() => {
    if (gesture.current) return;
    const o = options;
    if (o.length === 0) return;
    const i = indexForValue(value, o);
    setTy(centerTranslateY(i));
  }, [value, options]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesture.current = true;
    setIsDragging(true);
    startY.current = e.clientY;
    startTy.current = tyRef.current;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!gesture.current) return;
    const next = clampTy(startTy.current + (e.clientY - startY.current));
    setTy(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    finishGesture();
    if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  const onLostPointerCapture = () => {
    if (gesture.current) finishGesture();
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY;
    const step = Math.sign(delta) * Math.min(ITEM_H, Math.abs(delta) * 0.35);
    const next = clampTy(tyRef.current - step);
    setTy(next);
    if (wheelIdle.current) clearTimeout(wheelIdle.current);
    wheelIdle.current = setTimeout(() => {
      wheelIdle.current = null;
      const idx = indexFromTranslateY(tyRef.current, len);
      snapToIndex(idx);
    }, 120);
  };

  useEffect(
    () => () => {
      if (wheelIdle.current) clearTimeout(wheelIdle.current);
    },
    [],
  );

  useEffect(() => {
    const el = wheelSurfaceRef.current;
    if (!el) return;
    const nativeWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const delta = ev.deltaY;
      const step = Math.sign(delta) * Math.min(ITEM_H, Math.abs(delta) * 0.35);
      const next = clampTy(tyRef.current - step);
      setTy(next);
      if (wheelIdle.current) clearTimeout(wheelIdle.current);
      wheelIdle.current = setTimeout(() => {
        wheelIdle.current = null;
        const idx = indexFromTranslateY(tyRef.current, len);
        snapToIndex(idx);
      }, 120);
    };
    el.addEventListener('wheel', nativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', nativeWheel);
  }, [clampTy, len, snapToIndex]);

  const displayIdx = indexFromTranslateY(ty, len);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-600">{label}</span>
      <div
        ref={wheelSurfaceRef}
        className="relative cursor-grab overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a0a] shadow-inner shadow-black/40 active:cursor-grabbing"
        style={{ height: VIEWPORT_H, width: 72, touchAction: 'none', overscrollBehavior: 'contain' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onLostPointerCapture}
        onWheel={onWheel}
        role="listbox"
        aria-label={label}
        aria-valuenow={options[displayIdx] ?? 0}
      >
        <div
          className="pointer-events-none absolute inset-x-0 z-10 border-y border-orange-500/25 bg-orange-500/[0.07]"
          style={{ top: (VIEWPORT_H - ITEM_H) / 2, height: ITEM_H }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-10 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-10 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent"
          aria-hidden
        />

        <div
          className="relative z-0 will-change-transform"
          style={{
            transform: `translateY(${ty}px)`,
            transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {options.map((val, i) => {
            const sel = i === displayIdx;
            return (
              <div
                key={`${val}-${i}`}
                role="option"
                aria-selected={sel}
                className="flex items-center justify-center text-[17px] font-semibold tabular-nums leading-none"
                style={{ height: ITEM_H }}
              >
                <span
                  className={
                    sel ? 'text-white' : 'scale-[0.92] text-gray-500 opacity-75'
                  }
                >
                  {format(val)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
