import { useEffect, useMemo, useRef, useState } from 'react';
import { FiArrowRight, FiChevronDown, FiClock } from 'react-icons/fi';
import { MwTimeScrollWheel } from '../../MwTimeScrollWheel';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function snapTotalMinutes5(n: number): number {
  return Math.round(n / 5) * 5;
}

function hmToMinutes(hm: string): number {
  const [h, m] = (hm || '00:00').split(':');
  const hh = Number.parseInt(h, 10) || 0;
  const mm = Number.parseInt(m, 10) || 0;
  return hh * 60 + mm;
}

function parseHm(hm: string): { h: number; m: number } {
  const [h, m] = (hm || '00:00').split(':');
  return {
    h: Math.min(23, Math.max(0, Number.parseInt(h, 10) || 0)),
    m: Math.min(59, Math.max(0, Number.parseInt(m, 10) || 0)),
  };
}

function joinHm(h: number, m: number): string {
  return `${pad2(h)}:${pad2(m)}`;
}

function formatDurationLabel(startMin: number, endMin: number): string {
  let diff = endMin - startMin;
  if (diff < 0) diff += 24 * 60;
  if (diff === 0) return '0 perc';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m} perc`;
  if (m === 0) return `${h} óra`;
  return `${h} óra ${m} perc`;
}

const DAY_MINUTES = 24 * 60;
const DAY_MINUTES_MAX = DAY_MINUTES - 5;

type ActiveField = 'start' | 'end' | null;

interface TimeWindowInputProps {
  start: string;
  end: string;
  onChange: (next: { start: string; end: string }) => void;
}

/**
 * Prémium, horizontális időablak választó.
 *
 * - Két letisztult, nagyméretű időcsempe (Kezdés / Vége) egy fénycsík-skála fölött.
 * - A 24 órás skálán narancs glowing kiemelés mutatja a kiválasztott ablakot.
 * - A csempére kattintva nyílik egy görgős iOS-szerű idő-választó,
 *   a másik csempe halványul, a sáv a választás közben is élőben frissül.
 */
export default function TimeWindowInput({ start, end, onChange }: TimeWindowInputProps) {
  const [active, setActive] = useState<ActiveField>(null);
  const [dragging, setDragging] = useState<ActiveField>(null);
  const [animateRange, setAnimateRange] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const startParts = parseHm(start);
  const endParts = parseHm(end);

  const startMin = startParts.h * 60 + startParts.m;
  const endMin = endParts.h * 60 + endParts.m;

  const duration = useMemo(() => formatDurationLabel(hmToMinutes(start), hmToMinutes(end)), [start, end]);

  const startPct = (startMin / DAY_MINUTES) * 100;
  const endPct = (endMin / DAY_MINUTES) * 100;
  const rangeLeft = Math.min(startPct, endPct);
  const rangeWidth = Math.max(0, Math.abs(endPct - startPct));

  const toggle = (field: 'start' | 'end') => {
    setActive((cur) => (cur === field ? null : field));
  };

  const emitStart = (h: number, m: number) => {
    onChange({ start: joinHm(h, m), end });
  };

  const emitEnd = (h: number, m: number) => {
    onChange({ start, end: joinHm(h, m) });
  };

  const setFromPreset = (hStart: number, hEnd: number) => {
    setAnimateRange(true);
    onChange({ start: joinHm(hStart, 0), end: joinHm(hEnd, 0) });
    window.setTimeout(() => setAnimateRange(false), 260);
  };

  const setFromSliderMinutes = (field: 'start' | 'end', rawMinutes: number) => {
    const minutes = snapTotalMinutes5(Math.max(0, Math.min(DAY_MINUTES_MAX, rawMinutes)));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (field === 'start') {
      emitStart(hours, mins);
    } else {
      emitEnd(hours, mins);
    }
  };

  const quickSetHour = (hour: number) => {
    const target = active === 'start' || active === 'end' ? active : null;
    if (!target) return;
    setAnimateRange(true);
    window.setTimeout(() => setAnimateRange(false), 260);
    if (target === 'start') {
      emitStart(hour, 0);
    } else {
      emitEnd(hour, 0);
    }
  };

  const shouldAnimate = dragging == null;

  const pointToMinutes = (clientX: number): number | null => {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    return Math.round((pct / 100) * DAY_MINUTES_MAX);
  };

  const setDraggedValue = (field: 'start' | 'end', clientX: number) => {
    const raw = pointToMinutes(clientX);
    if (raw == null) return;
    if (field === 'start') setFromSliderMinutes('start', raw);
    else setFromSliderMinutes('end', raw);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      setDraggedValue(dragging, e.clientX);
    };
    const onUp = () => setDragging(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging]);

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400">
            <FiClock className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-xs font-medium text-gray-500">Játékablak</p>
            <p className="mt-0.5 text-sm font-semibold text-white">{duration}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: '8–16', from: 8, to: 16 },
            { label: '9–17', from: 9, to: 17 },
            { label: '10–18', from: 10, to: 18 },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setFromPreset(p.from, p.to)}
              className="rounded-lg border border-white/5 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-gray-400 transition-colors hover:border-orange-400/30 hover:bg-orange-500/10 hover:text-orange-200"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TimeTile
          label="Kezdés"
          value={joinHm(startParts.h, startParts.m)}
          isActive={active === 'start'}
          isDim={active === 'end'}
          onClick={() => toggle('start')}
        />
        <div className="flex h-10 items-center justify-center text-gray-500">
          <FiArrowRight className="h-5 w-5" />
        </div>
        <TimeTile
          label="Vége"
          value={joinHm(endParts.h, endParts.m)}
          isActive={active === 'end'}
          isDim={active === 'start'}
          onClick={() => toggle('end')}
          align="right"
        />
      </div>

      <div className="mt-5">
        <div
          ref={trackRef}
          className="relative h-3 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-inset ring-white/5"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const raw = pointToMinutes(e.clientX);
            if (raw == null) return;
            const distStart = Math.abs(raw - startMin);
            const distEnd = Math.abs(raw - endMin);
            const target: 'start' | 'end' = distStart <= distEnd ? 'start' : 'end';
            setFromSliderMinutes(target, raw);
            setDragging(target);
          }}
        >
          <div
            className={`absolute inset-y-0 rounded-full bg-gradient-to-r from-orange-500/90 via-orange-400/80 to-amber-400/80 shadow-[0_0_18px_rgba(249,115,22,0.55)] ${
              shouldAnimate || animateRange ? 'transition-[left,width] duration-200 ease-out' : ''
            }`}
            style={{ left: `${rangeLeft}%`, width: `${rangeWidth}%` }}
          />
          <div
            aria-label="Kezdés csúszka fogó"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();
              setDragging('start');
            }}
            className="absolute top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-white shadow-[0_0_0_3px_rgba(17,17,17,1),0_0_0_4px_rgba(249,115,22,0.8)] hover:scale-110"
            style={{
              left: `${startPct}%`,
              touchAction: 'none',
              // left külön animál (inline), ne a transform-mal egy listában — különben a translate(-50%) miatt a fogó „ugrál”
              transition:
                dragging === 'start'
                  ? 'transform 150ms ease'
                  : 'left 200ms ease-out, transform 150ms ease',
            }}
            role="presentation"
          />
          <div
            aria-label="Vég csúszka fogó"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();
              setDragging('end');
            }}
            className="absolute top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-white shadow-[0_0_0_3px_rgba(17,17,17,1),0_0_0_4px_rgba(249,115,22,0.8)] hover:scale-110"
            style={{
              left: `${endPct}%`,
              touchAction: 'none',
              transition:
                dragging === 'end'
                  ? 'transform 150ms ease'
                  : 'left 200ms ease-out, transform 150ms ease',
            }}
            role="presentation"
          />
        </div>
        <div className="relative mt-2 h-4 text-[10px] font-mono font-semibold tabular-nums text-gray-600">
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h, i, arr) => (
            <button
              key={h}
              type="button"
              disabled={active !== 'start' && active !== 'end'}
              onClick={() => quickSetHour(h)}
              className={`absolute top-0 transition-colors ${
                active === 'start' || active === 'end'
                  ? 'cursor-pointer hover:text-orange-300'
                  : 'cursor-default opacity-50'
              }`}
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
              {pad2(h)}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
          active ? 'mt-4 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0">
          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-orange-300">
                {active === 'start' ? 'Kezdés idejének beállítása' : 'Végidő beállítása'}
              </p>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                aria-label="Óra választó bezárása"
              >
                Bezárás
                <FiChevronDown className="h-3.5 w-3.5 rotate-180" />
              </button>
            </div>
            <div className="flex justify-center py-1">
              {active === 'start' ? (
                <MwTimeScrollWheel
                  hour={startParts.h}
                  minute={startParts.m}
                  onHourChange={(h) => emitStart(h, startParts.m)}
                  onMinuteChange={(m) => emitStart(startParts.h, m)}
                />
              ) : active === 'end' ? (
                <MwTimeScrollWheel
                  hour={endParts.h}
                  minute={endParts.m}
                  onHourChange={(h) => emitEnd(h, endParts.m)}
                  onMinuteChange={(m) => emitEnd(endParts.h, m)}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeTile({
  label,
  value,
  isActive,
  isDim,
  onClick,
  align = 'left',
}: {
  label: string;
  value: string;
  isActive: boolean;
  isDim: boolean;
  onClick: () => void;
  align?: 'left' | 'right';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
        isActive
          ? 'border-orange-400/60 bg-orange-500/10'
          : isDim
            ? 'border-white/5 bg-white/[0.02] opacity-60 hover:opacity-90'
            : 'border-white/10 bg-black/30 hover:border-white/20 hover:bg-black/40'
      } ${align === 'right' ? 'text-right' : ''}`}
      aria-pressed={isActive}
    >
      <span
        className={`block text-xs font-semibold ${
          isActive ? 'text-orange-300' : 'text-gray-500'
        }`}
      >
        {label}
      </span>
      <span
        className={`mt-0.5 block font-mono text-3xl font-bold tabular-nums leading-none ${
          isActive ? 'text-white' : 'text-gray-100'
        }`}
      >
        {value}
      </span>
      {isActive ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-orange-400/80 to-transparent" />
      ) : null}
    </button>
  );
}
