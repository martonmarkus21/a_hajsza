import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiAlertTriangle,
  FiClipboard,
  FiDownload,
  FiInfo,
  FiLayers,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUser,
  FiX,
  FiZap,
} from 'react-icons/fi';
import MwDateTimePicker from '../../components/MwDateTimePicker';
import MwDropdownSelect, { type MwDropdownOption } from '../../components/MwDropdownSelect';
import MwTableSearchInput from '../../components/MwTableSearchInput';
import Modal from '../../components/Modal';
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
import { DateTimeStackCell, formatDateTimeBudapest } from '../../utils/formatDateTimeBudapest';
import { useNotification } from '../../contexts/NotificationContext';
import { apiUrl } from '@/config/env';

const POLL_MS = 8000;

export interface AdminAuditLogRow {
  id: number;
  userId: number | null;
  username: string | null;
  actionType: string;
  entityType: string | null;
  entityId: number | null;
  dataJson: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
}

interface AuditUserOption {
  id: number;
  username: string;
}

interface AuditLogsManagementProps {
  users: AuditUserOption[];
}

const ACTION_LABELS: Record<string, string> = {
  pair_create: 'Pár létrehozva',
  pair_update: 'Pár módosítva',
  pair_delete: 'Pár törölve',
  user_create: 'Felhasználó létrehozva',
  user_update: 'Felhasználó módosítva',
  user_delete: 'Felhasználó törölve',
  geofence_create: 'Geokerítés létrehozva',
  geofence_delete: 'Geokerítés törölve',
  geofence_activate: 'Geokerítés aktiválva',
  geofence_deactivate: 'Geokerítés deaktiválva',
  geofence_bulk_status: 'Geokerítések tömeges állapot',
  game_area_update: 'Játékterület frissítve',
  capture: 'Elfogás',
  capture_rejected: 'Elfogás elutasítva',
  capture_revert: 'Elfogás visszavonva',
  message_sent: 'Üzenet küldve',
  device_logout: 'Eszköz kijelentkezés',
  device_force_logout: 'Eszköz kényszer-kijelentkezés',
  mw_flag: 'Most Wanted jelzés',
  audit_log_delete: 'Naplóbejegyzés törölve',
  game_settings_update: 'Játékbeállítások módosítva',
  game_settings_timer_start: 'Lokációs időzítő indítva',
  game_settings_timer_stop: 'Lokációs időzítő leállítva',
  game_runtime_engine_start: 'Játékmotor elindítva',
  game_runtime_engine_stop: 'Játékmotor leállítva',
  game_day_create: 'Játéknap létrehozva',
  game_day_update: 'Játéknap módosítva',
  game_day_delete: 'Játéknap törölve',
  position_delete_pair: 'Pozíciók törlése (pár)',
  position_delete_batch: 'Pozíciók törlése (kiválasztott)',
  rule_violation_delete: 'Szabályszegés törölve',
  audit_log_bulk_delete: 'Napló tömeges törlése',
};

function actionLabel(actionType: string): string {
  return ACTION_LABELS[actionType] ?? actionType.replace(/_/g, ' ');
}

function actionBadgeClass(actionType: string): string {
  if (actionType.startsWith('pair_')) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
  if (actionType.startsWith('user_')) return 'bg-violet-500/15 text-violet-200 border-violet-500/25';
  if (actionType.startsWith('geofence_')) return 'bg-sky-500/15 text-sky-200 border-sky-500/25';
  if (actionType.startsWith('game_area')) return 'bg-cyan-500/12 text-cyan-200 border-cyan-500/25';
  if (actionType.startsWith('game_settings')) return 'bg-indigo-500/15 text-indigo-200 border-indigo-500/25';
  if (actionType.startsWith('game_runtime')) return 'bg-indigo-500/15 text-indigo-200 border-indigo-500/25';
  if (actionType.startsWith('game_day')) return 'bg-blue-500/15 text-blue-200 border-blue-500/25';
  if (actionType.startsWith('device_')) return 'bg-slate-500/20 text-slate-200 border-slate-500/30';
  if (actionType.startsWith('message')) return 'bg-amber-500/15 text-amber-200 border-amber-500/30';
  if (actionType.startsWith('capture')) return 'bg-red-500/15 text-red-200 border-red-500/30';
  if (actionType.startsWith('mw_')) return 'bg-orange-500/15 text-orange-200 border-orange-500/30';
  if (actionType.startsWith('position_')) return 'bg-teal-500/15 text-teal-200 border-teal-500/25';
  if (actionType.startsWith('rule_violation')) return 'bg-rose-500/12 text-rose-200 border-rose-500/25';
  if (actionType === 'audit_log_bulk_delete') return 'bg-amber-900/25 text-amber-100 border-amber-500/25';
  if (actionType.startsWith('audit_log')) return 'bg-gray-500/20 text-gray-200 border-gray-500/30';
  return 'bg-white/10 text-gray-200 border-white/15';
}

/** Ugyanaz a minta, mint a `mentett-poziciok_*.csv` fájlnevekhez. */
function csvExportTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function localInputToIso(value: string): string | undefined {
  if (!value || !value.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

type SortKey =
  | 'id'
  | 'timestamp'
  | 'actionType'
  | 'username'
  | 'entityType'
  | 'entityId'
  | 'ipAddress';

export default function AuditLogsManagement({ users }: AuditLogsManagementProps) {
  const { addNotification } = useNotification();
  const [items, setItems] = useState<AdminAuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [totalDbRecords, setTotalDbRecords] = useState<number | null>(null);

  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [q, setQ] = useState('');
  const [fromLocal, setFromLocal] = useState('');
  const [toLocal, setToLocal] = useState('');

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'timestamp',
    direction: 'desc',
  });

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<AdminAuditLogRow | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [rowPendingDelete, setRowPendingDelete] = useState<AdminAuditLogRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [bulkModalScope, setBulkModalScope] = useState<'filtered' | 'all' | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const fromIso = useMemo(() => localInputToIso(fromLocal), [fromLocal]);
  const toIso = useMemo(() => localInputToIso(toLocal), [toLocal]);

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('sortBy', sortConfig.key);
    params.set('sortDir', sortConfig.direction);
    if (actionFilter && actionFilter !== 'all') params.set('actionType', actionFilter);
    if (entityFilter && entityFilter !== 'all') params.set('entityType', entityFilter);
    if (userFilter && userFilter !== 'all') params.set('userId', userFilter);
    if (q.trim()) params.set('q', q.trim());
    if (fromIso) params.set('from', fromIso);
    if (toIso) params.set('to', toIso);
    return params;
  }, [sortConfig, actionFilter, entityFilter, userFilter, q, fromIso, toIso]);

  const buildListParams = useCallback(() => {
    const params = buildFilterParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    return params;
  }, [buildFilterParams, page, pageSize]);

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/audit-logs/admin/meta'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        actionTypes?: string[];
        entityTypes?: string[];
        totalRecords?: number;
      };
      setActionTypes(Array.isArray(data.actionTypes) ? data.actionTypes : []);
      setEntityTypes(Array.isArray(data.entityTypes) ? data.entityTypes : []);
      if (typeof data.totalRecords === 'number') setTotalDbRecords(data.totalRecords);
    } catch {
      /* ignore */
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildListParams();
      const res = await fetch(apiUrl(`/api/audit-logs/admin/list?${params}`), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        if (res.status === 403) {
          setError('Nincs jogosultsága az eseménynapló megtekintéséhez (csak adminisztrátor).');
        } else {
          setError('A napló betöltése nem sikerült.');
        }
        setItems([]);
        setTotal(0);
        return;
      }
      const data = await res.json();
      setItems(data.items || []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
    } catch {
      setError('Hálózati hiba történt.');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [buildListParams]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadMeta();
      void loadList();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [loadList, loadMeta]);

  useEffect(() => {
    if (!detailModalOpen && detailRow) {
      const t = window.setTimeout(() => setDetailRow(null), 220);
      return () => window.clearTimeout(t);
    }
  }, [detailModalOpen, detailRow]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const fromIdx = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const toIdx = Math.min(safePage * pageSize, total);

  const handleSort = (key: SortKey) => {
    setPage(1);
    setSortConfig((c) => ({
      key,
      direction: c.key === key && c.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const thSort = (key: SortKey, label: React.ReactNode, className = '') => (
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

  const actionOptions: MwDropdownOption[] = useMemo(() => {
    const opts: MwDropdownOption[] = [{ value: 'all', label: 'Minden művelet' }];
    for (const a of actionTypes) {
      opts.push({ value: a, label: `${actionLabel(a)} (${a})` });
    }
    return opts;
  }, [actionTypes]);

  const entityOptions: MwDropdownOption[] = useMemo(() => {
    const opts: MwDropdownOption[] = [{ value: 'all', label: 'Minden entitás típus' }];
    for (const e of entityTypes) {
      opts.push({ value: e, label: e });
    }
    return opts;
  }, [entityTypes]);

  const userOptions: MwDropdownOption[] = useMemo(() => {
    const opts: MwDropdownOption[] = [{ value: 'all', label: 'Minden felhasználó' }];
    for (const u of users) {
      opts.push({ value: String(u.id), label: u.username });
    }
    return opts;
  }, [users]);

  const hasActiveFilters = !!(
    (actionFilter && actionFilter !== 'all') ||
    (entityFilter && entityFilter !== 'all') ||
    (userFilter && userFilter !== 'all') ||
    q.trim() ||
    fromLocal.trim() ||
    toLocal.trim()
  );

  const jsonPreview = (row: AdminAuditLogRow) => {
    try {
      return JSON.stringify(row.dataJson ?? null, null, 2);
    } catch {
      return String(row.dataJson);
    }
  };

  const exportCsv = useCallback(async () => {
    if (total === 0) {
      addNotification('info', 'Nincs exportálható sor a jelenlegi szűréssel.');
      return;
    }
    try {
      const params = buildFilterParams();
      const res = await fetch(apiUrl(`/api/audit-logs/admin/export?${params}`), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        addNotification('error', 'Az exportálás nem sikerült.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `esemenynaplo_${csvExportTimestamp()}.csv`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      addNotification('success', 'CSV letöltve.');
    } catch {
      addNotification('error', 'Hálózati hiba az exportáláskor.');
    }
  }, [addNotification, buildFilterParams, total]);

  const openDetail = (row: AdminAuditLogRow) => {
    setDetailRow(row);
    setDetailModalOpen(true);
  };

  const closeDetail = () => setDetailModalOpen(false);

  const requestDelete = (row: AdminAuditLogRow) => {
    setRowPendingDelete(row);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!rowPendingDelete) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/audit-logs/admin/${rowPendingDelete.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        addNotification('error', 'A törlés nem sikerült.');
        return;
      }
      addNotification('success', 'Bejegyzés törölve.');
      if (detailRow?.id === rowPendingDelete.id) closeDetail();
      setDeleteConfirmOpen(false);
      setRowPendingDelete(null);
      void loadList();
      void loadMeta();
    } catch {
      addNotification('error', 'Hálózati hiba a törléskor.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (!bulkModalScope) return;
    setBulkBusy(true);
    try {
      const params = buildFilterParams();
      const res = await fetch(apiUrl(`/api/audit-logs/admin/bulk-delete?${params}`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scope: bulkModalScope }),
      });
      if (!res.ok) {
        addNotification('error', 'A tömeges törlés nem sikerült.');
        return;
      }
      const data = (await res.json()) as { deleted?: number };
      const n = typeof data.deleted === 'number' ? data.deleted : 0;
      addNotification('success', n > 0 ? `${n} bejegyzés törölve.` : 'Nem került törlésre sor.');
      setBulkModalScope(null);
      void loadList();
      void loadMeta();
    } catch {
      addNotification('error', 'Hálózati hiba a tömeges törléskor.');
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="mw-card relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FiShield className="w-20 h-20 text-emerald-400" />
          </div>
          <div className="relative z-10">
            <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Naplóbejegyzések</div>
            <div className="text-3xl font-bold text-white tabular-nums mb-1">
              {totalDbRecords == null ? '…' : totalDbRecords}
            </div>
            <div className="text-gray-500 text-sm leading-relaxed">
              Összes sor az adatbázisban. A táblázat fejlécében a szűrésnek megfelelő találatok száma
              látható.
            </div>
          </div>
        </div>
        <div className="mw-card relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FiActivity className="w-24 h-24 text-emerald-500/80" />
          </div>
          <div className="relative z-10 pr-4">
            <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Mit rögzítünk?</div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Kritikus admin műveletek, üzenetek, geokerítések, párok és eszközök eseményei —{' '}
              <span className="text-white font-medium">IP</span> és{' '}
              <span className="text-white font-medium">böngészőazonosító</span> a kérés pillanatából. Az oldal
              időnként automatikusan frissül; a műveletek oszlopban részletek és törlés érhető el.
            </p>
          </div>
        </div>
      </div>

      <div className="mw-card p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <FiZap className="w-3.5 h-3.5 opacity-80 shrink-0" />
              Művelet
            </label>
            <MwDropdownSelect
              value={actionFilter}
              options={actionOptions}
              ariaLabel="Művelet szűrő"
              className="w-full"
              onChange={(v) => {
                setPage(1);
                setActionFilter(v);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <FiLayers className="w-3.5 h-3.5 opacity-80 shrink-0" />
              Entitás típus
            </label>
            <MwDropdownSelect
              value={entityFilter}
              options={entityOptions}
              ariaLabel="Entitás típus szűrő"
              className="w-full"
              onChange={(v) => {
                setPage(1);
                setEntityFilter(v);
              }}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <FiUser className="w-3.5 h-3.5 opacity-80 shrink-0" />
              Felhasználó
            </label>
            <MwDropdownSelect
              value={userFilter}
              options={userOptions}
              ariaLabel="Felhasználó szűrő"
              className="w-full"
              onChange={(v) => {
                setPage(1);
                setUserFilter(v);
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MwDateTimePicker
            label="Időponttól"
            value={fromLocal}
            maxLocal={toLocal || undefined}
            onChange={(v) => {
              setPage(1);
              setFromLocal(v);
            }}
          />
          <MwDateTimePicker
            label="Időpontig"
            value={toLocal}
            minLocal={fromLocal || undefined}
            onChange={(v) => {
              setPage(1);
              setToLocal(v);
            }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <FiSearch className="w-3.5 h-3.5 opacity-80 shrink-0" />
            Keresés
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <MwTableSearchInput
                value={q}
                onChange={(v) => {
                  setPage(1);
                  setQ(v);
                }}
                placeholder="IP, felhasználónév, user-agent vagy JSON tartalom…"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void exportCsv()}
                disabled={total === 0 || loading}
                title="Letöltés: a jelenlegi szűrésnek és rendezésnek megfelelő sorok (legfeljebb 8000), CSV"
                className="mw-btn mw-btn-primary inline-flex items-center justify-center gap-2 text-sm px-4 transition-[opacity,transform] duration-300 ease-out disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed"
              >
                <FiDownload className="w-4 h-4 shrink-0" />
                Exportálás
              </button>
              <button
                type="button"
                disabled={!hasActiveFilters}
                onClick={() => {
                  setActionFilter('all');
                  setEntityFilter('all');
                  setUserFilter('all');
                  setQ('');
                  setFromLocal('');
                  setToLocal('');
                  setPage(1);
                }}
                className="mw-btn inline-flex items-center justify-center gap-2 px-4 rounded-xl font-semibold text-sm bg-red-600 hover:bg-red-500 text-white border border-red-500/30 shadow-sm transition-[opacity,transform] duration-300 ease-out disabled:opacity-40 disabled:pointer-events-none disabled:hover:bg-red-600"
              >
                <FiX className="w-4 h-4 shrink-0" />
                Szűrők törlése
              </button>
              <button
                type="button"
                disabled={total === 0 || loading}
                onClick={() => setBulkModalScope('filtered')}
                title="A jelenlegi szűrőknek megfelelő összes naplósor törlése az adatbázisból (nem csak ez az oldal)"
                className="mw-btn inline-flex items-center justify-center gap-2 px-4 rounded-xl font-semibold text-sm border border-amber-500/35 bg-amber-950/40 text-amber-100 hover:bg-amber-900/50 transition-[opacity,transform] duration-300 ease-out disabled:opacity-40 disabled:pointer-events-none"
              >
                <FiTrash2 className="w-4 h-4 shrink-0" />
                Szűrt törlése
              </button>
              <button
                type="button"
                disabled={loading || totalDbRecords === 0}
                onClick={() => setBulkModalScope('all')}
                title="Az összes naplóbejegyzés törlése — visszavonhatatlan"
                className="mw-btn inline-flex items-center justify-center gap-2 px-4 rounded-xl font-semibold text-sm border border-red-500/40 bg-red-950/50 text-red-100 hover:bg-red-900/55 transition-[opacity,transform] duration-300 ease-out disabled:opacity-40 disabled:pointer-events-none"
              >
                <FiAlertTriangle className="w-4 h-4 shrink-0" />
                Összes törlése
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-red-200 text-sm font-medium">
          {error}
        </div>
      )}

      <AdminDataTableCard
        title="Eseménynapló"
        icon={<FiClipboard className="w-6 h-6" />}
        iconTone="green"
        countBadge={loading ? '…' : `${total} találat`}
        footer={
          <AdminTablePaginationFooter
            totalFiltered={total}
            fromIdx={fromIdx}
            toIdx={toIdx}
            page={safePage}
            totalPages={totalPages}
            loading={loading}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        }
      >
        {loading && items.length === 0 ? (
          <AdminTableLoadingState />
        ) : (
          <AdminTableShell
            headerRow={
              <tr>
                {thSort('id', '#', 'w-16')}
                {thSort('timestamp', 'Időpont')}
                {thSort('actionType', 'Művelet')}
                {thSort('username', 'Felhasználó', 'hidden md:table-cell')}
                {thSort('entityType', 'Entitás típus', 'hidden lg:table-cell')}
                {thSort('entityId', 'Entitás ID', 'hidden lg:table-cell')}
                {thSort('ipAddress', 'IP', 'hidden xl:table-cell')}
                <th className="text-center py-4 px-2 text-gray-400 w-28">Műveletek</th>
              </tr>
            }
          >
            {items.length === 0 ? (
              <AdminTableEmptyRow
                colSpan={8}
                icon={FiSearch}
                title="Nincs megjeleníthető naplóbejegyzés."
                hint="Próbáljon más szűrőt, vagy törölje a feltételeket."
              />
            ) : (
              items.map((row) => (
                <tr key={row.id} className="group transition-colors hover:bg-white/5">
                  <td className="text-center py-4 align-middle text-sm font-mono text-gray-400">{row.id}</td>
                  <td className="text-center py-4 align-middle">
                    <DateTimeStackCell iso={row.timestamp} />
                  </td>
                  <td className="text-center py-4 align-middle px-2">
                    <span
                      className={`inline-flex max-w-[14rem] flex-col items-center gap-0.5 rounded-lg border px-2 py-1 text-[11px] font-bold leading-tight ${actionBadgeClass(row.actionType)}`}
                      title={row.actionType}
                    >
                      <span className="truncate">{actionLabel(row.actionType)}</span>
                      <span className="font-mono text-[10px] font-normal opacity-80 truncate max-w-full">
                        {row.actionType}
                      </span>
                    </span>
                  </td>
                  <td className="text-center py-4 align-middle hidden md:table-cell">
                    <span className="text-sm text-gray-300">{row.username ?? '—'}</span>
                  </td>
                  <td className="text-center py-4 align-middle hidden lg:table-cell">
                    <span className="text-xs font-mono text-gray-400">{row.entityType ?? '—'}</span>
                  </td>
                  <td className="text-center py-4 align-middle hidden lg:table-cell">
                    <span className="text-xs font-mono text-gray-400 tabular-nums">
                      {row.entityId != null ? row.entityId : '—'}
                    </span>
                  </td>
                  <td className="text-center py-4 align-middle hidden xl:table-cell">
                    <span className="font-mono text-[11px] text-gray-400">{row.ipAddress ?? '—'}</span>
                  </td>
                  <td className="text-center py-4 align-middle">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                      <button
                        type="button"
                        onClick={() => openDetail(row)}
                        className="p-2 text-emerald-400 hover:text-white hover:bg-emerald-500/20 rounded-lg transition-colors"
                        title="Részletek"
                      >
                        <FiInfo className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDelete(row)}
                        className="p-2 text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Bejegyzés törlése"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </AdminTableShell>
        )}
      </AdminDataTableCard>

      {detailRow != null && (
        <Modal
          isOpen={detailModalOpen}
          onClose={closeDetail}
          variant="green"
          maxWidth="max-w-[min(100%,42rem)]"
          title={
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
                <FiLayers className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="min-w-0 text-left">
                <div className="text-lg font-bold text-white leading-tight truncate">Bejegyzés #{detailRow.id}</div>
                <div className="text-xs font-normal text-gray-400 truncate">{actionLabel(detailRow.actionType)}</div>
              </div>
            </div>
          }
        >
          <div className="border-t border-white/5 bg-gradient-to-b from-[#141414] to-[#101010] px-5 py-5">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="text-xs font-medium uppercase tracking-widest text-gray-500">Időpont</div>
                <div className="text-lg font-semibold leading-snug text-white">{formatDateTimeBudapest(detailRow.timestamp)}</div>
              </div>
              <span
                className={`inline-flex shrink-0 flex-col items-end gap-0.5 rounded-lg border px-3 py-2 text-right text-[11px] font-bold leading-tight ${actionBadgeClass(detailRow.actionType)}`}
                title={detailRow.actionType}
              >
                <span className="max-w-[12rem] truncate">{actionLabel(detailRow.actionType)}</span>
                <span className="font-mono text-[10px] font-normal opacity-85">{detailRow.actionType}</span>
              </span>
            </div>

            <dl className="mb-5 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 rounded-xl border border-white/10 bg-black/35 px-4 py-4 text-sm">
              <div className="sm:col-span-2 border-b border-white/5 pb-3 sm:grid sm:grid-cols-[8rem_1fr] sm:items-baseline sm:gap-3 sm:border-0 sm:pb-0">
                <dt className="text-gray-500">Felhasználó</dt>
                <dd className="font-medium text-white break-words">{detailRow.username ?? '—'}</dd>
              </div>
              <div className="sm:grid sm:grid-cols-[8rem_1fr] sm:items-baseline sm:gap-3">
                <dt className="text-gray-500">user_id</dt>
                <dd className="font-mono text-xs text-gray-200 tabular-nums">{detailRow.userId ?? '—'}</dd>
              </div>
              <div className="sm:grid sm:grid-cols-[8rem_1fr] sm:items-baseline sm:gap-3">
                <dt className="text-gray-500">entity_id</dt>
                <dd className="font-mono text-xs text-gray-200 tabular-nums">{detailRow.entityId ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2 sm:grid sm:grid-cols-[8rem_1fr] sm:items-baseline sm:gap-3">
                <dt className="text-gray-500">Entitás típus</dt>
                <dd className="font-mono text-xs text-gray-200 break-all">{detailRow.entityType ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2 sm:grid sm:grid-cols-[8rem_1fr] sm:items-baseline sm:gap-3">
                <dt className="text-gray-500">IP cím</dt>
                <dd className="font-mono text-xs text-gray-200 break-all">{detailRow.ipAddress ?? '—'}</dd>
              </div>
            </dl>

            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">User-Agent</span>
                <span className="text-[10px] text-gray-600">görgethető</span>
              </div>
              <div className="max-h-32 overflow-y-auto rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-gray-300 [overflow-wrap:anywhere]">
                {detailRow.userAgent ?? '—'}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">data_json</div>
              <pre className="max-h-[min(40vh,18rem)] overflow-auto rounded-lg border border-emerald-500/15 bg-black/60 px-3 py-3 font-mono text-[11px] leading-relaxed text-emerald-100/90 [overflow-wrap:anywhere]">
                {jsonPreview(detailRow)}
              </pre>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmationModal
        isOpen={deleteConfirmOpen}
        title="Bejegyzés törlése"
        message={
          rowPendingDelete
            ? `Biztosan törli a #${rowPendingDelete.id} naplóbejegyzést? Ez véglegesen eltávolítja az adatbázisból.`
            : ''
        }
        confirmLabel={deleteBusy ? 'Törlés…' : 'Törlés'}
        cancelLabel="Mégse"
        isDangerous
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (deleteBusy) return;
          setDeleteConfirmOpen(false);
          setRowPendingDelete(null);
        }}
      />

      <ConfirmationModal
        isOpen={bulkModalScope !== null}
        title={bulkModalScope === 'all' ? 'Összes napló törlése' : 'Szűrt napló törlése'}
        message={
          bulkModalScope === 'all'
            ? `Ez véglegesen törli az adatbázisban tárolt összes eseménynapló-bejegyzést (${totalDbRecords ?? '?'} sor). A művelet nem vonható vissza.`
            : `A jelenlegi szűrőknek megfelelő összes naplósor törlődik az adatbázisból — jelenleg ${total} találatot mutat a lista (minden oldal). A művelet nem vonható vissza.`
        }
        confirmLabel={bulkBusy ? 'Törlés…' : 'Törlés végrehajtása'}
        cancelLabel="Mégse"
        isDangerous
        onConfirm={() => void confirmBulkDelete()}
        onCancel={() => {
          if (bulkBusy) return;
          setBulkModalScope(null);
        }}
      />
    </div>
  );
}
