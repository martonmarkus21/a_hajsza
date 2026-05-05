import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
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
    FiPlus,
    FiCopy,
    FiRefreshCw,
    FiInfo,
    FiAlertTriangle,
} from 'react-icons/fi';
import { DateTimeStackCell } from '../../utils/formatDateTimeBudapest';
import CkTableSearchInput from '../../components/CkTableSearchInput';
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
import Modal from '../../components/Modal';
import ConfirmationModal from '../../components/ConfirmationModal';
import { apiUrl } from '@/config/env';
import { encodeCkMobileQrPayload } from '../../utils/mobileConnectionQr';
import { useNotification } from '../../contexts/NotificationContext';
import { extractApiErrorMessage } from '../../utils/extractApiErrorMessage';

async function parseFetchFailureMessage(res: Response): Promise<string> {
    const raw = await res.text();
    try {
        return extractApiErrorMessage(JSON.parse(raw), `HTTP ${res.status}`);
    } catch {
        return raw.trim() || `HTTP ${res.status}`;
    }
}

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
    const { addNotification } = useNotification();
    const [showAndroidConnModal, setShowAndroidConnModal] = useState(false);
    const [androidConnLoading, setAndroidConnLoading] = useState(false);
    const [androidConnError, setAndroidConnError] = useState<string | null>(null);
    const [androidConn, setAndroidConn] = useState<{
        apiBaseUrl: string;
        enrollmentEnabled: boolean;
        enrollmentSecret: string;
        enrollmentSecretFromEnv: boolean;
    } | null>(null);
    const [androidQrDataUrl, setAndroidQrDataUrl] = useState<string | null>(null);
    const [androidConnRegenerating, setAndroidConnRegenerating] = useState(false);
    const [androidCopiedField, setAndroidCopiedField] = useState<'url' | 'secret' | null>(null);
    const androidCopyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showRegenerateSecretConfirm, setShowRegenerateSecretConfirm] = useState(false);

    useEffect(() => {
        return () => {
            if (androidCopyResetRef.current) clearTimeout(androidCopyResetRef.current);
        };
    }, []);

    const applyAndroidConnPayload = async (
        data: {
            apiBaseUrl: string;
            enrollmentEnabled: boolean;
            enrollmentSecret: string;
            enrollmentSecretFromEnv: boolean;
        },
    ) => {
        setAndroidConn(data);
        const qrText = encodeCkMobileQrPayload(data.apiBaseUrl, data.enrollmentSecret || '');
        const url = await QRCode.toDataURL(qrText, {
            width: 176,
            margin: 1,
            color: { dark: '#0f0f0fff', light: '#ffffffff' },
        });
        setAndroidQrDataUrl(url);
    };

    useEffect(() => {
        if (!showAndroidConnModal) return;
        let cancelled = false;
        (async () => {
            setAndroidConnLoading(true);
            setAndroidConnError(null);
            setAndroidConn(null);
            setAndroidQrDataUrl(null);
            try {
                const res = await fetch(apiUrl('/api/devices/admin/mobile-connection'), {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                });
                if (!res.ok) {
                    throw new Error(await parseFetchFailureMessage(res));
                }
                const data = (await res.json()) as {
                    apiBaseUrl: string;
                    enrollmentEnabled: boolean;
                    enrollmentSecret: string;
                    enrollmentSecretFromEnv: boolean;
                };
                if (cancelled) return;
                await applyAndroidConnPayload(data);
            } catch (e: unknown) {
                if (!cancelled) {
                    setAndroidConnError(e instanceof Error ? e.message : 'Ismeretlen hiba');
                }
            } finally {
                if (!cancelled) setAndroidConnLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [showAndroidConnModal]);

    useEffect(() => {
        if (!showAndroidConnModal) {
            setAndroidCopiedField(null);
            if (androidCopyResetRef.current) {
                clearTimeout(androidCopyResetRef.current);
                androidCopyResetRef.current = null;
            }
        }
    }, [showAndroidConnModal]);

    const runRegenerateAndroidSecret = async () => {
        if (androidConnRegenerating) return;
        setAndroidConnRegenerating(true);
        setAndroidConnError(null);
        try {
            const res = await fetch(apiUrl('/api/devices/admin/mobile-connection/regenerate'), {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (!res.ok) {
                throw new Error(await parseFetchFailureMessage(res));
            }
            const data = (await res.json()) as {
                apiBaseUrl: string;
                enrollmentEnabled: boolean;
                enrollmentSecret: string;
                enrollmentSecretFromEnv: boolean;
            };
            await applyAndroidConnPayload(data);
            addNotification('success', 'Új kapcsolódási titok került generálásra.');
        } catch (e: unknown) {
            setAndroidConnError(e instanceof Error ? e.message : 'A generálás nem sikerült.');
        } finally {
            setAndroidConnRegenerating(false);
            setShowRegenerateSecretConfirm(false);
        }
    };

    const flashAndroidCopied = (field: 'url' | 'secret') => {
        if (androidCopyResetRef.current) clearTimeout(androidCopyResetRef.current);
        setAndroidCopiedField(field);
        androidCopyResetRef.current = setTimeout(() => {
            setAndroidCopiedField(null);
            androidCopyResetRef.current = null;
        }, 2000);
    };

    const copyAndroidField = async (field: 'url' | 'secret', text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            flashAndroidCopied(field);
        } catch {
            addNotification('error', 'A másolás nem sikerült — próbálja meg újra.');
        }
    };

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
            <Modal
                isOpen={showAndroidConnModal}
                onClose={() => setShowAndroidConnModal(false)}
                maxWidth="max-w-[min(100vw-1.25rem,24rem)] sm:max-w-xl md:max-w-2xl"
                headerPaddingClass="p-4 sm:p-5"
                title={
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="flex-shrink-0 p-1.5 sm:p-2 bg-orange-500/20 rounded-lg flex items-center justify-center ring-1 ring-orange-500/25">
                            <FiSmartphone className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                        </div>
                        <span className="text-base sm:text-lg font-bold text-white leading-snug">
                            Android alkalmazás kapcsolódása
                        </span>
                    </div>
                }
            >
                <div className="p-4 sm:p-5 text-gray-300 text-sm leading-relaxed max-h-[min(85dvh,32rem)] overflow-y-auto custom-scrollbar">
                    {androidConnLoading && (
                        <div className="flex items-center gap-2 text-gray-400 py-2">
                            <span className="inline-block w-4 h-4 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin shrink-0" />
                            <span className="text-xs sm:text-sm">Adatok betöltése…</span>
                        </div>
                    )}
                    {androidConnError && (
                        <div className="flex gap-2.5 items-start rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2.5 text-red-200/95 text-xs sm:text-sm">
                            <FiAlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" aria-hidden />
                            <p className="min-w-0">{androidConnError}</p>
                        </div>
                    )}
                    {androidConn && !androidConnLoading && (
                        <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-5 pt-1">
                            <div className="flex-1 min-w-0 space-y-3">
                                {androidConn.enrollmentSecretFromEnv ? (
                                    <div className="flex gap-2.5 rounded-xl border border-amber-500/35 bg-amber-950/40 px-3 py-2.5 text-amber-100/95 text-xs sm:text-sm leading-snug">
                                        <FiAlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400/90" aria-hidden />
                                        <p>
                                            Amit itt lát, a szerver beállítófájljából (<code className="text-orange-300/95 font-mono text-[11px]">.env</code>) jön, nem ezen az oldalon generálódik. A titkot a <code className="text-orange-300/95 font-mono text-[11px]">MOBILE_ENROLLMENT_SECRET</code> sorban lehet megváltoztatni – utána mindenképp indítsa újra a játék API-ját, különben a régi érték marad érvényben.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex gap-2.5 rounded-xl border border-violet-500/30 bg-violet-950/35 px-3 py-2.5 text-violet-100/95 text-xs sm:text-sm leading-snug">
                                        <FiInfo className="w-4 h-4 shrink-0 mt-0.5 text-violet-400/90" aria-hidden />
                                        <p>
                                            A webcím és a titok együtt mondja meg az alkalmazásnak, melyik szerverhez csatlakozzon. A titok véletlen kulcs, a szerver tárolja – első alkalommal itt jön létre, ha eddig nem volt. QR-rel nem kell gépelni; új kulcshoz (pl. kiszivárgás után) lent a „Új titok generálása” gomb.
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">
                                            Szerver webcíme (API)
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => void copyAndroidField('url', androidConn.apiBaseUrl)}
                                            className={`p-1 rounded-md transition-colors ${
                                                androidCopiedField === 'url'
                                                    ? 'text-emerald-400 bg-emerald-500/15'
                                                    : 'text-gray-400 hover:text-orange-300 hover:bg-white/10'
                                            }`}
                                            title="Másolás a vágólapra"
                                            aria-label="API URL másolása"
                                        >
                                            {androidCopiedField === 'url' ? (
                                                <FiCheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
                                            ) : (
                                                <FiCopy className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
                                            )}
                                        </button>
                                    </div>
                                    <div className="font-mono text-[11px] sm:text-xs break-all bg-black/35 border border-white/10 rounded-lg px-2.5 py-2 text-orange-200/90 leading-snug">
                                        {androidConn.apiBaseUrl}
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                                        A telefonon ezt a címet kell megadni; a QR tartalmazza.
                                    </p>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">
                                            Titkos kapcsolódási kulcs
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                void copyAndroidField('secret', androidConn.enrollmentSecret || '')
                                            }
                                            className={`p-1 rounded-md transition-colors ${
                                                androidCopiedField === 'secret'
                                                    ? 'text-emerald-400 bg-emerald-500/15'
                                                    : 'text-gray-400 hover:text-orange-300 hover:bg-white/10'
                                            } disabled:opacity-40 disabled:pointer-events-none`}
                                            title="Másolás a vágólapra"
                                            aria-label="Titok másolása"
                                            disabled={!androidConn.enrollmentSecret}
                                        >
                                            {androidCopiedField === 'secret' ? (
                                                <FiCheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
                                            ) : (
                                                <FiCopy className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
                                            )}
                                        </button>
                                    </div>
                                    <div className="font-mono text-[11px] sm:text-xs break-all bg-black/35 border border-white/10 rounded-lg px-2.5 py-2 text-emerald-200/85 leading-snug min-h-[2.25rem]">
                                        {androidConn.enrollmentSecret || '— (nincs elérhető titok)'}
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                                        A telefonra ezt is be kell írni; a QR ezt is átadja.
                                    </p>
                                </div>
                            </div>
                            {androidQrDataUrl && (
                                <div className="flex flex-col items-center gap-1.5 md:w-[11.5rem] shrink-0 mx-auto md:mx-0 md:pt-0.5 border-t border-white/10 md:border-t-0 md:border-l md:pl-5 md:border-white/10 pt-3 md:pt-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 text-center md:text-left w-full">
                                        QR-kód
                                    </span>
                                    <img
                                        src={androidQrDataUrl}
                                        alt="Android kapcsolódási QR-kód"
                                        className="rounded-lg border border-white/10 bg-white p-1.5 w-[148px] h-[148px] sm:w-[168px] sm:h-[168px] object-contain shadow-inner"
                                    />
                                    <p className="text-[10px] sm:text-[11px] text-gray-500 text-center leading-snug max-w-[14rem] md:max-w-none">
                                        Beolvasás az appban, vagy a szerver beállításánál a webcím és a kulcs bemásolása.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-t border-white/5 bg-black/25 flex flex-wrap items-center justify-end gap-2">
                    {androidConn && !androidConn.enrollmentSecretFromEnv && (
                        <button
                            type="button"
                            onClick={() => setShowRegenerateSecretConfirm(true)}
                            disabled={androidConnLoading || androidConnRegenerating}
                            className="ck-btn ck-btn-secondary flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-bold disabled:opacity-50"
                        >
                            <FiRefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${androidConnRegenerating ? 'animate-spin' : ''}`} />
                            Új titok generálása
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowAndroidConnModal(false)}
                        className="px-4 py-2 sm:px-5 sm:py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl font-semibold text-xs sm:text-sm transition-colors"
                    >
                        Bezárás
                    </button>
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={showRegenerateSecretConfirm}
                title="Új kapcsolódási titok"
                message={
                    'Létrejön egy új titok. A régi QR és a régi titok nem működik tovább – a telefonokon frissíteni kell (új QR vagy másolás).\n\nSzóljon előre a pároknak, vagy küldje el az új adatokat.\n\nBiztosan folytatja?'
                }
                confirmLabel={androidConnRegenerating ? 'Generálás…' : 'Új titok generálása'}
                cancelLabel="Mégse"
                isDangerous
                onCancel={() => !androidConnRegenerating && setShowRegenerateSecretConfirm(false)}
                onConfirm={() => void runRegenerateAndroidSecret()}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="ck-card relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FiSmartphone className="w-20 h-20 text-violet-400" />
                    </div>
                    <div className="relative z-10">
                        <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Regisztrált eszközök</div>
                        <div className="text-3xl font-bold text-white tabular-nums mb-1">{devices.length}</div>
                        <div className="text-gray-500 text-sm leading-relaxed">Összes felvett telefon vagy eszköz-ID a rendszerben.</div>
                    </div>
                </div>
                <div className="ck-card relative overflow-hidden group">
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

            <div className="ck-card p-4 sm:p-5 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                    <CkTableSearchInput
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
                                className={`ck-btn flex-1 min-w-[5.5rem] md:flex-none md:min-w-0 ${filterStatus === filter.id
                                    ? 'ck-btn-primary'
                                    : 'ck-btn-secondary text-gray-400 hover:text-white'
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
                headerActions={
                    <button
                        type="button"
                        onClick={() => setShowAndroidConnModal(true)}
                        onMouseUp={(e) => e.currentTarget.blur()}
                        className="ck-btn ck-btn-primary shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-bold"
                        title="Android kapcsolódási QR és titok"
                    >
                        <FiPlus className="w-4 h-4 shrink-0" />
                        Android kapcsolat
                    </button>
                }
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
                                    const pairForCk =
                                        pairsList.find((p: { id: number }) => p.id === device.pairId) ||
                                        pairsList.find((p: { name: string }) => p.name === device.pairName);
                                    const pairCelkereszt = !!pairForCk?.celkereszt;
                                    const pairCaptured = !!pairForCk?.captured;

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
                                                            className={`w-8 h-8 flex-shrink-0 cursor-pointer rounded-full border-[3px] flex items-center justify-center font-bold text-white text-xs outline-none focus:outline-none transition-colors duration-300 ${
                                                                pairCaptured
                                                                    ? 'border-red-600 bg-red-600 hover:bg-red-500'
                                                                    : pairCelkereszt
                                                                        ? 'border-orange-500 bg-orange-500 hover:bg-orange-400'
                                                                        : 'border-orange-500 bg-[#2a2a2a] hover:bg-[#383838]'
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
