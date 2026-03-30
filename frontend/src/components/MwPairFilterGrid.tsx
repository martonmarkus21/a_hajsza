import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown, FiUsers } from 'react-icons/fi';
import type { Pair } from '../types';

const PANEL_CLOSE_MS = 200;
const VIEWPORT_PAD = 8;

function clampPanelLeft(left: number, panelWidth: number): number {
  if (typeof window === 'undefined') return left;
  const maxL = Math.max(VIEWPORT_PAD, window.innerWidth - panelWidth - VIEWPORT_PAD);
  return Math.min(Math.max(left, VIEWPORT_PAD), maxL);
}

interface MwPairFilterGridProps {
  pairs: Pair[];
  value: string;
  onChange: (pairId: string) => void;
  className?: string;
}

/** Pár szűrő — MwDropdownSelect-szerű animáció; nyitott triggeren kontrasztos szöveg/ikon. */
export default function MwPairFilterGrid({ pairs, value, onChange, className = '' }: MwPairFilterGridProps) {
  const triggerId = useId();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [panelEnter, setPanelEnter] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelEnteredThisOpen = useRef(false);

  const sorted = [...pairs].sort((a, b) => a.assignedNumber - b.assignedNumber);

  const selectedPair = value ? pairs.find((p) => String(p.id) === value) : undefined;
  const triggerLabel = selectedPair
    ? selectedPair.name?.trim()
      ? selectedPair.name.trim()
      : `#${selectedPair.assignedNumber}`
    : 'Minden pár';

  const minPanelWidth = 280;

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = Math.max(r.width, minPanelWidth);
    const left = clampPanelLeft(r.left, w);
    setCoords({ top: r.bottom + 6, left, width: w });
  }, [minPanelWidth]);

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
    const id = requestAnimationFrame(() => {
      updatePosition();
    });
    return () => cancelAnimationFrame(id);
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
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelEnter(true));
    });
    return () => cancelAnimationFrame(id);
  }, [menuVisible, open, coords.width]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
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

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  /** Kompakt badge: eredeti narancs keret; csak nyitott (primary) gombnál sötétebb keret. */
  const pairBadgeClass = (mw: boolean, compact: boolean) => {
    const base = compact
      ? 'w-6 h-6 shrink-0 rounded-full flex items-center justify-center font-bold text-xs border-2 border-orange-500 text-white shadow-sm transition-colors duration-300'
      : 'w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-sm border-[3px] border-orange-500 text-white shadow-sm transition-colors duration-300';
    return `${base} ${mw ? 'bg-orange-500' : 'bg-[#2a2a2a]'}`;
  };

  const showPanel = menuVisible && coords.width > 0;

  const panel =
    showPanel &&
    createPortal(
      <div
        ref={menuRef}
        role="listbox"
        id={listboxId}
        aria-labelledby={triggerId}
        className={`fixed z-[10000] overflow-hidden rounded-xl border border-white/10 bg-[#141414] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.75)] ring-1 ring-white/[0.06] flex flex-col origin-top custom-scrollbar ${
          open && panelEnter
            ? 'opacity-100 translate-y-0 scale-100 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]'
            : 'opacity-0 -translate-y-1 scale-[0.98] pointer-events-none transition-[opacity,transform] duration-150 ease-out'
        }`}
        style={{
          top: coords.top,
          left: coords.left,
          width: coords.width,
          maxHeight: 'min(70vh, 440px)',
          transformOrigin: 'top center',
        }}
      >
        <div className="px-3 py-2 border-b border-white/5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          Válasszon párt
        </div>
        <div className="p-2.5 overflow-y-auto max-h-[min(58vh,380px)] custom-scrollbar">
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            <button
              type="button"
              role="option"
              aria-selected={value === ''}
              onClick={() => select('')}
              className={`aspect-square rounded-lg border flex flex-col items-center justify-center text-[11px] font-bold transition-colors ${
                value === ''
                  ? 'border-orange-500/60 bg-orange-500/15 text-white'
                  : 'border-white/10 bg-white/[0.03] text-gray-400 hover:bg-white/[0.07] hover:text-white'
              }`}
            >
              Összes
            </button>
            {sorted.map((p) => {
              const active = String(p.id) === value;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => select(String(p.id))}
                  title={p.name?.trim() || undefined}
                  className={`aspect-square rounded-lg border flex items-center justify-center transition-colors ${
                    active
                      ? 'border-orange-500 bg-white/[0.06] ring-1 ring-orange-500/35'
                      : 'border-white/10 bg-[#1a1a1a] hover:border-white/20 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className={pairBadgeClass(!!p.mostWanted, false)}>{p.assignedNumber}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`mw-btn mw-filter-trigger !flex h-10 w-full flex-row items-center justify-between gap-2 px-3 py-0 leading-none text-left ${
          open
            ? 'mw-btn-primary !text-white shadow-none [&_.mw-pair-chevron]:text-white'
            : 'mw-btn-secondary text-gray-400 hover:text-white'
        }`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {selectedPair ? (
            <span
              className={
                open
                  ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-orange-800 bg-orange-950/90 font-bold text-xs text-white shadow-inner transition-none'
                  : pairBadgeClass(!!selectedPair.mostWanted, true)
              }
            >
              {selectedPair.assignedNumber}
            </span>
          ) : (
            <span
              className={`flex shrink-0 items-center justify-center rounded-lg p-1 ${open ? 'text-white' : 'bg-white/5 text-orange-400'}`}
            >
              <FiUsers className="h-4 w-4" />
            </span>
          )}
          <span
            className={`max-w-[7rem] min-w-0 truncate text-sm font-semibold leading-tight sm:max-w-[9rem] ${open ? 'text-white' : 'text-gray-100'}`}
          >
            {triggerLabel}
          </span>
        </span>
        <span className="flex h-10 w-9 shrink-0 items-center justify-center">
          <FiChevronDown
            className={`mw-pair-chevron h-4 w-4 transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </span>
      </button>
      {panel}
    </div>
  );
}
