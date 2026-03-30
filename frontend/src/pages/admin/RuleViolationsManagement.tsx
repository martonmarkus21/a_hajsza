import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  FiAlertTriangle,
  FiActivity,
  FiCheckCircle,
  FiClock,
  FiInfo,
  FiTrash2,
} from 'react-icons/fi';
import { FaSortUp, FaSortDown } from 'react-icons/fa6';
import { DateTimeStackCell } from '../../utils/formatDateTimeBudapest';
import MwTableSearchInput from '../../components/MwTableSearchInput';
import { useSocket } from '../../hooks/useSocket';
import ConfirmationModal from '../../components/ConfirmationModal';
import MwDropdownSelect, { type MwDropdownOption } from '../../components/MwDropdownSelect';
import { useNotification } from '../../contexts/NotificationContext';
import type { Pair } from '../../types';

export interface AdminRuleViolationRow {
  id: number;
  pairId: number;
  assignedNumber: number | null;
  pairName: string | null;
  pairMostWanted?: boolean;
  violationType: string;
  description: string | null;
  createdAt: string | null;
  resolved: boolean;
  resolvedAt: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  game_area_exit: 'Játékterület elhagyása',
  vehicle_time_exceeded: 'Járműhasználat',
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] || type;
}

function deAccent(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

type StatusFilter = 'all' | 'active' | 'resolved';

const STATUS_FILTERS: {
  id: StatusFilter;
  label: string;
  icon: ComponentType<{ className?: string }> | null;
}[] = [
  { id: 'all', label: 'Összes', icon: null },
  { id: 'active', label: 'Aktív', icon: FiActivity },
  { id: 'resolved', label: 'Lezárt', icon: FiCheckCircle },
];

const TYPE_FILTER_OPTIONS: MwDropdownOption[] = [
  { value: 'all', label: 'Minden típus' },
  { value: 'game_area_exit', label: TYPE_LABELS.game_area_exit },
  { value: 'vehicle_time_exceeded', label: TYPE_LABELS.vehicle_time_exceeded },
];
type SortKey =
  | 'id'
  | 'pairNumber'
  | 'violationType'
  | 'description'
  | 'createdAt'
  | 'resolvedAt'
  | 'resolved';

interface RuleViolationsManagementProps {
  onOpenGameAreaDetails: (row: AdminRuleViolationRow) => void;
  onSelectPairById: (pairId: number) => void;
  onActiveViolationsNeedRefresh?: () => void | Promise<void>;
  /** Élő MW státusz a párok listájából (socket), a szám-kör színezéséhez */
  pairs?: Pair[];
}

/** Egy szinkron a szerverrel (mount + socket), mint a párok listája a usePairs adatával: szűrés/rendezés/lapozás kizárólag kliensen */
const FETCH_PAGE_SIZE = 5000;

export default function RuleViolationsManagement({
  onOpenGameAreaDetails,
  onSelectPairById,
  onActiveViolationsNeedRefresh,
  pairs,
}: RuleViolationsManagementProps) {
  const { socket } = useSocket();
  const { addNotification } = useNotification();

  const [allRows, setAllRows] = useState<AdminRuleViolationRow[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, resolved: 0 });
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'createdAt',
    direction: 'desc',
  });

  const [deleteTarget, setDeleteTarget] = useState<AdminRuleViolationRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [searchInput, statusFilter, typeFilter]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('pageSize', String(FETCH_PAGE_SIZE));
      params.set('status', 'all');
      params.set('type', 'all');
      params.set('sortBy', 'createdAt');
      params.set('sortDir', 'desc');

      const res = await fetch(`http://localhost:3000/api/rule-violations/list?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        if (res.status === 403) {
          setError('Nincs jogosultsága a lista megtekintéséhez.');
        } else {
          setError('A lista betöltése sikertelen.');
        }
        setAllRows([]);
        return;
      }
      const data = await res.json();
      setAllRows(data.violations || []);
      if (data.stats) {
        setStats({
          total: data.stats.total ?? 0,
          active: data.stats.active ?? 0,
          resolved: data.stats.resolved ?? 0,
        });
      }
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
    const onRuleViolation = () => {
      void loadRef.current();
    };
    socket.on('ruleViolation', onRuleViolation);
    return () => {
      socket.off('ruleViolation', onRuleViolation);
    };
  }, [socket]);

  const filteredRows = useMemo(() => {
    let list = allRows;
    const raw = searchInput.trim();
    if (raw) {
      const q = raw.toLowerCase();
      const qNorm = deAccent(raw);
      list = list.filter((r) => {
        const label = typeLabel(r.violationType);
        const labelNorm = deAccent(label);
        const desc = (r.description || '').toLowerCase();
        const name = (r.pairName || '').toLowerCase();
        return (
          String(r.id).includes(q) ||
          String(r.pairId).includes(q) ||
          desc.includes(q) ||
          name.includes(q) ||
          String(r.assignedNumber ?? '').includes(q) ||
          r.violationType.toLowerCase().includes(q) ||
          label.toLowerCase().includes(q) ||
          labelNorm.includes(qNorm) ||
          deAccent(r.description || '').includes(qNorm)
        );
      });
    }
    if (statusFilter === 'active') {
      list = list.filter((r) => !r.resolved);
    } else if (statusFilter === 'resolved') {
      list = list.filter((r) => r.resolved);
    }
    if (typeFilter !== 'all') {
      list = list.filter((r) => r.violationType === typeFilter);
    }
    return list;
  }, [allRows, searchInput, statusFilter, typeFilter]);

  const sortedRows = useMemo(() => {
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const arr = [...filteredRows];
    arr.sort((a, b) => {
      switch (sortConfig.key) {
        case 'id':
          return (a.id - b.id) * dir;
        case 'pairNumber':
          return ((a.assignedNumber ?? 0) - (b.assignedNumber ?? 0)) * dir;
        case 'violationType':
          return a.violationType.localeCompare(b.violationType) * dir;
        case 'description':
          return (a.description || '').localeCompare(b.description || '') * dir;
        case 'createdAt': {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return (ta - tb) * dir;
        }
        case 'resolvedAt': {
          const ta = a.resolvedAt ? new Date(a.resolvedAt).getTime() : 0;
          const tb = b.resolvedAt ? new Date(b.resolvedAt).getTime() : 0;
          return (ta - tb) * dir;
        }
        case 'resolved':
          return (Number(a.resolved) - Number(b.resolved)) * dir;
        default:
          return 0;
      }
    });
    return arr;
  }, [filteredRows, sortConfig]);

  const totalFiltered = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  const rows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, totalPages, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`http://localhost:3000/api/rule-violations/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        addNotification('success', 'Szabályszegés törölve');
        setDeleteTarget(null);
        setAllRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
        setStats((s) => ({
          total: Math.max(0, s.total - 1),
          resolved: Math.max(0, s.resolved - 1),
          active: s.active,
        }));
        void onActiveViolationsNeedRefresh?.();
      } else {
        addNotification('error', 'A törlés sikertelen');
      }
    } catch {
      addNotification('error', 'Hálózati hiba a törléskor');
    } finally {
      setDeleting(false);
    }
  };

  const mostWantedByPairId = useMemo(() => {
    const m = new Map<number, boolean>();
    for (const p of pairs ?? []) {
      m.set(p.id, !!p.mostWanted);
    }
    return m;
  }, [pairs]);

  const displayTotal = searchInput.trim() || statusFilter !== 'all' || typeFilter !== 'all' ? totalFiltered : stats.total;
  const fromIdx = totalFiltered === 0 ? 0 : (Math.min(page, totalPages) - 1) * pageSize + 1;
  const toIdx = Math.min(Math.min(page, totalPages) * pageSize, totalFiltered);

  return (
    <div className="space-y-6">
      <div className="mw-card flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
        <MwTableSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Keresés pár, típus vagy leírás szerint…"
          className="w-full shrink-0 md:w-96"
        />

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:flex-1 md:min-w-0 md:justify-end">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              onMouseUp={(e) => e.currentTarget.blur()}
              className={`mw-btn justify-center inline-flex items-center gap-2 flex-1 min-w-[5.5rem] sm:flex-initial sm:min-w-0 w-full sm:w-auto md:w-auto ${statusFilter === filter.id ? 'mw-btn-primary' : 'mw-btn-secondary text-gray-400 hover:text-white'}`}
            >
              {filter.icon && <filter.icon className="w-4 h-4 shrink-0" />}
              {filter.label}
            </button>
          ))}

          <MwDropdownSelect
            value={typeFilter}
            onChange={setTypeFilter}
            ariaLabel="Típus szűrő"
            minPanelWidth={188}
            className="min-w-0 w-[min(100%,9.25rem)] shrink max-w-[min(100%,9.25rem)] sm:w-44 sm:max-w-none md:w-52"
            options={TYPE_FILTER_OPTIONS}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-red-200 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="mw-card p-0 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
          <h3 className="text-xl font-bold text-white flex items-center gap-3 flex-wrap">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400">
              <FiAlertTriangle className="w-6 h-6" />
            </div>
            Szabályszegések naplója
            <span className="text-sm font-normal text-gray-500 ml-2 py-1 px-3 bg-white/5 rounded-full border border-white/5">
              {loading ? '…' : `${displayTotal} találat`}
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
                  {thSort('id', '#', 'w-20')}
                  {thSort('pairNumber', 'Pár')}
                  {thSort('violationType', 'Típus')}
                  {thSort('description', 'Leírás', 'hidden xl:table-cell max-w-[220px]')}
                  {thSort('createdAt', 'Kezdete')}
                  {thSort('resolvedAt', 'Lezárva', 'hidden md:table-cell')}
                  {thSort('resolved', 'Állapot')}
                  <th className="text-right py-4 pr-6 text-gray-400">Műveletek</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-0 border-b-0">
                      <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2">
                        <FiActivity className="w-8 h-8 opacity-30" />
                        <p className="font-medium text-sm">Nincs megjeleníthető szabályszegés.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const activeGameAreaRow =
                      !row.resolved && row.violationType === 'game_area_exit';
                    const livePairMw = mostWantedByPairId.has(row.pairId)
                      ? !!mostWantedByPairId.get(row.pairId)
                      : !!row.pairMostWanted;
                    return (
                  <tr
                    key={row.id}
                    className={`group transition-colors ${activeGameAreaRow ? 'mw-table-row-active-violation' : 'hover:bg-white/5'}`}
                  >
                    <td className="text-center py-4 align-middle text-sm font-mono text-gray-400">{row.id}</td>
                    <td className="text-center py-4 align-middle">
                      <button
                        type="button"
                        onClick={() => onSelectPairById(row.pairId)}
                        title="Pár részleteinek megtekintése"
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mx-auto shadow-sm cursor-pointer border-[3px] border-orange-500 text-white transition-colors duration-300 ${
                          livePairMw
                            ? 'bg-orange-500 hover:bg-orange-400'
                            : 'bg-[#2a2a2a] hover:bg-[#383838]'
                        }`}
                      >
                        {row.assignedNumber ?? '?'}
                      </button>
                    </td>
                    <td className="text-center py-4 align-middle">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${
                          row.violationType === 'game_area_exit'
                            ? 'text-red-500 bg-red-500/10 border-red-500/20'
                            : 'text-amber-400 bg-amber-500/10 border-amber-500/15'
                        }`}
                      >
                        {row.violationType === 'game_area_exit' ? (
                          <FiAlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <FiClock className="w-3.5 h-3.5 shrink-0" />
                        )}
                        {typeLabel(row.violationType)}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-gray-300 max-w-[280px] hidden xl:table-cell align-middle">
                      <span className="line-clamp-2 text-center block">{row.description || '—'}</span>
                    </td>
                    <td className="text-center py-4 align-middle">
                      <DateTimeStackCell iso={row.createdAt} />
                    </td>
                    <td className="text-center py-4 align-middle hidden md:table-cell">
                      {row.resolved ? <DateTimeStackCell iso={row.resolvedAt} /> : '—'}
                    </td>
                    <td className="text-center py-4 align-middle">
                      {row.resolved ? (
                        <span className="inline-flex items-center gap-1 text-green-500 bg-green-500/10 px-2 py-1 rounded-lg text-xs font-bold">
                          <FiCheckCircle className="w-3 h-3" />
                          Lezárt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500 bg-red-500/10 px-2 py-1 rounded-lg text-xs font-bold">
                          <FiActivity className="w-3 h-3" />
                          Aktív
                        </span>
                      )}
                    </td>
                    <td className="text-right pr-6 py-4 align-middle">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        {row.violationType === 'game_area_exit' && (
                          <button
                            type="button"
                            onClick={() => onOpenGameAreaDetails(row)}
                            className="p-2 text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Részletek"
                          >
                            <FiInfo className="w-4 h-4" />
                          </button>
                        )}
                        {row.resolved && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(row)}
                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Törlés"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
                · Oldal {Math.min(page, totalPages)} / {totalPages}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="mw-btn mw-btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
              >
                Előző
              </button>
              <span className="text-gray-500 font-mono text-xs px-2 sm:hidden">
                {Math.min(page, totalPages)}/{totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="mw-btn mw-btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
              >
                Következő
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!deleteTarget}
        title="Szabályszegés törlése"
        message={
          deleteTarget
            ? `Biztosan törli ezt a naplóbejegyzést? (ID: ${deleteTarget.id}, pár: ${deleteTarget.assignedNumber ?? deleteTarget.pairId}) A művelet nem vonható vissza.`
            : ''
        }
        confirmLabel={deleting ? 'Törlés…' : 'Törlés'}
        cancelLabel="Mégse"
        isDangerous
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
