
import { FiActivity, FiUsers, FiMap, FiSmartphone, FiClock } from 'react-icons/fi';

interface DashboardHomeProps {
    gameSettings: any;
    activePairsCount: number;
    activeDevicesCount: number;
    activeGeofencesCount: number;
    startTimer: () => void;
    stopTimer: () => void;
}

export default function DashboardHome({
    gameSettings,
    activePairsCount,
    activeDevicesCount,
    activeGeofencesCount,
    startTimer,
    stopTimer
}: DashboardHomeProps) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Game Status Card */}
                <div className="mw-card relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FiActivity className="w-24 h-24 text-orange-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Játék státusz</div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-3 h-3 rounded-full ${gameSettings?.isTimerRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                            <span className={`text-2xl font-bold tabular-nums ${gameSettings?.isTimerRunning ? 'text-white' : 'text-gray-400'}`}>
                                {gameSettings?.isTimerRunning ? 'AKTÍV' : 'LEÁLLÍTVA'}
                            </span>
                        </div>
                        {gameSettings?.isTimerRunning ? (
                            <button
                                onClick={stopTimer}
                                className="w-full py-2 bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg hover:bg-red-500/20 transition-all font-semibold"
                            >
                                Leállítás
                            </button>
                        ) : (
                            <button
                                onClick={startTimer}
                                className="w-full py-2 bg-green-500/10 border border-green-500/50 text-green-500 rounded-lg hover:bg-green-500/20 transition-all font-semibold"
                            >
                                Indítás
                            </button>
                        )}
                    </div>
                </div>

                {/* Active Pairs Card */}
                <div className="mw-card relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FiUsers className="w-24 h-24 text-blue-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Aktív párok</div>
                        <div className="text-4xl font-bold text-white tabular-nums mb-1">{activePairsCount}</div>
                        <div className="text-gray-500 text-sm leading-relaxed">Jelenleg a pályán.</div>
                    </div>
                </div>

                {/* Active Devices Card */}
                <div className="mw-card relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FiSmartphone className="w-24 h-24 text-purple-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Eszközök</div>
                        <div className="text-4xl font-bold text-white tabular-nums mb-1">{activeDevicesCount}</div>
                        <div className="text-gray-500 text-sm leading-relaxed">Aktív szerverkapcsolat.</div>
                    </div>
                </div>

                {/* Geofences Card */}
                <div className="mw-card relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FiMap className="w-24 h-24 text-emerald-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Zónák</div>
                        <div className="text-4xl font-bold text-white tabular-nums mb-1">{activeGeofencesCount}</div>
                        <div className="text-gray-500 text-sm leading-relaxed">Aktív geokerítés a térképen.</div>
                    </div>
                </div>
            </div>

            {/* Countdown Timer Big Display */}
            {gameSettings?.isTimerRunning && gameSettings.countdown && (
                <div className="mw-card flex items-center justify-center py-12 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-orange-500/5 animate-pulse"></div>
                    <div className="text-center relative z-10">
                        <div className="text-orange-500 font-semibold uppercase tracking-[0.2em] mb-4 flex items-center justify-center gap-2">
                            <FiClock className="w-5 h-5" />
                            Következő lokációfrissítés
                        </div>
                        <div className="text-7xl md:text-9xl font-bold text-white font-mono tracking-tighter tabular-nums drop-shadow-2xl">
                            {gameSettings.countdown.minutes}:{gameSettings.countdown.seconds.toString().padStart(2, '0')}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
