import { useState } from 'react';
import {
    FiSmartphone,
    FiTrash2,
    FiLogOut,
    FiWifi,
    FiWifiOff,
    FiCheckCircle,
    FiXCircle,
    FiAlertCircle,
    FiActivity,
} from 'react-icons/fi';
import { DateTimeStackCell } from '../../utils/formatDateTimeBudapest';
import MwTableSearchInput from '../../components/MwTableSearchInput';
import {
    AdminDataTableCard,
    AdminTableEmptyRow,
} from '../../components/admin/AdminDataTableCard';
import {
    AdminTableShell,
    AdminTableSortTh,
    AdminTablePaginationFooter,
} from '../../components/admin/AdminTableKit';
import { DEFAULT_ADMIN_TABLE_PAGE_SIZE, useAdminListPagination } from '../../hooks/useAdminListPagination';

/** Egyetlen megjelenített időpont: kijelentkezett eszköznél a kijelentkezés, különben az utolsó szerverkapcsolat. */
function deviceListTimestampIso(device: { loggedOutAt?: string | null; lastSeenAt?: string | null }): string | null {
  if (device.loggedOutAt) return device.loggedOutAt;
  return device.lastSeenAt ?? null;
}

interface DeviceManagementProps {
    devices: any[];
    activeDevices: any[];
    pairsList: any[];
    handleForceLogout: (deviceId: string) => void;
    handleDeleteDevice: (id: number) => void;
    onPairSelect?: (pair: any) => void;
    activeGameAreaExitViolations?: Record<number, boolean>;
    onOpenViolationDetails?: (pairId: number) => void;
}

export default function DeviceManagement({
    devices,
    activeDevices,
    pairsList,
    handleForceLogout,
    handleDeleteDevice,
    onPairSelect,
    activeGameAreaExitViolations,
    onOpenViolationDetails
}: DeviceManagementProps) {

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
    const [sortConfig, setSortConfig] = useState<{ key: 'imei' | 'pair' | 'lastSeen' | 'status' | 'fcm', direction: 'asc' | 'desc' }>({ key: 'imei', direction: 'asc' });

    const filteredDevices = devices.filter(device => {
        const isActive = activeDevices.some(d => d.imeiOrDeviceId === device.imeiOrDeviceId);
        const matchesSearch =
            device.imeiOrDeviceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (device.pairName && device.pairName.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus =
            filterStatus === 'all' ? true :
                filterStatus === 'online' ? isActive :
                    !isActive;

        return matchesSearch && matchesStatus;
    }).sort((a, b) => {
        const direction = sortConfig.direction === 'asc' ? 1 : -1;
        const isActiveA = activeDevices.some(d => d.imeiOrDeviceId === a.imeiOrDeviceId);
        const isActiveB = activeDevices.some(d => d.imeiOrDeviceId === b.imeiOrDeviceId);

        switch (sortConfig.key) {
            case 'imei':
                return a.imeiOrDeviceId.localeCompare(b.imeiOrDeviceId) * direction;
            case 'pair':
                // Find pair for device
                const getPairNumber = (dev: any) => {
                    const pair = pairsList.find((p: any) => p.id === dev.pairId) || pairsList.find((p: any) => p.name === dev.pairName);
                    return pair ? pair.assignedNumber : 0;
                };
                return (getPairNumber(a) - getPairNumber(b)) * direction;
            case 'lastSeen': {
                const isoA = deviceListTimestampIso(a);
                const isoB = deviceListTimestampIso(b);
                const timeA = isoA ? new Date(isoA).getTime() : 0;
                const timeB = isoB ? new Date(isoB).getTime() : 0;
                return (timeA - timeB) * direction;
            }
            case 'status':
                const statusA = isActiveA ? 1 : 0;
                const statusB = isActiveB ? 1 : 0;
                return (statusA - statusB) * direction;
            case 'fcm':
                const fcmA = a.hasFcmToken ? 1 : 0;
                const fcmB = b.hasFcmToken ? 1 : 0;
                return (fcmA - fcmB) * direction;
            default:
                return 0;
        }
    });

    const pagination = useAdminListPagination(
        filteredDevices,
        DEFAULT_ADMIN_TABLE_PAGE_SIZE,
        `${searchTerm}|${filterStatus}`,
    );

    const handleSort = (key: any) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="mw-card relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FiSmartphone className="w-20 h-20 text-violet-400" />
                    </div>
                    <div className="relative z-10">
                        <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Regisztrált eszközök</div>
                        <div className="text-3xl font-bold text-white tabular-nums mb-1">{devices.length}</div>
                        <div className="text-gray-500 text-sm leading-relaxed">Összes felvett telefon vagy eszköz-ID a rendszerben.</div>
                    </div>
                </div>
                <div className="mw-card relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FiActivity className="w-20 h-20 text-emerald-400" />
                    </div>
                    <div className="relative z-10">
                        <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Online most</div>
                        <div className="text-3xl font-bold text-emerald-400 tabular-nums mb-1">{activeDevices.length}</div>
                        <div className="text-gray-500 text-sm leading-relaxed">Élő szerverkapcsolattal rendelkező eszközök.</div>
                    </div>
                </div>
            </div>

            <div className="mw-card p-4 sm:p-5 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                    <MwTableSearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Keresés IMEI vagy pár alapján…"
                        className="w-full md:max-w-md md:flex-1 md:min-w-0"
                    />
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {[
                            { id: 'all', label: 'Összes', icon: null },
                            { id: 'online', label: 'Online', icon: FiWifi },
                            { id: 'offline', label: 'Offline', icon: FiWifiOff },
                        ].map((filter) => (
                            <button
                                key={filter.id}
                                type="button"
                                onClick={() => setFilterStatus(filter.id as 'all' | 'online' | 'offline')}
                                onMouseUp={(e) => e.currentTarget.blur()}
                                className={`mw-btn flex-1 min-w-[5.5rem] md:flex-none md:min-w-0 ${filterStatus === filter.id
                                    ? 'mw-btn-primary'
                                    : 'mw-btn-secondary text-gray-400 hover:text-white'
                                    }`}
                            >
                                {filter.icon && <filter.icon className="w-4 h-4 shrink-0" />}
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <AdminDataTableCard
                title="Eszközök listája"
                icon={<FiSmartphone className="w-6 h-6" />}
                iconTone="blue"
                countBadge={`${pagination.totalFiltered} találat`}
                scrollClassName="overflow-x-auto"
                footer={
                    <AdminTablePaginationFooter
                        totalFiltered={pagination.totalFiltered}
                        fromIdx={pagination.fromIdx}
                        toIdx={pagination.toIdx}
                        page={pagination.page}
                        totalPages={pagination.totalPages}
                        onPrev={() => pagination.setPage((p) => Math.max(1, p - 1))}
                        onNext={() => pagination.setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    />
                }
            >
                <AdminTableShell
                    headerRow={
                        <tr>
                            <AdminTableSortTh
                                paddedStart
                                onSort={() => handleSort('imei')}
                                active={sortConfig.key === 'imei'}
                                direction={sortConfig.direction}
                            >
                                IMEI
                            </AdminTableSortTh>
                            <AdminTableSortTh
                                onSort={() => handleSort('pair')}
                                active={sortConfig.key === 'pair'}
                                direction={sortConfig.direction}
                            >
                                Hozzárendelt Pár
                            </AdminTableSortTh>
                            <AdminTableSortTh
                                align="center"
                                title="Munkamenet alatt: utolsó szerverkapcsolat. Kijelentkezés után: kijelentkezés ideje."
                                onSort={() => handleSort('lastSeen')}
                                active={sortConfig.key === 'lastSeen'}
                                direction={sortConfig.direction}
                            >
                                Legutóbb aktív
                            </AdminTableSortTh>
                            <AdminTableSortTh
                                align="center"
                                onSort={() => handleSort('status')}
                                active={sortConfig.key === 'status'}
                                direction={sortConfig.direction}
                            >
                                Státusz
                            </AdminTableSortTh>
                            <AdminTableSortTh
                                align="center"
                                onSort={() => handleSort('fcm')}
                                active={sortConfig.key === 'fcm'}
                                direction={sortConfig.direction}
                            >
                                FCM
                            </AdminTableSortTh>
                            <th className="text-right py-4 pr-6">Műveletek</th>
                        </tr>
                    }
                >
                            {pagination.totalFiltered === 0 ? (
                                <AdminTableEmptyRow
                                    colSpan={6}
                                    icon={FiSmartphone}
                                    title="Nincs megjeleníthető eszköz."
                                    hint="Próbáljon más keresőkifejezést vagy szűrést, vagy várjon, amíg egy eszköz csatlakozik és bejelentkezik."
                                />
                            ) : (
                                pagination.slice.map((device) => {
                                    const isActive = activeDevices.some(d => d.imeiOrDeviceId === device.imeiOrDeviceId);
                                    const hasPair = device.pairId || device.pairNumber;
                                    const pairViolation =
                                        device.pairId && activeGameAreaExitViolations?.[device.pairId];
                                    const pairForMw =
                                        pairsList.find((p: { id: number }) => p.id === device.pairId) ||
                                        pairsList.find((p: { name: string }) => p.name === device.pairName);
                                    const pairMostWanted = !!pairForMw?.mostWanted;

                                    return (
                                        <tr key={device.id} className="group hover:bg-white/5 transition-colors">
                                            <td className="pl-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-white transition-colors">
                                                        <FiSmartphone className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className={`font-mono font-bold text-sm tracking-wider transition-colors duration-200 ${hasPair ? 'text-white group-hover:text-orange-400' : 'text-gray-500'}`}>{device.imeiOrDeviceId}</div>
                                                        <div className="text-xs text-gray-500">ID: #{device.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                {hasPair ? (
                                                    <div className="flex items-center gap-3">
                                                        <button 
                                                            onClick={() => {
                                                                if (onPairSelect) {
                                                                    const pairObj = pairsList.find((p: any) => p.id === device.pairId) || pairsList.find((p: any) => p.name === device.pairName);
                                                                    if (pairObj) onPairSelect(pairObj);
                                                                }
                                                            }}
                                                            className={`w-8 h-8 flex-shrink-0 cursor-pointer rounded-full border-[3px] border-orange-500 flex items-center justify-center font-bold text-white text-xs outline-none focus:outline-none transition-colors duration-300 ${
                                                                pairMostWanted
                                                                    ? 'bg-orange-500 hover:bg-orange-400'
                                                                    : 'bg-[#2a2a2a] hover:bg-[#383838]'
                                                            }`}
                                                            title="Pár részleteinek megtekintése"
                                                        >
                                                            {device.pairNumber}
                                                        </button>
                                                        <span
                                                            className={`inline-flex items-center gap-2 transition-colors duration-200 ${
                                                                device.pairName
                                                                    ? 'font-bold text-gray-300'
                                                                    : 'text-gray-300 group-hover:text-white'
                                                            }`}
                                                        >
                                                            {device.pairName || (
                                                                <span className="text-gray-500 italic font-normal">Névtelen</span>
                                                            )}
                                                            {pairViolation && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (device.pairId) onOpenViolationDetails?.(device.pairId);
                                                                    }}
                                                                    className="p-0.5 text-red-500 hover:text-red-300 transition-colors focus:outline-none"
                                                                    title="Szabályszegés részletei"
                                                                    aria-label="Szabályszegés részletei"
                                                                >
                                                                    <FiAlertCircle className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-600 italic text-sm">Nincs hozzárendelve</span>
                                                )}
                                            </td>
                                            <td className="py-4 text-sm text-gray-400 align-middle">
                                                <div className="flex justify-center">
                                                    <DateTimeStackCell iso={deviceListTimestampIso(device)} />
                                                </div>
                                            </td>
                                            <td className="text-center py-4">
                                                {isActive ? (
                                                    <span className="inline-flex items-center gap-1 text-green-500 bg-green-500/10 px-2 py-1 rounded-lg text-xs font-bold">
                                                        <FiWifi className="w-3 h-3" /> Online
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-gray-400 bg-gray-500/10 px-2 py-1 rounded-lg text-xs font-bold">
                                                        <FiWifiOff className="w-3 h-3" /> Offline
                                                    </span>
                                                )}
                                            </td>
                                            <td className="text-center py-4">
                                                {device.hasFcmToken ? (
                                                    <span className="inline-flex items-center gap-1 text-green-500 bg-green-500/10 px-2 py-1 rounded-lg text-xs font-bold">
                                                        <FiCheckCircle className="w-3 h-3" /> Aktív
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-red-500 bg-red-500/10 px-2 py-1 rounded-lg text-xs font-bold">
                                                        <FiXCircle className="w-3 h-3" /> Hiányzik
                                                    </span>
                                                )}
                                            </td>
                                            <td className="text-right pr-6 py-4">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                                    {isActive && (
                                                        <button
                                                            onClick={() => handleForceLogout(device.imeiOrDeviceId)}
                                                            className="p-2 text-orange-400 hover:text-white hover:bg-orange-500/20 rounded-lg transition-colors"
                                                            title="Kényszerített kijelentkeztetés"
                                                        >
                                                            <FiLogOut className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteDevice(device.id)}
                                                        className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors ml-2"
                                                        title="Eszköz törlése"
                                                    >
                                                        <FiTrash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                </AdminTableShell>
            </AdminDataTableCard>
        </div>
    );
}
