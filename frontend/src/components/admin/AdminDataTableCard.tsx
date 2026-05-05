import type { ComponentType, ReactNode } from 'react';

const ICON_TONE_CLASS: Record<'orange' | 'red' | 'blue' | 'green', string> = {
  orange: 'bg-orange-500/20 text-orange-500',
  red: 'bg-red-500/20 text-red-400',
  blue: 'bg-blue-500/20 text-blue-400',
  green: 'bg-emerald-500/20 text-emerald-400',
};

export type AdminDataTableIconTone = keyof typeof ICON_TONE_CLASS;

export interface AdminDataTableCardProps {
  title: string;
  icon: ReactNode;
  iconTone?: AdminDataTableIconTone;
  /** Ha nincs megadva, a „találat” pill sem jelenik meg. */
  countBadge?: string;
  headerActions?: ReactNode;
  /** A görgethető rész alatt, még a kártyán belül (pl. lapozó). */
  footer?: ReactNode;
  children: ReactNode;
  scrollClassName?: string;
  cardClassName?: string;
}

/**
 * Admin aloldalak közös „kártya + fejléc + görgethető táblázat” burkolója (ck-card, ikon, cím, találat-szám).
 */
export function AdminDataTableCard({
  title,
  icon,
  iconTone = 'orange',
  countBadge,
  headerActions,
  footer,
  children,
  scrollClassName = 'overflow-x-auto custom-scrollbar',
  cardClassName = 'ck-card p-0 overflow-hidden flex flex-col',
}: AdminDataTableCardProps) {
  const toneClass = ICON_TONE_CLASS[iconTone] ?? ICON_TONE_CLASS.orange;

  return (
    <div className={cardClassName}>
      <div className="p-6 border-b border-white/10 flex justify-between items-center gap-4 bg-white/[0.02]">
        <h3 className="text-xl font-bold text-white flex items-center gap-3 flex-wrap min-w-0">
          <div className={`p-2 rounded-xl shrink-0 ${toneClass}`}>{icon}</div>
          <span className="min-w-0">{title}</span>
          {countBadge != null && (
            <span className="text-sm font-normal text-gray-500 ml-2 py-1 px-3 bg-white/5 rounded-full border border-white/5 shrink-0">
              {countBadge}
            </span>
          )}
        </h3>
        {headerActions ? <div className="flex shrink-0 items-center gap-2">{headerActions}</div> : null}
      </div>
      <div className={scrollClassName}>{children}</div>
      {footer}
    </div>
  );
}

export interface AdminTableEmptyRowProps {
  colSpan: number;
  icon: ComponentType<{ className?: string }>;
  title: string;
  hint: string;
}

/** Üres táblaállapot: egy sor, középre igazított szöveg (ck-table tbody-ban használd). */
export function AdminTableEmptyRow({ colSpan, icon: Icon, title, hint }: AdminTableEmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0 border-b-0">
        <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2">
          <Icon className="w-8 h-8 opacity-30" />
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-gray-600 max-w-md text-center">{hint}</p>
        </div>
      </td>
    </tr>
  );
}

/** Táblázat helyén megjelenő betöltés (scroll területen, táblázat helyett). */
export function AdminTableLoadingState({ label = 'Betöltés…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
      <span className="inline-block w-5 h-5 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin mr-2" />
      {label}
    </div>
  );
}
