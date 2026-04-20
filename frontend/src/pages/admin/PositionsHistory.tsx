import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiMapPin,
  FiNavigation,
  FiLayers,
  FiCrosshair,
  FiDownload,
  FiX,
  FiCheckCircle,
  FiXCircle,
  FiUsers,
  FiZap,
  FiAlertCircle,
  FiTrash2,
  FiCheckSquare,
} from 'react-icons/fi';
import MwPairFilterGrid from '../../components/MwPairFilterGrid';
import MwDateTimePicker from '../../components/MwDateTimePicker';
import PositionsTraceMapModal from '../../components/PositionsTraceMapModal';
import PositionRowMapPreview from '../../components/PositionRowMapPreview';
import ConfirmationModal from '../../components/ConfirmationModal';
import {
  AdminDataTableCard,
  AdminTableEmptyRow,
  AdminTableLoadingState,
} from '../../components/admin/AdminDataTableCard';
import {
  AdminTableShell,
  AdminTableSortTh,
  AdminTablePaginationFooter,
} from '../../components/admin/AdminTableKit';
import { DateTimeStackCell, formatDateTimeBudapestParts } from '../../utils/formatDateTimeBudapest';
import { useSocket } from '../../hooks/useSocket';
import { useNotification } from '../../contexts/NotificationContext';
import type { Pair } from '../../types';

export interface AdminPositionRow {
  id: number;
  pairId: number;
  assignedNumber: number | null;
  pairName: string | null;
  lat: number;
  lon: number;
  accuracy: number | null;
  speed: number | null;
  vehicleMode: boolean;
  vehicleSessionRemaining: number | null;
  timestamp: string;
  createdAt: string;
  /** Mentéskor rögzített játékterület(ek) — egy pontos térképnézethez */
  gameAreaSnapshot?: unknown;
  /** Mentéskor volt-e fel nem oldott szabályszegése a párnak */
  hadRuleViolationAtSave?: boolean;
}

type SortKey =
  | 'id'
  | 'pairId'
  | 'timestamp'
  | 'location'
  | 'speed'
  | 'vehicleMode'
  | 'ruleViolation';

const FETCH_PAGE_SIZE = 5000;

function formatTraceIntervalLabel(fromIso?: string, toIso?: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' });
  if (fromIso && toIso) return `${fmt(fromIso)} – ${fmt(toIso)}`;
  if (fromIso) return `${fmt(fromIso)} —`;
  if (toIso) return `— ${fmt(toIso)}`;
  return 'teljes időszak';
}

function buildPositionMapSubtitle(row: AdminPositionRow): string {
  const num = row.assignedNumber ?? row.pairId;
  const name = row.pairName?.trim();
  const d = new Date(row.timestamp).toLocaleString('hu-HU', { dateStyle: 'medium', timeStyle: 'short' });
  return `Pár #${num}${name ? ` (${name})` : ''} · ${d}`;
}

interface PositionsHistoryProps {
  pairs: Pair[];
  onSelectPairById: (pairId: number) => void;
}

function localInputToIso(value: string): string | undefined {
  if (!value || !value.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

type MapConfig =
  | { variant: 'trace'; pairId: number; headerSubtitle: string }
  | { variant: 'single'; pairId: number; headerSubtitle: string; row: AdminPositionRow };

function compareNullableNum(
  a: number | null | undefined,
  b: number | null | undefined,
  dir: number,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * dir;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function PositionsHistory({ pairs, onSelectPairById }: PositionsHistoryProps) {
  const { socket } = useSocket();
  const { addNotification } = useNotification();
  const [allRows, setAllRows] = useState<AdminPositionRow[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pairFilter, setPairFilter] = useState('');
  const [fromLocal, setFromLocal] = useState('');
  const [toLocal, setToLocal] = useState('');

  const [quickPanelVisible, setQuickPanelVisible] = useState(false);
  const [quickPanelExiting, setQuickPanelExiting] = useState(false);

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'timestamp',
    direction: 'desc',
  });

  const [mapOpen, setMapOpen] = useState(false);
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const selectAllHeaderRef = useRef<HTMLInputElement>(null);
  const deleteInFlightRef = useRef(false);

  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
  const [confirmDeleteSelectedOpen, setConfirmDeleteSelectedOpen] = useState(false);
  const [deletingPositions, setDeletingPositions] = useState(false);

  const fromIso = useMemo(() => localInputToIso(fromLocal), [fromLocal]);
  const toIso = useMemo(() => localInputToIso(toLocal), [toLocal]);

  useEffect(() => {
    if (pairFilter) {
      setQuickPanelExiting(false);
      setQuickPanelVisible(true);
    } else if (quickPanelVisible) {
      setQuickPanelExiting(true);
    }
  }, [pairFilter, quickPanelVisible]);

  const hasActiveFilters = !!(pairFilter.trim() || fromLocal.trim() || toLocal.trim());

  const mostWantedByPairId = useMemo(() => {
    const m = new Map<number, boolean>();
    for (const p of pairs) m.set(p.id, !!p.mostWanted);
    return m;
  }, [pairs]);
  const capturedByPairId = useMemo(() => {
    const m = new Map<number, boolean>();
    for (const p of pairs) m.set(p.id, !!p.captured);
    return m;
  }, [pairs]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('pageSize', String(FETCH_PAGE_SIZE));
      params.set('sortBy', 'timestamp');
      params.set('sortDir', 'desc');

      const res = await fetch(`http://localhost:3000/api/positions/admin/list?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        if (res.status === 403) {
          setError('Nincs jogosultsága a mentett pozíciók megtekintéséhez (csak adminisztrátor).');
        } else {
          setError('A lista betöltése nem sikerült.');
        }
        setAllRows([]);
        return;
      }
      const data = await res.json();
      setAllRows(data.items || []);
    } catch {
      setError('Hálózati hiba történt.');
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadRef = useRef(loadAll);
  loadRef.current = loadAll;

  useEffect(() => {
    if (!socket) return;
    const onSaved = () => {
      void loadRef.current();
    };
    socket.on('savedPositionSample', onSaved);
    socket.on('savedPositionsDeleted', onSaved);
    return () => {
      socket.off('savedPositionSample', onSaved);
      socket.off('savedPositionsDeleted', onSaved);
    };
  }, [socket]);

  useEffect(() => {
    setPage(1);
  }, [pairFilter, fromLocal, toLocal, sortConfig.key, sortConfig.direction]);

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [pairFilter]);

  useEffect(() => {
    if (!selectionMode) setSelectedIds(new Set());
  }, [selectionMode]);

  const filteredRows = useMemo(() => {
    let list = allRows;
    if (pairFilter) {
      list = list.filter((r) => String(r.pairId) === pairFilter);
    }
    if (fromIso) {
      const t = new Date(fromIso).getTime();
      list = list.filter((r) => new Date(r.timestamp).getTime() >= t);
    }
    if (toIso) {
      const t = new Date(toIso).getTime();
      list = list.filter((r) => new Date(r.timestamp).getTime() <= t);
    }
    return list;
  }, [allRows, pairFilter, fromIso, toIso]);

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const key = sortConfig.key;
      switch (key) {
        case 'id':
          return (a.id - b.id) * dir;
        case 'pairId': {
          const an = a.assignedNumber ?? a.pairId;
          const bn = b.assignedNumber ?? b.pairId;
          return (an - bn) * dir;
        }
        case 'timestamp':
          return (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) * dir;
        case 'location': {
          const clat = (a.lat - b.lat) * dir;
          if (clat !== 0) return clat;
          return (a.lon - b.lon) * dir;
        }
        case 'speed':
          return compareNullableNum(a.speed, b.speed, dir);
        case 'vehicleMode':
          return ((a.vehicleMode ? 1 : 0) - (b.vehicleMode ? 1 : 0)) * dir;
        case 'ruleViolation':
          return (
            ((a.hadRuleViolationAtSave ? 1 : 0) - (b.hadRuleViolationAtSave ? 1 : 0)) * dir
          );
        default:
          return 0;
      }
    });
    return arr;
  }, [filteredRows, sortConfig]);

  const exportFilteredCsv = useCallback(() => {
    if (sortedRows.length === 0) {
      addNotification('info', 'Nincs exportálható sor a jelenlegi szűréssel.');
      return;
    }
    const header = [
      'id',
      'pair_id',
      'assigned_number',
      'pair_name',
      'lat',
      'lon',
      'accuracy_m',
      'speed_kmh',
      'vehicle_mode',
      'vehicle_session_remaining_s',
      'had_rule_violation_at_save',
      'timestamp_iso',
      'created_at_iso',
    ];
    const lines = [header.join(',')];
    for (const r of sortedRows) {
      const cols = [
        r.id,
        r.pairId,
        r.assignedNumber ?? '',
        r.pairName ?? '',
        r.lat,
        r.lon,
        r.accuracy ?? '',
        r.speed ?? '',
        r.vehicleMode ? '1' : '0',
        r.vehicleSessionRemaining ?? '',
        r.hadRuleViolationAtSave ? '1' : '0',
        r.timestamp,
        r.createdAt,
      ];
      lines.push(cols.map(csvEscape).join(','));
    }
    const body = lines.join('\r\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mentett-poziciok_${stamp}.csv`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      addNotification('success', `${sortedRows.length} sor exportálva (CSV).`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [sortedRows, addNotification]);

  const totalFiltered = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);
  const rows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const allFilteredIds = useMemo(() => sortedRows.map((r) => r.id), [sortedRows]);
  const allFilteredSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));
  const someFilteredSelected =
    allFilteredIds.some((id) => selectedIds.has(id)) && !allFilteredSelected;

  useEffect(() => {
    const el = selectAllHeaderRef.current;
    if (el) el.indeterminate = someFilteredSelected;
  }, [someFilteredSelected]);

  const fromIdx = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const toIdx = Math.min(safePage * pageSize, totalFiltered);

  const handleSort = (key: SortKey) => {
    setSortConfig((c) => ({
      key,
      direction: c.key === key && c.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const thSort = (key: SortKey, label: string, className = '') => (
    <AdminTableSortTh
      key={String(key)}
      align="center"
      className={`px-3 ${className}`.trim()}
      onSort={() => handleSort(key)}
      active={sortConfig.key === key}
      direction={sortConfig.direction}
    >
      {label}
    </AdminTableSortTh>
  );

  const openSingleModal = (row: AdminPositionRow) => {
    setMapConfig({
      variant: 'single',
      pairId: row.pairId,
      headerSubtitle: buildPositionMapSubtitle(row),
      row,
    });
    setMapOpen(true);
  };

  const openMapFromToolbar = () => {
    if (!pairFilter) return;
    if (fromIso && toIso && new Date(fromIso).getTime() > new Date(toIso).getTime()) {
      setError('Az „időponttól” nem lehet későbbi, mint az „időpontig”. Javítsa a szűrőt, vagy törölje az egyik dátumot.');
      return;
    }
    setError(null);
    const p = pairs.find((x) => String(x.id) === pairFilter);
    if (!p) return;
    const name = p.name?.trim();
    const headerSubtitle = `Pár #${p.assignedNumber}${name ? ` (${name})` : ''} · ${formatTraceIntervalLabel(fromIso, toIso)}`;
    setMapConfig({
      variant: 'trace',
      pairId: p.id,
      headerSubtitle,
    });
    setMapOpen(true);
  };

  const closeMap = () => {
    setMapOpen(false);
    window.setTimeout(() => setMapConfig(null), 220);
  };

  const selectedPairId = pairFilter ? Number.parseInt(pairFilter, 10) : NaN;
  const selectedPair = Number.isFinite(selectedPairId)
    ? pairs.find((x) => x.id === selectedPairId)
    : undefined;
  const selectedPairLabel = selectedPair
    ? `Pár #${selectedPair.assignedNumber}${selectedPair.name?.trim() ? ` (${selectedPair.name.trim()})` : ''}`
    : pairFilter
      ? `Pár #${pairFilter}`
      : '';

  const toggleSelectId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(allFilteredIds));
  };

  const runDeleteAllForPair = async () => {
    if (!Number.isFinite(selectedPairId) || deleteInFlightRef.current) return;
    deleteInFlightRef.current = true;
    setDeletingPositions(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:3000/api/positions/admin/pair/${selectedPairId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        let msg = 'A törlés nem sikerült.';
        if (res.status === 403) {
          msg = 'Nincs jogosultsága a törléshez (csak adminisztrátor).';
        } else {
          const t = await res.text().catch(() => '');
          if (t) msg = t;
        }
        addNotification('error', msg);
        return;
      }
      let deleted = 0;
      try {
        const data = (await res.json()) as { deleted?: number };
        if (typeof data.deleted === 'number') deleted = data.deleted;
      } catch {
        /* ignore */
      }
      if (deleted === 0) {
        addNotification(
          'info',
          `Ehhez a párhoz nem volt törölhető mentett pozíció (${selectedPairLabel}).`,
        );
      } else {
        addNotification('success', `Sikeresen törölve: ${deleted} mentett pozíció · ${selectedPairLabel}`);
      }
      setConfirmDeleteAllOpen(false);
      setSelectionMode(false);
      await loadAll();
    } catch {
      addNotification('error', 'Hálózati hiba történt a törlés során.');
    } finally {
      deleteInFlightRef.current = false;
      setDeletingPositions(false);
    }
  };

  const runDeleteSelected = async () => {
    if (!Number.isFinite(selectedPairId) || selectedIds.size === 0 || deleteInFlightRef.current) return;
    const ids = [...selectedIds];
    deleteInFlightRef.current = true;
    setDeletingPositions(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3000/api/positions/admin/delete-by-ids', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pairId: selectedPairId, ids }),
      });
      if (!res.ok) {
        let msg = 'A törlés nem sikerült.';
        if (res.status === 403) {
          msg = 'Nincs jogosultsága a törléshez (csak adminisztrátor).';
        } else {
          try {
            const j = await res.json();
            if (Array.isArray(j?.message)) msg = j.message.join(' ');
            else if (typeof j?.message === 'string') msg = j.message;
          } catch {
            /* ignore */
          }
        }
        addNotification('error', msg);
        return;
      }
      let deleted = 0;
      try {
        const data = (await res.json()) as { deleted?: number };
        if (typeof data.deleted === 'number') deleted = data.deleted;
      } catch {
        /* ignore */
      }
      if (deleted === 0) {
        addNotification('info', 'Nem történt törlés — ellenőrizze a kijelölést, vagy frissítse a listát.');
      } else {
        addNotification(
          'success',
          `Sikeresen törölve: ${deleted} kijelölt mentett pozíció · ${selectedPairLabel}`,
        );
      }
      setConfirmDeleteSelectedOpen(false);
      setSelectedIds(new Set());
      await loadAll();
    } catch {
      addNotification('error', 'Hálózati hiba történt a törlés során.');
    } finally {
      deleteInFlightRef.current = false;
      setDeletingPositions(false);
    }
  };

  const tableColSpan = 8 + (selectionMode && pairFilter ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="mw-card relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FiLayers className="w-20 h-20 text-blue-400" />
          </div>
          <div className="relative z-10">
            <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Betöltött adatok</div>
            <div className="text-3xl font-bold text-white tabular-nums mb-1">{loading ? '…' : allRows.length}</div>
            <div className="text-gray-500 text-sm leading-relaxed">
              Legfeljebb {FETCH_PAGE_SIZE} legutóbbi mentés a szerverről. A szűrőnek megfelelő sorok számát a táblázat fejlécében
              láthatja.
            </div>
          </div>
        </div>
        <div className="mw-card relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FiNavigation className="w-24 h-24 text-orange-500" />
          </div>
          <div className="relative z-10 pr-4">
            <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Tájékoztató</div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Itt a szerver által <span className="text-white font-medium">rögzített</span> helymeghatározási adatok láthatók —
              ugyanazok, amelyek a játék során a térképen is megjelentek. Az adatok automatikusan frissülnek, ha új mentés
              érkezik. Az <span className="text-white font-medium">exportálás</span> a táblázat szűrőjének és rendezésének megfelelő sorokat menti le (CSV fájl).
            </p>
          </div>
        </div>
      </div>

      <div className="mw-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4">
          <div className="w-full max-w-[13rem] shrink-0 space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <FiUsers className="w-3.5 h-3.5 opacity-80" />
              Pár
            </label>
            <MwPairFilterGrid
              pairs={pairs}
              value={pairFilter}
              onChange={(v) => {
                setPairFilter(v);
                setPage(1);
              }}
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-w-0">
            <MwDateTimePicker
              label="Időponttól"
              value={fromLocal}
              maxLocal={toLocal || undefined}
              onChange={(v) => {
                setFromLocal(v);
                setPage(1);
              }}
            />
            <MwDateTimePicker
              label="Időpontig"
              value={toLocal}
              minLocal={fromLocal || undefined}
              onChange={(v) => {
                setToLocal(v);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 lg:pb-0.5">
            <button
              type="button"
              onClick={exportFilteredCsv}
              disabled={totalFiltered === 0}
              title="Letöltés: a jelenlegi szűrésnek és táblázat-rendezésnek megfelelő összes betöltött sor (legfeljebb 5000), CSV formátumban"
              className="mw-btn mw-btn-primary inline-flex items-center justify-center gap-2 text-sm px-4 transition-[opacity,transform] duration-300 ease-out disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed"
            >
              <FiDownload className="w-4 h-4 shrink-0" />
              Exportálás
            </button>
            <button
              type="button"
              disabled={!hasActiveFilters}
              onClick={() => {
                setPairFilter('');
                setFromLocal('');
                setToLocal('');
                setPage(1);
              }}
              className="mw-btn inline-flex items-center justify-center gap-2 px-4 rounded-xl font-semibold text-sm bg-red-600 hover:bg-red-500 text-white border border-red-500/30 shadow-sm transition-[opacity,transform] duration-300 ease-out disabled:opacity-40 disabled:pointer-events-none disabled:hover:bg-red-600"
            >
              <FiX className="w-4 h-4 shrink-0" />
              Szűrők törlése
            </button>
          </div>
        </div>

        {quickPanelVisible ? (
          <div
            key={quickPanelExiting ? 'hiding' : 'showing'}
            onAnimationEnd={(e) => {
              if (!quickPanelExiting) return;
              const n = e.animationName || '';
              if (n.includes('content-hide')) {
                setQuickPanelVisible(false);
                setQuickPanelExiting(false);
              }
            }}
            className={`border-t border-white/5 pt-3 ${quickPanelExiting ? 'animate-content-hide' : 'animate-content-reveal'}`}
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <p className="flex shrink-0 items-center gap-1.5 text-xs text-gray-400">
                  <FiZap className="h-3.5 w-3.5 shrink-0 text-orange-400/90" />
                  Gyors műveletek a kiválasztott párhoz:
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-2">
                  <button
                    type="button"
                    onClick={openMapFromToolbar}
                    className={`mw-btn inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400/25 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-950/30 transition-[color,background-color,border-color,opacity,transform] duration-200 hover:bg-blue-500 sm:w-auto ${
                      selectionMode
                        ? 'opacity-[0.88] ring-1 ring-inset ring-white/15 scale-[0.99] hover:opacity-100 hover:scale-100'
                        : ''
                    }`}
                  >
                    <FiMapPin className="h-4 w-4 shrink-0" />
                    Nyomvonal a térképen
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAllOpen(true)}
                    className={`mw-btn inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/35 bg-red-600/90 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-red-950/25 transition-[color,background-color,border-color,opacity,transform] duration-200 hover:bg-red-500 sm:w-auto ${
                      selectionMode
                        ? 'opacity-[0.88] ring-1 ring-inset ring-white/15 scale-[0.99] hover:opacity-100 hover:scale-100'
                        : ''
                    }`}
                    title="Az adatbázisban ehhez a párhoz tartozó összes mentett pozíció törlése"
                  >
                    <FiTrash2 className="h-4 w-4 shrink-0" />
                    Összes pozíció törlése
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectionMode((v) => !v)}
                    className={`mw-btn inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold shadow-none transition-[color,background-color,border-color,opacity] duration-200 outline-none ring-0 focus:shadow-none focus:outline-none focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 sm:w-auto ${
                      selectionMode
                        ? 'border-amber-400/55 bg-amber-600/30 text-amber-50 hover:bg-amber-600/40'
                        : 'border-white/15 bg-white/5 text-gray-200 hover:bg-white/10'
                    }`}
                    title="Több sor kijelölése, majd csak ezek törlése"
                  >
                    <FiCheckSquare className="h-4 w-4 shrink-0" />
                    {selectionMode ? 'Kijelölés mód kikapcsolása' : 'Kijelöléses törlés'}
                  </button>
                </div>
              </div>
              {selectionMode && (
                <div className="flex flex-col gap-2 rounded-xl border border-amber-500/25 bg-amber-950/20 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
                  <p className="text-xs text-gray-400">
                    <span className="font-semibold text-amber-100/95">{selectedIds.size}</span> kijelölve
                    {totalFiltered > 0 ? (
                      <>
                        {' '}
                        · sorok a jelenlegi szűréssel:{' '}
                        <span className="font-mono text-gray-300">{totalFiltered}</span>
                      </>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={totalFiltered === 0}
                      onClick={toggleSelectAllFiltered}
                      title="A táblázatban a szűrőnek megfelelő összes sor (minden lap) egyszerre"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-white/10 disabled:opacity-40"
                    >
                      {allFilteredSelected ? (
                        <>
                          <FiX className="h-3.5 w-3.5 shrink-0 opacity-90" />
                          Összes kijelölés feloldása
                        </>
                      ) : (
                        <>
                          <FiCheckSquare className="h-3.5 w-3.5 shrink-0 opacity-90" />
                          Mind kijelölése
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={selectedIds.size === 0}
                      onClick={() => setSelectedIds(new Set())}
                      title="Összes pipa eltávolítása"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-white/10 disabled:opacity-40"
                    >
                      <FiXCircle className="h-3.5 w-3.5 shrink-0 opacity-90" />
                      Kijelölés ürítése
                    </button>
                    <button
                      type="button"
                      disabled={selectedIds.size === 0}
                      onClick={() => setConfirmDeleteSelectedOpen(true)}
                      title="A kijelölt sorok törlése az adatbázisból"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/40 bg-red-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
                    >
                      <FiTrash2 className="h-3.5 w-3.5 shrink-0 opacity-95" />
                      Kijelöltek törlése
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="border-t border-white/5 pt-3 text-xs text-gray-400">
            <FiCrosshair className="mr-1 inline h-3.5 w-3.5 align-text-bottom text-gray-500" />
            Egy pár szűrt nyomvonalához előbb válasszon párt, majd nyissa meg a térképes nézetet.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-red-200 text-sm font-medium">
          {error}
        </div>
      )}

      <AdminDataTableCard
        title="Mentett pozíciók"
        icon={<FiMapPin className="w-6 h-6" />}
        iconTone="blue"
        countBadge={loading ? '…' : `${totalFiltered} találat`}
        footer={
          <AdminTablePaginationFooter
            totalFiltered={totalFiltered}
            fromIdx={fromIdx}
            toIdx={toIdx}
            page={page}
            totalPages={totalPages}
            loading={loading}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        }
      >
        {loading && allRows.length === 0 ? (
          <AdminTableLoadingState />
        ) : (
          <AdminTableShell
            headerRow={
              <tr>
                {selectionMode && pairFilter ? (
                  <th className="text-center py-4 px-2 w-12 text-gray-400">
                    <span className="sr-only">Kijelölés</span>
                    <input
                      ref={selectAllHeaderRef}
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      className="h-4 w-4 rounded border-white/20 bg-black/40 text-orange-500 focus:ring-orange-500/50"
                      title="A jelenlegi szűrésnek megfelelő összes sor kijelölése vagy feloldása (minden lap)"
                    />
                  </th>
                ) : null}
                {thSort('id', '#', 'w-16')}
                {thSort('pairId', 'Pár')}
                {thSort('timestamp', 'Idő')}
                {thSort('location', 'Lokáció', 'hidden lg:table-cell')}
                {thSort('speed', 'Sebesség', 'hidden xl:table-cell')}
                {thSort('vehicleMode', 'Jármű', 'hidden md:table-cell')}
                {thSort('ruleViolation', 'Szabályszegés', 'hidden xl:table-cell')}
                <th className="text-center py-4 px-2 text-gray-400">Megtekintés</th>
              </tr>
            }
          >
                {rows.length === 0 ? (
                  <AdminTableEmptyRow
                    colSpan={tableColSpan}
                    icon={FiMapPin}
                    title="Nincs megjeleníthető mentett pozíció."
                    hint="Próbáljon más időintervallumot, vagy várjon, amíg a játék során új adat kerül rögzítésre."
                  />
                ) : (
                  rows.map((row) => {
                    const liveMw = mostWantedByPairId.has(row.pairId)
                      ? !!mostWantedByPairId.get(row.pairId)
                      : false;
                    const liveCaptured = capturedByPairId.has(row.pairId)
                      ? !!capturedByPairId.get(row.pairId)
                      : false;
                    const timeParts = formatDateTimeBudapestParts(row.timestamp);
                    return (
                      <tr key={row.id} className="group transition-colors hover:bg-white/5">
                        {selectionMode && pairFilter ? (
                          <td className="text-center py-4 align-middle">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(row.id)}
                              onChange={() => toggleSelectId(row.id)}
                              className="h-4 w-4 rounded border-white/20 bg-black/40 text-orange-500 focus:ring-orange-500/50"
                              aria-label={`Pozíció #${row.id} kijelölése`}
                            />
                          </td>
                        ) : null}
                        <td className="text-center py-4 align-middle text-sm font-mono text-gray-400">{row.id}</td>
                        <td className="text-center py-4 align-middle">
                          <button
                            type="button"
                            onClick={() => onSelectPairById(row.pairId)}
                            title="Pár részleteinek megtekintése"
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mx-auto shadow-sm cursor-pointer border-[3px] text-white transition-colors duration-300 ${
                              liveCaptured
                                ? 'border-red-600 bg-red-600 hover:bg-red-500'
                                : liveMw
                                  ? 'border-orange-500 bg-orange-500 hover:bg-orange-400'
                                  : 'border-orange-500 bg-[#2a2a2a] hover:bg-[#383838]'
                            }`}
                          >
                            {row.assignedNumber ?? '?'}
                          </button>
                        </td>
                        <td className="text-center py-4 align-middle">
                          <DateTimeStackCell iso={row.timestamp} />
                        </td>
                        <td className="text-center py-4 align-middle hidden lg:table-cell">
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-mono text-gray-300 bg-black/40 px-2 py-1 rounded border border-white/5">
                              {row.lat.toFixed(4)}, {row.lon.toFixed(4)}
                            </span>
                            <span className="text-[10px] text-gray-500 mt-1 font-mono tabular-nums">
                              {timeParts?.time ?? '—'}
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-4 align-middle text-sm text-gray-400 hidden xl:table-cell">
                          {row.speed != null ? `${(Number(row.speed) < 5 ? 0 : Number(row.speed)).toFixed(1)} km/h` : '—'}
                        </td>
                        <td className="text-center py-4 align-middle hidden md:table-cell">
                          {row.vehicleMode ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg text-xs font-bold">
                              <FiCheckCircle className="w-3 h-3 shrink-0" />
                              Jármű mód
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400 bg-white/5 px-2 py-1 rounded-lg text-xs font-bold border border-white/10">
                              <FiXCircle className="w-3 h-3 shrink-0 opacity-80" />
                              Gyalogos
                            </span>
                          )}
                        </td>
                        <td className="text-center py-4 align-middle hidden xl:table-cell">
                          {row.hadRuleViolationAtSave ? (
                            <span className="inline-flex items-center gap-1 text-red-400 bg-red-500/10 px-2 py-1 rounded-lg text-xs font-bold">
                              <FiAlertCircle className="w-3 h-3 shrink-0" />
                              Aktív szabályszegés
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-400/95 bg-emerald-500/10 px-2 py-1 rounded-lg text-xs font-bold">
                              <FiCheckCircle className="w-3 h-3 shrink-0" />
                              Rendben volt
                            </span>
                          )}
                        </td>
                        <td className="text-center py-4 align-middle">
                          <PositionRowMapPreview
                            lat={row.lat}
                            lon={row.lon}
                            onClick={() => openSingleModal(row)}
                            title="Részletes térképnézet megnyitása"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
          </AdminTableShell>
        )}
      </AdminDataTableCard>

      {mapConfig && (
        <PositionsTraceMapModal
          isOpen={mapOpen}
          onClose={closeMap}
          variant={mapConfig.variant}
          pairId={mapConfig.pairId}
          headerSubtitle={mapConfig.headerSubtitle}
          singleRow={mapConfig.variant === 'single' ? mapConfig.row : undefined}
          fromIso={fromIso}
          toIso={toIso}
        />
      )}

      <ConfirmationModal
        isOpen={confirmDeleteAllOpen}
        title="Összes mentett pozíció törlése"
        message={`Biztosan törli ${selectedPairLabel} összes mentett pozícióját az adatbázisból?\n\nA dátum- és egyéb táblázat-szűrők nem korlátozzák ezt: a szerveren ehhez a párhoz tartozó minden mentett sor véglegesen törlődik. A művelet nem vonható vissza.`}
        confirmLabel={deletingPositions ? 'Törlés…' : 'Összes törlése'}
        cancelLabel="Mégse"
        isDangerous
        onCancel={() => !deletingPositions && setConfirmDeleteAllOpen(false)}
        onConfirm={() => void runDeleteAllForPair()}
      />

      <ConfirmationModal
        isOpen={confirmDeleteSelectedOpen}
        title="Kijelölt pozíciók törlése"
        message={`A kijelölés alapján ${selectedIds.size} db, korábban mentett GPS-pozíció törlődik véglegesen az adatbázisból — ${selectedPairLabel}.\n\nBiztosan folytatja? A művelet nem vonható vissza.`}
        confirmLabel={deletingPositions ? 'Törlés…' : 'Törlés'}
        cancelLabel="Mégse"
        isDangerous
        onCancel={() => !deletingPositions && setConfirmDeleteSelectedOpen(false)}
        onConfirm={() => void runDeleteSelected()}
      />
    </div>
  );
}
