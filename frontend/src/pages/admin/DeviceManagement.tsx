import { FiSmartphone, FiWifi, FiWifiOff, FiTrash2, FiLogOut } from 'react-icons/fi';

interface DeviceManagementProps {
    devices: any[];
    activeDevices: any[];
    handleForceLogout: (deviceId: string) => void;
    handleDeleteDevice: (id: number) => void;
}

export default function DeviceManagement({
    devices,
    activeDevices,
    handleForceLogout,
    handleDeleteDevice
}: DeviceManagementProps) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stats Card */}
                <div className="mw-card">
                    <h3 className="text-gray-400 text-sm font-bold uppercase mb-2">Összes Eszköz</h3>
                    <div className="text-3xl font-bold text-white">{devices.length} db</div>
                </div>
                <div className="mw-card">
                    <h3 className="text-gray-400 text-sm font-bold uppercase mb-2">Aktív Eszközök</h3>
                    <div className="text-3xl font-bold text-green-500">{activeDevices.length} db</div>
                </div>
            </div>

            <div className="mw-card overflow-hidden p-0">
                <div className="p-6 border-b border-white/5">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <FiSmartphone className="w-6 h-6 text-orange-500" />
                        Eszközök Listája
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="mw-table">
                        <thead>
                            <tr>
                                <th className="text-left">IMEI / ID</th>
                                <th className="text-left">Pár</th>
                                <th className="text-left">Utoljára látva</th>
                                <th className="text-center">Státusz</th>
                                <th className="text-center">FCM</th>
                                <th className="text-right">Műveletek</th>
                            </tr>
                        </thead>
                        <tbody>
                            {devices.map((device) => {
                                const isActive = activeDevices.some(d => d.imeiOrDeviceId === device.imeiOrDeviceId);
                                // Fix for "No pair assigned" bug: check pairNumber as fallback even if name is missing
                                const hasPair = device.pairId || device.pairNumber;

                                return (
                                    <tr key={device.id}>
                                        <td className="font-mono text-sm text-gray-300">{device.imeiOrDeviceId}</td>
                                        <td>
                                            {hasPair ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-orange-500">
                                                        {device.pairNumber}
                                                    </span>
                                                    <span className="text-white">{device.pairName || `Pár #${device.pairNumber}`}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-600 italic">Nincs hozzárendelve</span>
                                            )}
                                        </td>
                                        <td className="text-gray-400 text-sm">
                                            {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : '-'}
                                        </td>
                                        <td className="text-center">
                                            <span className={`mw-badge ${isActive ? 'active' : 'inactive'}`}>
                                                {isActive ? <FiWifi /> : <FiWifiOff />}
                                                {isActive ? 'Online' : 'Offline'}
                                            </span>
                                        </td>
                                        <td className="text-center">
                                            <span className={`mw-badge ${device.hasFcmToken ? 'active' : 'warning'}`}>
                                                {device.hasFcmToken ? 'Aktív' : 'Hiányzik'}
                                            </span>
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {isActive && (
                                                    <button
                                                        onClick={() => handleForceLogout(device.imeiOrDeviceId)}
                                                        className="p-2 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded-lg transition-colors"
                                                        title="Kijelentkeztetés"
                                                    >
                                                        <FiLogOut className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteDevice(device.id)}
                                                    className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Eszköz törlése"
                                                >
                                                    <FiTrash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {devices.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-500 italic">
                                        Nincsenek regisztrált eszközök.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
