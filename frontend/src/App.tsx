import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, Polygon, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { useSocket } from './hooks/useSocket';
import { usePairs } from './hooks/usePairs';
import { useGameInfo } from './hooks/useGameInfo';
import { Pair } from './types';
import { mergeLastPosition } from './utils/mergeLastPosition';
import { authService } from './services/auth';
import { useNotification } from './contexts/NotificationContext';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import PairDetails from './components/PairDetails';
import PositionsTraceMapModal, { type SinglePositionRow } from './components/PositionsTraceMapModal';
import { fetchLatestSavedPositionForPair } from './utils/fetchLatestSavedPosition';
import RuleViolationDetailsModal from './components/RuleViolationDetailsModal';
import MWLoader from './components/MWLoader';
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
  FiX,
  FiBell,
  FiCheckCircle,
  FiAlertCircle,
  FiInfo,
  FiTrash2,
  FiShield
} from 'react-icons/fi';
import { HiPencil } from 'react-icons/hi2';
import { FaHandcuffs } from 'react-icons/fa6';
import logoImage from './assets/images/most_wanted_logo_raw.png';
import mwOrangeImage from './assets/images/mw_orange.png';
import 'leaflet/dist/leaflet.css';
import './App.css';
import SmoothAnimatedMarker from './components/SmoothAnimatedMarker';
import { buildPairMarkerDivHtml } from './utils/pairMapMarkerHtml';

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

interface ActiveGameAreaViolation {
  pairId: number;
  assignedNumber: number | null;
  pairName: string | null;
  description: string;
  createdAt: string;
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

const formatRelativeTime = (timestamp: number | string | Date) => {
  const date = new Date(timestamp);
  const now = new Date();
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffDays = Math.round((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
  const timeStr = date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  
  if (diffDays === 0) return timeStr;
  if (diffDays === 1) return `Tegnap ${timeStr}`;
  
  const dateStr = date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
  return `${dateStr} ${timeStr}`;
};

function NotificationDropdown() {
  const { history, markAsRead, markAllAsRead, clearHistory, unreadCount, loadHistoryForUser, deleteNotification } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user?.username) {
      loadHistoryForUser(user.username);
    }
  }, [loadHistoryForUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-white/5 border border-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-all focus:outline-none"
        title="Értesítések"
      >
        <FiBell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-lg shadow-red-500/50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel - via portal to bypass backdrop-blur nesting limitations */}
      {createPortal(
        <div
          ref={dropdownRef}
          className={`fixed top-[84px] right-4 md:right-[150px] lg:right-[160px] w-[min(calc(100vw-32px),380px)] bg-[#050505]/85 backdrop-blur-xl border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden transition-all duration-300 z-[2000] flex flex-col ${isOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"}`}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-white/[0.03] to-transparent">
            <h3 className="font-extrabold text-white flex items-center gap-2.5 text-lg tracking-tight">
              <FiBell className="w-5 h-5 text-white/40" />
              Értesítések
              {unreadCount > 0 && (
                <div className="flex items-center justify-center bg-white/10 text-white h-5 min-w-[20px] px-1.5 rounded-full text-[11px] font-bold ml-0.5">
                  {unreadCount}
                </div>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && history.length > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:scale-105 transition-all shadow-sm"
                  title="Összes olvasottnak jelölése"
                >
                  <FiCheckCircle className="w-4 h-4" />
                </button>
              )}
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:scale-105 transition-all shadow-sm"
                  title="Összes törlése"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto max-h-[400px] custom-scrollbar">
            {history.length === 0 ? (
              <div className="p-6 flex items-center justify-center text-gray-500">
                <p className="text-sm font-medium">Nincsenek új értesítések.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => !item.read && markAsRead(item.id)}
                    className={`group relative p-4 border-b border-white/5 flex gap-3 transition-colors cursor-pointer hover:bg-white/[0.02] ${!item.read ? 'bg-white/[0.04]' : ''}`}
                  >
                    {/* Unread indicator line */}
                    {!item.read && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500" />}

                    {/* Icon */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5
                      ${item.type === 'success' ? 'bg-green-500/10 text-green-400' : ''}
                      ${item.type === 'error' ? 'bg-red-500/10 text-red-400' : ''}
                      ${item.type === 'info' ? 'bg-blue-500/10 text-blue-400' : ''}
                  `}>
                      {item.type === 'success' && <FiCheckCircle className="w-4 h-4" />}
                      {item.type === 'error' && <FiAlertCircle className="w-4 h-4" />}
                      {item.type === 'info' && <FiInfo className="w-4 h-4" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <p className={`text-sm leading-snug break-words ${!item.read ? 'text-white font-medium' : 'text-gray-400'}`}>
                        {item.message}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                        {item.isGlobal ? (
                          <span className="text-[9px] uppercase font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded">Globális</span>
                        ) : (
                          <span className="text-[9px] uppercase font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">Személyes</span>
                        )}
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotification(item.id); }}
                      className="flex-shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all self-start mt-0.5"
                      title="Értesítés törlése"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

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
  const navigate = useNavigate();
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
              onClick={() => navigate('/profile')}
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
              <NotificationDropdown />

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
  isHeaderExpanded,
  activeGameAreaExitViolations
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
  activeGameAreaExitViolations: Record<number, boolean>;
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
              const hasViolation = !!activeGameAreaExitViolations[pair.id];

              return (
                <div
                  key={pair.id}
                  onClick={() => pair.active && onPairClick(pair)}
                  className={`group relative p-3 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden ${isSelected
                    ? 'bg-orange-500/10 border-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.1)]'
                    : hasViolation
                      ? 'bg-red-500/[0.06] border-red-500/40 hover:bg-red-500/[0.09] hover:border-red-500/50'
                    : isMw
                      ? 'bg-orange-500/[0.03] border-orange-500/20 hover:bg-orange-500/[0.06] hover:border-orange-500/30'
                      : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
                    } ${pair.captured ? 'opacity-60 saturate-50' : ''}`}
                >
                  {/* Selection Indicator */}
                  {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />}

                  <div className="flex items-center gap-3">
                    {/* Avatar / Number — középen a középső tartalommal és a gombokkal */}
                    <div className={`relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl border-[3px] border-orange-500 text-white shadow-lg pb-0.5 transition-all duration-300 ${isMw ? 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.6)]' : 'bg-[#222]'}`}>
                      {pair.assignedNumber}
                      {/* Status Dot */}
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#121212] ${pair.captured ? 'bg-red-500' : pair.active ? 'bg-emerald-500' : 'bg-gray-500'
                        }`} />
                      {hasViolation && (
                        <div
                          className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-red-500/90 border border-black/40 flex items-center justify-center"
                          title="Aktív szabályszegés: játéktér elhagyása"
                        >
                          <FiAlertCircle className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Név/badge sor csak ha van tartalom — üres helykitöltő nélkül, hogy ne nőjön feleslegesen a sor */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      {(pair.name || isMw || hasViolation) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {pair.name && (
                            <span className={`text-base font-bold truncate ${isSelected ? 'text-white' : 'text-gray-200 group-hover:text-white'}`}>
                              {pair.name}
                            </span>
                          )}
                          {isMw && <span className="mw-badge mw !px-1.5 !py-0.5 !text-[10px] !rounded-[6px]"><FiShield className="w-2.5 h-2.5 fill-current" /> MW</span>}
                          {hasViolation && (
                            <span className="mw-badge error !px-1.5 !py-0.5 !text-[10px] !rounded-[6px]">
                              <FiAlertCircle className="w-2.5 h-2.5" /> Szabálysz.
                            </span>
                          )}
                        </div>
                      )}

                      {(!pair.lastPosition && !pair.distancePosition && pair.active) && (
                        <div className="flex items-center justify-center w-full">
                          <div className="w-5 h-5 rounded-full border-2 border-gray-600/30 border-t-gray-500 animate-[spin_1.5s_linear_infinite]" />
                        </div>
                      )}

                      {(pair.lastPosition || pair.distancePosition) && (
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
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
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

// --- Unified Popup Component (Refactored) ---
function GeofencePopup({
  geofence,
  activeMapLayer,
  onClose
}: {
  geofence: Geofence;
  activeMapLayer: MapLayerType;
  onClose: () => void;
}) {
  const g = geofence;
  const isCounty = g.geofenceType === 'county' || !!g.metadataJson?.countyCode;

  // Logic for Subtitle
  let subtitle = '';
  if (isCounty) {
    subtitle = g.name === 'Budapest' ? 'FŐVÁROS' : 'VÁRMEGYE';
  } else if (g.geofenceType === 'game_area') {
    // If name implies Hungary, we don't need a subtitle, or it's just 'MAGYARORSZÁG'
    if (g.name.toLowerCase() === 'magyarország') subtitle = '';
    else subtitle = 'MAGYARORSZÁG';
  } else {
    // Dynamic subtitle for custom zones: calculate size in km
    const radiusKm = parseFloat((g.radiusM / 1000).toFixed(3));
    subtitle = `${radiusKm} km-es zóna`;
  }

  // Consistent Status Dot Style
  const statusDotClass = `w-2.5 h-2.5 rounded-full shadow-[0_0_12px] ${activeMapLayer === 'dark' ? 'bg-green-500 shadow-green-500' : 'bg-green-500 shadow-green-500/40'}`;

  return (
    <Popup className={activeMapLayer === 'dark' ? "custom-popup-dark" : "custom-popup-light"}>
      <div className="flex flex-col gap-3 p-4 min-w-[240px] font-sans">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className={statusDotClass} />
            <div>
              <div className={`font-bold text-base leading-none mb-0.5 ${activeMapLayer === 'dark' ? 'text-white' : 'text-gray-900'}`}>{g.name}</div>
              {subtitle && (
                <div className={`text-[9px] uppercase tracking-wider font-bold ${activeMapLayer === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{subtitle}</div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className={`transition-colors p-0.5 -mr-1 -mt-1 ${activeMapLayer === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-black'}`}
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* Description line if exists */}
        {g.metadataJson?.description && (
          <>
            <div className={`h-px w-full ${activeMapLayer === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />
            <div className={`text-xs italic mt-1 ${activeMapLayer === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{g.metadataJson.description}</div>
          </>
        )}
      </div>
    </Popup>
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
  const [showViolationDetailsModal, setShowViolationDetailsModal] = useState(false);
  const [selectedViolationPairId, setSelectedViolationPairId] = useState<number | null>(null);
  const [pairLastPositionMap, setPairLastPositionMap] = useState<{
    pairId: number;
    headerSubtitle: string;
    row: SinglePositionRow;
  } | null>(null);
  const [pairMapOpen, setPairMapOpen] = useState(false);
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
  const [activeGameAreaExitViolations, setActiveGameAreaExitViolations] = useState<Record<number, boolean>>({});
  const [activeGameAreaViolationDetails, setActiveGameAreaViolationDetails] = useState<Record<number, ActiveGameAreaViolation>>({});

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
    const fetchActiveGameAreaViolations = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/rule-violations/active-game-area', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!response.ok) return;

        const data = await response.json();
        const map: Record<number, boolean> = {};
        const details: Record<number, ActiveGameAreaViolation> = {};
        for (const violation of data.violations || []) {
          const pairId = Number(violation.pairId);
          if (!pairId) continue;
          map[pairId] = true;
          details[pairId] = {
            pairId,
            assignedNumber: violation.assignedNumber ?? null,
            pairName: violation.pairName ?? null,
            description: violation.description || 'Pár kilépett a játéktérből',
            createdAt: violation.createdAt,
          };
        }
        setActiveGameAreaExitViolations(map);
        setActiveGameAreaViolationDetails(details);
      } catch (error) {
        console.error('Error fetching active game area violations:', error);
      }
    };

    fetchActiveGameAreaViolations();
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
              lastPosition: mergeLastPosition(existing.lastPosition, apiPair.lastPosition),
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
    socket.on('ruleViolation', (data: any) => {
      if (!data || data.violationType !== 'game_area_exit') return;
      const pairId = Number(data.pairId);
      if (!pairId) return;

      if (data.resolved === false) {
        setActiveGameAreaExitViolations((prev) => ({ ...prev, [pairId]: true }));
        setActiveGameAreaViolationDetails((prev) => ({
          ...prev,
          [pairId]: {
            pairId,
            assignedNumber:
              pairsState.find((p) => p.id === pairId)?.assignedNumber ??
              pairs.find((p) => p.id === pairId)?.assignedNumber ??
              null,
            pairName:
              pairsState.find((p) => p.id === pairId)?.name ??
              pairs.find((p) => p.id === pairId)?.name ??
              null,
            description: data.description || 'Pár kilépett a játéktérből',
            createdAt: data.createdAt || data.timestamp || new Date().toISOString(),
          },
        }));
        const targetPair =
          pairsState.find((p) => p.id === pairId) || pairs.find((p) => p.id === pairId);
        const pairText = targetPair
          ? `${targetPair.assignedNumber}. pár${targetPair.name ? ` (${targetPair.name})` : ''}`
          : `${pairId}. azonosítójú pár`;
        addNotification(
          'error',
          `Szabálysértés: a(z) ${pairText} elhagyta az aktív játékterületet. Ettől kezdve folyamatosan láthatja ezt a párost a térképen, amíg a játékterületre nem tér vissza.`,
          true, // global
        );
      } else {
        setActiveGameAreaExitViolations((prev) => {
          if (!prev[pairId]) return prev;
          const next = { ...prev };
          delete next[pairId];
          return next;
        });
        setActiveGameAreaViolationDetails((prev) => {
          if (!prev[pairId]) return prev;
          const next = { ...prev };
          delete next[pairId];
          return next;
        });
      }
    });
    return () => {
      socket.off('distanceUpdate', handleDistanceUpdate);
      socket.off('positionUpdate', handlePositionUpdate);
      socket.off('capture');
      socket.off('mwHighlight');
      socket.off('gameAreaUpdate');
      socket.off('ruleViolation');
    };
  }, [socket, gameSettings, refetch, addNotification, pairsState, pairs]);

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
      n = prompt('Adja meg a pár nevét:', p?.name || '') || undefined;
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
    return <MWLoader subtitle="Térkép betöltése..." />;
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
            <SmoothAnimatedMarker
              key="browser-location"
              position={[browserLocation.lat, browserLocation.lon]}
              duration={380}
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
            </SmoothAnimatedMarker>
          )}

          {/* Pair Markers */}
          {displayPairsOnMap.map((pair) => (
            pair.lastPosition && (
              <SmoothAnimatedMarker
                key={`pair-${pair.id}`}
                position={[pair.lastPosition.lat, pair.lastPosition.lon]}
                duration={400}
                icon={L.divIcon({
                  className: 'custom-pair-marker',
                  html: buildPairMarkerDivHtml({
                    assignedNumber: pair.assignedNumber,
                    mostWanted: !!pair.mostWanted,
                    hasViolation: !!activeGameAreaExitViolations[pair.id],
                  }),
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

          {/* Unified Dimming Mask for ALL Active Zones (Game Area, Counties, Custom) */}
          {(() => {
            // Helper to approximate a circle as a polygon for the mask hole
            const getCirclePolygon = (lat: number, lon: number, radiusM: number) => {
              const points: [number, number][] = [];
              const steps = 64; // Smoothness
              const R = 6371000; // Earth radius in meters

              for (let i = 0; i < steps; i++) {
                const angle = (i * 360 / steps) * (Math.PI / 180);
                // Simple flat-earth approximation for small radii is sufficient for visual mask
                // dLat = (radius / R) * (180 / PI)
                // dLon = (radius / R) * (180 / PI) / cos(lat)
                const dLat = (radiusM / R) * (180 / Math.PI);
                const dLon = dLat / Math.cos(lat * Math.PI / 180);

                const pLat = lat + dLat * Math.sin(angle);
                const pLon = lon + dLon * Math.cos(angle);
                points.push([pLat, pLon]);
              }
              return points;
            };

            // Collect all "Active" areas that should be bright (Holes in the mask)
            const holes: [number, number][][] = [];

            geofences.filter(g => g.active).forEach(g => {
              // 1. Polygons (Game Area, County, Custom Polygon)
              if (g.metadataJson?.polygon && g.metadataJson.polygon.length > 0) {
                holes.push(g.metadataJson.polygon.map(([lon, lat]) => [lat, lon] as [number, number]));
              }
              // 2. Circles (Custom Zones without polygon data)
              else if (g.centerLat && g.centerLon && g.radiusM) {
                holes.push(getCirclePolygon(g.centerLat, g.centerLon, g.radiusM));
              }
            });

            if (holes.length > 0) {
              const maskPositions = [
                [ // Outer Ring (World)
                  [90, -180], [90, 180], [-90, 180], [-90, -180]
                ],
                ...holes // All Holes
              ];

              return (
                <Polygon
                  positions={maskPositions as any}
                  pathOptions={{
                    color: 'transparent',
                    fillColor: '#000000',
                    fillOpacity: activeMapLayer === 'dark' ? 0.7 : 0.5, // Darker dimming in Dark Mode
                    stroke: false
                  }}
                  eventHandlers={{ click: () => { } }} // Passthrough
                />
              );
            } else {
              // No active zones -> Dim the ENTIRE map
              const maskPositions = [
                [90, -180], [90, 180], [-90, 180], [-90, -180]
              ];

              return (
                <Polygon
                  positions={maskPositions as any}
                  pathOptions={{
                    color: 'transparent',
                    fillColor: '#000000',
                    fillOpacity: activeMapLayer === 'dark' ? 0.7 : 0.5,
                    stroke: false
                  }}
                  eventHandlers={{ click: () => { } }} // Passthrough
                />
              );
            }
          })()}

          {/* Render Active Geofences (Borders/Fills) */}
          {geofences.filter(g => g.active).map(g => {
            const isCounty = g.geofenceType === 'county' || !!g.metadataJson?.countyCode;

            // 1. Game Area (Polygon)
            if (g.geofenceType === 'game_area' && g.metadataJson?.polygon) {
              const positions = g.metadataJson.polygon.map(([lon, lat]) => [lat, lon] as [number, number]);
              return (
                <Polygon
                  key={`${g.id}-${activeMapLayer}`}
                  positions={positions}
                  pathOptions={{
                    color: activeMapLayer === 'dark' ? '#f97316' : '#3b82f6',
                    fillColor: 'transparent',
                    fillOpacity: 0,
                    weight: 3
                  }}
                >
                  <GeofencePopup geofence={g} activeMapLayer={activeMapLayer} onClose={() => mapRef.current?.closePopup()} />
                </Polygon>
              );
            }

            // 2. Standard Polygon (County / Custom)
            if (g.metadataJson?.polygon && (g.metadataJson?.type === 'polygon' || isCounty)) {
              let color = '#3b82f6'; // Default Blue

              if (activeMapLayer === 'dark') {
                if (g.geofenceType === 'county') color = '#f97316';
                else color = '#3b82f6'; // Custom Zone -> Blue (on Dark)
              } else {
                // Standard / Satellite Logic
                if (g.geofenceType === 'county') color = '#3b82f6'; // County -> Blue (on Light)
                else color = '#f97316'; // Custom Zone -> Orange (on Light)
              }

              return (
                <Polygon
                  key={`${g.id}-${activeMapLayer}`}
                  positions={g.metadataJson.polygon.map(([lon, lat]) => [lat, lon] as [number, number])}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: g.geofenceType === 'county' ? 0.05 : 0, // No fill for custom zones (0.1 -> 0)
                    weight: 2,
                    dashArray: isCounty ? '5, 10' : undefined
                  }}
                >
                  <GeofencePopup geofence={g} activeMapLayer={activeMapLayer} onClose={() => mapRef.current?.closePopup()} />
                </Polygon>
              );
            }

            // 3. Circle (Default - usually Custom Zones/Points)
            let circleColor = '#3b82f6'; // Default Blue
            if (activeMapLayer === 'dark') {
              circleColor = '#3b82f6'; // Custom Zone -> Blue (on Dark)
            } else {
              // Standard / Satellite Logic
              circleColor = '#f97316'; // Custom Zone -> Orange (on Light)
            }

            return (
              <Circle
                key={`${g.id}-${activeMapLayer}`}
                center={[g.centerLat, g.centerLon]}
                radius={g.radiusM}
                pathOptions={{ color: circleColor, fillColor: circleColor, fillOpacity: 0, weight: 2 }} // No fill (0.1 -> 0)
              >
                <GeofencePopup geofence={g} activeMapLayer={activeMapLayer} onClose={() => mapRef.current?.closePopup()} />
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
        activeGameAreaExitViolations={activeGameAreaExitViolations}
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
          hasActiveGameAreaViolation={!!activeGameAreaExitViolations[selectedPair.id]}
          onOpenViolationDetails={(pairId) => {
            setSelectedViolationPairId(pairId);
            setShowViolationDetailsModal(true);
          }}
          /* Round 3: Fix Message Logic - Keep details open */
          onSendMessage={(id) => {
            setMessagePairId(id); // Set the specific pair ID
            setShowMessageModal(true);
          }}
          onOpenLastPositionMap={async (p) => {
            if (!p.lastPosition || p.lastPosition.lat == null || p.lastPosition.lon == null) return;
            const name = p.name?.trim();
            const saved = await fetchLatestSavedPositionForPair(p.id);
            let row: SinglePositionRow;
            let headerSubtitle: string;
            if (saved) {
              row = saved;
              headerSubtitle = `Pár #${p.assignedNumber}${name ? ` (${name})` : ''} · ${new Date(saved.timestamp).toLocaleString('hu-HU', { dateStyle: 'medium', timeStyle: 'short' })}`;
            } else {
              row = {
                id: 0,
                lat: p.lastPosition.lat,
                lon: p.lastPosition.lon,
                timestamp: p.lastPosition.timestamp,
              };
              headerSubtitle = `Pár #${p.assignedNumber}${name ? ` (${name})` : ''} · utolsó ismert hely · ${new Date(p.lastPosition.timestamp).toLocaleString('hu-HU', { dateStyle: 'medium', timeStyle: 'short' })}`;
            }
            setPairLastPositionMap({ pairId: p.id, headerSubtitle, row });
            setPairMapOpen(true);
          }}
        />
      )}

      {pairLastPositionMap && (
        <PositionsTraceMapModal
          isOpen={pairMapOpen}
          onClose={() => {
            setPairMapOpen(false);
            window.setTimeout(() => setPairLastPositionMap(null), 220);
          }}
          variant="single"
          pairId={pairLastPositionMap.pairId}
          headerSubtitle={pairLastPositionMap.headerSubtitle}
          singleRow={pairLastPositionMap.row}
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

      <RuleViolationDetailsModal
        isOpen={showViolationDetailsModal}
        onClose={() => setShowViolationDetailsModal(false)}
        pairId={selectedViolationPairId}
        initialAssignedNumber={
          selectedViolationPairId != null
            ? activeGameAreaViolationDetails[selectedViolationPairId]?.assignedNumber ??
              pairsState.find((p) => p.id === selectedViolationPairId)?.assignedNumber ??
              null
            : null
        }
        initialPairName={
          selectedViolationPairId != null
            ? activeGameAreaViolationDetails[selectedViolationPairId]?.pairName ??
              pairsState.find((p) => p.id === selectedViolationPairId)?.name ??
              null
            : null
        }
        initialStartedAt={
          selectedViolationPairId != null
            ? activeGameAreaViolationDetails[selectedViolationPairId]?.createdAt ?? null
            : null
        }
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
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;