
import { FiClock, FiSave } from 'react-icons/fi';

interface GameControlProps {
    gameSettings: any;
    intervalInputValue: number;
    isEditingInterval: boolean;
    setIntervalInputValue: (value: number) => void;
    setIsEditingInterval: (value: boolean) => void;
    updateInterval: (value: number) => void;
}

export default function GameControl({
    gameSettings,
    intervalInputValue,
    isEditingInterval,
    setIntervalInputValue,
    setIsEditingInterval,
    updateInterval
}: GameControlProps) {
    return (
        <div className="mw-card">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <FiClock className="w-6 h-6 text-orange-500" />
                Játék Beállítások
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <label className="block text-gray-400 text-sm font-semibold mb-2 uppercase tracking-wide">Frissítési intervallum (perc)</label>
                    <div className="flex gap-3">
                        <input
                            type="number"
                            min="1"
                            value={intervalInputValue}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setIntervalInputValue(isNaN(val) ? 0 : val);
                                setIsEditingInterval(true);
                            }}
                            className="mw-input text-lg font-mono flex-1"
                        />
                        {isEditingInterval && (
                            <button
                                onClick={() => {
                                    updateInterval(intervalInputValue);
                                    setIsEditingInterval(false);
                                }}
                                className="mw-btn mw-btn-primary"
                            >
                                <FiSave className="w-5 h-5" /> Mentés
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                        Jelenlegi beállítás: <span className="text-orange-400 font-mono font-bold text-sm bg-orange-500/10 px-2 py-0.5 rounded">{gameSettings?.locationUpdateIntervalMinutes || 20} perc</span>
                    </div>
                </div>

                <div>
                    <label className="block text-gray-400 text-sm font-semibold mb-2 uppercase tracking-wide">Utolsó frissítés</label>
                    <div className="text-white font-mono text-lg bg-black/20 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                        <FiClock className="text-gray-500 w-5 h-5" />
                        {gameSettings?.lastLocationUpdate
                            ? new Date(gameSettings.lastLocationUpdate).toLocaleTimeString()
                            : 'Nincs adat'}
                    </div>
                </div>
            </div>
        </div>
    );
}
