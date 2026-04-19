import type { ReactNode } from 'react';
import { FaSortUp, FaSortDown } from 'react-icons/fa6';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export type SortDirection = 'asc' | 'desc';

function SortIcons({ active, direction }: { active: boolean; direction: SortDirection }) {
  return (
    <div className="flex flex-col ml-1 shrink-0">
      <FaSortUp
        className={`w-3 h-3 -mb-3 ${active && direction === 'asc' ? 'text-orange-500' : 'text-gray-500 opacity-60'}`}
      />
      <FaSortDown
        className={`w-3 h-3 ${active && direction === 'desc' ? 'text-orange-500' : 'text-gray-500 opacity-60'}`}
      />
    </div>
  );
}

export interface AdminTableSortThProps {
  onSort: () => void;
  active: boolean;
  direction: SortDirection;
  align?: 'left' | 'center' | 'right';
  /** Első oszlop: pl-6 */
  paddedStart?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}

/** mw-table rendezhető fejléc cella (ikon + szöveg). */
export function AdminTableSortTh({
  onSort,
  active,
  direction,
  align = 'left',
  paddedStart = false,
  title: ariaTitle,
  className = '',
  children,
}: AdminTableSortThProps) {
  const alignClass =
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
  const flexJustify =
    align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : '';

  return (
    <th
      title={ariaTitle}
      className={`${alignClass} py-4 cursor-pointer group hover:bg-white/5 transition-colors ${paddedStart ? 'pl-6' : ''} ${className}`.trim()}
      onClick={onSort}
    >
      <div className={`flex items-center gap-1 text-gray-400 group-hover:text-white ${flexJustify}`}>
        {children}
        <SortIcons active={active} direction={direction} />
      </div>
    </th>
  );
}

export interface AdminTableShellProps {
  /** Egy `<tr>…</tr>` sor a fejléchez. */
  headerRow: ReactNode;
  children: ReactNode;
  tbodyClassName?: string;
}

/** Közös `mw-table` + thead/tbody (divide-y) szerkezet. */
export function AdminTableShell({
  headerRow,
  children,
  tbodyClassName = 'divide-y divide-white/5',
}: AdminTableShellProps) {
  return (
    <table className="mw-table">
      <thead>
        {headerRow}
      </thead>
      <tbody className={tbodyClassName}>{children}</tbody>
    </table>
  );
}

export interface AdminTablePaginationFooterProps {
  totalFiltered: number;
  fromIdx: number;
  toIdx: number;
  page: number;
  totalPages: number;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
}

/** Egységes lapozó sáv a táblázat alján (admin kártyán belül). */
export function AdminTablePaginationFooter({
  totalFiltered,
  fromIdx,
  toIdx,
  page,
  totalPages,
  loading = false,
  onPrev,
  onNext,
}: AdminTablePaginationFooterProps) {
  if (totalFiltered <= 0) return null;

  const displayPage = Math.min(page, totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-white/10 bg-white/[0.02] text-sm">
      <span className="text-gray-500">
        <span className="text-gray-400 font-mono text-xs">
          {fromIdx}–{toIdx}
        </span>
        <span className="mx-1">/</span>
        <span className="font-mono text-xs">{totalFiltered}</span>
        <span className="ml-2 hidden sm:inline">
          · Oldal {displayPage} / {totalPages}
        </span>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={displayPage <= 1 || loading}
          onClick={onPrev}
          className="mw-btn mw-btn-secondary inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs disabled:opacity-40"
        >
          <FiChevronLeft className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
          Előző
        </button>
        <span className="text-gray-500 font-mono text-xs px-2 sm:hidden">
          {displayPage}/{totalPages}
        </span>
        <button
          type="button"
          disabled={displayPage >= totalPages || loading}
          onClick={onNext}
          className="mw-btn mw-btn-secondary inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs disabled:opacity-40"
        >
          Következő
          <FiChevronRight className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
        </button>
      </div>
    </div>
  );
}
