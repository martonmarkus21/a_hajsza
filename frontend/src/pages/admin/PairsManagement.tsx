
import { useState } from 'react';
import { FiUsers, FiPlus, FiTrash2, FiMail, FiShield, FiSearch, FiEdit3, FiMinus } from 'react-icons/fi';
import { FaHandcuffs, FaSortUp, FaSortDown } from 'react-icons/fa6';
import Modal from '../../components/Modal';
import EditNameModal from '../../components/EditNameModal';
import { useNotification } from '../../contexts/NotificationContext';

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
    setShowCreateModal
}: PairsManagementProps) {
    const { addNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'captured' | 'mw'>('all');
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

    const handleSort = (key: any) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortIcon = (key: string) => {
        const isActive = sortConfig.key === key;
        return (
            <div className="flex flex-col ml-1">
                <FaSortUp className={`w-3 h-3 -mb-3 ${isActive && sortConfig.direction === 'asc' ? 'text-orange-500' : 'text-gray-500 opacity-60'}`} />
                <FaSortDown className={`w-3 h-3 ${isActive && sortConfig.direction === 'desc' ? 'text-orange-500' : 'text-gray-500 opacity-60'}`} />
            </div>
        );
    };





    const handleCreate = () => {
        createPair();
        setShowCreateModal(false);
    };

    return (
        <div className="space-y-6">
            {/* Top Bar with Search & Actions */}
            <div className="mw-card p-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                    <div className="relative w-full group">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Keresés név vagy sorszám alapján..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 focus:bg-white/5 transition-all"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {[
                        { id: 'all', label: 'Összes', icon: null },
                        { id: 'active', label: 'Aktív', icon: null },
                        { id: 'captured', label: 'Elfogva', icon: FaHandcuffs },
                        { id: 'mw', label: 'Most Wanted', icon: FiShield },
                    ].map(filter => (
                        <button
                            key={filter.id}
                            onClick={() => setFilterStatus(filter.id as any)}
                            onMouseUp={(e) => e.currentTarget.blur()}
                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all focus:outline-none focus:ring-0 shadow-none ${filterStatus === filter.id
                                ? 'bg-orange-500 text-white'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            {filter.icon && <filter.icon className="w-3.5 h-3.5" />}
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Pairs Grid/Table */}
            <div className="mw-card overflow-hidden p-0">
                <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <FiUsers className="w-6 h-6 text-orange-500" />
                        Párok listája
                        <span className="text-sm font-normal text-gray-500 ml-2">({filteredPairs.length} találat)</span>
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="mw-table">
                        <thead>
                            <tr>
                                <th className="w-20 text-center py-4 cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => handleSort('assignedNumber')}>
                                    <div className="flex items-center justify-center gap-1 text-gray-400 group-hover:text-white">
                                        # {getSortIcon('assignedNumber')}
                                    </div>
                                </th>
                                <th className="text-left py-4 cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => handleSort('name')}>
                                    <div className="flex items-center gap-1 text-gray-400 group-hover:text-white">
                                        Név {getSortIcon('name')}
                                    </div>
                                </th>
                                <th className="text-center py-4 cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => handleSort('status')}>
                                    <div className="flex items-center justify-center gap-1 text-gray-400 group-hover:text-white">
                                        Státusz {getSortIcon('status')}
                                    </div>
                                </th>
                                <th className="text-center py-4 cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => handleSort('mw')}>
                                    <div className="flex items-center justify-center gap-1 text-gray-400 group-hover:text-white">
                                        MW {getSortIcon('mw')}
                                    </div>
                                </th>
                                <th className="text-center py-4 cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => handleSort('location')}>
                                    <div className="flex items-center justify-center gap-1 text-gray-400 group-hover:text-white">
                                        Lokáció {getSortIcon('location')}
                                    </div>
                                </th>
                                <th className="text-right py-4 pr-6">Műveletek</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredPairs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-gray-500">
                                        Nem található pár a keresési feltételekkel.
                                    </td>
                                </tr>
                            ) : (
                                filteredPairs.map((pair) => (
                                    <tr key={pair.id} className="group hover:bg-white/5 transition-colors">
                                        <td className="text-center py-4">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mx-auto shadow-sm transition-all ${pair.mostWanted
                                                ? 'bg-orange-500 text-white shadow-orange-500/20'
                                                : 'bg-[#2a2a2a] text-white border-[3px] border-orange-500'
                                                }`}>
                                                {pair.assignedNumber}
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <div className="font-bold text-white text-base group-hover:text-orange-400 transition-colors">
                                                {pair.name || <span className="text-gray-600 italic font-normal">Névtelen</span>}
                                            </div>
                                            {pair.captured && (
                                                <div className="flex items-center gap-1 text-xs text-red-500 font-bold uppercase tracking-wider mt-1">
                                                    <FaHandcuffs className="w-3 h-3" /> Elfogva
                                                </div>
                                            )}
                                        </td>
                                        <td className="text-center py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${pair.active
                                                ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                                : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                                                }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${pair.active ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                                                {pair.active ? 'Aktív' : 'Inaktív'}
                                            </span>
                                        </td>
                                        <td className="text-center py-4">
                                            <button
                                                onClick={() => handleMw(pair.id)}
                                                onMouseUp={(e) => e.currentTarget.blur()}
                                                className={`p-2 rounded-lg transition-all transform hover:scale-110 focus:outline-none focus:ring-0 border-0 outline-none ${pair.mostWanted
                                                    ? 'bg-orange-500/20 text-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]'
                                                    : 'text-gray-600 hover:text-gray-400 hover:bg-white/5 grayscale opacity-50 hover:grayscale-0 hover:opacity-100'
                                                    }`}
                                                title="Most Wanted státusz váltása"
                                            >
                                                <FiShield className={`w-5 h-5 ${pair.mostWanted ? 'fill-current' : ''}`} />
                                            </button>
                                        </td>
                                        <td className="text-center py-4">
                                            {pair.lastPosition && pair.lastPosition.lat != null && pair.lastPosition.lon != null ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-mono text-gray-300 bg-black/40 px-2 py-1 rounded border border-white/5">
                                                        {pair.lastPosition.lat.toFixed(4)}, {pair.lastPosition.lon.toFixed(4)}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 mt-1">
                                                        {new Date(pair.lastPosition.timestamp).toLocaleTimeString()}
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
                                                    className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
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
                                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Rename Modal */}
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
                    <>
                        <div className="p-2 bg-orange-500/20 rounded-lg">
                            <FiPlus className="w-5 h-5 text-orange-500" />
                        </div>
                        Új pár létrehozása
                    </>
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
