import { useState, useEffect, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, Polygon, Popup, Marker, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { useSocket } from './hooks/useSocket';
import { usePairs } from './hooks/usePairs';
import { useGameInfo } from './hooks/useGameInfo';
import { Pair } from './types';
import { authService } from './services/auth';
import { useNotification } from './contexts/NotificationContext';
import Login from './pages/Login';
import Admin from './pages/Admin';
import PairDetails from './components/PairDetails';
import SendMessageModal from './components/SendMessageModal';
import EditNameModal from './components/EditNameModal';
import ConfirmationModal from './components/ConfirmationModal';
import {
  FiSettings,
  FiSend,
  FiLogOut,
  FiClock,
  FiUsers,
  FiMap,
  FiActivity,
  FiUser,
  FiMapPin,
  FiChevronDown,
  FiMoon,
  FiGlobe,
  FiChevronRight,
  FiX
} from 'react-icons/fi';
import { HiPencil } from 'react-icons/hi2';
import { FaHandcuffs } from 'react-icons/fa6';
import logoImage from './assets/images/most_wanted_logo_raw.png';
import mwOrangeImage from './assets/images/mw_orange.png';
import 'leaflet/dist/leaflet.css';
import './App.css';

interface Geofence {
  id: number;
  name: string;
  centerLat: number;
  centerLon: number;
  radiusM: number;
  active: boolean;
  geofenceType: string;
  metadataJson?: {
    polygon?: number[][];
    type?: string;
    countyCode?: string;
    countyName?: string;
    description?: string;
  };
}

// Component to handle map resize dynamically using ResizeObserver
function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    // ResizeObserver monitors the map container for size changes
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });

    const container = map.getContainer();
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [map]);

  return null;
}



// Custom map layer selector component - UI ONLY
type MapLayerType = 'standard' | 'satellite' | 'dark';

function MapLayerSelector({
  activeLayer,
  onLayerChange
}: {
  activeLayer: MapLayerType;
  onLayerChange: (layer: MapLayerType) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  const layers: { id: MapLayerType; label: string; icon: React.ReactNode }[] = [
    { id: 'standard', label: 'Térkép', icon: <FiMap className="w-5 h-5" /> },
    { id: 'satellite', label: 'Műhold', icon: <FiGlobe className="w-5 h-5" /> },
    { id: 'dark', label: 'Sötét', icon: <FiMoon className="w-5 h-5" /> },
  ];

  const currentLayer = layers.find(l => l.id === activeLayer) || layers[0];

  return (
    <div
      ref={selectorRef}
      className={`relative`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-all"
        title="Térképnézet váltás"
      >
        {currentLayer.icon}
        <div className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
          <FiChevronDown className="w-4 h-4" />
        </div>
      </button>

      {/* Dropdown */}
      <div className={`absolute top-full text-left right-0 mt-2 w-40 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden transition-all duration-200 z-[1001] ${isExpanded ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"}`}>
        {layers.map((layer) => (
          <button
            key={layer.id}
            onClick={() => {
              onLayerChange(layer.id);
              setIsExpanded(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${activeLayer === layer.id ? "bg-orange-500/20 text-orange-400" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
          >
            {layer.icon}
            <span>{layer.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- New Components for Redesign ---

function FloatingHeader({
  connected,
  gameInfo,
  activePairsCount,
  locationUpdateCountdown,
  gameSettings,
  authService,
  handleLogout,
  onSendMessageClick,
  isExpanded,
  setIsExpanded,
  activeMapLayer,
  onMapLayerChange,
  sidebarCollapsed,
  onToggleSidebar
}: {
  connected: boolean;
  gameInfo: any;
  activePairsCount: number;
  locationUpdateCountdown: { minutes: number; seconds: number } | null;
  gameSettings: any;
  authService: any;
  handleLogout: () => void;
  onSendMessageClick: () => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  activeMapLayer: MapLayerType;
  onMapLayerChange: (layer: MapLayerType) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  return (
    <div className={`absolute top-0 left-0 right-0 z-[1000] flex flex-col transition-all duration-300 ease-in-out font-sans p-4`}>
      {/* Glassmorphism Container */}
      <div className={`bg-[#0f0f0f]/90 backdrop-blur-xl border border-white/10 shadow-2xl overflow-visible transition-all duration-300 ${isExpanded ? 'rounded-[24px]' : 'rounded-[20px]'
        }`}>
        {/* Top Bar (Always Visible) */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Round 3: Sidebar Toggle MOVED HERE */}
            <button
              onClick={onToggleSidebar}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-all`}
              title={sidebarCollapsed ? 'Oldalsáv megjelenítése' : 'Oldalsáv elrejtése'}
            >
              <FiUsers className="w-5 h-5" />
              <div className={`transition-transform duration-300 ${sidebarCollapsed ? '' : 'rotate-180'}`}>
                <FiChevronRight className="w-4 h-4" />
              </div>
            </button>

            {/* Logo */}
            <img
              src={logoImage}
              alt="Most Wanted"
              className="h-8 object-contain drop-shadow-md select-none hidden sm:block"
            />

            {/* Status Indicators */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${connected
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></div>
              <span className="hidden md:inline">{connected ? 'Online' : 'Offline'}</span>
            </div>

            {/* Round 3: Clock in Collapsed State */}
            {/* Round 3: Clock in Collapsed State */}
            {/* Round 3: Clock in Collapsed State */}
            <div className={`flex items-center gap-3 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${isExpanded ? 'max-w-0 opacity-0' : 'max-w-[200px] opacity-100'}`}>
              <div className="h-6 w-px bg-white/10 mx-1 hidden md:block"></div>
              <div className="hidden md:flex items-center gap-2 text-gray-400 text-base whitespace-nowrap">
                <FiClock className="w-4 h-4 text-orange-400" />
                <span className="text-white font-bold">{gameInfo.currentTime}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Round 3: Map Layer Selector MOVED HERE */}
            <div className="hidden md:block">
              <MapLayerSelector activeLayer={activeMapLayer} onLayerChange={onMapLayerChange} />
            </div>

            <div className="h-6 w-px bg-white/10 mx-1 hidden md:block"></div>

            {/* User Profile */}
            <button
              className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-white/5 transition-all text-left group"
              onClick={() => { /* Navigate to profile */ }}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white shadow-lg transition-all">
                <FiUser className="w-4 h-4" />
              </div>
              <div className="hidden lg:block">
                <div className="text-sm text-gray-400 group-hover:text-gray-300 font-medium leading-none mb-0.5 transition-colors">Bejelentkezve</div>
                <div className="text-base text-white group-hover:text-orange-400 font-bold leading-none transition-colors">{authService.getCurrentUser()?.username}</div>
              </div>
            </button>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-2">
              <button
                onClick={onSendMessageClick}
                className="p-2 rounded-xl bg-white/5 border border-white/5 text-gray-300 hover:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all"
                title="Üzenet küldése"
              >
                <FiSend className="w-5 h-5" />
              </button>

              {authService.getCurrentUser()?.role === 'admin' && (
                <a href="/admin" className="p-2 rounded-xl bg-white/5 border border-white/5 text-gray-300 hover:text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/30 transition-all">
                  <FiSettings className="w-5 h-5" />
                </a>
              )}

              <button
                onClick={handleLogout}
                className="p-2 rounded-xl bg-white/5 border border-white/5 text-gray-300 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
                title="Kijelentkezés"
              >
                <FiLogOut className="w-5 h-5" />
              </button>

              {/* Toggle Expand */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="ml-2 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              >
                <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                  <FiChevronDown className="w-5 h-5" />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Info Panel */}
        <div className={`header-divider transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden border-t ${isExpanded ? 'max-h-[140px] border-white/5' : 'max-h-0 border-transparent'
          }`}>
          <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* ... existing info panel contents ... */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center gap-2 hover:bg-white/[0.06] transition-colors">
              <div className="text-xs uppercase font-bold text-gray-500 tracking-wider">Státusz</div>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold border ${gameInfo.isGameActive
                ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${gameInfo.isGameActive ? 'bg-orange-400 pulse-orange' : 'bg-red-400'}`} />
                {gameInfo.isGameActive ? 'FOLYAMATBAN' : 'SZÜNETEL'}
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center gap-1 hover:bg-white/[0.06] transition-colors">
              <div className="text-xs uppercase font-bold text-gray-500 tracking-wider flex items-center gap-1">
                <FiClock className="w-3 h-3" /> Idő
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">{gameInfo.currentTime}</div>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center gap-1 hover:bg-white/[0.06] transition-colors">
              <div className="text-xs uppercase font-bold text-gray-500 tracking-wider flex items-center gap-1">
                <FiUsers className="w-3 h-3" /> Párok
              </div>
              <div className="text-3xl font-bold text-orange-400">{activePairsCount}</div>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center gap-1 hover:bg-white/[0.06] transition-colors">
              <div className="text-xs uppercase font-bold text-gray-500 tracking-wider flex items-center gap-1">
                <FiMap className="w-3 h-3" /> Terület
              </div>
              <div className="text-base font-semibold text-white text-center px-2 truncate w-full">
                {gameInfo.activeGameArea || 'Nincs beállítva'}
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center gap-1 hover:bg-white/[0.06] transition-colors">
              <div className="text-xs uppercase font-bold text-gray-500 tracking-wider flex items-center gap-1">
                <FiActivity className="w-3 h-3" /> Frissítés
              </div>
              <div className="text-2xl font-mono font-bold text-emerald-400 tabular-nums">
                {locationUpdateCountdown ? (
                  `${locationUpdateCountdown.minutes}:${locationUpdateCountdown.seconds.toString().padStart(2, '0')}`
                ) : (
                  gameSettings?.isTimerRunning ? '--:--' : 'ÁLL'
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModernSidebar({
  isVisible,
  activePairs,
  selectedPairId,
  onPairClick,
  onCapture,
  onEditName,
  browserLocation,
  calculateDistance,
  formatDistance,
  forceRender,
  isHeaderExpanded
}: {
  isVisible: boolean;
  activePairs: Pair[];
  selectedPairId: number | undefined;
  onPairClick: (pair: Pair) => void;
  onCapture: (pairId: number) => void;
  onEditName: (pairId: number) => void;
  browserLocation: { lat: number, lon: number } | null;
  calculateDistance: Function;
  formatDistance: Function;
  forceRender: number;
  isHeaderExpanded: boolean;
}) {
  return (
    <div
      className={`absolute left-4 bottom-4 z-[999] w-96 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] transform ${isVisible ? 'translate-x-0 opacity-100 pointer-events-auto' : '-translate-x-[120%] opacity-0 pointer-events-none'
        }`}
      /* Round 3: Consistent top position (gap) regardless of Header expansion */
      style={{ top: isHeaderExpanded ? '220px' : '100px' }}
    >
      {/* Glass Container */}
      <div className="flex-1 bg-[#0f0f0f]/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[24px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/5 bg-white/[0.02]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400">
              <FiUsers className="w-4 h-4" />
            </span>
            <span>Aktív csapatok</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1 ml-9">
            {activePairs.length > 0 ? `${activePairs.length} csapat a terepen` : 'Nincs aktív csapat'}
          </p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {activePairs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-60">
              <FiUsers className="w-10 h-10 mb-3" />
              <p className="text-sm font-medium">Jelenleg nincs bejelentkezett pár.</p>
            </div>
          ) : (
            activePairs.map(pair => {
              const isSelected = selectedPairId === pair.id;
              const isMw = pair.mostWanted;

              return (
                <div
                  key={pair.id}
                  onClick={() => pair.active && onPairClick(pair)}
                  className={`group relative p-3 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden ${isSelected
                    ? 'bg-orange-500/10 border-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.1)]'
                    : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
                    } ${pair.captured ? 'opacity-60 saturate-50' : ''}`}
                >
                  {/* Selection Indicator */}
                  {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />}

                  <div className="flex items-center gap-3">
                    {/* Avatar / Number - Round 3: Thinner Border, Grey BG, Larger Text */}
                    <div className={`relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl border-[3px] border-orange-500 text-white shadow-lg pb-0.5 transition-all duration-300 ${isMw ? 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.6)]' : 'bg-[#222]'}`}>
                      {pair.assignedNumber}
                      {/* Status Dot */}
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#121212] ${pair.captured ? 'bg-red-500' : pair.active ? 'bg-emerald-500' : 'bg-gray-500'
                        }`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {pair.name && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-base font-bold truncate ${isSelected ? 'text-white' : 'text-gray-200 group-hover:text-white'}`}>
                            {pair.name}
                          </span>
                          {isMw && <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-orange-500 text-white shadow-sm">MW</span>}
                        </div>
                      )}

                      <div className="flex flex-col gap-1">
                        {pair.lastPosition && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <FiClock className="w-3 h-3" />
                            <span>
                              {new Date(pair.lastPosition.timestamp).toLocaleString('hu-HU', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </div>
                        )}

                        {browserLocation && (pair.distancePosition || pair.lastPosition) && (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-orange-400" key={`dist-${pair.id}-${forceRender}`}>
                            <FiMapPin className="w-3 h-3" />
                            <span>
                              Légvonal: {formatDistance(calculateDistance(
                                browserLocation.lat,
                                browserLocation.lon,
                                (pair.distancePosition || pair.lastPosition)!.lat,
                                (pair.distancePosition || pair.lastPosition)!.lon
                              ))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions (Always Visible, Side-by-Side) */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditName(pair.id); }}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="Név szerkesztése"
                      >
                        <HiPencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); !pair.captured && onCapture(pair.id); }}
                        disabled={pair.captured}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-orange-400 disabled:opacity-30 transition-colors"
                        title="Elfogás rögzítése"
                      >
                        <FaHandcuffs className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function MapView() {
  const { pairs, loading, refetch } = usePairs();
  const { addNotification } = useNotification();
  const { socket, connected } = useSocket();
  const gameInfo = useGameInfo();
  const [isClosingPairDetails, setIsClosingPairDetails] = useState(false);
  const [renamingPair, setRenamingPair] = useState<{ id: number; name: string } | null>(null);
  const [capturePairId, setCapturePairId] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [selectedPair, setSelectedPair] = useState<Pair | null>(null);
  const [pairsState, setPairsState] = useState<Pair[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [showPairDetails, setShowPairDetails] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messagePairId, setMessagePairId] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [locationUpdateCountdown, setLocationUpdateCountdown] = useState<{ minutes: number; seconds: number } | null>(null);
  const [gameSettings, setGameSettings] = useState<{
    locationUpdateIntervalMinutes: number;
    isTimerRunning: boolean;
    countdown: { minutes: number; seconds: number } | null;
    lastLocationUpdate: string | null;
    allowPositionUpdatesForMap?: boolean;
  } | null>(null);
  const [browserLocation, setBrowserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [forceRender, setForceRender] = useState(0);

  const [activeMapLayer, setActiveMapLayer] = useState<MapLayerType>('standard');
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(true);

  // All active pairs
  const allActivePairs = (pairsState.length > 0 ? pairsState : pairs)
    .filter((p) => p.active === true && p.hasActiveDevice === true)
    .sort((a, b) => (a.assignedNumber || 0) - (b.assignedNumber || 0));

  // Pairs to show on map
  const displayPairsOnMap = useMemo(() => {
    if (!gameSettings) return [];
    return allActivePairs.filter((p) => {
      if (!p.lastPosition) return false;
      if (!gameSettings.isTimerRunning) return false;
      return true;
    });
  }, [allActivePairs, gameSettings?.isTimerRunning, forceRender]);

  // --- Effects and Helpers (Same as before) ---

  useEffect(() => {
    fetchGeofences();
    const interval = setInterval(fetchGeofences, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const savedLocation = localStorage.getItem('browserLocation');
    if (savedLocation) {
      try {
        const parsed = JSON.parse(savedLocation);
        if (parsed.lat && parsed.lon) setBrowserLocation({ lat: parsed.lat, lon: parsed.lon });
      } catch (e) {
        console.error('Error parsing saved browser location:', e);
      }
    }
    if (navigator.geolocation) {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (locationIntervalRef.current !== null) clearInterval(locationIntervalRef.current);
      const saveLocation = (lat: number, lon: number) => {
        setBrowserLocation({ lat, lon });
        localStorage.setItem('browserLocation', JSON.stringify({ lat, lon }));
      };
      navigator.geolocation.getCurrentPosition(
        (p) => saveLocation(p.coords.latitude, p.coords.longitude),
        (e) => console.error('Error:', e),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      watchIdRef.current = navigator.geolocation.watchPosition(
        (p) => saveLocation(p.coords.latitude, p.coords.longitude),
        (e) => console.error('Error:', e),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      locationIntervalRef.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (p) => saveLocation(p.coords.latitude, p.coords.longitude),
          (e) => console.error('Error:', e),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }, 1000);
      return () => {
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        if (locationIntervalRef.current !== null) clearInterval(locationIntervalRef.current);
      };
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setForceRender((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchGameSettings = async () => {
      try {
        let response = await fetch('http://localhost:3000/api/game-settings', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!response.ok && response.status === 403) {
          response = await fetch('http://localhost:3000/api/game-settings/countdown', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          });
        }
        if (response.ok) {
          const data = await response.json();
          setGameSettings({
            locationUpdateIntervalMinutes: data.locationUpdateIntervalMinutes || 20,
            isTimerRunning: data.isTimerRunning,
            countdown: data.countdown,
            lastLocationUpdate: data.lastLocationUpdate || null,
            allowPositionUpdatesForMap: data.allowPositionUpdatesForMap,
          });
          setLocationUpdateCountdown(data.countdown);
        }
      } catch (error) { console.error('Error:', error); }
    };
    fetchGameSettings();
    const interval = setInterval(fetchGameSettings, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (pairs.length > 0) {
      setPairsState((prev) => {
        return pairs.map((apiPair) => {
          const existing = prev.find((p) => p.id === apiPair.id);
          if (existing) {
            return {
              ...apiPair,
              lastPosition: existing.lastPosition || apiPair.lastPosition,
              distancePosition: existing.distancePosition,
              distanceToNearestOfficer: existing.distanceToNearestOfficer ?? apiPair.distanceToNearestOfficer,
            };
          }
          return apiPair;
        });
      });
    }
  }, [pairs]);

  useEffect(() => {
    if (!socket) return;
    const handleDistanceUpdate = (data: any) => {
      setPairsState((prev) =>
        prev.map((pair) => {
          if (pair.id !== data.pairId) return pair;
          return {
            ...pair,
            distancePosition: { lat: data.lat, lon: data.lon, timestamp: data.timestamp },
            distanceToNearestOfficer: data.distanceToNearestOfficer || pair.distanceToNearestOfficer,
          };
        }),
      );
    };
    const handlePositionUpdate = (data: any) => {
      const ts = new Date(data.timestamp).getTime();
      setPairsState((prev) => {
        const existing = prev.find((p) => p.id === data.pairId);
        if (!existing) {
          return [...prev, {
            id: data.pairId, assignedNumber: 0, name: null, active: true, captured: false, mostWanted: false, hasActiveDevice: true,
            lastPosition: { lat: data.lat, lon: data.lon, timestamp: data.timestamp },
            distanceToNearestOfficer: data.distanceToNearestOfficer,
          }];
        }
        return prev.map((pair) => {
          if (pair.id !== data.pairId) return pair;
          if (pair.lastPosition && new Date(pair.lastPosition.timestamp).getTime() === ts) return pair;
          return {
            ...pair,
            lastPosition: { lat: data.lat, lon: data.lon, timestamp: data.timestamp },
            distanceToNearestOfficer: data.distanceToNearestOfficer || pair.distanceToNearestOfficer,
          };
        });
      });
    };
    socket.on('distanceUpdate', handleDistanceUpdate);
    socket.on('positionUpdate', handlePositionUpdate);
    socket.on('capture', (data: any) => {
      setPairsState((prev) => prev.map((p) => p.id === data.pairId ? { ...p, captured: true } : p));
      refetch();
    });
    socket.on('mwHighlight', (data: any) => {
      setPairsState((prev) => prev.map((p) => p.id === data.pairId ? { ...p, mostWanted: data.active } : p));
      refetch();
    });
    socket.on('gameAreaUpdate', () => fetchGeofences());
    return () => {
      socket.off('distanceUpdate', handleDistanceUpdate);
      socket.off('positionUpdate', handlePositionUpdate);
      socket.off('capture');
      socket.off('mwHighlight');
      socket.off('gameAreaUpdate');
    };
  }, [socket, gameSettings, refetch]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatDistance = (d: number): string => d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;

  const fetchGeofences = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/geofence', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setGeofences(await res.json());
    } catch (e) { console.error(e); }
  };

  // --- Handlers ---
  const handleCapture = async (pairId: number) => {
    try {
      const res = await fetch('http://localhost:3000/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ pairId }),
      });
      const data = await res.json();
      if (data.success) refetch(); else addNotification('error', 'Hiba történt a pár elfogása során');
    } catch (e) { addNotification('error', 'Hiba történt a pár elfogása során'); }
  };

  const handleMw = async (pairId: number) => {
    try {
      const p = pairsState.find((p) => p.id === pairId);
      const url = p?.mostWanted ? `http://localhost:3000/api/mw/${pairId}` : 'http://localhost:3000/api/mw';
      const method = p?.mostWanted ? 'DELETE' : 'POST';
      const body = p?.mostWanted ? undefined : JSON.stringify({ pairId });
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body,
      });
      if (res.ok) refetch();
    } catch (e) { console.error(e); }
  };

  const handleAssignName = async (pairId: number, newName?: string) => {
    const p = pairsState.find((p) => p.id === pairId);
    let n = newName;
    if (n === undefined) {
      n = prompt('Add meg a pár nevét:', p?.name || '') || undefined;
      if (n === undefined) return; // User cancelled prompt
    }
    if (n === null) return;
    const nameToSet = n.trim() === '' ? null : n.trim();
    try {
      const res = await fetch(`http://localhost:3000/api/pairs/${pairId}/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ name: nameToSet }),
      });
      const data = await res.json();
      if (data.success) {
        refetch();
        // Removed alerts as requested - notification is handled by UI context if available or just update
      } else console.error(data.message || 'Hiba');
    } catch (e) { console.error('Hiba történt', e); }
  };

  const handleSendMessage = async (pairId: number | null, title: string, body: string) => {
    try {
      const res = await fetch('http://localhost:3000/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ pairId: pairId || undefined, title, body }),
      });
      const data = await res.json();
      if (data.success) {
        addNotification('success', 'Üzenet sikeresen elküldve');
      } else {
        addNotification('error', data.message || 'Hiba történt az üzenet küldésekor');
      }
    } catch (e) {
      addNotification('error', 'Hálózati hiba történt az üzenet küldésekor');
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="loader-container">
          <div className="loader-spinner"></div>
          <div className="text-white mt-4">Betöltés...</div>
        </div>
      </div>
    );
  }



  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0f0f0f] relative font-sans">
      {/* 1. Fullscreen Map Background */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[47.58, 18.60]}
          zoom={8}
          className="h-full w-full bg-[#1a1a1a]"
          zoomControl={false}
          ref={mapRef}
        >
          {/* Round 3: Conditional Tile Layer Logic */}
          {activeMapLayer === 'standard' && <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="" />}
          {activeMapLayer === 'satellite' && <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="" />}
          {activeMapLayer === 'dark' && <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="" />}

          <ZoomControl position="bottomright" />
          <MapResizeHandler />

          {/* User Location Marker - Round 3: No white border, use Image */}
          {browserLocation && (
            <Marker
              key={`user-loc-${activeMapLayer}`}
              position={[browserLocation.lat, browserLocation.lon]}
              icon={L.divIcon({
                className: 'custom-browser-location-marker',
                html: `<div style="width:32px;height:32px;border-radius:50%;box-shadow:0 3px 10px rgba(0,0,0,0.4);background-image:url(${mwOrangeImage});background-size:cover;background-position:center;overflow:hidden;"></div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
              })}
            >
              <Popup className={activeMapLayer === 'dark' ? "custom-popup-dark" : "custom-popup-light"}>
                <div className="p-3 min-w-[200px]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FiMapPin className="w-4 h-4 text-orange-500" />
                      <strong className={`text-sm ${activeMapLayer === 'dark' ? 'text-white' : 'text-gray-900'}`}>Saját pozíció</strong>
                    </div>
                    <button
                      onClick={() => mapRef.current?.closePopup()}
                      className={`transition-colors p-0.5 -mr-1 -mt-1 ${activeMapLayer === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-black'}`}
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                  <div className={`p-2 rounded-lg border ${activeMapLayer === 'dark' ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
                    <div className={`text-[10px] flex items-center justify-between uppercase tracking-wider font-semibold ${activeMapLayer === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      <span>Szélesség</span>
                      <span className={`font-mono normal-case ${activeMapLayer === 'dark' ? 'text-white' : 'text-gray-900'}`}>{browserLocation.lat.toFixed(5)}</span>
                    </div>
                    <div className={`text-[10px] flex items-center justify-between mt-1 uppercase tracking-wider font-semibold ${activeMapLayer === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      <span>Hosszúság</span>
                      <span className={`font-mono normal-case ${activeMapLayer === 'dark' ? 'text-white' : 'text-gray-900'}`}>{browserLocation.lon.toFixed(5)}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Pair Markers */}
          {displayPairsOnMap.map((pair) => (
            pair.lastPosition && (
              <Marker
                key={`${pair.id}-${activeMapLayer}`}
                position={[pair.lastPosition.lat, pair.lastPosition.lon]}
                // Round 3: Larger size (32px), Larger Font (18px), Thicker Border (3px) -> Matches Sidebar/Details
                icon={L.divIcon({
                  className: 'custom-pair-marker',
                  html: `<div style="background-color:${pair.mostWanted ? '#f97316' : '#2a2a2a'};width:32px;height:32px;border-radius:50%;border:3px solid #f97316;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${pair.assignedNumber}</div>`,
                  iconSize: [32, 32],
                  iconAnchor: [16, 16],
                })}
                eventHandlers={{
                  click: () => {
                    setSelectedPair(pair);
                    setShowPairDetails(true);
                  },
                }}
              />
            )
          ))}

          {/* Geofences - Round 3: "Kidolgozott" Popups */}
          {geofences.filter(g => g.active).map(g => {
            // Game Area Polygon
            if (g.geofenceType === 'game_area' && g.metadataJson?.polygon) {
              return (
                <Polygon
                  key={`${g.id}-${activeMapLayer}`}
                  positions={g.metadataJson.polygon.map(([lon, lat]) => [lat, lon] as [number, number])}
                  pathOptions={{
                    // Use Blue for Game Area if NOT in Dark Mode, otherwise Orange
                    color: activeMapLayer === 'dark' ? '#f97316' : '#3b82f6',
                    fillColor: activeMapLayer === 'dark' ? '#f97316' : '#3b82f6',
                    fillOpacity: 0.1,
                    weight: 2
                  }}
                >
                  <Popup className={activeMapLayer === 'dark' ? "custom-popup-dark" : "custom-popup-light"}>
                    <div className="flex flex-col gap-3 p-4 min-w-[240px] font-sans">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_12px] bg-green-500 shadow-green-500`} />
                          <span className={`font-bold text-base leading-none ${activeMapLayer === 'dark' ? 'text-white' : 'text-gray-900'}`}>{g.name}</span>
                        </div>
                        <button
                          onClick={() => mapRef.current?.closePopup()}
                          className={`transition-colors p-0.5 -mr-1 -mt-1 ${activeMapLayer === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-black'}`}
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                      <div className={`h-px w-full ${activeMapLayer === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${activeMapLayer === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Státusz</span>
                        <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded">AKTÍV</span>
                      </div>
                      {g.metadataJson?.description && (
                        <div className={`text-xs italic mt-1 ${activeMapLayer === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{g.metadataJson.description}</div>
                      )}
                    </div>
                  </Popup>
                </Polygon>
              );
            }
            // Standard Polygon (Custom/Scenario)
            if (g.metadataJson?.polygon && g.metadataJson?.type === 'polygon') {
              return (
                <Polygon
                  key={`${g.id}-${activeMapLayer}`}
                  positions={g.metadataJson.polygon.map(([lon, lat]) => [lat, lon] as [number, number])}
                  pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 2 }}
                >
                  <Popup className={activeMapLayer === 'dark' ? "custom-popup-dark" : "custom-popup-light"}>
                    <div className="p-3 min-w-[200px] font-sans">
                      <div className="flex items-center justify-between mb-1">
                        <div className={`font-bold ${activeMapLayer === 'dark' ? 'text-white' : 'text-gray-900'}`}>{g.name}</div>
                        <button
                          onClick={() => mapRef.current?.closePopup()}
                          className={`transition-colors p-0.5 -mr-1 -mt-1 ${activeMapLayer === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-black'}`}
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                      <div className={`text-xs ${activeMapLayer === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{g.geofenceType}</div>
                    </div>
                  </Popup>
                </Polygon>
              );
            }
            // Circle (Default)
            return (
              <Circle
                key={`${g.id}-${activeMapLayer}`}
                center={[g.centerLat, g.centerLon]}
                radius={g.radiusM}
                pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 2 }}
              >
                <Popup className={activeMapLayer === 'dark' ? "custom-popup-dark" : "custom-popup-light"}>
                  <div className="p-3 min-w-[200px] font-sans">
                    <div className="flex items-center justify-between mb-1">
                      <div className={`font-bold ${activeMapLayer === 'dark' ? 'text-white' : 'text-gray-900'}`}>{g.name}</div>
                      <button
                        onClick={() => mapRef.current?.closePopup()}
                        className={`transition-colors p-0.5 -mr-1 -mt-1 ${activeMapLayer === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-black'}`}
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    </div>
                    <div className={`text-xs ${activeMapLayer === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{g.geofenceType}</div>
                  </div>
                </Popup>
              </Circle>
            );
          })}
        </MapContainer>
      </div>

      {/* 2. Floating Header Overlay */}
      <FloatingHeader
        connected={connected}
        gameInfo={gameInfo}
        activePairsCount={allActivePairs.length}
        locationUpdateCountdown={locationUpdateCountdown}
        gameSettings={gameSettings}
        authService={authService}
        handleLogout={() => { authService.logout(); window.location.href = '/login'; }}
        onSendMessageClick={() => { setMessagePairId(null); setShowMessageModal(true); }}
        isExpanded={isHeaderExpanded}
        setIsExpanded={setIsHeaderExpanded}
        // Round 3: New Props
        activeMapLayer={activeMapLayer}
        onMapLayerChange={setActiveMapLayer}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* 3. Floating Sidebar Overlay */}
      <ModernSidebar
        isVisible={!sidebarCollapsed}
        activePairs={allActivePairs}
        selectedPairId={isClosingPairDetails ? undefined : selectedPair?.id}
        onPairClick={(pair) => { setSelectedPair(pair); setShowPairDetails(true); }}
        onCapture={(id) => setCapturePairId(id)}
        onEditName={(id) => {
          const p = allActivePairs.find(p => p.id === id);
          if (p) setRenamingPair({ id: p.id, name: p.name || '' });
        }}
        browserLocation={browserLocation}
        calculateDistance={calculateDistance}
        formatDistance={formatDistance}
        forceRender={forceRender}
        isHeaderExpanded={isHeaderExpanded}
      />

      {/* Modals */}
      {showPairDetails && selectedPair && (
        <PairDetails
          pair={pairsState.find(p => p.id === selectedPair.id) || selectedPair}
          browserLocation={browserLocation}
          calculateDistance={calculateDistance}
          onClose={() => { setShowPairDetails(false); setSelectedPair(null); setIsClosingPairDetails(false); }}
          onClosingStart={() => setIsClosingPairDetails(true)}
          onCapture={handleCapture}
          onMw={handleMw}
          onRename={handleAssignName}
          /* Round 3: Fix Message Logic - Keep details open */
          onSendMessage={(id) => {
            setMessagePairId(id); // Set the specific pair ID
            setShowMessageModal(true);
          }}
        />
      )}

      {/* Modals - Render AFTER PairDetails to be on top */}
      <SendMessageModal
        isOpen={showMessageModal}
        pairId={messagePairId}
        pairAssignedNumber={allActivePairs.find(p => p.id === messagePairId)?.assignedNumber}
        pairName={allActivePairs.find(p => p.id === messagePairId)?.name}
        onClose={() => setShowMessageModal(false)}
        onSend={handleSendMessage}
      />

      <EditNameModal
        isOpen={!!renamingPair}
        initialName={renamingPair?.name || ''}
        onClose={() => setRenamingPair(null)}
        onSave={async (newName: string | null) => {
          if (renamingPair) {
            await handleAssignName(renamingPair.id, newName || '');
            addNotification('success', 'Pár neve sikeresen módosítva');
            setRenamingPair(null);
          }
        }}
      />

      <ConfirmationModal
        isOpen={!!capturePairId}
        title="Pár elfogása"
        message={`Biztosan elfogottnak jelöli a(z) ${allActivePairs.find(p => p.id === capturePairId)?.assignedNumber || '?'}. számú párt?`}
        confirmLabel="Elfogás"
        cancelLabel="Mégse"
        isDangerous={true}
        onConfirm={() => {
          if (capturePairId) {
            handleCapture(capturePairId);
            setCapturePairId(null);
          }
        }}
        onCancel={() => setCapturePairId(null)}
      />
    </div>
  );
}

// ... ProtectedRoute & App ...
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!authService.isAuthenticated()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;