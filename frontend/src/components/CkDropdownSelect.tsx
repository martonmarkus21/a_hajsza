import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown } from 'react-icons/fi';

export interface CkDropdownOption {
  value: string;
  label: string;
}

interface CkDropdownSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CkDropdownOption[];
  /** Képernyőolvasóhoz */
  ariaLabel: string;
  className?: string;
  /** Panel minimális szélessége (px), ha a trigger keskenyebb */
  minPanelWidth?: number;
}

const VIEWPORT_PAD = 8;

function clampPanelLeft(left: number, panelWidth: number): number {
  if (typeof window === 'undefined') return left;
  const maxL = Math.max(VIEWPORT_PAD, window.innerWidth - panelWidth - VIEWPORT_PAD);
  return Math.min(Math.max(left, VIEWPORT_PAD), maxL);
}

/** Egyedi legördülő – trigger: ck-btn (ugyanaz a magasság, mint a szűrőgombok), portálon. */
export default function CkDropdownSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
  minPanelWidth = 200,
}: CkDropdownSelectProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [panelEnter, setPanelEnter] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelEnteredThisOpen = useRef(false);

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
    }, 200);
    return () => window.clearTimeout(t);
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

  /** Animáció csak nyitáskor, mért pozíció után; scroll/resize ne indítsa újra */
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

  const currentLabel = options.find((o) => o.value === value)?.label ?? '—';

  const showPanel = menuVisible && coords.width > 0;

  const panel =
    showPanel &&
    createPortal(
      <div
        ref={menuRef}
        role="listbox"
        id={panelId}
        className={`fixed z-[10000] overflow-hidden rounded-xl border border-white/10 bg-[#141414] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.75)] ring-1 ring-white/[0.06] max-h-[min(20rem,50vh)] flex flex-col origin-top custom-scrollbar ${
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
        <div className="flex flex-col gap-1 p-1.5 overflow-y-auto max-h-[inherit]">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              className={`w-full shrink-0 text-left rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                opt.value === value
                  ? 'text-white bg-gradient-to-r from-orange-600/25 to-orange-500/15 ring-1 ring-orange-500/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                  : 'text-gray-300 hover:bg-white/[0.07] hover:text-white'
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>,
      document.body,
    );

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`ck-btn w-full min-h-0 !justify-between text-left items-center ${
          open ? 'ck-btn-primary' : 'ck-btn-secondary text-gray-400 hover:text-white'
        }`}
      >
        <span className="truncate min-w-0 font-semibold">{currentLabel}</span>
        <FiChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {panel}
    </div>
  );
}
