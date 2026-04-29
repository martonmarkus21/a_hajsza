import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

const GAP = 8;
const VIEW = 8;

type Pos = { top: number; left: number };

/**
 * Rögzített, viewport-hoz igazodó lebegő tipp: ha alul nincs hely, a trigger fölé kerül.
 * Erősebb glass, szürke keret, rövid fade.
 */
export function FloatingHoverTip({
  content,
  children,
  className = '',
  panelClassName = '',
}: {
  content: string;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<Pos>({ top: 0, left: 0 });

  const clearLeave = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };

  const scheduleClose = () => {
    clearLeave();
    setFadeIn(false);
    leaveTimer.current = setTimeout(() => setOpen(false), 180);
  };

  const layout = useCallback(() => {
    const tr = triggerRef.current;
    const tip = tipRef.current;
    if (!tr || !tip) return;
    const r = tr.getBoundingClientRect();
    const h = tip.getBoundingClientRect().height || 1;
    const w = Math.min(tip.getBoundingClientRect().width, window.innerWidth - VIEW * 2);
    let top = r.bottom + GAP;
    if (r.bottom + GAP + h > window.innerHeight - VIEW) {
      const t2 = r.top - GAP - h;
      if (t2 >= VIEW) {
        top = t2;
      } else {
        top = Math.max(VIEW, window.innerHeight - h - VIEW);
      }
    }
    const left = Math.min(Math.max(VIEW, r.left), window.innerWidth - w - VIEW);
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    setFadeIn(false);
    layout();
    const r1 = requestAnimationFrame(() => {
      layout();
      requestAnimationFrame(() => {
        layout();
        setFadeIn(true);
      });
    });
    const onScroll = () => layout();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(r1);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, content, layout]);

  useEffect(() => () => clearLeave(), []);

  return (
    <span
      ref={triggerRef}
      className={`relative inline-flex ${className}`.trim()}
      onMouseEnter={() => {
        clearLeave();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      {children}
      {open &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            onMouseEnter={() => {
              clearLeave();
              setOpen(true);
              setFadeIn(true);
            }}
            onMouseLeave={scheduleClose}
            className={`fixed z-[10070] w-max max-w-[min(100vw-1rem,20rem)] rounded-lg border border-gray-500/35 bg-[#0c0c0c]/97 px-3 py-2.5 text-left text-[12px] leading-relaxed text-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.65)] backdrop-blur-2xl backdrop-saturate-100 transition-opacity duration-200 ease-out ${panelClassName} ${
              fadeIn ? 'opacity-100' : 'opacity-0'
            }`.trim()}
            style={{ top: pos.top, left: pos.left, pointerEvents: 'auto' }}
          >
            {content
              .split(/\n+/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((para, i) => (
                <p key={i} className="mb-1.5 last:mb-0">
                  {para}
                </p>
              ))}
          </div>,
          document.body,
        )}
    </span>
  );
}
