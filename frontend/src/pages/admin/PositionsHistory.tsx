import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiMapPin,
  FiNavigation,
  FiLayers,
  FiCrosshair,
  FiRefreshCw,
  FiX,
  FiCheckCircle,
  FiXCircle,
  FiUsers,
  FiZap,
  FiAlertCircle,
} from 'react-icons/fi';
import { FaSortUp, FaSortDown } from 'react-icons/fa6';
import MwPairFilterGrid from '../../components/MwPairFilterGrid';
import MwDateTimePicker from '../../components/MwDateTimePicker';
import PositionsTraceMapModal from '../../components/PositionsTraceMapModal';
import PositionRowMapPreview from '../../components/PositionRowMapPreview';
import { DateTimeStackCell, formatDateTimeBudapestParts } from '../../utils/formatDateTimeBudapest';
import { useSocket } from '../../hooks/useSocket';
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

export default function PositionsHistory({ pairs, onSelectPairById }: PositionsHistoryProps) {
  const { socket } = useSocket();
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
    return () => {
      socket.off('savedPositionSample', onSaved);
    };
  }, [socket]);

  useEffect(() => {
    setPage(1);
  }, [pairFilter, fromLocal, toLocal, sortConfig.key, sortConfig.direction]);

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

  const totalFiltered = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);
  const rows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const fromIdx = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const toIdx = Math.min(safePage * pageSize, totalFiltered);

  const handleSort = (key: SortKey) => {
    setSortConfig((c) => ({
      key,
      direction: c.key === key && c.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (key: SortKey) => {
    const isActive = sortConfig.key === key;
    return (
      <div className="flex flex-col ml-1">
        <FaSortUp
          className={`w-3 h-3 -mb-3 ${isActive && sortConfig.direction === 'asc' ? 'text-orange-500' : 'text-gray-500 opacity-60'}`}
        />
        <FaSortDown
          className={`w-3 h-3 ${isActive && sortConfig.direction === 'desc' ? 'text-orange-500' : 'text-gray-500 opacity-60'}`}
        />
      </div>
    );
  };

  const thSort = (key: SortKey, label: string, className = '') => (
    <th
      className={`text-center py-4 px-3 cursor-pointer group hover:bg-white/5 transition-colors ${className}`}
      onClick={() => handleSort(key)}
    >
      <div className="flex items-center justify-center gap-1 text-gray-400 group-hover:text-white">
        {label}
        {getSortIcon(key)}
      </div>
    </th>
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

  return (
    <div className="space-y-6 animate-fade-in">
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
              érkezik.
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
              onClick={() => void loadAll()}
              className="mw-btn mw-btn-primary inline-flex items-center justify-center gap-2 text-sm px-4"
              disabled={loading}
              title="Adatok frissítése a szerverről"
            >
              <FiRefreshCw className={`w-4 h-4 shrink-0 ${loading ? 'animate-spin opacity-70' : ''}`} />
              Szinkronizálás
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex shrink-0 items-center gap-1.5 text-xs text-gray-400">
                <FiZap className="h-3.5 w-3.5 shrink-0 text-orange-400/90" />
                Gyors műveletek a kiválasztott párhoz:
              </p>
              <button
                type="button"
                onClick={openMapFromToolbar}
                className="mw-btn inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400/25 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-950/30 transition-colors hover:bg-blue-500 sm:ml-auto sm:w-auto"
              >
                <FiMapPin className="h-4 w-4 shrink-0" />
                Nyomvonal a térképen
              </button>
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

      <div className="mw-card p-0 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
          <h3 className="text-xl font-bold text-white flex items-center gap-3 flex-wrap">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <FiMapPin className="w-6 h-6" />
            </div>
            Mentett pozíciók
            <span className="text-sm font-normal text-gray-500 ml-2 py-1 px-3 bg-white/5 rounded-full border border-white/5">
              {loading ? '…' : `${totalFiltered} találat`}
            </span>
          </h3>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          {loading && allRows.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
              <span className="inline-block w-5 h-5 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin mr-2" />
              Betöltés…
            </div>
          ) : (
            <table className="mw-table">
              <thead>
                <tr>
                  {thSort('id', '#', 'w-16')}
                  {thSort('pairId', 'Pár')}
                  {thSort('timestamp', 'Idő')}
                  {thSort('location', 'Lokáció', 'hidden lg:table-cell')}
                  {thSort('speed', 'Sebesség', 'hidden xl:table-cell')}
                  {thSort('vehicleMode', 'Jármű', 'hidden md:table-cell')}
                  {thSort('ruleViolation', 'Szabályszegés', 'hidden xl:table-cell')}
                  <th className="text-center py-4 px-2 text-gray-400">Megtekintés</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-0 border-b-0">
                      <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2">
                        <FiMapPin className="w-8 h-8 opacity-30" />
                        <p className="font-medium text-sm">Nincs megjeleníthető mentett pozíció.</p>
                        <p className="text-xs text-gray-600 max-w-md text-center">
                          Próbáljon más időintervallumot, vagy várjon, amíg a játék során új adat kerül rögzítésre.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const liveMw = mostWantedByPairId.has(row.pairId)
                      ? !!mostWantedByPairId.get(row.pairId)
                      : false;
                    const timeParts = formatDateTimeBudapestParts(row.timestamp);
                    return (
                      <tr key={row.id} className="group transition-colors hover:bg-white/5">
                        <td className="text-center py-4 align-middle text-sm font-mono text-gray-400">{row.id}</td>
                        <td className="text-center py-4 align-middle">
                          <button
                            type="button"
                            onClick={() => onSelectPairById(row.pairId)}
                            title="Pár részleteinek megtekintése"
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mx-auto shadow-sm cursor-pointer border-[3px] border-orange-500 text-white transition-colors duration-300 ${
                              liveMw ? 'bg-orange-500 hover:bg-orange-400' : 'bg-[#2a2a2a] hover:bg-[#383838]'
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
                          {row.speed != null ? `${Number(row.speed).toFixed(1)} km/h` : '—'}
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
                              Rendben (mentéskor)
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
              </tbody>
            </table>
          )}
        </div>

        {totalFiltered > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-white/10 bg-white/[0.02] text-sm">
            <span className="text-gray-500">
              <span className="text-gray-400 font-mono text-xs">
                {fromIdx}–{toIdx}
              </span>
              <span className="mx-1">/</span>
              <span className="font-mono text-xs">{totalFiltered}</span>
              <span className="ml-2 hidden sm:inline">
                · Oldal {safePage} / {totalPages}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="mw-btn mw-btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
              >
                Előző
              </button>
              <span className="text-gray-500 font-mono text-xs px-2 sm:hidden">
                {safePage}/{totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="mw-btn mw-btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
              >
                Következő
              </button>
            </div>
          </div>
        )}
      </div>

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
    </div>
  );
}
