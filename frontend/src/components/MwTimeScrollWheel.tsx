import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const ITEM_H = 40;
const VISIBLE_ROWS = 5;
const VIEWPORT_H = VISIBLE_ROWS * ITEM_H;

function centerTranslateY(index: number): number {
  const vc = VIEWPORT_H / 2;
  return vc - ITEM_H / 2 - index * ITEM_H;
}

function indexFromTranslateY(ty: number, length: number): number {
  const vc = VIEWPORT_H / 2;
  const idx = Math.round((vc - ITEM_H / 2 - ty) / ITEM_H);
  return Math.max(0, Math.min(length - 1, idx));
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export interface MwTimeScrollWheelProps {
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
  disabled?: boolean;
}

/**
 * Két görgős oszlop (óra / perc), húzással és egérgörgővel —
 * iOS-szerű középső sáv, külső könyvtár nélkül.
 */
export function MwTimeScrollWheel({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
  disabled,
}: MwTimeScrollWheelProps) {
  return (
    <div
      className={`flex items-stretch justify-center gap-0.5 select-none ${disabled ? 'pointer-events-none opacity-45' : ''}`}
      aria-label="Idő választása"
    >
      <WheelColumn label="Óra" length={24} value={hour} onChange={onHourChange} format={pad2} />
      <div className="flex w-5 shrink-0 translate-y-[7px] items-center justify-center text-xl font-light leading-none text-gray-500">
        :
      </div>
      <WheelColumn label="Perc" length={60} value={minute} onChange={onMinuteChange} format={pad2} />
    </div>
  );
}

type WheelColumnProps = {
  label: string;
  length: number;
  value: number;
  onChange: (v: number) => void;
  format: (n: number) => string;
};

function WheelColumn({ label, length, value, onChange, format }: WheelColumnProps) {
  const [ty, setTy] = useState(() => centerTranslateY(value));
  const [isDragging, setIsDragging] = useState(false);
  const gesture = useRef(false);
  const startY = useRef(0);
  const startTy = useRef(0);
  const tyRef = useRef(ty);
  const valueRef = useRef(value);
  const wheelIdle = useRef<ReturnType<typeof setTimeout> | null>(null);

  tyRef.current = ty;
  valueRef.current = value;

  const minTy = centerTranslateY(length - 1);
  const maxTy = centerTranslateY(0);

  const clampTy = useCallback(
    (t: number) => Math.min(maxTy, Math.max(minTy, t)),
    [minTy, maxTy],
  );

  const snapToIndex = useCallback(
    (idx: number) => {
      const t = centerTranslateY(idx);
      setTy(t);
      if (idx !== valueRef.current) onChange(idx);
    },
    [onChange],
  );

  const finishGesture = useCallback(() => {
    if (!gesture.current) return;
    gesture.current = false;
    setIsDragging(false);
    const idx = indexFromTranslateY(tyRef.current, length);
    snapToIndex(idx);
  }, [length, snapToIndex]);

  useLayoutEffect(() => {
    if (gesture.current) return;
    setTy(centerTranslateY(value));
  }, [value]);

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
      const idx = indexFromTranslateY(tyRef.current, length);
      snapToIndex(idx);
    }, 120);
  };

  useEffect(
    () => () => {
      if (wheelIdle.current) clearTimeout(wheelIdle.current);
    },
    [],
  );

  const displayIdx = indexFromTranslateY(ty, length);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-600">{label}</span>
      <div
        className="relative cursor-grab overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a0a] shadow-inner shadow-black/40 active:cursor-grabbing"
        style={{ height: VIEWPORT_H, width: 72, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onLostPointerCapture}
        onWheel={onWheel}
        role="listbox"
        aria-label={label}
        aria-valuenow={displayIdx}
      >
        <div
          className="pointer-events-none absolute inset-x-0 z-10 border-y border-orange-500/25 bg-orange-500/[0.07]"
          style={{ top: (VIEWPORT_H - ITEM_H) / 2, height: ITEM_H }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-10 bg-gradient-to-b from-[#141414] to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-10 bg-gradient-to-t from-[#141414] to-transparent"
          aria-hidden
        />

        <div
          className="relative z-0 will-change-transform"
          style={{
            transform: `translateY(${ty}px)`,
            transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {Array.from({ length }, (_, i) => {
            const sel = i === displayIdx;
            return (
              <div
                key={i}
                role="option"
                aria-selected={sel}
                className="flex items-center justify-center text-[17px] font-semibold tabular-nums leading-none"
                style={{ height: ITEM_H }}
              >
                <span
                  className={
                    sel ? 'text-white drop-shadow-sm' : 'text-gray-500 scale-[0.92] opacity-75'
                  }
                >
                  {format(i)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
