import { useState, useEffect, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, Polygon, Popup, Marker, LayersControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useSocket } from './hooks/useSocket';
import { usePairs } from './hooks/usePairs';
import { useGameInfo } from './hooks/useGameInfo';
import { Pair } from './types';
import { authService } from './services/auth';
import Login from './pages/Login';
import Admin from './pages/Admin';
import PairDetails from './components/PairDetails';
import SendMessageModal from './components/SendMessageModal';
import { 
  FiSettings, 
  FiSend, 
  FiLogOut, 
  FiWifi, 
  FiWifiOff, 
  FiClock, 
  FiUsers, 
  FiMap,
  FiActivity,
  FiUser,
  FiMapPin,
  FiNavigation,
  FiChevronLeft,
  FiChevronRight
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
  };
}

// Component to handle map resize when sidebar toggles
function MapResizeHandler({ sidebarCollapsed }: { sidebarCollapsed: boolean }) {
  const map = useMap();
  
  useEffect(() => {
    // Store current zoom and center before resize
    const currentZoom = map.getZoom();
    const currentCenter = map.getCenter();
    
    // Multiple attempts to ensure map resizes correctly
    const timers = [
      setTimeout(() => {
        map.invalidateSize();
        map.setZoom(currentZoom);
        map.setView(currentCenter, currentZoom);
      }, 50),
      setTimeout(() => {
        map.invalidateSize();
        map.setZoom(currentZoom);
        map.setView(currentCenter, currentZoom);
      }, 200),
      setTimeout(() => {
        map.invalidateSize();
        map.setZoom(currentZoom);
        map.setView(currentCenter, currentZoom);
      }, 500),
    ];
    
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [sidebarCollapsed, map]);
  
  return null;
}

function MapView() {
  const { pairs, loading, refetch } = usePairs();
  const { socket, connected } = useSocket();
  const gameInfo = useGameInfo();
  const watchIdRef = useRef<number | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  const [forceRender, setForceRender] = useState(0); // Force component re-render every second
  
  // All active pairs (for sidebar display) - sorted by assignedNumber
  const allActivePairs = (pairsState.length > 0 ? pairsState : pairs)
    .filter((p) => p.active === true && p.hasActiveDevice === true)
    .sort((a, b) => (a.assignedNumber || 0) - (b.assignedNumber || 0));

  // Pairs to show on map (only if timer is running)
  // When timer expires, each pair sends ONE position update via positionUpdate WebSocket event
  // This position stays on the map until the next timer cycle expires
  // allowPositionUpdatesForMap only controls when NEW positions can be sent, not when to show existing ones
  const displayPairsOnMap = useMemo(() => {
    if (!gameSettings) return [];
    
    return allActivePairs.filter((p) => {
      if (!p.lastPosition) return false;
      
      // CRITICAL: Only show positions if timer is running
      // The position stays on the map until the next timer cycle expires
      // allowPositionUpdatesForMap only controls when NEW positions can be sent
      if (!gameSettings.isTimerRunning) return false;
      
      // If we have lastPosition and timer is running, show it
      // The position was received via positionUpdate event when allowPositionUpdatesForMap was true
      // But we don't need to check allowPositionUpdatesForMap here - once a position is received, it stays
      return true;
    });
  }, [allActivePairs, gameSettings?.isTimerRunning, forceRender]); // Add forceRender to trigger recalculation when pairsState changes

  useEffect(() => {
    fetchGeofences();
    const interval = setInterval(fetchGeofences, 30000);
    return () => clearInterval(interval);
  }, []);

  // Request browser location
  // CRITICAL: This effect runs every time the component mounts (including when navigating back from admin panel)
  useEffect(() => {
    // First, try to restore location from localStorage (for instant display when navigating back)
    const savedLocation = localStorage.getItem('browserLocation');
    if (savedLocation) {
      try {
        const parsed = JSON.parse(savedLocation);
        if (parsed.lat && parsed.lon) {
          setBrowserLocation({ lat: parsed.lat, lon: parsed.lon });
        }
      } catch (e) {
        console.error('Error parsing saved browser location:', e);
      }
    }

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

      // Helper function to save location to localStorage
      const saveLocation = (lat: number, lon: number) => {
        setBrowserLocation({ lat, lon });
        localStorage.setItem('browserLocation', JSON.stringify({ lat, lon }));
      };

      // Get initial position immediately
      navigator.geolocation.getCurrentPosition(
        (position) => {
          saveLocation(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('Error getting browser location:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
      
      // Watch position for continuous updates
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          saveLocation(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('Error watching browser location:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0, // Always get fresh location
        }
      );
      watchIdRef.current = watchId;
      
      // Also update browser location every second using interval as fallback
      const locationInterval = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            saveLocation(position.coords.latitude, position.coords.longitude);
          },
          (error) => {
            console.error('Error getting browser location:', error);
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          }
        );
      }, 1000); // Update every second
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
  }, []); // Run on mount and cleanup on unmount

  // Force component re-render every second to ensure distance updates are displayed
  // The distance calculation uses distancePosition which is updated via distanceUpdate WebSocket events
  useEffect(() => {
    const interval = setInterval(() => {
      setForceRender((prev) => prev + 1); // Force component re-render
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch game settings and countdown
  useEffect(() => {
    const fetchGameSettings = async () => {
      try {
        // Try to fetch full settings (admin only)
        let response = await fetch('http://localhost:3000/api/game-settings', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        
        // If admin endpoint fails (403), try officer endpoint
        if (!response.ok && response.status === 403) {
          response = await fetch('http://localhost:3000/api/game-settings/countdown', {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          });
        }
        
        if (response.ok) {
          const data = await response.json();
          // Create new object to ensure reference changes, triggering useMemo recalculation
          setGameSettings({
            locationUpdateIntervalMinutes: data.locationUpdateIntervalMinutes || 20,
            isTimerRunning: data.isTimerRunning,
            countdown: data.countdown,
            lastLocationUpdate: data.lastLocationUpdate || null,
            allowPositionUpdatesForMap: data.allowPositionUpdatesForMap,
          });
          setLocationUpdateCountdown(data.countdown);
        }
      } catch (error) {
        console.error('Error fetching game settings:', error);
      }
    };

    fetchGameSettings();
    const interval = setInterval(fetchGameSettings, 1000); // Update every second
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (pairs.length > 0) {
      // Merge pairs from API with pairsState, keeping WebSocket updates
      // CRITICAL: Never overwrite lastPosition from WebSocket with API data
      // lastPosition should ONLY be updated via positionUpdate WebSocket events (when timer allows)
      // distancePosition should ONLY be updated via distanceUpdate WebSocket events (every second)
      setPairsState((prev) => {
        const merged = pairs.map((apiPair) => {
          const existing = prev.find((p) => p.id === apiPair.id);
          if (existing) {
            // Keep WebSocket-updated positions (both lastPosition and distancePosition)
            // Only update other fields from API (name, active, captured, mostWanted, etc.)
            // CRITICAL: Never delete lastPosition - frontend will filter based on allowPositionUpdatesForMap
            // This prevents the flickering issue where positions appear and disappear
            return {
              ...apiPair,
              // CRITICAL: Keep lastPosition from WebSocket (positionUpdate events)
              // Only use API lastPosition if we don't have one from WebSocket
              // Frontend will filter based on allowPositionUpdatesForMap flag
              lastPosition: existing.lastPosition || apiPair.lastPosition,
              // CRITICAL: Keep distancePosition from WebSocket (distanceUpdate events)
              // Distance updates are always allowed (for continuous distance calculation)
              distancePosition: existing.distancePosition,
              // Keep distanceToNearestOfficer from WebSocket
              distanceToNearestOfficer: existing.distanceToNearestOfficer ?? apiPair.distanceToNearestOfficer,
            };
          }
          // New pair from API - use API data (which already filters lastPosition based on timer)
          return apiPair;
        });
        return merged;
      });
    }
  }, [pairs]);

  useEffect(() => {
    if (!socket) return;

    // Handle distance updates - sent continuously (every second) for distance calculation
    // This updates the position for distance calculation but NOT for map display
    const handleDistanceUpdate = (data: any) => {
      setPairsState((prev) =>
        prev.map((pair) => {
          if (pair.id !== data.pairId) return pair;
          
          // Update position for distance calculation (but don't update map position)
          // We need to track both: position for distance (from distanceUpdate) and position for map (from positionUpdate)
          const distancePosition = {
            lat: data.lat,
            lon: data.lon,
            timestamp: data.timestamp,
          };
          
          return {
            ...pair,
            // Store position for distance calculation separately
            distancePosition: distancePosition,
            distanceToNearestOfficer: data.distanceToNearestOfficer || pair.distanceToNearestOfficer,
          };
        }),
      );
    };

    // Handle position updates - only sent when timer allows (for map display)
    // CRITICAL: The backend ONLY sends positionUpdate when:
    // 1. Timer is running (isTimerRunning === true)
    // 2. Position updates are allowed (allowPositionUpdatesForMap === true)
    // 3. This pair hasn't sent a position yet in this cycle
    // So if we receive a positionUpdate, we can trust it's allowed and update it
    const handlePositionUpdate = (data: any) => {
      // CRITICAL: The backend already filters positionUpdate events, so if we receive one, it's allowed
      // We trust the backend and always update the position when we receive a positionUpdate event
      // The backend ensures that only one positionUpdate is sent per pair per cycle
      const positionTimestamp = new Date(data.timestamp).getTime();
      
      console.log('[Frontend] Received positionUpdate for pairId:', data.pairId, 'timestamp:', data.timestamp);
      
      setPairsState((prev) => {
        // Check if pair exists in state, if not, we need to add it
        // This happens when user just logged in and positionUpdate arrives before API data
        const existingPair = prev.find((p) => p.id === data.pairId);
        
        if (!existingPair) {
          // Pair doesn't exist in state yet - create a minimal pair object
          // The API will merge the full data later
          const newPosition = {
            lat: data.lat,
            lon: data.lon,
            timestamp: data.timestamp,
          };
          
          console.log('[Frontend] Adding new pair with position from positionUpdate. pairId:', data.pairId, 'timestamp:', data.timestamp);
          
          // Create minimal pair object - API will fill in the rest
          return [...prev, {
            id: data.pairId,
            assignedNumber: 0, // Will be updated by API
            name: null, // Will be updated by API
            active: true,
            captured: false,
            mostWanted: false,
            hasActiveDevice: true,
            lastPosition: newPosition,
            distanceToNearestOfficer: data.distanceToNearestOfficer,
          }];
        }
        
        // Pair exists in state - update it
        return prev.map((pair) => {
          if (pair.id !== data.pairId) return pair;
          
          // CRITICAL: Always update if we receive a positionUpdate event
          // The backend ensures that only one positionUpdate is sent per pair per cycle
          // We check if the timestamp is different to avoid unnecessary re-renders
          if (pair.lastPosition) {
            const existingTimestamp = new Date(pair.lastPosition.timestamp).getTime();
            // If it's the same timestamp, don't update (avoid unnecessary re-renders)
            if (existingTimestamp === positionTimestamp) {
              console.log('[Frontend] Already have lastPosition with same timestamp, not updating. pairId:', data.pairId, 'timestamp:', data.timestamp);
              return pair;
            }
          }
          
          const newPosition = {
            lat: data.lat,
            lon: data.lon,
            timestamp: data.timestamp,
          };
          
          console.log('[Frontend] Updating lastPosition for pairId:', data.pairId, 'timestamp:', data.timestamp, 'lat:', data.lat, 'lon:', data.lon);
          
          return {
            ...pair,
            lastPosition: newPosition, // Update position for map display (only once per cycle)
            distanceToNearestOfficer: data.distanceToNearestOfficer || pair.distanceToNearestOfficer,
          };
        });
      });
    };

    socket.on('distanceUpdate', handleDistanceUpdate);
    socket.on('positionUpdate', handlePositionUpdate);

    socket.on('capture', (data: any) => {
      setPairsState((prev) =>
        prev.map((pair) =>
          pair.id === data.pairId ? { ...pair, captured: true } : pair,
        ),
      );
      refetch();
    });

    socket.on('mwHighlight', (data: any) => {
      setPairsState((prev) =>
        prev.map((pair) =>
          pair.id === data.pairId ? { ...pair, mostWanted: data.active } : pair,
        ),
      );
      refetch();
    });

    socket.on('gameAreaUpdate', () => {
      fetchGeofences();
    });

    return () => {
      socket.off('distanceUpdate', handleDistanceUpdate);
      socket.off('positionUpdate', handlePositionUpdate);
      socket.off('capture');
      socket.off('mwHighlight');
      socket.off('gameAreaUpdate');
    };
  }, [socket, gameSettings, refetch]); // gameSettings needed for handlePositionUpdate

  const getGeofenceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'game_area': 'Játékterület',
      'scenario': 'Scenarió',
      'crossing_point': 'Átkelési pont',
    };
    return labels[type] || type;
  };

  // Calculate distance between two coordinates using Haversine formula
  // Returns distance in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Return in meters
  };

  // Format distance for display
  const formatDistance = (distanceMeters: number): string => {
    if (distanceMeters < 1000) {
      return `${Math.round(distanceMeters)} m`;
    }
    return `${(distanceMeters / 1000).toFixed(1)} km`;
  };

  const toRad = (degrees: number): number => {
    return (degrees * Math.PI) / 180;
  };

  const fetchGeofences = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/geofence', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      console.log('Fetched geofences:', data);
      setGeofences(data);
    } catch (error) {
      console.error('Error fetching geofences:', error);
    }
  };

  const handleCapture = async (pairId: number) => {
    if (!confirm('Biztosan elfogod ezt a párt?')) return;

    try {
      const response = await fetch('http://localhost:3000/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          pairId,
        }),
      });
      const data = await response.json();
      if (data.success) {
        refetch();
        alert('Pár elfogva!');
      } else {
        alert(data.message || 'Hiba történt');
      }
    } catch (error) {
      console.error('Capture error:', error);
      alert('Hiba történt az elfogás során');
    }
  };

  const handleMw = async (pairId: number) => {
    try {
      const pair = pairsState.find((p) => p.id === pairId);
      const isMw = pair?.mostWanted;

      if (isMw) {
        const response = await fetch(`http://localhost:3000/api/mw/${pairId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (response.ok) {
          refetch();
          alert('MW jelölés eltávolítva!');
        }
      } else {
        const response = await fetch('http://localhost:3000/api/mw', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            pairId,
          }),
        });
        const data = await response.json();
        if (data.success) {
          refetch();
          alert('MW jelölés hozzáadva!');
        }
      }
    } catch (error) {
      console.error('MW error:', error);
      alert('Hiba történt a MW jelölés során');
    }
  };

  const handleAssignName = async (pairId: number) => {
    const currentPair = pairsState.find((p) => p.id === pairId);
    const currentName = currentPair?.name || '';
    const name = prompt('Add meg a pár nevét (hagyd üresen a törléshez):', currentName);
    
    // If user cancels (null), do nothing
    if (name === null) return;

    // If user enters empty string or only whitespace, delete the name
    const nameToSet = name.trim() === '' ? null : name.trim();

    try {
      const response = await fetch(`http://localhost:3000/api/pairs/${pairId}/name`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ name: nameToSet }),
      });
      const data = await response.json();
      if (data.success) {
        refetch();
        if (nameToSet === null) {
          alert('Név törölve!');
        } else {
          alert('Név hozzárendelve!');
        }
      } else {
        alert(data.message || 'Hiba történt');
      }
    } catch (error) {
      console.error('Assign name error:', error);
      alert('Hiba történt a név hozzárendelése során');
    }
  };

  const handleSendMessage = async (pairId: number | null, title: string, body: string) => {
    try {
      const response = await fetch('http://localhost:3000/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          pairId: pairId || undefined,
          title,
          body,
        }),
      });
      const data = await response.json();
      if (data.success) {
        alert(`Üzenet elküldve! (${data.successCount || 0} sikeres, ${data.failureCount || 0} sikertelen)`);
      } else {
        alert(data.message || 'Hiba történt az üzenet küldése során');
      }
    } catch (error) {
      console.error('Send message error:', error);
      alert('Hiba történt az üzenet küldése során');
    }
  };

  const handlePairClick = (pair: Pair) => {
    setSelectedPair(pair);
    setShowPairDetails(true);
  };

  const handleLogout = () => {
    authService.logout();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="text-center">
          <div className="text-4xl font-bold gradient-text mb-3">Betöltés...</div>
          <div className="text-gray-400">Párok adatainak lekérése</div>
          <div className="mt-4 flex justify-center">
            <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  const activeGeofences = geofences.filter((g) => g.active);
  const activePairsCount = allActivePairs.filter((p) => p.active && !p.captured).length;

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Header */}
      <div className="glass-effect text-white shadow-2xl border-b border-orange-500/20">
        <div className="px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <img 
                src={logoImage} 
                alt="Most Wanted - A hajsza" 
                className="h-14 object-contain drop-shadow-lg"
              />
              <div className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg ${
                connected 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' 
                  : 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
              }`}>
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-white animate-pulse' : 'bg-white'}`}></div>
                {connected ? <FiWifi className="w-4 h-4" /> : <FiWifiOff className="w-4 h-4" />}
                <span>{connected ? 'Csatlakozva' : 'Nincs kapcsolat'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-200 font-medium flex items-center gap-2 hover:bg-gray-800/70 transition-colors">
                <FiUser className="w-4 h-4 text-orange-400" />
                <span>Bejelentkezve: {authService.getCurrentUser()?.username}</span>
              </div>
              {authService.getCurrentUser()?.role === 'admin' && (
                <a
                  href="/admin"
                  className="modern-button p-2.5 bg-gradient-to-r from-orange-600 to-orange-500 rounded-lg font-semibold shadow-lg flex items-center justify-center text-white hover:from-orange-500 hover:to-orange-400 hover:shadow-xl hover:scale-105 transition-all"
                  title="Admin Panel"
                >
                  <FiSettings className="w-5 h-5" />
                </a>
              )}
              <button
                onClick={() => {
                  setMessagePairId(null);
                  setShowMessageModal(true);
                }}
                className="modern-button p-2.5 bg-gradient-to-r from-orange-600 to-orange-500 rounded-lg font-semibold shadow-lg flex items-center justify-center text-white hover:from-orange-500 hover:to-orange-400 hover:shadow-xl hover:scale-105 transition-all"
                title="Üzenet küldése"
              >
                <FiSend className="w-5 h-5" />
              </button>
              <button
                onClick={handleLogout}
                className="modern-button p-2.5 bg-gradient-to-r from-red-600 to-red-500 rounded-lg font-semibold shadow-lg flex items-center justify-center text-white hover:from-red-500 hover:to-red-400 hover:shadow-xl hover:scale-105 transition-all"
                title="Kijelentkezés"
              >
                <FiLogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Game Info Bar */}
          <div className="mt-5 grid grid-cols-5 gap-4">
            <div className="glass-card rounded-xl p-4 hover:bg-white/10 hover:shadow-lg transition-all cursor-default">
              <div className="text-gray-400 text-xs mb-2 flex items-center gap-1.5 font-medium uppercase tracking-wide">
                <FiActivity className="w-3.5 h-3.5" />
                <span>Játék állapot</span>
              </div>
              <div className={`text-xl font-bold flex items-center gap-2 ${
                gameInfo.isGameActive 
                  ? 'text-orange-400' 
                  : 'text-red-400'
              }`}>
                <div className={`w-2.5 h-2.5 rounded-full ${
                  gameInfo.isGameActive 
                    ? 'bg-orange-400 pulse-orange' 
                    : 'bg-red-400'
                }`}></div>
                <span>{gameInfo.isGameActive ? 'FOLYAMATBAN' : 'SZÜNETEL'}</span>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4 hover:bg-white/10 hover:shadow-lg transition-all cursor-default">
              <div className="text-gray-400 text-xs mb-2 flex items-center gap-1.5 font-medium uppercase tracking-wide">
                <FiClock className="w-3.5 h-3.5" />
                <span>Idő</span>
              </div>
              <div className="text-xl font-bold text-orange-400">{gameInfo.currentTime}</div>
              {gameInfo.gameStartTime && gameInfo.gameEndTime && (
                <div className="text-xs text-gray-400 mt-1.5">
                  {gameInfo.gameStartTime} - {gameInfo.gameEndTime}
                </div>
              )}
            </div>
            <div className="glass-card rounded-xl p-4 hover:bg-white/10 hover:shadow-lg transition-all cursor-default">
              <div className="text-gray-400 text-xs mb-2 flex items-center gap-1.5 font-medium uppercase tracking-wide">
                <FiUsers className="w-3.5 h-3.5" />
                <span>Aktív párok</span>
              </div>
              <div className="text-xl font-bold text-orange-400">{activePairsCount}</div>
            </div>
            <div className="glass-card rounded-xl p-4 hover:bg-white/10 hover:shadow-lg transition-all cursor-default">
              <div className="text-gray-400 text-xs mb-2 flex items-center gap-1.5 font-medium uppercase tracking-wide">
                <FiMap className="w-3.5 h-3.5" />
                <span>Játékterület</span>
              </div>
              <div className="text-xl font-bold truncate text-orange-400">
                {gameInfo.activeGameArea || 'Nincs beállítva'}
              </div>
            </div>
            <div className="glass-card rounded-xl p-4 hover:bg-white/10 hover:shadow-lg transition-all cursor-default">
              <div className="text-gray-400 text-xs mb-2 flex items-center gap-1.5 font-medium uppercase tracking-wide">
                <FiClock className="w-3.5 h-3.5" />
                <span>Lokációfrissítés</span>
              </div>
              <div className="text-xl font-bold text-orange-400">
                {locationUpdateCountdown ? (
                  `${locationUpdateCountdown.minutes}:${locationUpdateCountdown.seconds.toString().padStart(2, '0')}`
                ) : (
                  gameSettings?.isTimerRunning ? 'Betöltés...' : 'Nincs aktív számláló'
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={[47.4979, 19.0402]}
            zoom={7}
            style={{ height: '100%', width: '100%' }}
          >
            <MapResizeHandler sidebarCollapsed={sidebarCollapsed} />
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Térkép nézet">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Műholdas nézet">
                <TileLayer
                  attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              </LayersControl.BaseLayer>
            </LayersControl>
            
            {/* Sidebar toggle button - positioned below LayersControl */}
            <div className="leaflet-top leaflet-right sidebar-toggle-control">
              <div className="leaflet-control">
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="sidebar-toggle-button"
                  title={sidebarCollapsed ? 'Párok lista megjelenítése' : 'Párok lista elrejtése'}
                >
                  {sidebarCollapsed ? (
                    <FiChevronRight className="w-5 h-5" />
                  ) : (
                    <FiChevronLeft className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
            
            {/* Geofences */}
            {activeGeofences.map((geofence) => {
              if (!geofence.active) return null;

              if (geofence.metadataJson?.polygon && geofence.metadataJson?.type === 'polygon') {
                const polygonCoords = geofence.metadataJson.polygon.map(([lon, lat]) => [lat, lon] as [number, number]);
                return (
                  <Polygon
                    key={geofence.id}
                    positions={polygonCoords}
                    pathOptions={{
                      color: geofence.geofenceType === 'game_area' ? '#2563EB' : geofence.geofenceType === 'scenario' ? '#10B981' : '#F59E0B',
                      fillColor: geofence.geofenceType === 'game_area' ? '#3B82F6' : geofence.geofenceType === 'scenario' ? '#10B981' : '#F59E0B',
                      fillOpacity: geofence.geofenceType === 'game_area' ? 0.2 : 0.3,
                      weight: 3,
                    }}
                  >
                    <Popup>
                      <div>
                        <strong className="text-lg">{geofence.name}</strong>
                        <div className="text-sm text-gray-600 mt-1">{getGeofenceTypeLabel(geofence.geofenceType)}</div>
                        {geofence.metadataJson.countyName && (
                          <div className="text-xs text-gray-500 mt-1">{geofence.metadataJson.countyName}</div>
                        )}
                      </div>
                    </Popup>
                  </Polygon>
                );
              }
              
              // Only show circle if it's NOT a game_area (game_area should always be polygon)
              if (geofence.geofenceType === 'game_area') {
                console.warn(`Game area geofence "${geofence.name}" has no polygon data!`, geofence);
                return null; // Don't show game_area as circle
              }
              
              return (
                <Circle
                  key={geofence.id}
                  center={[geofence.centerLat, geofence.centerLon]}
                  radius={geofence.radiusM}
                  pathOptions={{
                    color: geofence.geofenceType === 'scenario' ? '#10B981' : '#F59E0B',
                    fillColor: geofence.geofenceType === 'scenario' ? '#10B981' : '#F59E0B',
                    fillOpacity: 0.3,
                    weight: 3,
                  }}
                >
                  <Popup>
                    <div>
                      <strong className="text-lg">{geofence.name}</strong>
                      <div className="text-sm text-gray-600 mt-1">{getGeofenceTypeLabel(geofence.geofenceType)}</div>
                      <div className="text-xs text-gray-500 mt-1">{(geofence.radiusM / 1000).toFixed(1)} km</div>
                    </div>
                  </Popup>
                </Circle>
              );
            })}

            {/* Browser location (user's own location) */}
            {browserLocation && (
              <Marker
                key="browser-location"
                position={[browserLocation.lat, browserLocation.lon]}
                icon={L.divIcon({
                  className: 'custom-browser-location-marker',
                  html: `
                    <div style="
                      width: 32px;
                      height: 32px;
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                      background-image: url(${mwOrangeImage});
                      background-size: cover;
                      background-position: center;
                    ">
                    </div>
                  `,
                  iconSize: [32, 32],
                  iconAnchor: [16, 16],
                })}
              >
                <Popup>
                  <div className="text-center min-w-[150px]">
                    <strong className="text-xl flex items-center justify-center gap-2">
                      <FiMapPin className="w-5 h-5" />
                      <span>Saját pozíció</span>
                    </strong>
                    <div className="text-xs text-gray-500 mt-2">
                      {browserLocation.lat.toFixed(6)}, {browserLocation.lon.toFixed(6)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Pairs */}
            {displayPairsOnMap.map((pair) => {
              if (!pair.lastPosition || !pair.active) return null;
              
              // Force re-render by using forceRender in key
              const pairKey = `pair-${pair.id}-${forceRender}`;
              
              // Determine background color and border color based on status
              const getBackgroundColor = () => {
                if (pair.mostWanted) return '#f36f26'; // Orange for Most Wanted (same as border)
                return '#2a2a2a'; // Dark gray/black for others
              };
              
              const getBorderColor = () => {
                return '#f36f26'; // Always use orange border
              };
              
              const backgroundColor = getBackgroundColor();
              const borderColor = getBorderColor();
              
              // Create custom icon with pair number
              // Most Wanted: orange background (#f36f26), others: dark gray/black background
              // Border is always orange and thicker, number is white and larger
              const icon = L.divIcon({
                className: 'custom-pair-marker',
                html: `
                  <div style="
                    background-color: ${backgroundColor};
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 3px solid ${borderColor};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: 18px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                  ">
                    ${pair.assignedNumber}
                  </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
              });
              
              return (
                <Marker
                  key={pairKey}
                  position={[pair.lastPosition.lat, pair.lastPosition.lon]}
                  icon={icon}
                  eventHandlers={{
                    click: () => handlePairClick(pair),
                  }}
                >
                  <Popup>
                    <div className="text-center min-w-[150px]">
                      <strong className="text-xl flex items-center justify-center gap-2">
                        <FiUser className="w-5 h-5" />
                        <span>Pár #{pair.assignedNumber}</span>
                      </strong>
                      {pair.name && <div className="text-sm text-gray-700 mt-1 font-medium">{pair.name}</div>}
                      {pair.mostWanted && (
                        <div className="text-orange-600 font-bold mt-2 text-lg flex items-center justify-center gap-1">
                          <FiNavigation className="w-4 h-4" />
                          <span>MOST WANTED</span>
                        </div>
                      )}
                      {pair.captured && (
                        <div className="text-red-600 font-bold mt-2 text-lg">Elfogva</div>
                      )}
                      {pair.lastPosition && (
                        <div className="text-xs text-gray-500 mt-2 flex items-center justify-center gap-1">
                            <FiClock className="w-3 h-3" />
                            <span>{new Date(pair.lastPosition.timestamp).toLocaleString('hu-HU')}</span>
                          </div>
                        )}
                        {browserLocation && (pair.distancePosition || pair.lastPosition) && (
                          <div className="text-xs text-blue-600 font-semibold mt-1 flex items-center justify-center gap-1" key={`popup-distance-${pair.id}-${forceRender}`}>
                            <FiMapPin className="w-3 h-3" />
                            <span>Légvonalbeli távolság: {formatDistance(
                              calculateDistance(
                                browserLocation.lat,
                                browserLocation.lon,
                                (pair.distancePosition || pair.lastPosition)!.lat,
                                (pair.distancePosition || pair.lastPosition)!.lon
                              )
                            )}</span>
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Sidebar */}
        <div 
          className={`glass-effect border-l border-orange-500/20 overflow-y-auto shadow-2xl transition-all duration-300 ${
            sidebarCollapsed ? 'w-0 opacity-0 -translate-x-full overflow-hidden pointer-events-none' : 'w-96 opacity-100 translate-x-0'
          }`}
          style={{ minWidth: sidebarCollapsed ? '0' : '384px', maxWidth: sidebarCollapsed ? '0' : '384px', flexShrink: 0 }}
        >
          <div className="p-5 border-b border-orange-500/20 sticky top-0 z-10 glass-effect">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <FiUsers className="w-6 h-6 text-orange-400" />
              <span>Párok</span>
            </h2>
            <p className="text-sm text-gray-400 mt-2">
              {activePairsCount} aktív pár
            </p>
          </div>
          <div className="divide-y divide-gray-700/30">
            {allActivePairs.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <FiUsers className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <div className="text-lg mb-2 font-bold text-gray-300">Nincs aktív pár</div>
                <div className="text-sm text-gray-500">A párok csak akkor jelennek meg, ha be vannak jelentkezve a telefonokon.</div>
              </div>
            ) : (
              allActivePairs.map((pair) => {
                // Determine background color and border color based on status (same as map markers)
                const getBackgroundColor = () => {
                  if (pair.mostWanted) return '#f36f26';
                  return '#2a2a2a';
                };
                
                const backgroundColor = getBackgroundColor();
                const borderColor = '#f36f26';
                
                return (
                  <div
                    key={pair.id}
                    className={`p-4 transition-all duration-200 ${
                      selectedPair?.id === pair.id 
                        ? 'bg-orange-500/20 border-l-4 border-orange-500' 
                        : 'hover:bg-gray-800/50 border-l-4 border-transparent'
                    } ${pair.captured && selectedPair?.id !== pair.id ? 'bg-red-500/10 opacity-75' : ''} ${
                      pair.mostWanted && selectedPair?.id !== pair.id ? 'bg-orange-500/10' : ''
                    } ${!pair.active ? 'opacity-50' : ''} cursor-pointer`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => pair.active && handlePairClick(pair)}
                      >
                        <div className="flex items-center gap-3">
                          {/* Circle number badge (same style as map markers) */}
                          <div 
                            className="flex-shrink-0"
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              backgroundColor: backgroundColor,
                              border: `3px solid ${borderColor}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: 'bold',
                              fontSize: '18px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            }}
                          >
                            {pair.assignedNumber}
                          </div>
                          <div className="flex-1 min-w-0 flex items-center">
                            {pair.name ? (
                              <div className="w-full">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="text-base text-white font-semibold">{pair.name}</div>
                                  {pair.mostWanted && (
                                    <span className="px-2.5 py-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs rounded-full font-bold shadow-lg">
                                      MW
                                    </span>
                                  )}
                                  {pair.captured && (
                                    <span className="px-2.5 py-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full font-bold shadow-lg">
                                      Elfogva
                                    </span>
                                  )}
                                  {!pair.active && (
                                    <span className="px-2.5 py-1 bg-gray-600 text-white text-xs rounded-full">
                                      Inaktív
                                    </span>
                                  )}
                                </div>
                                {pair.lastPosition && (
                                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-1.5">
                                    <FiClock className="w-3 h-3" />
                                    {new Date(pair.lastPosition.timestamp).toLocaleString('hu-HU')}
                                  </div>
                                )}
                                {browserLocation && (pair.distancePosition || pair.lastPosition) && (
                                  <div className="text-xs text-orange-400 font-semibold flex items-center gap-1 mt-1" key={`distance-${pair.id}-${forceRender}`}>
                                    <FiMapPin className="w-3 h-3" />
                                    Légvonalbeli távolság: {formatDistance(
                                      calculateDistance(
                                        browserLocation.lat,
                                        browserLocation.lon,
                                        (pair.distancePosition || pair.lastPosition)!.lat,
                                        (pair.distancePosition || pair.lastPosition)!.lon
                                      )
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="w-full flex flex-col justify-center">
                                <div className="flex items-center gap-2 mb-1.5">
                                  {pair.mostWanted && (
                                    <span className="px-2.5 py-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs rounded-full font-bold shadow-lg">
                                      MW
                                    </span>
                                  )}
                                  {pair.captured && (
                                    <span className="px-2.5 py-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full font-bold shadow-lg">
                                      Elfogva
                                    </span>
                                  )}
                                  {!pair.active && (
                                    <span className="px-2.5 py-1 bg-gray-600 text-white text-xs rounded-full">
                                      Inaktív
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-col gap-1">
                                  {pair.lastPosition && (
                                    <div className="text-xs text-gray-500 flex items-center gap-1">
                                      <FiClock className="w-3 h-3" />
                                      {new Date(pair.lastPosition.timestamp).toLocaleString('hu-HU')}
                                    </div>
                                  )}
                                  {browserLocation && (pair.distancePosition || pair.lastPosition) && (
                                    <div className="text-xs text-orange-400 font-semibold flex items-center gap-1 mt-0.5" key={`distance-${pair.id}-${forceRender}`}>
                                      <FiMapPin className="w-3 h-3" />
                                      Légvonalbeli távolság: {formatDistance(
                                        calculateDistance(
                                          browserLocation.lat,
                                          browserLocation.lon,
                                          (pair.distancePosition || pair.lastPosition)!.lat,
                                          (pair.distancePosition || pair.lastPosition)!.lon
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Quick actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!pair.captured) {
                              handleCapture(pair.id);
                            }
                          }}
                          disabled={pair.captured}
                          className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 border border-gray-600 hover:border-orange-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title={pair.captured ? 'Már elfogva' : 'Elfogás'}
                        >
                          <FaHandcuffs className={`w-5 h-5 ${pair.captured ? 'text-gray-500' : 'text-orange-400'}`} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAssignName(pair.id);
                          }}
                          className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 border border-gray-600 hover:border-orange-500/50 transition-all"
                          title="Név szerkesztése"
                        >
                          <HiPencil className="w-5 h-5 text-orange-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {allActivePairs.length > 0 && (
            <div className="border-t border-gray-700/30"></div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showPairDetails && selectedPair && (
        <PairDetails
          pair={selectedPair}
          browserLocation={browserLocation}
          calculateDistance={calculateDistance}
          onClose={() => {
            setShowPairDetails(false);
            setSelectedPair(null);
          }}
          onCapture={handleCapture}
          onMw={handleMw}
          onAssignName={handleAssignName}
          onSendMessage={(pairId) => {
            setMessagePairId(pairId);
            setShowMessageModal(true);
            setShowPairDetails(false);
          }}
        />
      )}

      {showMessageModal && (
        <SendMessageModal
          pairId={messagePairId}
          pairAssignedNumber={messagePairId ? allActivePairs.find((p) => p.id === messagePairId)?.assignedNumber || null : null}
          pairName={messagePairId ? allActivePairs.find((p) => p.id === messagePairId)?.name || null : null}
          pairMostWanted={messagePairId ? allActivePairs.find((p) => p.id === messagePairId)?.mostWanted || false : false}
          onClose={() => {
            setShowMessageModal(false);
            setMessagePairId(null);
            setSelectedPair(null);
          }}
          onSend={handleSendMessage}
        />
      )}
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MapView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
