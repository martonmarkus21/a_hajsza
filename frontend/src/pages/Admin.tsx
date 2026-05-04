import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEdit, FiCheckCircle, FiUser, FiShield, FiPlus, FiMail } from 'react-icons/fi';

// New Components
import { usePairs } from '../hooks/usePairs';
import { useSocket } from '../hooks/useSocket';
import AdminLayout from './admin/AdminLayout';
import DashboardHome from './admin/DashboardHome';
import GameControl from './admin/GameControl';
import Modal from '../components/Modal';
import PairsManagement from './admin/PairsManagement';
import DeviceManagement from './admin/DeviceManagement';
import UserManagement from './admin/UserManagement';
import GeofenceManager from './admin/GeofenceManager';
import RuleViolationsManagement from './admin/RuleViolationsManagement';
import PositionsHistory from './admin/PositionsHistory';
import AuditLogsManagement from './admin/AuditLogsManagement';
import type { AdminRuleViolationRow } from './admin/RuleViolationsManagement';
import PairDetails from '../components/PairDetails';
import CaptureDetailsModal from '../components/CaptureDetailsModal';
import PositionsTraceMapModal, { type SinglePositionRow } from '../components/PositionsTraceMapModal';
import { fetchLatestSavedPositionForPair } from '../utils/fetchLatestSavedPosition';
import RuleViolationDetailsModal from '../components/RuleViolationDetailsModal';

// Shared Components
import SendMessageModal from '../components/SendMessageModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { useNotification } from '../contexts/NotificationContext';
import { formatDateTimeBudapestParts } from '../utils/formatDateTimeBudapest';
import { extractApiErrorMessage } from '../utils/extractApiErrorMessage';
import { mergeLastPosition } from '../utils/mergeLastPosition';

import 'leaflet/dist/leaflet.css';

// Import Pair from types
import { Pair } from '../types';
import { apiUrl } from '@/config/env';
import { maybeReportPursuerLiveLocation } from '@/utils/reportPursuerLiveLocation';
import { logGeolocationError } from '@/utils/geolocationQuietError';

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
  };
}

// Local Pair interface removed to use global Pair type


interface Device {
  id: number;
  pairId: number;
  pairNumber: number;
  pairName: string | null;
  imeiOrDeviceId: string;
  lastSeenAt: string | null;
  loggedOutAt: string | null;
  hasFcmToken: boolean;
  active: boolean;
}

interface User {
  id: number;
  username: string;
  email: string | null;
  role: 'admin' | 'officer';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ActiveGameAreaViolation {
  pairId: number;
  assignedNumber: number | null;
  pairName: string | null;
  description: string;
  createdAt: string;
  violationType?: string;
}

interface GameDay {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  specialRulesJson?: any;
}

function normalizeYmd(value?: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const ymdMatch = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  if (ymdMatch) return ymdMatch[1];
  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return raw.slice(0, 10);
}

function normalizeHm(value?: string): string {
  const raw = String(value ?? '').trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (!match) return '00:00';
  const hh = Math.max(0, Math.min(23, Number(match[1]) || 0));
  const mm = Math.max(0, Math.min(59, Number(match[2]) || 0));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export default function Admin() {
  const CAPTURE_MAX_DISTANCE_METERS = 500;
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPair, setSelectedPair] = useState<Pair | null>(null);
  const [showViolationDetailsModal, setShowViolationDetailsModal] = useState(false);
  const [selectedViolationPairId, setSelectedViolationPairId] = useState<number | null>(null);
  const [pairLastPositionMap, setPairLastPositionMap] = useState<{
    pairId: number;
    headerSubtitle: string;
    row: SinglePositionRow;
  } | null>(null);
  const [pairMapOpen, setPairMapOpen] = useState(false);
  /** Naplósorból megnyitva: ne írja felül az élő API a megjelenített adatot */
  const [violationModalArchive, setViolationModalArchive] = useState<AdminRuleViolationRow | null>(null);
  const violationArchiveClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [browserLocation, setBrowserLocation] = useState<{ lat: number; lon: number } | null>(null);

  // Generic Confirmation State
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    isDangerous?: boolean;
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: async () => { },
    isDangerous: false,
    confirmLabel: 'Igen'
  });

  const [geofences, setGeofences] = useState<Geofence[]>([]);
  /* Real-time Pairs Logic */
  const { pairs: initialPairs, refetch: fetchPairs } = usePairs();
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [captureDetailsPairId, setCaptureDetailsPairId] = useState<number | null>(null);
  const frozenLastLivePositionsRef = useRef<Record<number, NonNullable<Pair['lastPosition']>>>({});
  const { socket } = useSocket();

  const [activeGameAreaExitViolations, setActiveGameAreaExitViolations] = useState<Record<number, boolean>>({});
  const [activeGameAreaViolationDetails, setActiveGameAreaViolationDetails] = useState<Record<number, ActiveGameAreaViolation>>({});

  const persistFrozenLastLivePositions = () => {
    localStorage.setItem('mw:frozen-last-live-positions', JSON.stringify(frozenLastLivePositionsRef.current));
  };

  const freezeCurrentLastPosition = (
    pairId: number,
    explicitPosition?: { lat: number; lon: number; timestamp: string } | null,
  ) => {
    const current = explicitPosition ?? pairs.find((p) => p.id === pairId)?.lastPosition;
    if (!current) return;
    const existing = frozenLastLivePositionsRef.current[pairId];
    if (existing) {
      const tExisting = new Date(existing.timestamp).getTime();
      const tCurrent = new Date(current.timestamp).getTime();
      if (Number.isFinite(tExisting) && Number.isFinite(tCurrent) && tCurrent < tExisting) return;
    }
    frozenLastLivePositionsRef.current[pairId] = current;
    persistFrozenLastLivePositions();
  };

  const clearFrozenLastPosition = (pairId: number) => {
    if (frozenLastLivePositionsRef.current[pairId] == null) return;
    delete frozenLastLivePositionsRef.current[pairId];
    persistFrozenLastLivePositions();
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('mw:frozen-last-live-positions');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, NonNullable<Pair['lastPosition']>>;
      const normalized: Record<number, NonNullable<Pair['lastPosition']>> = {};
      for (const [k, v] of Object.entries(parsed || {})) {
        const id = Number(k);
        if (!Number.isFinite(id) || !v) continue;
        if (!Number.isFinite(v.lat) || !Number.isFinite(v.lon) || !v.timestamp) continue;
        normalized[id] = { lat: v.lat, lon: v.lon, timestamp: v.timestamp };
      }
      frozenLastLivePositionsRef.current = normalized;
    } catch {
      frozenLastLivePositionsRef.current = {};
    }
  }, []);

  const refreshActiveGameAreaViolations = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/rule-violations/active-game-area'), {
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
        const vType = violation.violationType as string | undefined;
        details[pairId] = {
          pairId,
          assignedNumber: violation.assignedNumber ?? null,
          pairName: violation.pairName ?? null,
          description:
            violation.description ||
            (vType === 'vehicle_time_exceeded'
              ? 'Járműhasználati idő limit túllépve'
              : 'Pár kilépett a játéktérből'),
          createdAt: violation.createdAt,
          violationType: vType,
        };
      }

      setActiveGameAreaExitViolations(map);
      setActiveGameAreaViolationDetails(details);
    } catch (error) {
      console.error('Error fetching active game area violations:', error);
    }
  }, []);

  // Sync pairs from hook BUT preserve socket-updated distancePosition
  // This prevents the jumping issue where API data overwrites socket data
  useEffect(() => {
    if (initialPairs.length > 0) {
      const apiPairIds = new Set(initialPairs.map((p) => p.id));
      let removedAnyFrozen = false;
      for (const rawId of Object.keys(frozenLastLivePositionsRef.current)) {
        const id = Number(rawId);
        if (!apiPairIds.has(id)) {
          delete frozenLastLivePositionsRef.current[id];
          removedAnyFrozen = true;
        }
      }
      if (removedAnyFrozen) {
        persistFrozenLastLivePositions();
      }
      setPairs(prevPairs => {
        // Merge API data with existing socket-updated data
        return initialPairs.map(apiPair => {
          const existing = prevPairs.find(p => p.id === apiPair.id);
          if (existing) {
            const frozen = frozenLastLivePositionsRef.current[apiPair.id];
            // Preserve distancePosition from socket (distanceUpdate events)
            // Preserve lastPosition from socket (positionUpdate events)
            return {
              ...apiPair,
              lastPosition: frozen ?? mergeLastPosition(existing.lastPosition, apiPair.lastPosition),
              distancePosition: existing.distancePosition, // Keep socket-updated distance position
            };
          }
          return apiPair;
        });
      });
    }
  }, [initialPairs]);

  useEffect(() => {
    void refreshActiveGameAreaViolations();
  }, [refreshActiveGameAreaViolations]);

  useEffect(() => {
    if (!socket) return;
    const handleRuntimeUpdate = () => {
      fetchGameSettings();
    };
    const handleAreaUpdate = () => {
      fetchGeofences();
      fetchGameSettings();
    };
    socket.on('gameRuntimeUpdate', handleRuntimeUpdate);
    socket.on('gameAreaUpdate', handleAreaUpdate);
    return () => {
      socket.off('gameRuntimeUpdate', handleRuntimeUpdate);
      socket.off('gameAreaUpdate', handleAreaUpdate);
    };
  }, [socket]);

  // Listen for real-time position updates
  useEffect(() => {
    if (!socket) return;

    // Handle distance updates - sent continuously (every second) for distance calculation
    // This updates `distancePosition` which is used for distance calculation in PairDetails
    const handleDistanceUpdate = (data: { pairId: number; lat: number; lon: number; timestamp: string }) => {
      if (data.lat == null || data.lon == null) {
        console.warn('Received invalid distance data:', data);
        return;
      }

      setPairs(prevPairs => prevPairs.map(p => {
        if (p.id !== data.pairId) return p;

        return {
          ...p,
          distancePosition: {
            lat: data.lat,
            lon: data.lon,
            timestamp: data.timestamp || new Date().toISOString()
          }
        };
      }));
    };

    // Handle position updates - only sent when timer allows (for map display)
    // Data structure: { pairId, lat, lon, timestamp } - NOT nested under 'position'
    const handlePositionUpdate = (data: { pairId: number; lat: number; lon: number; timestamp: string }) => {
      if (data.lat == null || data.lon == null) {
        console.warn('Received invalid position data:', data);
        return;
      }
      clearFrozenLastPosition(data.pairId);

      setPairs(prevPairs => prevPairs.map(p => {
        if (p.id === data.pairId) {
          return {
            ...p,
            lastPosition: {
              lat: data.lat,
              lon: data.lon,
              timestamp: data.timestamp || new Date().toISOString()
            }
          };
        }
        return p;
      }));
    };

    const handleGlobalToast = (data: { message?: string; variant?: string }) => {
      const msg = (data?.message ?? '').trim();
      if (!msg) return;
      const v = (data?.variant ?? 'info').toLowerCase();
      const level: 'info' | 'error' | 'success' =
        v === 'error' ? 'error' : v === 'success' ? 'success' : 'info';
      addNotification(level, msg, true);
    };

    const handleRuleViolation = (data: any) => {
      const vType = data?.violationType;
      if (!data || (vType !== 'game_area_exit' && vType !== 'vehicle_time_exceeded')) return;
      const pairId = Number(data.pairId);
      if (!pairId) return;

      if (data.resolved === false) {
        setActiveGameAreaExitViolations((prev) => ({ ...prev, [pairId]: true }));
        setActiveGameAreaViolationDetails((prev) => ({
          ...prev,
          [pairId]: {
            pairId,
            assignedNumber: pairs.find((p) => p.id === pairId)?.assignedNumber ?? null,
            pairName: pairs.find((p) => p.id === pairId)?.name ?? null,
            description:
              data.description ||
              (vType === 'vehicle_time_exceeded'
                ? 'Járműhasználati idő túllépve'
                : 'Pár kilépett a játéktérből'),
            createdAt: data.createdAt || data.timestamp || new Date().toISOString(),
            violationType: vType,
          },
        }));
        const targetPair = pairs.find((p) => p.id === pairId);
        const pairText = targetPair
          ? `${targetPair.assignedNumber}. pár${targetPair.name ? ` (${targetPair.name})` : ''}`
          : `${pairId}. azonosítójú pár`;
        const body =
          vType === 'vehicle_time_exceeded'
            ? `Szabálysértés: a(z) ${pairText} túllépte a járműhasználati időt. Ettől kezdve kb. 15 percig folyamatosan látható a térképen (élő pozíció). Ezután a szabályszegés jelzése lezárul.`
            : `Szabálysértés: a(z) ${pairText} elhagyta az aktív játékterületet. Ettől kezdve folyamatosan láthatja ezt a párost a térképen, amíg a játékterületre nem tér vissza.`;
        addNotification('error', body, true);
      } else {
        freezeCurrentLastPosition(pairId, data.lastLivePosition ?? null);
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
    };

    const handleCaptureEvent = (data: {
      pairId: number;
      assignedNumber?: number;
      pairName?: string | null;
      timestamp?: string;
      captureLocation?: { lat: number; lon: number } | null;
      capturedBy?: { username?: string };
    }) => {
      const pair = pairs.find((p) => p.id === data.pairId);
      const number = data.assignedNumber ?? pair?.assignedNumber ?? data.pairId;
      const name = data.pairName ?? pair?.name ?? null;
      const pairLabel = `${number}. pár${name ? ` (${name})` : ''}`;
      const recorder = data.capturedBy?.username;

      setPairs((prev) =>
        prev.map((p) =>
          p.id === data.pairId
            ? {
                ...p,
                captured: true,
                captureTimestamp: data.timestamp ?? p.captureTimestamp ?? null,
                capturedByUsername: data.capturedBy?.username ?? p.capturedByUsername ?? null,
                captureLocation: data.captureLocation ?? p.captureLocation ?? null,
              }
            : p,
        ),
      );
      addNotification(
        'info',
        `Elfogás: a(z) ${pairLabel} elfogott státuszba került.${recorder ? ` Rögzítő: ${recorder}.` : ''} Ettől kezdve a térképen és a párok listájában ennek megfelelően látható.`,
        true,
      );
      fetchPairs();
    };

    const handleCaptureRevertedEvent = (data: {
      pairId: number;
      assignedNumber?: number;
      pairName?: string | null;
      lastLivePosition?: { lat: number; lon: number; timestamp: string } | null;
    }) => {
      const pair = pairs.find((p) => p.id === data.pairId);
      const number = data.assignedNumber ?? pair?.assignedNumber ?? data.pairId;
      const name = data.pairName ?? pair?.name ?? null;
      const pairLabel = `${number}. pár${name ? ` (${name})` : ''}`;

      setPairs((prev) =>
        prev.map((p) =>
          p.id === data.pairId
            ? {
                ...p,
                captured: false,
                captureTimestamp: null,
                captureId: null,
                capturedByUserId: null,
                capturedByUsername: null,
                capturedByRole: null,
                captureLocation: null,
                captureNote: null,
              }
            : p,
        ),
      );

      freezeCurrentLastPosition(data.pairId, data.lastLivePosition ?? null);

      addNotification(
        'info',
        `Elfogás visszavonva: a(z) ${pairLabel} ismét aktív menekülőként szerepel. A térképen és a párok listájában a nézet ennek megfelelően frissült.`,
        true,
      );
      fetchPairs();
    };

    socket.on('distanceUpdate', handleDistanceUpdate);
    socket.on('positionUpdate', handlePositionUpdate);
    socket.on('ruleViolation', handleRuleViolation);
    socket.on('globalToast', handleGlobalToast);
    socket.on('capture', handleCaptureEvent);
    socket.on('captureReverted', handleCaptureRevertedEvent);

    return () => {
      socket.off('distanceUpdate', handleDistanceUpdate);
      socket.off('positionUpdate', handlePositionUpdate);
      socket.off('ruleViolation', handleRuleViolation);
      socket.off('globalToast', handleGlobalToast);
      socket.off('capture', handleCaptureEvent);
      socket.off('captureReverted', handleCaptureRevertedEvent);
    };
  }, [socket, addNotification, pairs, fetchPairs]);



  // Calculate distance helper
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Browser location - same logic as App.tsx for continuous updates
  const watchIdRef = useRef<number | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastBrowserGeoFixMsRef = useRef(0);

  useEffect(() => {
    if (navigator.geolocation) {
      // Clean up any existing watch/interval first
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (locationIntervalRef.current !== null) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }

      const geoStaleMs = 2000;
      const saveLocation = (lat: number, lon: number) => {
        lastBrowserGeoFixMsRef.current = Date.now();
        setBrowserLocation({ lat, lon });
        maybeReportPursuerLiveLocation(lat, lon);
      };

      // Get initial position immediately
      navigator.geolocation.getCurrentPosition(
        (position) => {
          saveLocation(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          logGeolocationError('getCurrentPosition (initial)', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      // Watch position for continuous updates
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          saveLocation(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          logGeolocationError('watchPosition', error);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
      watchIdRef.current = watchId;

      // Tartalék: csak ha ~2 s óta nem érkezett fix (watch leáll / lassú böngésző), kérünk újat — maximumAge 0, mozgásnál friss térkép
      const locationInterval = setInterval(() => {
        if (Date.now() - lastBrowserGeoFixMsRef.current < geoStaleMs) return;
        navigator.geolocation.getCurrentPosition(
          (position) => {
            saveLocation(position.coords.latitude, position.coords.longitude);
          },
          (error) => {
            logGeolocationError('getCurrentPosition (interval)', error);
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
      }, 1000);
      locationIntervalRef.current = locationInterval;

      return () => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        if (locationIntervalRef.current !== null) {
          clearInterval(locationIntervalRef.current);
          locationIntervalRef.current = null;
        }
      };
    }
  }, []);
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeDevices, setActiveDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [gameSettings, setGameSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gameDays, setGameDays] = useState<GameDay[]>([]);
  // Form States
  const [newGeofence, setNewGeofence] = useState({
    name: '',
    centerLat: 47.4979,
    centerLon: 19.0402,
    radiusM: 25000,
    geofenceType: 'scenario',
  });
  const [newPair, setNewPair] = useState({
    assignedNumber: 1,
    name: '',
  });
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'officer' as 'admin' | 'officer',
    active: true,
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editUserForm, setEditUserForm] = useState({
    username: '',
    email: '',
    role: 'officer' as 'admin' | 'officer',
    password: '',
    active: true,
  });

  // UI States
  const [intervalInputValue, setIntervalInputValue] = useState<number>(20);
  const [isEditingInterval, setIsEditingInterval] = useState(false);
  const [stayRadiusInput, setStayRadiusInput] = useState(5);
  const [isEditingStay, setIsEditingStay] = useState(false);
  const [mapClickMode, setMapClickMode] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showCreatePairModal, setShowCreatePairModal] = useState(false);
  const [selectedMessagePair, setSelectedMessagePair] = useState<Pair | null>(null);

  // Helper to check admin role
  const checkAdminRole = () => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role === 'admin';
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    if (activeTab === 'audit_logs' && !checkAdminRole()) {
      setActiveTab('dashboard');
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
    const isAdmin = checkAdminRole();

    // Only poll if user is admin
    if (isAdmin) {
      const interval = setInterval(() => {
        fetchPairs();
        fetchDevices();
        fetchActiveDevices();
        fetchGameSettings();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    if (!isEditingInterval && gameSettings?.locationUpdateIntervalMinutes) {
      setIntervalInputValue(gameSettings.locationUpdateIntervalMinutes);
    }
  }, [gameSettings?.locationUpdateIntervalMinutes, isEditingInterval]);

  useEffect(() => {
    if (!isEditingStay && gameSettings?.stayRadiusKm != null) {
      setStayRadiusInput(Number(gameSettings.stayRadiusKm));
    }
  }, [gameSettings?.stayRadiusKm, isEditingStay]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (checkAdminRole()) {
        await Promise.all([
          fetchGeofences(),
          fetchPairs(),
          fetchDevices(),
          fetchActiveDevices(),
          fetchUsers(),
          fetchGameSettings(),
          fetchGameDays(),
        ]);
      } else {
        // Just fetch minimal data if needed, or redirect
        // For now, we allow loading but maybe fail gracefully on 403s
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // API Calls
  const fetchGameSettings = async () => {
    try {
      const response = await fetch(apiUrl('/api/game-settings'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        setGameSettings(await response.json());
      }
    } catch (error) { console.error(error); }
  };

  const fetchGameDays = async () => {
    try {
      const response = await fetch(apiUrl('/api/game-days'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        setGameDays(await response.json());
      }
    } catch (error) { console.error(error); }
  };

  // fetchPairs removed, handled by usePairs hook

  const fetchDevices = async () => {
    try {
      const response = await fetch(apiUrl('/api/devices'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) setDevices(await response.json());
    } catch (error) { console.error(error); }
  };

  const fetchActiveDevices = async () => {
    try {
      const response = await fetch(apiUrl('/api/devices/active'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) setActiveDevices(await response.json());
    } catch (error) { console.error(error); }
  };

  const fetchGeofences = async () => {
    try {
      const response = await fetch(apiUrl('/api/geofence'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) setGeofences(await response.json());
    } catch (error) { console.error(error); }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(apiUrl('/api/users'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) setUsers(await response.json());
    } catch (error) { console.error(error); }
  };

  // Actions
  const startTimer = async () => {
    await fetch(apiUrl('/api/game-settings/timer/start'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    fetchGameSettings();
  };

  const stopTimer = async () => {
    await fetch(apiUrl('/api/game-settings/timer/stop'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    fetchGameSettings();
  };

  const updateInterval = async (minutes: number) => {
    await fetch(apiUrl('/api/game-settings'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ locationUpdateIntervalMinutes: minutes }),
    });
    fetchGameSettings();
    addNotification('success', 'A helymeghatározási időköz frissítése megtörtént.');
  };

  const updateStaySettings = async (payload: { stayRuleEnabled?: boolean; stayRadiusKm?: number }) => {
    await fetch(apiUrl('/api/game-settings'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(payload),
    });
    fetchGameSettings();
    addNotification('success', 'A maradási szabály beállításai frissítve lettek.');
  };

  const createGameDay = async (draft: {
    date: string;
    startTime: string;
    endTime: string;
    specialRulesText: string;
  }) => {
    const isFinalDay = (raw: unknown): boolean => {
      if (!raw) return false;
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          return parsed?.isFinalDay === true;
        } catch {
          return false;
        }
      }
      if (typeof raw === 'object') {
        return (raw as any)?.isFinalDay === true;
      }
      return false;
    };
    const buildStamp = (dateValue?: string, timeValue?: string): string => {
      const ymd = normalizeYmd(dateValue);
      const hm = normalizeHm(timeValue);
      return `${ymd} ${hm}`;
    };

    if (!draft.date || !draft.startTime || !draft.endTime) {
      addNotification('error', 'A dátum és az idősáv megadása kötelező.');
      return false;
    }
    const sanitizedDate = normalizeYmd(draft.date);
    const sanitizedStartTime = normalizeHm(draft.startTime);
    const sanitizedEndTime = normalizeHm(draft.endTime);
    let specialRules: any = undefined;
    if (draft.specialRulesText.trim()) {
      try {
        specialRules = JSON.parse(draft.specialRulesText);
      } catch {
        addNotification('error', 'A speciális beállítások formátuma nem érvényes. Kérjük, ellenőrizze.');
        return false;
      }
    }
    const existingFinalDay = gameDays.find((day) => isFinalDay(day.specialRulesJson));
    if (existingFinalDay) {
      if (specialRules?.isFinalDay === true) {
        addNotification('error', 'Már létezik utolsó játéknap. Egyszerre csak egy lehet.');
        return false;
      }
      const finalYmd = normalizeYmd(existingFinalDay.date);
      const draftYmd = sanitizedDate;
      if (finalYmd && draftYmd && draftYmd > finalYmd) {
        addNotification('error', 'Az utolsó játéknap után nem lehet új napot felvenni.');
        return false;
      }
    }
    if (specialRules?.isFinalDay === true) {
      const latestExisting = gameDays.reduce((acc, day) => {
        const stamp = buildStamp(day.date, day.startTime);
        return !acc || stamp > acc ? stamp : acc;
      }, '');
      const draftStamp = buildStamp(sanitizedDate, sanitizedStartTime);
      if (latestExisting && draftStamp < latestExisting) {
        addNotification('error', 'Az utolsó játéknap csak a ténylegesen legutolsó ütemezett nap lehet.');
        return false;
      }
    }
    const response = await fetch(apiUrl('/api/game-days'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        date: sanitizedDate,
        startTime: sanitizedStartTime,
        endTime: sanitizedEndTime,
        ...(specialRules ? { specialRules } : {}),
      }),
    });
    if (response.ok) {
      addNotification('success', 'A játéknap sikeresen felvétele megtörtént.');
      fetchGameDays();
      return true;
    }
    try {
      const err = await response.json();
      addNotification('error', err?.message || 'A játéknap mentése sikertelen volt.');
    } catch {
      addNotification('error', 'A játéknap mentése sikertelen volt.');
    }
    return false;
  };

  const updateGameDay = async (
    id: number,
    payload: { date: string; startTime: string; endTime: string; specialRulesText: string },
  ) => {
    const isFinalDay = (raw: unknown): boolean => {
      if (!raw) return false;
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          return parsed?.isFinalDay === true;
        } catch {
          return false;
        }
      }
      if (typeof raw === 'object') {
        return (raw as any)?.isFinalDay === true;
      }
      return false;
    };
    const buildStamp = (dateValue?: string, timeValue?: string): string => {
      const ymd = normalizeYmd(dateValue);
      const hm = normalizeHm(timeValue);
      return `${ymd} ${hm}`;
    };
    const sanitizedDate = normalizeYmd(payload.date);
    const sanitizedStartTime = normalizeHm(payload.startTime);
    const sanitizedEndTime = normalizeHm(payload.endTime);

    let specialRules: any = {};
    if (payload.specialRulesText.trim()) {
      try {
        specialRules = JSON.parse(payload.specialRulesText);
      } catch {
        addNotification('error', 'A speciális beállítások formátuma nem érvényes. Kérjük, ellenőrizze.');
        return false;
      }
    }
    const otherFinalDay = gameDays.find((day) => day.id !== id && isFinalDay(day.specialRulesJson));
    if (otherFinalDay && specialRules?.isFinalDay === true) {
      addNotification('error', 'Már létezik utolsó játéknap. Egyszerre csak egy lehet.');
      return false;
    }
    if (otherFinalDay) {
      const finalYmd = normalizeYmd(otherFinalDay.date);
      const payloadYmd = normalizeYmd(payload.date);
      if (finalYmd && payloadYmd && payloadYmd > finalYmd) {
        addNotification('error', 'Az utolsó játéknap után nem lehet napot ütemezni.');
        return false;
      }
    }
    if (specialRules?.isFinalDay === true) {
      const latestOtherStamp = gameDays
        .filter((day) => day.id !== id)
        .reduce((acc, day) => {
          const stamp = buildStamp(day.date, day.startTime);
          return !acc || stamp > acc ? stamp : acc;
        }, '');
      const payloadStamp = buildStamp(sanitizedDate, sanitizedStartTime);
      if (latestOtherStamp && payloadStamp < latestOtherStamp) {
        addNotification('error', 'Az utolsó játéknap csak a ténylegesen legutolsó ütemezett nap lehet.');
        return false;
      }
    }
    const response = await fetch(apiUrl(`/api/game-days/${id}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        date: sanitizedDate,
        startTime: sanitizedStartTime,
        endTime: sanitizedEndTime,
        specialRules,
      }),
    });
    if (response.ok) {
      addNotification('success', 'A játéknap módosítása elmentve.');
      fetchGameDays();
      return true;
    }
    try {
      const err = await response.json();
      addNotification('error', err?.message || 'A játéknap mentése sikertelen volt.');
    } catch {
      addNotification('error', 'A játéknap mentése sikertelen volt.');
    }
    return false;
  };

  const deleteGameDay = async (id: number) => {
    const response = await fetch(apiUrl(`/api/game-days/${id}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (response.ok) {
      addNotification('success', 'A játéknap törlése megtörtént.');
      fetchGameDays();
      return true;
    }
    addNotification('error', 'A játéknap törlése sikertelen volt.');
    return false;
  };

  const createPair = async () => {
    if (!newPair.assignedNumber) {
      addNotification('error', 'Adja meg a számot!');
      return;
    }
    const res = await fetch(apiUrl('/api/pairs'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(newPair),
    });
    const data = await res.json();
    if (data.success) {
      fetchPairs();
      setNewPair({ assignedNumber: 1, name: '' });
      addNotification('success', 'Pár létrehozva');
    } else {
      const errorMessage = data.message === 'Pair with this number already exists'
        ? 'Ezzel a számmal már létezik pár'
        : (data.message || 'Hiba a pár létrehozásakor');
      addNotification('error', errorMessage);
    }
  };

  const deletePair = async (id: number) => {
    setConfirmation({
      isOpen: true,
      title: 'Pár törlése',
      message: 'Biztosan törli a kiválasztott párt? A művelet nem vonható vissza.',
      isDangerous: true,
      confirmLabel: 'Törlés',
      action: async () => {
        await fetch(apiUrl(`/api/pairs/${id}`), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        fetchPairs();
        addNotification('success', 'Pár törölve');
        setConfirmation(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleEditPairName = async (pair: Partial<Pair>) => {
    // If name is not provided in the object, we don't do anything (or could throw error)
    // The UI handles the input now.
    const name = pair.name;
    if (name === undefined || name === null) return;

    await fetch(apiUrl(`/api/pairs/${pair.id}/name`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ name: name.trim() || null }),
    });
    fetchPairs();
  };

  const handleMw = async (pairId: number) => {
    const pair = pairs.find((p) => p.id === pairId);
    const wasMw = !!pair?.mostWanted;
    const fallbackErr = wasMw
      ? 'A Most Wanted státusz nem távolítható el.'
      : 'A Most Wanted státusz nem állítható be.';
    try {
      const res = wasMw
        ? await fetch(apiUrl(`/api/mw/${pairId}`), {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          })
        : await fetch(apiUrl('/api/mw'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({ pairId }),
          });

      if (res.ok) {
        await fetchPairs();
        addNotification(
          'success',
          wasMw ? 'Most Wanted státusz eltávolítva.' : 'Most Wanted státusz beállítva.',
        );
        return;
      }

      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      addNotification('error', extractApiErrorMessage(body, fallbackErr));
    } catch {
      addNotification('error', 'Hálózati hiba történt. Kérjük, próbálja újra.');
    }
  };

  // Direct capture for PairDetails modal (which has its own confirmation)
  const handleCaptureDirect = async (pairId: number) => {
    try {
      const p = pairs.find((x) => x.id === pairId);
      const pos = p?.distancePosition ?? p?.lastPosition;
      if (!browserLocation) {
        addNotification(
          'error',
          'Az elfogás nem rögzíthető: a saját pozíció nem áll rendelkezésre. Kérjük, ellenőrizze a helymeghatározási jogosultságot, majd próbálja újra.',
        );
        return;
      }
      if (!pos || pos.lat == null || pos.lon == null) {
        addNotification('error', 'Az elfogás nem rögzíthető: a célpár aktuális pozíciója nem érhető el.');
        return;
      }
      const distanceM = calculateDistance(browserLocation.lat, browserLocation.lon, pos.lat, pos.lon);
      const formatDistance = (d: number): string =>
        d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
      if (!Number.isFinite(distanceM) || distanceM > CAPTURE_MAX_DISTANCE_METERS) {
        addNotification(
          'error',
          `Az elfogás nem rögzíthető: a célpár távolsága ${formatDistance(distanceM)}. Az engedélyezett maximális távolság ${formatDistance(CAPTURE_MAX_DISTANCE_METERS)}.`,
        );
        return;
      }
      const requestId = `capture-${pairId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const response = await fetch(apiUrl('/api/capture'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          pairId,
          requestId,
          clientTimestamp: new Date().toISOString(),
          ...(pos?.lat != null && pos?.lon != null ? { pairLat: pos.lat, pairLon: pos.lon } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Hiba az elfogás során');
      }

      fetchPairs();
      addNotification('success', 'Elfogás rögzítve.');
    } catch (error) {
      console.error('Capture error:', error);
      addNotification('error', error instanceof Error ? error.message : 'Hiba történt az elfogás során');
    }
  };

  const handleCapture = async (pairId: number) => {
    const pair = pairs.find((p) => p.id === pairId);
    setConfirmation({
      isOpen: true,
      title: 'Pár elfogása',
      message: `Biztosan elfogottnak jelöli a(z) ${pair?.assignedNumber ?? '?'}. számú párt?`,
      isDangerous: true,
      confirmLabel: 'Elfogás',
      action: async () => {
        await handleCaptureDirect(pairId);
        setConfirmation(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleCaptureRevert = async (pairId: number) => {
    setConfirmation({
      isOpen: true,
      title: 'Elfogás visszavonása',
      message: 'Biztosan visszavonja a kiválasztott pár elfogását?',
      isDangerous: true,
      confirmLabel: 'Visszavonás',
      action: async () => {
        try {
          const response = await fetch(apiUrl(`/api/capture/${pairId}`), {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          });
          const data = await response.json();
          if (!response.ok || !data?.success) {
            throw new Error(data?.message || 'Hiba az elfogás visszavonása során');
          }
          fetchPairs();
          addNotification('success', 'Elfogás visszavonva.');
        } catch (error) {
          addNotification(
            'error',
            error instanceof Error ? error.message : 'Hiba történt az elfogás visszavonása során',
          );
        }
        setConfirmation((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleForceLogout = async (deviceId: string) => {
    setConfirmation({
      isOpen: true,
      title: 'Kényszerített kijelentkeztetés',
      message: 'Biztosan kijelentkezteti a kiválasztott eszközt? A munkamenet azonnal megszakad.',
      isDangerous: true,
      confirmLabel: 'Kijelentkeztetés',
      action: async () => {
        try {
          // Must use the string deviceId (IMEI) for the force-logout endpoint
          const res = await fetch(apiUrl(`/api/devices/force-logout/${encodeURIComponent(deviceId)}`), {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          });

          if (res.ok) {
            fetchDevices();
            fetchActiveDevices();
            addNotification('success', 'Eszköz kijelentkeztetve');
          } else {
            addNotification('error', 'Hiba történt a kijelentkeztetéskor');
          }
        } catch (e) {
          addNotification('error', 'Hálózati hiba');
        }
        setConfirmation(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteDevice = async (deviceId: number) => {
    setConfirmation({
      isOpen: true,
      title: 'Eszköz törlése',
      message: 'Biztosan törli a kiválasztott eszközt? A művelet nem vonható vissza.',
      isDangerous: true,
      confirmLabel: 'Törlés',
      action: async () => {
        try {
          const res = await fetch(apiUrl(`/api/devices/${deviceId}`), {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          });
          if (res.ok) {
            fetchDevices();
            fetchActiveDevices();
            addNotification('success', 'Eszköz törölve');
          } else {
            addNotification('error', 'Hiba a törléskor');
          }
        } catch (e) {
          addNotification('error', 'Hiba történt a törléskor');
        }
        setConfirmation(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const createUser = async () => {
    if (!newUser.username || !newUser.password) {
      addNotification('error', 'Felhasználónév és jelszó kötelező!');
      return false;
    }
    if (newUser.password.length < 6) {
      addNotification('error', 'A jelszónak legalább 6 karakternek kell lennie!');
      return false;
    }

    const payload = {
      ...newUser,
      email: newUser.email === '' ? undefined : newUser.email
    };

    try {
      const res = await fetch(apiUrl('/api/users'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        fetchUsers();
        setNewUser({ username: '', email: '', password: '', role: 'officer', active: true });
        addNotification('success', 'Felhasználó sikeresen létrehozva');
        return true;
      } else {
        const err = await res.json();
        addNotification('error', `Hiba: ${err.message || 'Ismeretlen hiba'}`);
        return false;
      }
    } catch (error) {
      addNotification('error', 'Hálózati hiba történt');
      return false;
    }
  };

  const deleteUser = (id: number, username: string) => {
    setConfirmation({
      isOpen: true,
      title: 'Felhasználó törlése',
      message: `Biztosan törli a felhasználót (${username})? A művelet nem vonható vissza.`,
      isDangerous: true,
      confirmLabel: 'Törlés',
      action: async () => {
        try {
          const res = await fetch(apiUrl(`/api/users/${id}`), {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          });
          if (res.ok) {
            fetchUsers();
            addNotification('success', 'Felhasználó törölve');
          } else {
            addNotification('error', 'Hiba történt a törléskor');
          }
        } catch (error) {
          addNotification('error', 'Hálózati hiba történt');
        }
        setConfirmation(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserForm({
      username: user.username,
      email: user.email || '',
      role: user.role,
      active: user.active,
      password: ''
    });
    setShowUserModal(true);
  };

  const submitUserEdit = async () => {
    if (!editingUser) return;
    const updateData: any = {
      username: editUserForm.username,
      email: editUserForm.email || null,
      role: editUserForm.role,
      active: editUserForm.active
    };
    if (editUserForm.password) {
      if (editUserForm.password.length < 6) {
        addNotification('error', 'A jelszónak legalább 6 karakternek kell lennie!');
        return;
      }
      updateData.password = editUserForm.password;
    }

    try {
      const res = await fetch(apiUrl(`/api/users/${editingUser.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        setShowUserModal(false);
        fetchUsers();
        addNotification('success', 'Felhasználó sikeresen frissítve');
      } else {
        const err = await res.json();
        addNotification('error', `Hiba: ${err.message || 'Ismeretlen hiba'}`);
      }
    } catch (error) {
      addNotification('error', 'Hálózati hiba történt');
    }
  };


  const createGeofence = async () => {
    if (!newGeofence.name) {
      addNotification('error', 'Név kötelező!');
      return;
    }
    const res = await fetch(apiUrl('/api/geofence'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(newGeofence),
    });
    if (res.ok) {
      fetchGeofences();
      setNewGeofence({ ...newGeofence, name: '' });
      addNotification('success', 'Zóna létrehozva.');
    }
  };

  const handleToggleGeofence = async (id: number, active: boolean) => {
    await fetch(apiUrl(`/api/geofence/${id}/${active ? 'activate' : 'deactivate'}`), {
      method: 'PUT',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    fetchGeofences();
  };

  const handleDeleteGeofence = async (id: number, name: string) => {
    setConfirmation({
      isOpen: true,
      title: 'Geofence törlése',
      message: `Biztosan törli a zónát (${name})? A művelet nem vonható vissza.`,
      isDangerous: true,
      confirmLabel: 'Törlés',
      action: async () => {
        await fetch(apiUrl(`/api/geofence/${id}`), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        fetchGeofences();
        addNotification('success', 'Zóna törölve');
        setConfirmation(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleActivateHungary = async () => {
    try {
      const res = await fetch(apiUrl('/api/game-area'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ activeCounties: [], activeRegions: [] }),
      });
      if (res.ok) {
        fetchGeofences();
        addNotification('success', 'Magyarország aktiválva');
      } else {
        addNotification('error', 'Hiba történt');
      }
    } catch (error) {
      addNotification('error', 'Hálózati hiba');
    }
  };

  const handleToggleHungary = async (active: boolean) => {
    // Find Hungary geofence
    const hungaryGeofence = geofences.find(g => g.name === 'Magyarország' && g.geofenceType === 'game_area');
    if (hungaryGeofence) {
      await handleToggleGeofence(hungaryGeofence.id, active);
      if (!active) {
        addNotification('info', 'Magyarország deaktiválva');
      }
    }
  };

  const handleSendMessage = async (pairId: number | null, title: string, body: string) => {
    try {
      const res = await fetch(apiUrl('/api/messages/send'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...(pairId != null ? { pairId } : {}),
          title,
          body,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addNotification('success', 'Üzenet sikeresen elküldve');
      } else {
        addNotification('error', data.message || 'Hiba történt az üzenet küldésekor');
      }
    } catch (error) {
      addNotification('error', 'Hálózati hiba történt az üzenet küldésekor');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const headerActions = activeTab === 'pairs' ? (
    <>
      <button
        onClick={() => {
          setSelectedMessagePair(null);
          setShowMessageModal(true);
        }}
        className="flex-none px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
      >
        <FiMail className="w-5 h-5" />
        Üzenet mindenkinek
      </button>
      <button
        onClick={() => setShowCreatePairModal(true)}
        className="flex-none px-6 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-xl font-bold shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2"
      >
        <FiPlus className="w-5 h-5" />
        Új pár
      </button>
    </>
  ) : null;

  // Render Content based on active Tab
  const renderContent = (_sidebarOpen: boolean = true) => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardHome
            gameSettings={gameSettings}
            gameDays={gameDays}
            activePairsCount={pairs.filter(p => p.active && !p.captured).length}
            activeDevicesCount={activeDevices.length}
            activeGeofencesCount={geofences.filter(g => g.active).length}
            onGoToGameControl={() => setActiveTab('game_control')}
            onGoToPairs={() => setActiveTab('pairs')}
            onGoToDevices={() => setActiveTab('devices')}
            onGoToGeofences={() => setActiveTab('geofences')}
          />
        );
      case 'game_control':
        return (
          <GameControl
            gameSettings={gameSettings}
            startTimer={startTimer}
            stopTimer={stopTimer}
            gameDays={gameDays}
            createGameDay={createGameDay}
            updateGameDay={updateGameDay}
            deleteGameDay={deleteGameDay}
            intervalInputValue={intervalInputValue}
            isEditingInterval={isEditingInterval}
            setIntervalInputValue={setIntervalInputValue}
            setIsEditingInterval={setIsEditingInterval}
            updateInterval={updateInterval}
            stayRadiusInput={stayRadiusInput}
            setStayRadiusInput={setStayRadiusInput}
            isEditingStay={isEditingStay}
            setIsEditingStay={setIsEditingStay}
            updateStaySettings={updateStaySettings}
          />
        );
      case 'pairs':
        return (
          <PairsManagement
            pairs={pairs}
            newPair={newPair}
            setNewPair={setNewPair}
            createPair={createPair}
            deletePair={deletePair}
            handleEditPairName={handleEditPairName}
            handleSendMessage={(pair) => {
              setSelectedMessagePair(pair);
              setShowMessageModal(true);
            }}
            handleMw={handleMw}
            handleCapture={handleCapture}
            handleCaptureRevert={handleCaptureRevert}
            showCreateModal={showCreatePairModal}
            setShowCreateModal={setShowCreatePairModal}
            onPairSelect={setSelectedPair}
            activeGameAreaExitViolations={activeGameAreaExitViolations}
            onOpenViolationDetails={(pairId) => {
              if (violationArchiveClearTimerRef.current) {
                clearTimeout(violationArchiveClearTimerRef.current);
                violationArchiveClearTimerRef.current = null;
              }
              setViolationModalArchive(null);
              setSelectedViolationPairId(pairId);
              setShowViolationDetailsModal(true);
            }}
            onOpenCaptureDetails={(p) => {
              setCaptureDetailsPairId(p.id);
            }}
          />
        );
      case 'devices':
        return (
          <DeviceManagement
            devices={devices}
            activeDevices={activeDevices}
            pairsList={pairs}
            handleForceLogout={handleForceLogout}
            handleDeleteDevice={handleDeleteDevice}
            onPairSelect={setSelectedPair}
            activeGameAreaExitViolations={activeGameAreaExitViolations}
            onOpenViolationDetails={(pairId) => {
              if (violationArchiveClearTimerRef.current) {
                clearTimeout(violationArchiveClearTimerRef.current);
                violationArchiveClearTimerRef.current = null;
              }
              setViolationModalArchive(null);
              setSelectedViolationPairId(pairId);
              setShowViolationDetailsModal(true);
            }}
          />
        );
      case 'positions':
        return (
          <PositionsHistory
            pairs={pairs}
            onSelectPairById={(pairId) => {
              const p = pairs.find((x) => x.id === pairId);
              if (p) setSelectedPair(p);
              else addNotification('info', 'Ez a pár nem szerepel a jelenlegi párok listájában.');
            }}
          />
        );
      case 'rule_violations':
        return (
          <RuleViolationsManagement
            pairs={pairs}
            onOpenGameAreaDetails={(row: AdminRuleViolationRow) => {
              if (violationArchiveClearTimerRef.current) {
                clearTimeout(violationArchiveClearTimerRef.current);
                violationArchiveClearTimerRef.current = null;
              }
              setViolationModalArchive(row);
              setSelectedViolationPairId(row.pairId);
              setShowViolationDetailsModal(true);
            }}
            onSelectPairById={(pairId) => {
              const p = pairs.find((x) => x.id === pairId);
              if (p) setSelectedPair(p);
              else addNotification('info', 'Ez a pár nem szerepel a jelenlegi párok listájában.');
            }}
            onActiveViolationsNeedRefresh={refreshActiveGameAreaViolations}
          />
        );
      case 'users':
        return (
          <UserManagement
            users={users}
            newUser={newUser}
            setNewUser={setNewUser}
            createUser={createUser}
            deleteUser={deleteUser}
            handleEditUser={handleEditUser}
          />
        );
      case 'audit_logs':
        return (
          <AuditLogsManagement
            users={users.map((u) => ({ id: u.id, username: u.username }))}
          />
        );
      case 'geofences':
        return (
          <GeofenceManager
            geofences={geofences}
            newGeofence={newGeofence}
            setNewGeofence={setNewGeofence}
            createGeofence={createGeofence}
            handleToggleGeofence={handleToggleGeofence}
            handleDeleteGeofence={handleDeleteGeofence}
            mapClickMode={mapClickMode}
            setMapClickMode={setMapClickMode}
            handleMapClick={(lat: number, lon: number) => {
              setNewGeofence({ ...newGeofence, centerLat: lat, centerLon: lon });
              setMapClickMode(false);
            }}
            pairs={pairs}
            onActivateHungary={handleActivateHungary}
            onToggleHungary={handleToggleHungary}
            onPairSelect={setSelectedPair}
            onRefresh={fetchGeofences}
            activeGameAreaExitViolations={activeGameAreaExitViolations}
          />
        );
      default:
        return <div>Válasson egy menüpontot</div>;
    }
  };

  return (
    <AdminLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      loading={loading}
      onLogout={handleLogout}
      headerActions={headerActions}
      showAuditNav={checkAdminRole()}
    >
      {(sidebarOpen: boolean) => {
        const captureModalPair =
          captureDetailsPairId != null ? pairs.find((p) => p.id === captureDetailsPairId) ?? null : null;
        return (
        <>
          {renderContent(sidebarOpen)}

          {/* Pair Details Modal from Map Interaction */}
          <PairDetails
            pair={pairs.find(p => p.id === selectedPair?.id) || selectedPair}
            browserLocation={browserLocation}

            calculateDistance={calculateDistance}
            onClose={() => setSelectedPair(null)}
            onCapture={handleCaptureDirect}
            onMw={handleMw}
            onRename={(id, name) => handleEditPairName({ id, name })}
            hasActiveGameAreaViolation={
              !!(selectedPair && activeGameAreaExitViolations[selectedPair.id])
            }
            onOpenViolationDetails={(pairId) => {
              if (violationArchiveClearTimerRef.current) {
                clearTimeout(violationArchiveClearTimerRef.current);
                violationArchiveClearTimerRef.current = null;
              }
              setViolationModalArchive(null);
              setSelectedViolationPairId(pairId);
              setShowViolationDetailsModal(true);
            }}
            onSendMessage={(id) => {
              setSelectedMessagePair(pairs.find(p => p.id === id) || null);
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

          {/* Global Modals (Rendered last to appear on top of PairDetails) */}
          <SendMessageModal
            isOpen={showMessageModal}
            pairId={selectedMessagePair?.id || null}
            pairAssignedNumber={selectedMessagePair?.assignedNumber}
            pairName={selectedMessagePair?.name}
            onClose={() => setShowMessageModal(false)}
            onSend={handleSendMessage}
          />

          <RuleViolationDetailsModal
            isOpen={showViolationDetailsModal}
            onClose={() => {
              setShowViolationDetailsModal(false);
              if (violationArchiveClearTimerRef.current) {
                clearTimeout(violationArchiveClearTimerRef.current);
              }
              violationArchiveClearTimerRef.current = setTimeout(() => {
                setViolationModalArchive(null);
                violationArchiveClearTimerRef.current = null;
              }, 220);
            }}
            pairId={selectedViolationPairId}
            archiveSnapshot={
              violationModalArchive
                ? {
                    violationId: violationModalArchive.id,
                    violationType: violationModalArchive.violationType,
                    description: violationModalArchive.description,
                    createdAt: violationModalArchive.createdAt,
                    resolved: violationModalArchive.resolved,
                    resolvedAt: violationModalArchive.resolvedAt,
                  }
                : null
            }
            initialAssignedNumber={
              selectedViolationPairId != null
                ? violationModalArchive?.assignedNumber ??
                  activeGameAreaViolationDetails[selectedViolationPairId]?.assignedNumber ??
                  pairs.find((p) => p.id === selectedViolationPairId)?.assignedNumber ??
                  null
                : null
            }
            initialPairName={
              selectedViolationPairId != null
                ? violationModalArchive?.pairName ??
                  activeGameAreaViolationDetails[selectedViolationPairId]?.pairName ??
                  pairs.find((p) => p.id === selectedViolationPairId)?.name ??
                  null
                : null
            }
            initialStartedAt={
              selectedViolationPairId != null
                ? violationModalArchive?.createdAt ??
                  activeGameAreaViolationDetails[selectedViolationPairId]?.createdAt ??
                  null
                : null
            }
            initialLiveViolationType={
              selectedViolationPairId != null
                ? activeGameAreaViolationDetails[selectedViolationPairId]?.violationType ?? 'game_area_exit'
                : null
            }
          />

          {/* User Edit Modal */}
          <Modal
            isOpen={showUserModal}
            onClose={() => setShowUserModal(false)}
            title={
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <FiEdit className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {editingUser?.username}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500 font-normal">
                    <span>
                      Létrehozva:{' '}
                      {editingUser ? formatDateTimeBudapestParts(editingUser.createdAt)?.date ?? '—' : '—'}
                    </span>
                    {editingUser?.updatedAt && (
                      <>
                        <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                        <span>
                          Módosítva: {formatDateTimeBudapestParts(editingUser.updatedAt)?.date ?? '—'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            }
          >

            <div className="p-6 space-y-6">
              {/* Alapadatok */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2">Alapadatok</h4>
                <div>
                  <label className="block text-gray-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Felhasználónév</label>
                  <input
                    type="text"
                    value={editUserForm.username}
                    onChange={(e) => setEditUserForm({ ...editUserForm, username: e.target.value })}
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 focus:bg-white/5 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Email cím</label>
                  <input
                    type="email"
                    value={editUserForm.email}
                    onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 focus:bg-white/5 transition-all"
                    placeholder="Nem kötelező"
                  />
                </div>
              </div>

              {/* Biztonság */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2">Biztonság</h4>
                <div>
                  <label className="block text-gray-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Jelszó</label>
                  <input
                    type="password"
                    value={editUserForm.password}
                    onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 focus:bg-white/5 transition-all text-sm font-mono tracking-widest"
                    placeholder="••••••••"
                  />
                  <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mt-1.5 ml-1">
                    Hagyja üresen, ha nem változtat
                  </p>
                </div>
              </div>

              {/* Beállítások */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2">Beállítások</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Szerepkör</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setEditUserForm({ ...editUserForm, role: 'officer' })}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${editUserForm.role === 'officer'
                          ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                          : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'
                          }`}
                      >
                        <FiUser className="w-6 h-6" />
                        <span className="font-bold text-sm">Officer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditUserForm({ ...editUserForm, role: 'admin' })}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${editUserForm.role === 'admin'
                          ? 'bg-orange-500/20 border-orange-500 text-orange-500'
                          : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'
                          }`}
                      >
                        <FiShield className="w-6 h-6" />
                        <span className="font-bold text-sm">Admin</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Státusz</label>
                    <div className="flex items-center h-[74px] px-4 bg-black/20 border border-white/10 rounded-xl justify-center">
                      <button
                        onClick={() => setEditUserForm({ ...editUserForm, active: !editUserForm.active })}
                        className={`relative w-14 h-8 rounded-full transition-colors duration-200 focus:outline-none ${editUserForm.active ? 'bg-green-500' : 'bg-red-500'
                          }`}
                      >
                        <span
                          className={`absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 shadow-md ${editUserForm.active ? 'translate-x-6' : 'translate-x-0'
                            }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-black/20 flex gap-3">
              <button
                onClick={() => setShowUserModal(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold transition-all"
              >
                Mégse
              </button>
              <button
                onClick={submitUserEdit}
                className="flex-1 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-xl font-bold shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2"
              >
                <FiCheckCircle className="w-5 h-5" />
                Mentés
              </button>
            </div>
          </Modal>


          {/* Generic Confirmation Modal */}
          <ConfirmationModal
            isOpen={confirmation.isOpen}
            title={confirmation.title}
            message={confirmation.message}
            onConfirm={confirmation.action}
            onCancel={() => setConfirmation(prev => ({ ...prev, isOpen: false }))}
            isDangerous={confirmation.isDangerous}
            confirmLabel={confirmation.confirmLabel}
          />

          <CaptureDetailsModal
            pair={captureModalPair}
            isOpen={captureDetailsPairId != null && !!captureModalPair?.captured}
            onClose={() => setCaptureDetailsPairId(null)}
          />
        </>
      );}}
    </AdminLayout>
  );
}
