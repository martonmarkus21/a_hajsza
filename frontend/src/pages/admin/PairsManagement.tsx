
import { useMemo, useState } from 'react';
import { FiUsers, FiPlus, FiTrash2, FiMail, FiShield, FiEdit3, FiMinus, FiCheckCircle, FiXCircle, FiAlertCircle, FiTarget } from 'react-icons/fi';
import { FaHandcuffs } from 'react-icons/fa6';
import Modal from '../../components/Modal';
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
import EditNameModal from '../../components/EditNameModal';
import { useNotification } from '../../contexts/NotificationContext';
import { formatDateTimeBudapestParts } from '../../utils/formatDateTimeBudapest';

interface PairsManagementProps {
    pairs: any[];
    newPair: { assignedNumber: number; name: string };
    setNewPair: (pair: any) => void;
    createPair: () => void;
    deletePair: (id: number) => void;
    handleEditPairName: (pair: any) => void;
    handleSendMessage: (pair: any) => void;
    handleMw: (pairId: number) => void;
    handleCapture: (pairId: number) => void;
    showCreateModal: boolean;
    setShowCreateModal: (show: boolean) => void;
    onPairSelect?: (pair: any) => void;
    activeGameAreaExitViolations?: Record<number, boolean>;
    onOpenViolationDetails?: (pairId: number) => void;
}

export default function PairsManagement({
    pairs,
    newPair,
    setNewPair,
    createPair,
    deletePair,
    handleEditPairName,
    handleSendMessage,
    handleMw,
    handleCapture,
    showCreateModal,
    setShowCreateModal,
    onPairSelect,
    activeGameAreaExitViolations,
    onOpenViolationDetails
}: PairsManagementProps) {
    const { addNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'captured' | 'mw'>('all');

    const pairStats = useMemo(() => {
        const total = pairs.length;
        const active = pairs.filter((p) => p.active && !p.captured).length;
        const captured = pairs.filter((p) => p.captured).length;
        return { total, active, captured };
    }, [pairs]);
    const [renamingPair, setRenamingPair] = useState<{ id: number; name: string } | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: 'assignedNumber' | 'name' | 'status' | 'mw' | 'location', direction: 'asc' | 'desc' }>({ key: 'assignedNumber', direction: 'asc' });

    // Filter logic
    const filteredPairs = pairs.filter(pair => {
        const matchesSearch =
            (pair.name && pair.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            pair.assignedNumber.toString().includes(searchTerm);

        const matchesStatus =
            filterStatus === 'all' ? true :
                filterStatus === 'active' ? pair.active && !pair.captured :
                    filterStatus === 'captured' ? pair.captured :
                        filterStatus === 'mw' ? pair.mostWanted : true;

        return matchesSearch && matchesStatus;
    }).sort((a, b) => {
        const direction = sortConfig.direction === 'asc' ? 1 : -1;

        switch (sortConfig.key) {
            case 'assignedNumber':
                return (a.assignedNumber - b.assignedNumber) * direction;
            case 'name':
                return (a.name || '').localeCompare(b.name || '') * direction;
            case 'status':
                const statusA = a.captured ? 0 : (a.active ? 2 : 1);
                const statusB = b.captured ? 0 : (b.active ? 2 : 1);
                return (statusA - statusB) * direction;
            case 'mw':
                return (Number(a.mostWanted) - Number(b.mostWanted)) * direction;
            case 'location':
                const timeA = a.lastPosition ? new Date(a.lastPosition.timestamp).getTime() : 0;
                const timeB = b.lastPosition ? new Date(b.lastPosition.timestamp).getTime() : 0;
                return (timeA - timeB) * direction;
            default:
                return 0;
        }
    });

    const pagination = useAdminListPagination(
        filteredPairs,
        DEFAULT_ADMIN_TABLE_PAGE_SIZE,
        `${searchTerm}|${filterStatus}`,
    );

    const handleSort = (key: any) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };



    const handleCreate = () => {
        createPair();
        setShowCreateModal(false);
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="mw-card relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FiUsers className="w-20 h-20 text-blue-400" />
                    </div>
                    <div className="relative z-10">
                        <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Párok összesen</div>
                        <div className="text-3xl font-bold text-white tabular-nums mb-1">{pairStats.total}</div>
                        <div className="text-gray-500 text-sm leading-relaxed">
                            <span className="text-emerald-300/90 font-medium">{pairStats.active}</span> aktív ·{' '}
                            <span className="text-gray-400 font-medium">{pairStats.captured}</span> elfogva
                        </div>
                    </div>
                </div>
                <div className="mw-card relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FiTarget className="w-20 h-20 text-orange-400" />
                    </div>
                    <div className="relative z-10 pr-2">
                        <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Tájékoztató</div>
                        <p className="text-gray-300 text-sm leading-relaxed">
                            Szűrhet név vagy sorszám szerint; a táblázatban sorra <span className="text-white font-medium">üzenet</span>,{' '}
                            <span className="text-white font-medium">elfogás</span> és egyéb műveletek érhetők el.
                        </p>
                    </div>
                </div>
            </div>

            <div className="mw-card p-4 sm:p-5 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                    <MwTableSearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Keresés név vagy sorszám alapján…"
                        className="w-full md:max-w-md md:flex-1 md:min-w-0"
                    />
                    <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:shrink-0 md:justify-end">
                        {[
                            { id: 'all', label: 'Összes', icon: null },
                            { id: 'active', label: 'Aktív', icon: FiCheckCircle },
                            { id: 'captured', label: 'Elfogva', icon: FaHandcuffs },
                            { id: 'mw', label: 'Most Wanted', icon: FiShield },
                        ].map((filter) => (
                            <button
                                key={filter.id}
                                type="button"
                                onClick={() => setFilterStatus(filter.id as 'all' | 'active' | 'captured' | 'mw')}
                                onMouseUp={(e) => e.currentTarget.blur()}
                                className={`mw-btn justify-center md:w-auto ${filterStatus === filter.id
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
                title="Párok listája"
                icon={<FiUsers className="w-6 h-6" />}
                iconTone="orange"
                countBadge={`${pagination.totalFiltered} találat`}
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
                                className="w-20"
                                align="center"
                                onSort={() => handleSort('assignedNumber')}
                                active={sortConfig.key === 'assignedNumber'}
                                direction={sortConfig.direction}
                            >
                                #
                            </AdminTableSortTh>
                            <AdminTableSortTh
                                onSort={() => handleSort('name')}
                                active={sortConfig.key === 'name'}
                                direction={sortConfig.direction}
                            >
                                Név
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
                                onSort={() => handleSort('mw')}
                                active={sortConfig.key === 'mw'}
                                direction={sortConfig.direction}
                            >
                                MW
                            </AdminTableSortTh>
                            <AdminTableSortTh
                                align="center"
                                onSort={() => handleSort('location')}
                                active={sortConfig.key === 'location'}
                                direction={sortConfig.direction}
                            >
                                Lokáció
                            </AdminTableSortTh>
                            <th className="text-right py-4 pr-6">Műveletek</th>
                        </tr>
                    }
                >
                            {pagination.totalFiltered === 0 ? (
                                <AdminTableEmptyRow
                                    colSpan={6}
                                    icon={FiUsers}
                                    title="Nincs megjeleníthető pár."
                                    hint="Próbáljon más keresőkifejezést vagy szűrést, vagy hozzon létre új párt, ha még nincs egy sem rögzítve."
                                />
                            ) : (
                                pagination.slice.map((pair) => (
                                    <tr key={pair.id} className="group hover:bg-white/5 transition-colors">
                                        <td className="text-center py-4">
                                            <div 
                                                onClick={() => onPairSelect && onPairSelect(pair)}
                                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mx-auto shadow-sm cursor-pointer border-[3px] border-orange-500 text-white transition-colors duration-300 ${pair.mostWanted
                                                ? 'bg-orange-500 hover:bg-orange-400'
                                                : 'bg-[#2a2a2a] hover:bg-[#383838]'
                                                }`}
                                                title="Pár részleteinek megtekintése"
                                            >
                                                {pair.assignedNumber}
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`text-left font-bold text-base transition-colors duration-200 ${pair.name ? 'text-white group-hover:text-orange-400' : 'text-gray-500 italic font-normal'}`}>
                                                    {pair.name || 'Névtelen'}
                                                </div>
                                                {activeGameAreaExitViolations?.[pair.id] && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onOpenViolationDetails?.(pair.id);
                                                        }}
                                                        className="p-0.5 text-red-500 hover:text-red-300 transition-colors focus:outline-none"
                                                        title="Szabályszegés részletei"
                                                        aria-label="Szabályszegés részletei"
                                                    >
                                                        <FiAlertCircle className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                            {pair.captured && (
                                                <div className="flex items-center gap-1 text-xs text-red-500 font-bold uppercase tracking-wider mt-1">
                                                    <FaHandcuffs className="w-3 h-3" /> Elfogva
                                                </div>
                                            )}
                                        </td>
                                        <td className="text-center py-4">
                                            {pair.active ? (
                                                <span className="inline-flex items-center gap-1 text-green-500 bg-green-500/10 px-2 py-1 rounded-lg text-xs font-bold">
                                                    <FiCheckCircle className="w-3 h-3" /> Aktív
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-red-500 bg-red-500/10 px-2 py-1 rounded-lg text-xs font-bold">
                                                    <FiXCircle className="w-3 h-3" /> Inaktív
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-center py-4">
                                            <button
                                                onClick={(e) => {
                                                    e.currentTarget.blur();
                                                    handleMw(pair.id);
                                                    addNotification('success', `Most Wanted státusz ${pair.mostWanted ? 'eltávolítva' : 'beállítva'}`);
                                                }}
                                                className={`relative block mx-auto -translate-x-1.5 p-2 rounded-xl transition-all duration-300 outline-none border-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 bg-transparent ${pair.mostWanted
                                                    ? 'text-orange-400'
                                                    : 'text-gray-600 hover:text-gray-400 hover:bg-white/5 opacity-60 hover:opacity-100'
                                                    }`}
                                                style={{ WebkitTapHighlightColor: 'transparent', outline: 'none', boxShadow: 'none' }}
                                                title="Most Wanted státusz váltása"
                                            >
                                                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 transition-opacity duration-300 pointer-events-none bg-orange-500/20 blur-md rounded-full ${pair.mostWanted ? 'opacity-100' : 'opacity-0'}`} />
                                                <FiShield className={`relative z-10 w-5 h-5 mx-auto transition-colors duration-300 ${pair.mostWanted ? 'fill-current' : ''}`} />
                                            </button>
                                        </td>
                                        <td className="text-center py-4">
                                            {pair.lastPosition && pair.lastPosition.lat != null && pair.lastPosition.lon != null ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-mono text-gray-300 bg-black/40 px-2 py-1 rounded border border-white/5">
                                                        {pair.lastPosition.lat.toFixed(4)}, {pair.lastPosition.lon.toFixed(4)}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 mt-1 font-mono tabular-nums">
                                                        {formatDateTimeBudapestParts(pair.lastPosition.timestamp)?.time ?? '—'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-600 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="text-right pr-6 py-4">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                                <button
                                                    onClick={() => handleSendMessage(pair)}
                                                    className="p-2 text-blue-400 hover:text-white hover:bg-blue-500/20 rounded-lg transition-colors"
                                                    title="Üzenet küldése"
                                                >
                                                    <FiMail className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setRenamingPair({ id: pair.id, name: pair.name || '' })}
                                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                    title="Név szerkesztése"
                                                >
                                                    <FiEdit3 className="w-4 h-4" />
                                                </button>
                                                {!pair.captured && (
                                                    <button
                                                        onClick={() => handleCapture(pair.id)}
                                                        className="p-2 text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors"
                                                        title="Elfogás rögzítése"
                                                    >
                                                        <FaHandcuffs className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => deletePair(pair.id)}
                                                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors ml-2"
                                                    title="Törlés"
                                                >
                                                    <FiTrash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                </AdminTableShell>
            </AdminDataTableCard>

            {/* Rename Modal */}
            <EditNameModal
                isOpen={!!renamingPair}
                initialName={renamingPair?.name || ''}
                onClose={() => setRenamingPair(null)}
                onSave={async (newName: string | null) => {
                    if (renamingPair) {
                        try {
                            const updatedPair = { ...renamingPair, name: newName || '' };
                            await handleEditPairName(updatedPair);
                            addNotification('success', 'Pár neve sikeresen módosítva');
                            setRenamingPair(null);
                        } catch (error) {
                            console.error(error);
                            addNotification('error', 'Hiba történt az átnevezés során');
                        }
                    }
                }}
            />

            {/* Create Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title={
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0 p-2 bg-orange-500/20 rounded-lg flex items-center justify-center">
                            <FiPlus className="w-5 h-5 text-orange-400" />
                        </div>
                        <span className="text-xl font-bold text-white leading-tight">Új pár létrehozása</span>
                    </div>
                }
            >
                <div className="p-6 space-y-4">
                    <div className="flex gap-4">
                        <div className="w-36">
                            <label className="block text-gray-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Sorszám</label>
                            <div className="flex items-center h-[52px] bg-black/20 border border-white/10 rounded-xl overflow-hidden focus-within:border-orange-500/50 focus-within:bg-white/5 transition-all">
                                <button
                                    onClick={() => setNewPair({ ...newPair, assignedNumber: Math.max(1, newPair.assignedNumber - 1) })}
                                    className="w-12 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    <FiMinus className="w-4 h-4" />
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    value={newPair.assignedNumber}
                                    onChange={(e) => setNewPair({ ...newPair, assignedNumber: parseInt(e.target.value) || 0 })}
                                    className="flex-1 w-full bg-transparent border-none text-white font-bold text-center text-lg focus:ring-0 px-0 appearance-none m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                                <button
                                    onClick={() => setNewPair({ ...newPair, assignedNumber: newPair.assignedNumber + 1 })}
                                    className="w-12 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    <FiPlus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block text-gray-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Csapatnév (opcionális)</label>
                            <input
                                type="text"
                                value={newPair.name}
                                onChange={(e) => setNewPair({ ...newPair, name: e.target.value })}
                                className="w-full h-[52px] px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 focus:bg-white/5 transition-all"
                                placeholder="Pl. Alpha csapat"
                            />
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t border-white/5 bg-black/20 flex gap-3">
                    <button
                        onClick={() => setShowCreateModal(false)}
                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold transition-all"
                    >
                        Mégse
                    </button>
                    <button
                        onClick={handleCreate}
                        className="flex-1 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-xl font-bold shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2"
                    >
                        <FiPlus className="w-5 h-5" />
                        Pár létrehozása
                    </button>
                </div>
            </Modal>
        </div>
    );
}
