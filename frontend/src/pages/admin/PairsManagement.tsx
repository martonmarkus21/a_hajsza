
import { FiUsers, FiPlus, FiTrash2, FiMail, FiShield } from 'react-icons/fi';
import { FaHandcuffs } from 'react-icons/fa6';

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
    handleCapture
}: PairsManagementProps) {

    // Sort pairs by assigned number
    const sortedPairs = [...pairs].sort((a, b) => a.assignedNumber - b.assignedNumber);

    return (
        <div className="space-y-6">
            {/* Create New Pair Card */}
            <div className="mw-card">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <FiPlus className="w-6 h-6 text-orange-500" />
                    Új Pár Hozzáadása
                </h3>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="w-full md:w-32">
                        <label className="block text-gray-400 text-xs font-bold mb-1 uppercase">Sorszám</label>
                        <input
                            type="number"
                            min="1"
                            value={newPair.assignedNumber}
                            onChange={(e) => setNewPair({ ...newPair, assignedNumber: parseInt(e.target.value) || 0 })}
                            className="mw-input text-center font-bold text-lg"
                        />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-gray-400 text-xs font-bold mb-1 uppercase">Név (Opcionális)</label>
                        <input
                            type="text"
                            value={newPair.name}
                            onChange={(e) => setNewPair({ ...newPair, name: e.target.value })}
                            placeholder="Pl. Alpha Csapat"
                            className="mw-input"
                        />
                    </div>
                    <button
                        onClick={createPair}
                        className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        <FiPlus className="w-5 h-5" />
                        Létrehozás
                    </button>
                </div>
            </div>

            {/* Pairs List */}
            <div className="mw-card overflow-hidden p-0">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <FiUsers className="w-6 h-6 text-orange-500" />
                        Párok Listája
                        <span className="text-sm font-normal text-gray-500 ml-2">({pairs.length} aktív)</span>
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="mw-table">
                        <thead>
                            <tr>
                                <th className="w-16 text-center">#</th>
                                <th className="text-left">Név</th>
                                <th className="text-center">Státusz</th>
                                <th className="text-center">MW</th>
                                <th className="text-center">Lokáció</th>
                                <th className="text-right">Műveletek</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPairs.map((pair) => (
                                <tr key={pair.id} className="group">
                                    <td className="text-center">
                                        <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center font-bold text-orange-500 mx-auto">
                                            {pair.assignedNumber}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="font-semibold text-white">{pair.name || <span className="text-gray-600 italic">Névtelen</span>}</div>
                                        {pair.captured && <div className="text-xs text-red-500 font-bold uppercase tracking-wider mt-0.5">Elfogva</div>}
                                    </td>
                                    <td className="text-center">
                                        <span className={`mw-badge ${pair.active ? 'active' : 'inactive'}`}>
                                            {pair.active ? 'Aktív' : 'Inaktív'}
                                        </span>
                                    </td>
                                    <td className="text-center">
                                        <button
                                            onClick={() => handleMw(pair.id)}
                                            className={`p-2 rounded-lg transition-all ${pair.mostWanted ? 'bg-orange-500/20 text-orange-500 border border-orange-500/50' : 'text-gray-600 hover:text-gray-400 hover:bg-white/5'}`}
                                            title="Most Wanted státusz váltása"
                                        >
                                            <FiShield className="w-5 h-5" />
                                        </button>
                                    </td>
                                    <td className="text-center">
                                        {pair.lastPosition ? (
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs font-mono text-gray-400">
                                                    {pair.lastPosition.lat.toFixed(4)}, {pair.lastPosition.lon.toFixed(4)}
                                                </span>
                                                <span className="text-[10px] text-gray-600">
                                                    {new Date(pair.lastPosition.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-600">-</span>
                                        )}
                                    </td>
                                    <td className="text-right">
                                        <div className="flex items-center justify-end gap-2 opaciy-80 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleSendMessage(pair)}
                                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                title="Üzenet küldése"
                                            >
                                                <FiMail className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleEditPairName(pair)}
                                                className="p-2 text-gray-400 hover:bg-white/10 rounded-lg transition-colors"
                                                title="Név szerkesztése"
                                            >
                                                <FiUsers className="w-4 h-4" />
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
                                                className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors ml-2"
                                                title="Törlés"
                                            >
                                                <FiTrash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {pairs.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-500 italic">
                                        Nincsenek létrehozott párok.
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
