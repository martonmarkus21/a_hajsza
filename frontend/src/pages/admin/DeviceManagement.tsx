import { useState } from 'react';
import { FiSmartphone, FiTrash2, FiLogOut, FiSearch, FiWifi, FiWifiOff, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { FaSortUp, FaSortDown } from 'react-icons/fa6';

interface DeviceManagementProps {
    devices: any[];
    activeDevices: any[];
    pairsList: any[];
    handleForceLogout: (deviceId: string) => void;
    handleDeleteDevice: (id: number) => void;
    onPairSelect?: (pair: any) => void;
}

export default function DeviceManagement({
    devices,
    activeDevices,
    pairsList,
    handleForceLogout,
    handleDeleteDevice,
    onPairSelect
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
            case 'lastSeen':
                const timeA = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
                const timeB = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
                return (timeA - timeB) * direction;
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

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="mw-card">
                    <h3 className="text-gray-400 text-sm font-bold uppercase mb-2">Összes eszköz</h3>
                    <div className="text-3xl font-bold text-white">{devices.length} db</div>
                </div>
                <div className="mw-card">
                    <h3 className="text-gray-400 text-sm font-bold uppercase mb-2">Aktív eszközök</h3>
                    <div className="text-3xl font-bold text-green-500">{activeDevices.length} db</div>
                </div>
            </div>

            {/* Top Bar with Search & Filters */}
            <div className="mw-card flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="relative w-full md:w-96 group">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Keresés IMEI vagy Pár alapján..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="mw-input pl-11"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    {[
                        { id: 'all', label: 'Összes', icon: null },
                        { id: 'online', label: 'Online', icon: FiWifi },
                        { id: 'offline', label: 'Offline', icon: FiWifiOff },
                    ].map(filter => (
                        <button
                            key={filter.id}
                            onClick={() => setFilterStatus(filter.id as any)}
                            onMouseUp={(e) => e.currentTarget.blur()}
                            className={`mw-btn flex-1 md:flex-none ${filterStatus === filter.id
                                ? 'mw-btn-primary'
                                : 'mw-btn-secondary text-gray-400 hover:text-white'
                                }`}
                        >
                            {filter.icon && <filter.icon className="w-4 h-4" />}
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mw-card p-0 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-orange-500/20 text-orange-500">
                            <FiSmartphone className="w-6 h-6" />
                        </div>
                        Eszközök listája
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="mw-table">
                        <thead>
                            <tr>

                                <th className="text-left py-4 pl-6 cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => handleSort('imei')}>
                                    <div className="flex items-center gap-1 text-gray-400 group-hover:text-white">
                                        Eszköz (IMEI) {getSortIcon('imei')}
                                    </div>
                                </th>
                                <th className="text-left py-4 cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => handleSort('pair')}>
                                    <div className="flex items-center gap-1 text-gray-400 group-hover:text-white">
                                        Hozzárendelt Pár {getSortIcon('pair')}
                                    </div>
                                </th>
                                <th className="text-left py-4 cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => handleSort('lastSeen')}>
                                    <div className="flex items-center gap-1 text-gray-400 group-hover:text-white">
                                        Utoljára látva {getSortIcon('lastSeen')}
                                    </div>
                                </th>
                                <th className="text-center py-4 cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => handleSort('status')}>
                                    <div className="flex items-center justify-center gap-1 text-gray-400 group-hover:text-white">
                                        Státusz {getSortIcon('status')}
                                    </div>
                                </th>
                                <th className="text-center py-4 cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => handleSort('fcm')}>
                                    <div className="flex items-center justify-center gap-1 text-gray-400 group-hover:text-white">
                                        FCM {getSortIcon('fcm')}
                                    </div>
                                </th>
                                <th className="text-right py-4 pr-6">Műveletek</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredDevices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-gray-500">
                                        Nem található eszköz a keresési feltételekkel.
                                    </td>
                                </tr>
                            ) : (
                                filteredDevices.map((device) => {
                                    const isActive = activeDevices.some(d => d.imeiOrDeviceId === device.imeiOrDeviceId);
                                    const hasPair = device.pairId || device.pairNumber;

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
                                                            className="w-8 h-8 flex-shrink-0 cursor-pointer rounded-full bg-[#2a2a2a] hover:bg-[#383838] transition-colors border-[3px] border-orange-500 flex items-center justify-center font-bold text-white text-xs outline-none focus:outline-none"
                                                            title="Pár részleteinek megtekintése"
                                                        >
                                                            {device.pairNumber}
                                                        </button>
                                                        <span className="text-gray-300 group-hover:text-white transition-colors">
                                                            {device.pairName || <span className="text-gray-500 italic">Névtelen</span>}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-600 italic text-sm">Nincs hozzárendelve</span>
                                                )}
                                            </td>
                                            <td className="py-4 text-sm text-gray-400 font-mono">
                                                {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : '-'}
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
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
