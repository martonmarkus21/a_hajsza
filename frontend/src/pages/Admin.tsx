import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Polygon, Popup, useMapEvents, Marker, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { 
  FiSettings, 
  FiUsers, 
  FiSmartphone, 
  FiMap, 
  FiPlus, 
  FiTrash2, 
  FiLogOut,
  FiSave,
  FiPlay,
  FiPause,
  FiMapPin,
  FiEdit,
  FiUser,
  FiMail,
  FiShield,
  FiChevronDown,
  FiArrowLeft,
  FiClock
} from 'react-icons/fi';
import mwOrangeImage from '../assets/images/mw_orange.png';
import 'leaflet/dist/leaflet.css';

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

interface Pair {
  id: number;
  assignedNumber: number;
  name: string | null;
  active: boolean;
  lastPosition?: {
    lat: number;
    lon: number;
    timestamp: string;
  } | null;
  captured?: boolean;
  mostWanted?: boolean;
  hasActiveDevice?: boolean;
}

interface Device {
  id: number;
  pairId: number;
  pairNumber: number;
  pairName: string | null;
  imeiOrDeviceId: string;
  lastSeenAt: string | null;
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

export default function Admin() {
  const navigate = useNavigate();
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeDevices, setActiveDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const [availableCounties, setAvailableCounties] = useState<Array<{ code: string; name: string }>>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'officer' as 'admin' | 'officer',
    active: true,
  });
  const [editUser, setEditUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'officer' as 'admin' | 'officer',
    active: true,
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    gameStatus: false,
    gameSettings: false,
    pairs: false,
    devices: false,
    geofences: false,
    gameArea: false,
    users: false,
  });
  const [gameSettings, setGameSettings] = useState<{
    locationUpdateIntervalMinutes: number;
    isTimerRunning: boolean;
    lastLocationUpdate: string | null;
    nextLocationUpdate: string | null;
    countdown: { minutes: number; seconds: number } | null;
    allowPositionUpdatesForMap?: boolean;
  } | null>(null);
  const [intervalInputValue, setIntervalInputValue] = useState<number>(20);
  const [isEditingInterval, setIsEditingInterval] = useState(false);
  const [mapClickMode, setMapClickMode] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [selectedPair, setSelectedPair] = useState<Pair | null>(null);
  const [showPairModal, setShowPairModal] = useState(false);
  const [editingPairName, setEditingPairName] = useState(false);
  const [pairNameEdit, setPairNameEdit] = useState('');
  const [browserLocation, setBrowserLocation] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      fetchPairs();
      fetchDevices();
      fetchActiveDevices();
      fetchGameSettings();
    }, 1000); // Refresh every second to update countdown
    return () => clearInterval(interval);
  }, []);

  // Update intervalInputValue only when gameSettings changes, but not if user is typing
  useEffect(() => {
    if (!isEditingInterval && gameSettings?.locationUpdateIntervalMinutes) {
      setIntervalInputValue(gameSettings.locationUpdateIntervalMinutes);
    }
  }, [gameSettings?.locationUpdateIntervalMinutes, isEditingInterval]);

  // Request browser location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setBrowserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
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
      
      // Watch position for continuous updates (every second)
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setBrowserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
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
      
      // Also update browser location every second using interval as fallback
      const locationInterval = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setBrowserLocation({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            });
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
      
      return () => {
        navigator.geolocation.clearWatch(watchId);
        clearInterval(locationInterval);
      };
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchGeofences(),
        fetchPairs(),
        fetchDevices(),
        fetchActiveDevices(),
        fetchCounties(),
        fetchUsers(),
        fetchGameSettings(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGameSettings = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/game-settings', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setGameSettings(data);
        setIntervalInputValue(data.locationUpdateIntervalMinutes || 20);
      }
    } catch (error) {
      console.error('Error fetching game settings:', error);
    }
  };

  const startTimer = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/game-settings/timer/start', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        await fetchGameSettings();
        alert('✅ Lokációfrissítés számláló elindítva!');
      } else {
        const data = await response.json();
        alert('❌ Hiba: ' + (data.message || 'Ismeretlen hiba'));
      }
    } catch (error) {
      console.error('Error starting timer:', error);
      alert('❌ Hiba történt a számláló indítása során');
    }
  };

  const stopTimer = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/game-settings/timer/stop', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        await fetchGameSettings();
        alert('✅ Lokációfrissítés számláló leállítva!');
      } else {
        const data = await response.json();
        alert('❌ Hiba: ' + (data.message || 'Ismeretlen hiba'));
      }
    } catch (error) {
      console.error('Error stopping timer:', error);
      alert('❌ Hiba történt a számláló leállítása során');
    }
  };

  const updateInterval = async (minutes: number) => {
    try {
      const response = await fetch('http://localhost:3000/api/game-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ locationUpdateIntervalMinutes: minutes }),
      });
      if (response.ok) {
        await fetchGameSettings();
        alert('✅ Intervallum frissítve!');
      } else {
        const data = await response.json();
        alert('❌ Hiba: ' + (data.message || 'Ismeretlen hiba'));
      }
    } catch (error) {
      console.error('Error updating interval:', error);
      alert('❌ Hiba történt az intervallum frissítése során');
    }
  };

  const fetchCounties = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/game-area/counties', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Loaded counties:', data);
        setAvailableCounties(data);
      } else {
        console.error('Failed to fetch counties:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Error fetching counties:', error);
    }
  };

  const fetchGeofences = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/geofence', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setGeofences(data);
      }
    } catch (error) {
      console.error('Error fetching geofences:', error);
    }
  };

  const fetchPairs = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/pairs', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPairs(data.pairs || []);
      }
    } catch (error) {
      console.error('Error fetching pairs:', error);
    }
  };

  const fetchDevices = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/devices', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setDevices(data || []);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const fetchActiveDevices = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/devices/active', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setActiveDevices(data || []);
      }
    } catch (error) {
      console.error('Error fetching active devices:', error);
    }
  };

  const createGeofence = async () => {
    if (!newGeofence.name.trim()) {
      alert('Add meg a geofence nevét!');
      return;
    }
    try {
      const response = await fetch('http://localhost:3000/api/geofence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(newGeofence),
      });
      if (response.ok) {
        await fetchGeofences();
        setNewGeofence({
          name: '',
          centerLat: 47.4979,
          centerLon: 19.0402,
          radiusM: 25000,
          geofenceType: 'scenario',
        });
        alert('✅ Geofence létrehozva!');
      } else {
        alert('❌ Hiba történt a geofence létrehozása során');
      }
    } catch (error) {
      console.error('Error creating geofence:', error);
      alert('❌ Hiba történt a geofence létrehozása során');
    }
  };

  const handleToggleGeofence = async (id: number, activate: boolean) => {
    try {
      const endpoint = activate ? 'activate' : 'deactivate';
      const response = await fetch(`http://localhost:3000/api/geofence/${id}/${endpoint}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        await fetchGeofences();
        alert(activate ? '✅ Geofence aktiválva!' : '✅ Geofence deaktiválva!');
      }
    } catch (error) {
      console.error('Error toggling geofence:', error);
      alert('❌ Hiba történt');
    }
  };

  const handleDeleteGeofence = async (id: number, name: string) => {
    if (!confirm(`⚠️ Biztosan törölni szeretnéd a "${name}" geofence-t?`)) return;

    try {
      const response = await fetch(`http://localhost:3000/api/geofence/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        await fetchGeofences();
        alert('✅ Geofence törölve!');
      } else {
        const errorText = await response.text();
        console.error('Delete geofence error:', response.status, errorText);
        alert(`❌ Hiba történt: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting geofence:', error);
      alert('❌ Hiba történt: ' + (error instanceof Error ? error.message : 'Ismeretlen hiba'));
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/users', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const createUser = async () => {
    if (!newUser.username || !newUser.password) {
      alert('Add meg a felhasználónevet és a jelszót!');
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(newUser),
      });

      if (response.ok) {
        await fetchUsers();
        setNewUser({
          username: '',
          email: '',
          password: '',
          role: 'officer',
          active: true,
        });
        alert('✅ Felhasználó létrehozva!');
      } else {
        const data = await response.json();
        alert('❌ Hiba történt: ' + (data.message || 'Ismeretlen hiba'));
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('❌ Hiba történt a felhasználó létrehozása során');
    }
  };

  const updateUser = async () => {
    if (!editingUser) return;
    if (!editUser.username) {
      alert('Add meg a felhasználónevet!');
      return;
    }

    try {
      const updateData: any = {
        username: editUser.username,
        email: editUser.email || null,
        role: editUser.role,
        active: editUser.active,
      };

      // Only include password if it's provided
      if (editUser.password && editUser.password.trim() !== '') {
        updateData.password = editUser.password;
      }

      const response = await fetch(`http://localhost:3000/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        await fetchUsers();
        setEditingUser(null);
        setShowUserModal(false);
        alert('✅ Felhasználó frissítve!');
      } else {
        const data = await response.json();
        alert('❌ Hiba történt: ' + (data.message || 'Ismeretlen hiba'));
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('❌ Hiba történt a felhasználó frissítése során');
    }
  };

  const deleteUser = async (id: number, username: string) => {
    if (!confirm(`⚠️ Biztosan törölni szeretnéd a "${username}" felhasználót?`)) return;

    try {
      const response = await fetch(`http://localhost:3000/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        await fetchUsers();
        alert('✅ Felhasználó törölve!');
      } else {
        const data = await response.json();
        alert('❌ Hiba történt: ' + (data.message || 'Ismeretlen hiba'));
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('❌ Hiba történt: ' + (error instanceof Error ? error.message : 'Ismeretlen hiba'));
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUser({
      username: user.username,
      email: user.email || '',
      password: '',
      role: user.role,
      active: user.active,
    });
    setShowUserModal(true);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getGeofenceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'game_area': 'Játékterület',
      'scenario': 'Scenarió',
      'crossing_point': 'Átkelési pont',
    };
    return labels[type] || type;
  };

  const handleMapClick = (lat: number, lon: number) => {
    if (mapClickMode) {
      setNewGeofence({
        ...newGeofence,
        centerLat: lat,
        centerLon: lon,
      });
      setMapClickMode(false);
      alert(`✅ Koordináta beállítva: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    }
  };

  // Map click handler component
  function MapClickHandler({ onClick }: { onClick: (lat: number, lon: number) => void }) {
    useMapEvents({
      click: (e) => {
        onClick(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  }

  const handleUpdateGameArea = async () => {
    if (selectedCounties.length === 0) {
      if (!confirm('Nincs megye kiválasztva. Biztosan törölni szeretnéd az összes játékterületet?')) {
        return;
      }
    }
    try {
      console.log('Updating game area with counties:', selectedCounties);
      const response = await fetch('http://localhost:3000/api/game-area', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          activeCounties: selectedCounties,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log('Game area update response:', data);
        // Wait a bit for backend to process
        setTimeout(async () => {
          await fetchGeofences();
          alert('✅ Játékterület frissítve!');
        }, 500);
      } else {
        console.error('Game area update failed:', data);
        alert('❌ Hiba történt a játékterület frissítése során: ' + (data.message || 'Ismeretlen hiba'));
      }
    } catch (error) {
      console.error('Error updating game area:', error);
      alert('❌ Hiba történt: ' + (error instanceof Error ? error.message : 'Ismeretlen hiba'));
    }
  };

  const createPair = async () => {
    if (!newPair.assignedNumber || newPair.assignedNumber < 1) {
      alert('Add meg a pár számát!');
      return;
    }
    try {
      const response = await fetch('http://localhost:3000/api/pairs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(newPair),
      });
      const data = await response.json();
      if (data.success) {
        await fetchPairs();
        setNewPair({ assignedNumber: 1, name: '' });
        alert(`✅ Pár #${data.pair.assignedNumber} létrehozva!`);
      } else {
        alert(data.message || '❌ Hiba történt');
      }
    } catch (error) {
      console.error('Error creating pair:', error);
      alert('❌ Hiba történt a pár létrehozása során');
    }
  };

  const deletePair = async (id: number) => {
    if (!confirm('⚠️ Biztosan törölni szeretnéd ezt a párt?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/pairs/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          await fetchPairs();
          alert('✅ Pár törölve!');
        } else {
          alert('❌ Hiba történt: ' + (data.message || 'Ismeretlen hiba'));
        }
      } else {
        const errorText = await response.text();
        console.error('Delete pair error:', response.status, errorText);
        alert(`❌ Hiba történt: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting pair:', error);
      alert('❌ Hiba történt: ' + (error instanceof Error ? error.message : 'Ismeretlen hiba'));
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="text-center">
          <div className="text-4xl font-bold gradient-text mb-3">Betöltés...</div>
          <div className="text-gray-400">Admin panel adatainak lekérése</div>
          <div className="mt-4 flex justify-center">
            <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="w-96 glass-effect border-r border-orange-500/20 p-5 overflow-y-auto shadow-2xl" style={{ zIndex: 1 }}>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-3xl font-bold text-white flex items-center gap-2">
              <FiSettings className="w-8 h-8 text-orange-400" />
              <span>Admin Panel</span>
            </h2>
            <button
              onClick={() => navigate('/')}
              className="modern-button px-3 py-2 bg-gradient-to-r from-gray-700 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-500 font-semibold flex items-center gap-2 text-sm shadow-lg"
              title="Vissza a fő oldalra"
            >
              <FiArrowLeft className="w-4 h-4" />
              <span>Vissza</span>
            </button>
          </div>
          <div className="text-sm text-gray-600">Most Wanted - A hajsza</div>
        </div>

        {/* Game Status */}
        <div className="mb-4 glass-card rounded-xl border border-orange-500/20">
          <button
            onClick={() => toggleSection('gameStatus')}
            className="w-full p-4 flex items-center justify-between font-bold text-white transition-colors rounded-xl"
          >
            <div className="flex items-center gap-3">
              <FiUsers className="w-5 h-5 text-orange-400" />
              <span>Játék állapot</span>
            </div>
            <div className={`transition-transform duration-300 ${expandedSections.gameStatus ? 'rotate-180' : ''}`}>
              <FiChevronDown className="w-5 h-5 text-gray-400" />
            </div>
          </button>
          <div 
            className={`grid transition-all duration-300 ease-in-out ${
              expandedSections.gameStatus ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="text-sm space-y-2 mt-3 px-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Aktív párok:</span>
                  <span className="font-bold text-orange-400">{activeDevices.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Összes pár:</span>
                  <span className="font-bold text-white">{pairs.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Bejelentkezett eszközök:</span>
                  <span className="font-bold text-green-400">{devices.filter(d => d.active).length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Game Settings */}
        <div className="mb-4 glass-card rounded-xl border border-orange-500/20">
          <button
            onClick={() => toggleSection('gameSettings')}
            className="w-full p-4 flex items-center justify-between font-bold text-white transition-colors rounded-xl"
          >
            <div className="flex items-center gap-3">
              <FiClock className="w-5 h-5 text-orange-400" />
              <span>Játék beállítások</span>
            </div>
            <div className={`transition-transform duration-300 ${expandedSections.gameSettings ? 'rotate-180' : ''}`}>
              <FiChevronDown className="w-5 h-5 text-gray-400" />
            </div>
          </button>
          <div 
            className={`grid transition-all duration-300 ease-in-out ${
              expandedSections.gameSettings ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="mt-3 space-y-3">
                {/* Timer Status */}
                <div className="p-4 glass-card rounded-xl">
                  <div className="text-xs font-semibold mb-3 text-gray-400 uppercase tracking-wide">Lokációfrissítés számláló</div>
                  {gameSettings?.isTimerRunning ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 pulse-orange"></span>
                        <span className="text-green-400 font-bold">Fut</span>
                      </div>
                      {gameSettings.countdown && (
                        <div className="text-2xl font-bold text-orange-400">
                          {gameSettings.countdown.minutes}:{gameSettings.countdown.seconds.toString().padStart(2, '0')}
                        </div>
                      )}
                      {gameSettings.nextLocationUpdate && (
                        <div className="text-xs text-gray-400">
                          Következő frissítés: {new Date(gameSettings.nextLocationUpdate).toLocaleString('hu-HU')}
                        </div>
                      )}
                      <button
                        onClick={stopTimer}
                        className="modern-button w-full px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-500 hover:to-red-600 font-semibold flex items-center justify-center gap-2 text-sm shadow-lg"
                      >
                        <FiPause className="w-4 h-4" />
                        <span>Leállítás</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-2.5 h-2.5 rounded-full bg-gray-500"></span>
                        <span className="text-gray-400">Leállítva</span>
                      </div>
                      <button
                        onClick={startTimer}
                        className="modern-button w-full px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-500 hover:to-emerald-500 font-semibold flex items-center justify-center gap-2 text-sm shadow-lg"
                      >
                        <FiPlay className="w-4 h-4" />
                        <span>Indítás</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Interval Settings */}
                <div className="p-4 glass-card rounded-xl">
                  <div className="text-xs font-semibold mb-3 text-gray-400 uppercase tracking-wide">Frissítési intervallum</div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={intervalInputValue}
                      onFocus={() => setIsEditingInterval(true)}
                      onBlur={() => setIsEditingInterval(false)}
                      onChange={(e) => {
                        const minutes = parseInt(e.target.value);
                        if (minutes >= 1 && minutes <= 60) {
                          setIntervalInputValue(minutes);
                        }
                      }}
                      className="flex-1 px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                      placeholder="Perc"
                    />
                    <span className="flex items-center text-sm text-gray-400">perc</span>
                    <button
                      onClick={() => updateInterval(intervalInputValue)}
                      className="modern-button px-4 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg hover:from-orange-500 hover:to-orange-600 font-semibold flex items-center justify-center gap-1 text-sm shadow-lg"
                      title="Mentés"
                    >
                      <FiSave className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    Jelenlegi érték: <span className="text-orange-400 font-semibold">{gameSettings?.locationUpdateIntervalMinutes || 20}</span> perc
                  </div>
                </div>

                {/* Last Update */}
                {gameSettings?.lastLocationUpdate && (
                  <div className="p-4 glass-card rounded-xl">
                    <div className="text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">Utolsó frissítés</div>
                    <div className="text-sm text-gray-300">
                      {new Date(gameSettings.lastLocationUpdate).toLocaleString('hu-HU')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pairs Management */}
        <div className="mb-4 glass-card rounded-xl border border-orange-500/20">
          <button
            onClick={() => toggleSection('pairs')}
            className="w-full p-4 flex items-center justify-between font-bold text-white transition-colors rounded-xl"
          >
            <div className="flex items-center gap-3">
              <FiUsers className="w-5 h-5 text-orange-400" />
              <span>Párok kezelése</span>
            </div>
            <div className={`transition-transform duration-300 ${expandedSections.pairs ? 'rotate-180' : ''}`}>
              <FiChevronDown className="w-5 h-5 text-gray-400" />
            </div>
          </button>
          <div 
            className={`grid transition-all duration-300 ease-in-out ${
              expandedSections.pairs ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              {/* Create Pair */}
              <div className="mb-4 p-4 glass-card rounded-xl">
                <h4 className="font-semibold mb-3 text-sm text-gray-300 uppercase tracking-wide">Új Pár</h4>
                <input
                  type="number"
                  placeholder="Pár száma"
                  value={newPair.assignedNumber}
                  onChange={(e) => setNewPair({ ...newPair, assignedNumber: parseInt(e.target.value) || 1 })}
                  className="w-full mb-3 px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                  min="1"
                />
                <input
                  type="text"
                  placeholder="Név (opcionális)"
                  value={newPair.name}
                  onChange={(e) => setNewPair({ ...newPair, name: e.target.value })}
                  className="w-full mb-3 px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                />
                <button
                  onClick={createPair}
                  className="modern-button w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white py-2.5 rounded-lg hover:from-orange-500 hover:to-orange-600 font-semibold flex items-center justify-center gap-2 shadow-lg"
                >
                  <FiPlus className="w-4 h-4" />
                  <span>Pár létrehozása</span>
                </button>
              </div>

              {/* Pairs List */}
              <div className="mb-4">
                <h4 className="font-semibold mb-3 text-sm text-gray-300 uppercase tracking-wide">Párok ({pairs.length})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {pairs.length === 0 ? (
                    <div className="text-sm text-gray-400 p-3 glass-card rounded-lg text-center">Nincs pár</div>
                  ) : (
                    pairs.map((pair) => {
                      // Use pair.active flag instead of device.active
                      // pair.active is set to false on logout, so it's more reliable
                      const isActive = pair.active || false;
                      return (
                        <div 
                          key={pair.id} 
                          className="p-3 glass-card rounded-lg flex justify-between items-center cursor-pointer transition-all"
                          onClick={() => {
                            setSelectedPair(pair);
                            setPairNameEdit(pair.name || '');
                            setEditingPairName(false);
                            setShowPairModal(true);
                          }}
                        >
                          <div className="flex-1">
                            <div className="font-bold text-white">#{pair.assignedNumber}</div>
                            {pair.name && <div className="text-xs text-gray-400 mt-1">{pair.name}</div>}
                            <div className={`text-xs flex items-center gap-1 mt-1 ${isActive ? 'text-green-400' : 'text-red-400'}`}>
                              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                              {isActive ? 'Aktív' : 'Inaktív'}
                            </div>
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => deletePair(pair.id)}
                              className="px-3 py-1.5 text-xs bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-500 hover:to-red-600 font-semibold shadow-lg"
                              title="Törlés"
                            >
                              <FiTrash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Active Devices */}
        <div className="mb-4 glass-card rounded-xl border border-orange-500/20">
          <button
            onClick={() => toggleSection('devices')}
            className="w-full p-4 flex items-center justify-between font-bold text-white transition-colors rounded-xl"
          >
            <div className="flex items-center gap-3">
              <FiSmartphone className="w-5 h-5 text-orange-400" />
              <span>Bejelentkezett eszközök</span>
            </div>
            <div className={`transition-transform duration-300 ${expandedSections.devices ? 'rotate-180' : ''}`}>
              <FiChevronDown className="w-5 h-5 text-gray-400" />
            </div>
          </button>
          <div 
            className={`grid transition-all duration-300 ease-in-out ${
              expandedSections.devices ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="space-y-2 text-sm max-h-32 overflow-y-auto mt-3 px-2">
              {activeDevices.length === 0 ? (
                <div className="text-gray-400 text-xs p-3 glass-card rounded-lg text-center">Nincs bejelentkezett eszköz</div>
              ) : (
                activeDevices.map((device) => (
                  <div 
                    key={device.id} 
                    className="p-3 glass-card rounded-lg cursor-pointer transition-all border border-green-500/20"
                    onClick={() => {
                      setSelectedDevice(device);
                      setShowDeviceModal(true);
                    }}
                  >
                    <div className="font-bold text-white">Pár #{device.pairNumber}</div>
                    {device.pairName && <div className="text-xs text-gray-400 mt-1">{device.pairName}</div>}
                    <div className="text-xs text-gray-500 mt-1">
                      {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('hu-HU') : 'Soha'}
                    </div>
                  </div>
                ))
              )}
              </div>
            </div>
          </div>
        </div>

        {/* Geofences Management */}
        <div className="mb-4 glass-card rounded-xl border border-orange-500/20 overflow-hidden">
          <button
            onClick={() => toggleSection('geofences')}
            className="w-full p-4 flex items-center justify-between font-bold text-white transition-colors rounded-xl"
          >
            <div className="flex items-center gap-3">
              <FiMapPin className="w-5 h-5 text-orange-400" />
              <span>Geofence-ek kezelése</span>
            </div>
            <div className={`transition-transform duration-300 ${expandedSections.geofences ? 'rotate-180' : ''}`}>
              <FiChevronDown className="w-5 h-5 text-gray-400" />
            </div>
          </button>
          <div 
            className={`grid transition-all duration-300 ease-in-out ${
              expandedSections.geofences ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              {/* Create Geofence */}
              <div className="mb-4 p-4 glass-card rounded-xl">
                <h4 className="font-semibold mb-3 text-sm text-gray-300 uppercase tracking-wide">Új Geofence (Scenarió)</h4>
                <input
                  type="text"
                  placeholder="Név"
                  value={newGeofence.name}
                  onChange={(e) => setNewGeofence({ ...newGeofence, name: e.target.value })}
                  className="w-full mb-3 px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                />
                <div className="flex gap-2 mb-3 w-full">
                  <input
                    type="number"
                    placeholder="Szélesség"
                    value={newGeofence.centerLat}
                    onChange={(e) => setNewGeofence({ ...newGeofence, centerLat: parseFloat(e.target.value) })}
                    className="flex-1 min-w-0 w-0 px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    step="0.0001"
                  />
                  <input
                    type="number"
                    placeholder="Hosszúság"
                    value={newGeofence.centerLon}
                    onChange={(e) => setNewGeofence({ ...newGeofence, centerLon: parseFloat(e.target.value) })}
                    className="flex-1 min-w-0 w-0 px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    step="0.0001"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMapClickMode(true);
                    alert('🗺️ Kattints a térképre a koordináta kiválasztásához!');
                  }}
                  className={`w-full mb-3 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                    mapClickMode 
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg' 
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  <FiMapPin className="w-4 h-4" />
                  <span>{mapClickMode ? 'Kattints a térképre...' : 'Koordináta kiválasztása térképen'}</span>
                </button>
                <input
                  type="number"
                  placeholder="Sugár (m)"
                  value={newGeofence.radiusM}
                  onChange={(e) => setNewGeofence({ ...newGeofence, radiusM: parseInt(e.target.value) })}
                  className="w-full mb-3 px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                />
                <select
                  value={newGeofence.geofenceType}
                  onChange={(e) => setNewGeofence({ ...newGeofence, geofenceType: e.target.value })}
                  className="w-full mb-3 px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                >
                  <option value="scenario">Scenarió</option>
                  <option value="crossing_point">Átkelési pont</option>
                </select>
                <button
                  onClick={createGeofence}
                  className="modern-button w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white py-2.5 rounded-lg hover:from-orange-500 hover:to-orange-600 font-semibold flex items-center justify-center gap-2 shadow-lg"
                >
                  <FiPlus className="w-4 h-4" />
                  <span>Geofence létrehozása</span>
                </button>
              </div>

              {/* Geofences List */}
              <div className="mb-4">
                <h4 className="font-semibold mb-3 text-sm text-gray-300 uppercase tracking-wide">Geofence-ek ({geofences.length})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {geofences.length === 0 ? (
                    <div className="text-sm text-gray-400 p-3 glass-card rounded-lg text-center">Nincs geofence</div>
                  ) : (
                    geofences.map((geofence) => (
                      <div key={geofence.id} className="p-3 glass-card rounded-lg">
                        <div className="font-bold text-white">{geofence.name}</div>
                        <div className="text-xs text-gray-400 mt-1">{getGeofenceTypeLabel(geofence.geofenceType)}</div>
                        <div className={`text-xs flex items-center gap-1 mb-2 mt-2 ${geofence.active ? 'text-green-400' : 'text-red-400'}`}>
                          <span className={`w-2 h-2 rounded-full ${geofence.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          {geofence.active ? 'Aktív' : 'Inaktív'}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleGeofence(geofence.id, !geofence.active)}
                            className={`flex-1 px-3 py-1.5 text-xs rounded-lg flex items-center justify-center gap-1 font-semibold shadow-lg ${
                              geofence.active ? 'bg-gradient-to-r from-red-600 to-red-500 text-white' : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                            }`}
                          >
                            {geofence.active ? (
                              <>
                                <FiPause className="w-3 h-3" />
                                <span>Deaktiválás</span>
                              </>
                            ) : (
                              <>
                                <FiPlay className="w-3 h-3" />
                                <span>Aktiválás</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteGeofence(geofence.id, geofence.name)}
                            className="px-3 py-1.5 text-xs bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-500 hover:to-red-600 font-semibold flex items-center justify-center shadow-lg"
                            title="Törlés"
                          >
                            <FiTrash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className="mb-4 glass-card rounded-xl border border-orange-500/20">
          <button
            onClick={() => toggleSection('gameArea')}
            className="w-full p-4 flex items-center justify-between font-bold text-white transition-colors rounded-xl"
          >
            <div className="flex items-center gap-3">
              <FiMap className="w-5 h-5 text-orange-400" />
              <span>Játékterület</span>
            </div>
            <div className={`transition-transform duration-300 ${expandedSections.gameArea ? 'rotate-180' : ''}`}>
              <FiChevronDown className="w-5 h-5 text-gray-400" />
            </div>
          </button>
          <div 
            className={`grid transition-all duration-300 ease-in-out ${
              expandedSections.gameArea ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="max-h-64 overflow-y-auto glass-card rounded-xl p-3">
                {availableCounties.length === 0 ? (
                  <div className="text-sm text-gray-400 p-3 text-center">Betöltés...</div>
                ) : (
                  availableCounties.map((county) => (
                    <label key={county.code} className="flex items-center gap-2 p-2 cursor-pointer rounded-lg transition-all">
                      <input
                        type="checkbox"
                        checked={selectedCounties.includes(county.code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCounties([...selectedCounties, county.code]);
                          } else {
                            setSelectedCounties(selectedCounties.filter((c) => c !== county.code));
                          }
                        }}
                        className="accent-orange-500"
                      />
                      <span className="text-sm text-gray-300">{county.name}</span>
                    </label>
                  ))
                )}
              </div>
              <button
                onClick={handleUpdateGameArea}
                className="modern-button w-full mt-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white py-2.5 rounded-lg hover:from-orange-500 hover:to-orange-600 font-semibold flex items-center justify-center gap-2 shadow-lg"
              >
                <FiSave className="w-4 h-4" />
                <span>Játékterület frissítése</span>
              </button>
            </div>
          </div>
        </div>

        {/* Users Management */}
        <div className="mb-4 glass-card rounded-xl border border-orange-500/20">
          <button
            onClick={() => toggleSection('users')}
            className="w-full p-4 flex items-center justify-between font-bold text-white transition-colors rounded-xl"
          >
            <div className="flex items-center gap-3">
              <FiUser className="w-5 h-5 text-orange-400" />
              <span>Felhasználók kezelése</span>
            </div>
            <div className={`transition-transform duration-300 ${expandedSections.users ? 'rotate-180' : ''}`}>
              <FiChevronDown className="w-5 h-5 text-gray-400" />
            </div>
          </button>
          <div 
            className={`grid transition-all duration-300 ease-in-out ${
              expandedSections.users ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">

          {/* Create User */}
          <div className="mb-4 p-4 glass-card rounded-xl">
            <h4 className="font-semibold mb-3 text-sm text-gray-300 uppercase tracking-wide">Új felhasználó</h4>
            <input
              type="text"
              placeholder="Felhasználónév"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              className="w-full mb-3 px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
            />
            <input
              type="email"
              placeholder="Email (opcionális)"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="w-full mb-3 px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
            />
            <input
              type="password"
              placeholder="Jelszó"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              className="w-full mb-3 px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'officer' })}
              className="w-full mb-3 px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
            >
              <option value="officer">Rendőr</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={createUser}
              className="modern-button w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white py-2.5 rounded-lg hover:from-orange-500 hover:to-orange-600 font-semibold flex items-center justify-center gap-2 shadow-lg"
            >
              <FiPlus className="w-3 h-3" />
              <span>Felhasználó létrehozása</span>
            </button>
          </div>

          {/* Users List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {users.length === 0 ? (
              <div className="text-sm text-gray-400 p-3 glass-card rounded-lg text-center">Nincs felhasználó</div>
            ) : (
              users.map((user) => (
                <div key={user.id} className="p-3 glass-card rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-bold flex items-center gap-2 text-white">
                        <FiUser className="w-4 h-4" />
                        {user.username}
                      </div>
                      {user.email && (
                        <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                          <FiMail className="w-3 h-3" />
                          {user.email}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                        <FiShield className="w-3 h-3" />
                        {user.role === 'admin' ? 'Admin' : 'Rendőr'}
                        <span className={`ml-2 flex items-center gap-1 ${user.active ? 'text-green-400' : 'text-red-400'}`}>
                          <span className={`w-2 h-2 rounded-full ${user.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          {user.active ? 'Aktív' : 'Inaktív'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="px-3 py-1.5 text-xs bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-500 hover:to-blue-600 font-semibold shadow-lg"
                        title="Szerkesztés"
                      >
                        <FiEdit className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteUser(user.id, user.username)}
                        className="px-3 py-1.5 text-xs bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-500 hover:to-red-600 font-semibold shadow-lg"
                        title="Törlés"
                      >
                        <FiTrash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            authService.logout();
            window.location.href = '/login';
          }}
          className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 font-medium flex items-center justify-center gap-2"
        >
          <FiLogOut className="w-4 h-4" />
          <span>Kijelentkezés</span>
        </button>
      </div>

      <div className="flex-1">
        <MapContainer
          center={[47.4979, 19.0402]}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
        >
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
          {mapClickMode && <MapClickHandler onClick={handleMapClick} />}
          {geofences.map((geofence) => {
            if (!geofence.active) return null;

            if (geofence.metadataJson?.polygon && geofence.metadataJson?.type === 'polygon') {
              const polygonCoords = geofence.metadataJson.polygon.map(([lon, lat]) => [lat, lon] as [number, number]);
              return (
                <Polygon
                  key={geofence.id}
                  positions={polygonCoords}
                  pathOptions={{
                    color: geofence.geofenceType === 'game_area' ? '#EA580C' : geofence.geofenceType === 'scenario' ? '#10B981' : '#F59E0B',
                    fillColor: geofence.geofenceType === 'game_area' ? '#F97316' : geofence.geofenceType === 'scenario' ? '#10B981' : '#F59E0B',
                    fillOpacity: geofence.geofenceType === 'game_area' ? 0.2 : 0.3,
                    weight: 3,
                  }}
                >
                  <Popup>
                    <div>
                      <strong>{geofence.name}</strong>
                      <div className="text-sm text-gray-600">{getGeofenceTypeLabel(geofence.geofenceType)}</div>
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
                      <strong>{geofence.name}</strong>
                      <div className="text-sm text-gray-600">{getGeofenceTypeLabel(geofence.geofenceType)}</div>
                      <div className="text-xs text-gray-500">{(geofence.radiusM / 1000).toFixed(1)} km</div>
                    </div>
                  </Popup>
              </Circle>
            );
          })}

          {/* Pairs on map */}
          {pairs.filter(p => {
            // Show pair on map only if:
            // 1. pair has lastPosition
            // 2. pair has an active device (actually logged in)
            // 3. Timer is running (same logic as main map)
            // CRITICAL: Positions stay on the map until the next timer cycle expires
            // We only show positions that were received when allowPositionUpdatesForMap was true
            // But we don't filter them out when allowPositionUpdatesForMap becomes false
            const hasActiveDevice = activeDevices.some(d => d.pairId === p.id);
            const timerRunning = gameSettings?.isTimerRunning === true;
            
            if (!p.lastPosition || !hasActiveDevice || !timerRunning) {
              return false;
            }
            
            // CRITICAL: Only show positions that were received in the current cycle
            // The API already filters out positions that shouldn't be shown
            // But we double-check here: position timestamp must be after lastLocationUpdate
            if (gameSettings?.lastLocationUpdate && p.lastPosition.timestamp) {
              const positionTimestamp = new Date(p.lastPosition.timestamp).getTime();
              const lastLocationUpdate = new Date(gameSettings.lastLocationUpdate).getTime();
              
              // Only show positions that were received after the lastLocationUpdate
              // (positions from the current cycle)
              if (positionTimestamp < lastLocationUpdate) {
                return false; // This position is from a previous cycle, don't show it
              }
            } else if (!gameSettings?.lastLocationUpdate) {
              // If there's no lastLocationUpdate, don't show positions
              // (timer hasn't expired yet, or no positions have been sent)
              return false;
            }
            
            return true;
          }).map((pair) => {
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
                  key={pair.id}
                  position={[pair.lastPosition!.lat, pair.lastPosition!.lon]}
                  icon={icon}
                  eventHandlers={{
                    click: () => {
                      setSelectedPair(pair);
                      setPairNameEdit(pair.name || '');
                      setEditingPairName(false);
                      setShowPairModal(true);
                    },
                  }}
                >
                  <Popup>
                    <div className="text-center min-w-[150px]">
                      <strong className="text-xl">Pár #{pair.assignedNumber}</strong>
                      {pair.name && <div className="text-sm text-gray-700 mt-1">{pair.name}</div>}
                      {pair.mostWanted && (
                        <div className="text-orange-600 font-bold mt-2">MOST WANTED</div>
                      )}
                      {pair.captured && (
                        <div className="text-red-600 font-bold mt-2">Elfogva</div>
                      )}
                      {pair.lastPosition && (
                        <div className="text-xs text-gray-500 mt-2">
                          {new Date(pair.lastPosition.timestamp).toLocaleString('hu-HU')}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
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
        </MapContainer>
      </div>

      {/* Pair Details Modal */}
      {showPairModal && selectedPair && (
        <>
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998]"
            onClick={() => {
              setShowPairModal(false);
              setSelectedPair(null);
            }}
          />
          <div 
            className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none"
            style={{ overflow: 'auto' }}
          >
            <div 
              className="glass-effect rounded-2xl p-8 w-full max-w-md shadow-2xl pointer-events-auto my-8 mx-4 border border-orange-500/30"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white">
                <FiUsers className="w-6 h-6 text-orange-400" />
                <span>Pár részletek</span>
              </h3>
              <div className="space-y-4">
                <div className="p-4 glass-card rounded-xl">
                  <label className="block text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">Pár száma</label>
                  <div className="text-2xl font-bold text-orange-400">#{selectedPair.assignedNumber}</div>
                </div>
                <div className="p-4 glass-card rounded-xl">
                  <label className="block text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">Pár neve</label>
                  {editingPairName ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={pairNameEdit}
                        onChange={(e) => setPairNameEdit(e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                        placeholder="Pár neve (opcionális)"
                      />
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch(`http://localhost:3000/api/pairs/${selectedPair.id}/name`, {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${localStorage.getItem('token')}`,
                              },
                              body: JSON.stringify({ name: pairNameEdit.trim() === '' ? null : pairNameEdit.trim() }),
                            });
                            if (response.ok) {
                              const data = await response.json();
                              if (data.success) {
                                await fetchPairs();
                                setSelectedPair({ ...selectedPair, name: pairNameEdit.trim() || null });
                                setEditingPairName(false);
                                alert('✅ Pár neve frissítve!');
                              } else {
                                alert('❌ Hiba történt: ' + (data.message || 'Ismeretlen hiba'));
                              }
                            } else {
                              const errorText = await response.text();
                              console.error('Error updating pair name:', response.status, errorText);
                              alert(`❌ Hiba történt: ${response.status} ${response.statusText}`);
                            }
                          } catch (error) {
                            console.error('Error updating pair name:', error);
                            alert('❌ Hiba történt: ' + (error instanceof Error ? error.message : 'Ismeretlen hiba'));
                          }
                        }}
                        className="modern-button px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-500 hover:to-emerald-500 font-semibold shadow-lg"
                      >
                        <FiSave className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingPairName(false);
                          setPairNameEdit(selectedPair.name || '');
                        }}
                        className="px-4 py-2.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 font-semibold transition-colors"
                      >
                        Mégse
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-lg text-white">{selectedPair.name || <span className="text-gray-400 italic">Nincs név</span>}</div>
                      <button
                        onClick={() => {
                          setPairNameEdit(selectedPair.name || '');
                          setEditingPairName(true);
                        }}
                        className="modern-button px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-500 hover:to-blue-600 font-semibold shadow-lg"
                        title="Szerkesztés"
                      >
                        <FiEdit className="w-4 h-4" />
                      </button>
                      {selectedPair.name && (
                        <button
                          onClick={async () => {
                            if (!confirm('⚠️ Biztosan törölni szeretnéd a pár nevét?')) return;
                            try {
                              const response = await fetch(`http://localhost:3000/api/pairs/${selectedPair.id}/name`, {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${localStorage.getItem('token')}`,
                                },
                                body: JSON.stringify({ name: null }),
                              });
                              if (response.ok) {
                                const data = await response.json();
                                if (data.success) {
                                  await fetchPairs();
                                  setSelectedPair({ ...selectedPair, name: null });
                                  alert('✅ Pár neve törölve!');
                                } else {
                                  alert('❌ Hiba történt: ' + (data.message || 'Ismeretlen hiba'));
                                }
                              } else {
                                const errorText = await response.text();
                                console.error('Error deleting pair name:', response.status, errorText);
                                alert(`❌ Hiba történt: ${response.status} ${response.statusText}`);
                              }
                            } catch (error) {
                              console.error('Error deleting pair name:', error);
                              alert('❌ Hiba történt: ' + (error instanceof Error ? error.message : 'Ismeretlen hiba'));
                            }
                          }}
                          className="modern-button px-3 py-2 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-500 hover:to-red-600 font-semibold shadow-lg"
                          title="Név törlése"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="p-4 glass-card rounded-xl">
                  <label className="block text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">Státusz</label>
                  <div className={`text-lg font-bold ${selectedPair.active ? 'text-green-400' : 'text-red-400'}`}>
                    {selectedPair.active ? 'Aktív' : 'Inaktív'}
                  </div>
                </div>
                {selectedPair.lastPosition && (
                  <div className="p-4 glass-card rounded-xl">
                    <label className="block text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">Legutóbbi pozíció</label>
                    <div className="text-sm text-gray-300 space-y-1">
                      <div>Szélesség: <span className="font-mono">{selectedPair.lastPosition.lat.toFixed(6)}</span></div>
                      <div>Hosszúság: <span className="font-mono">{selectedPair.lastPosition.lon.toFixed(6)}</span></div>
                      <div className="text-gray-400 mt-2">
                        {new Date(selectedPair.lastPosition.timestamp).toLocaleString('hu-HU')}
                      </div>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${selectedPair.lastPosition.lat},${selectedPair.lastPosition.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="modern-button mt-3 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-500 hover:to-blue-600 font-semibold shadow-lg"
                    >
                      <FiMap className="w-4 h-4" />
                      <span>Megnyitás Google Maps-en</span>
                    </a>
                  </div>
                )}
                {!selectedPair.lastPosition && (
                  <div className="p-4 glass-card rounded-xl">
                    <div className="text-sm text-gray-400">Nincs elérhető pozíció adat</div>
                  </div>
                )}
                {(() => {
                  const pairDevice = devices.find((d) => d.pairId === selectedPair.id);
                  if (pairDevice) {
                    return (
                      <div className="p-4 glass-card rounded-xl border-t border-gray-700/50">
                        <label className="block text-xs font-semibold mb-3 text-gray-400 uppercase tracking-wide">Eszköz információk</label>
                        <div className="space-y-2 text-sm text-gray-300">
                          <div>
                            <span className="font-medium">Eszköz ID:</span>{' '}
                            <span className="font-mono text-xs text-gray-400">{pairDevice.imeiOrDeviceId}</span>
                          </div>
                          <div>
                            <span className="font-medium">Utolsó látogatás:</span>{' '}
                            <span className="text-gray-400">
                              {pairDevice.lastSeenAt 
                                ? new Date(pairDevice.lastSeenAt).toLocaleString('hu-HU')
                                : 'Soha'}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">FCM Token:</span>{' '}
                            <span className={pairDevice.hasFcmToken ? 'text-green-400' : 'text-red-400'}>
                              {pairDevice.hasFcmToken ? 'Van' : 'Nincs'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPairModal(false);
                    setSelectedPair(null);
                  }}
                  className="modern-button flex-1 bg-gradient-to-r from-gray-700 to-gray-600 text-white py-2.5 rounded-lg hover:from-gray-600 hover:to-gray-500 font-semibold shadow-lg"
                >
                  Bezárás
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Device Details Modal */}
      {showDeviceModal && selectedDevice && (
        <>
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998]"
            onClick={() => {
              setShowDeviceModal(false);
              setSelectedDevice(null);
            }}
          />
          <div 
            className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none"
            style={{ overflow: 'auto' }}
          >
            <div 
              className="glass-effect rounded-2xl p-8 w-full max-w-md shadow-2xl pointer-events-auto my-8 mx-4 border border-orange-500/30"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white">
                <FiSmartphone className="w-6 h-6 text-orange-400" />
                <span>Eszköz részletek</span>
              </h3>
              <div className="space-y-4">
                <div className="p-4 glass-card rounded-xl">
                  <label className="block text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">Pár száma</label>
                  <div className="text-2xl font-bold text-orange-400">#{selectedDevice.pairNumber}</div>
                </div>
                {selectedDevice.pairName && (
                  <div className="p-4 glass-card rounded-xl">
                    <label className="block text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">Pár neve</label>
                    <div className="text-lg text-white">{selectedDevice.pairName}</div>
                  </div>
                )}
                <div className="p-4 glass-card rounded-xl">
                  <label className="block text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">Eszköz ID</label>
                  <div className="text-sm font-mono bg-gray-800/50 p-3 rounded-lg text-gray-300 border border-gray-700">{selectedDevice.imeiOrDeviceId}</div>
                </div>
                <div className="p-4 glass-card rounded-xl">
                  <label className="block text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">Utolsó látogatás</label>
                  <div className="text-sm text-gray-300">
                    {selectedDevice.lastSeenAt 
                      ? new Date(selectedDevice.lastSeenAt).toLocaleString('hu-HU')
                      : 'Soha'}
                  </div>
                </div>
                <div className="p-4 glass-card rounded-xl">
                  <label className="block text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">FCM Token</label>
                  <div className={`text-lg font-bold ${selectedDevice.hasFcmToken ? 'text-green-400' : 'text-red-400'}`}>
                    {selectedDevice.hasFcmToken ? 'Van' : 'Nincs'}
                  </div>
                </div>
                <div className="p-4 glass-card rounded-xl">
                  <label className="block text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">Státusz</label>
                  <div className={`text-lg font-bold ${selectedDevice.active ? 'text-green-400' : 'text-red-400'}`}>
                    {selectedDevice.active ? 'Aktív' : 'Inaktív'}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={async () => {
                    if (!confirm('⚠️ Biztosan ki szeretnéd jelentkeztetni ezt az eszközt?')) return;
                    
                    try {
                      const response = await fetch(`http://localhost:3000/api/devices/force-logout/${selectedDevice.imeiOrDeviceId}`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${localStorage.getItem('token')}`,
                        },
                      });
                      
                      if (response.ok) {
                        const data = await response.json();
                        if (data.success) {
                          alert('✅ Eszköz sikeresen kijelentkeztetve!');
                          await Promise.all([
                            fetchDevices(),
                            fetchActiveDevices(),
                            fetchPairs()
                          ]);
                          setShowDeviceModal(false);
                          setSelectedDevice(null);
                        } else {
                          alert('❌ Hiba történt: ' + (data.message || 'Ismeretlen hiba'));
                        }
                      } else {
                        const errorText = await response.text();
                        console.error('Force logout error:', response.status, errorText);
                        alert(`❌ Hiba történt: ${response.status} ${response.statusText}`);
                      }
                    } catch (error) {
                      console.error('Error force logging out device:', error);
                      alert('❌ Hiba történt: ' + (error instanceof Error ? error.message : 'Ismeretlen hiba'));
                    }
                  }}
                  className="modern-button flex-1 bg-gradient-to-r from-red-600 to-red-500 text-white py-2.5 rounded-lg hover:from-red-500 hover:to-red-600 font-semibold flex items-center justify-center gap-2 shadow-lg"
                >
                  <FiLogOut className="w-4 h-4" />
                  <span>Kijelentkeztetés</span>
                </button>
                <button
                  onClick={() => {
                    setShowDeviceModal(false);
                    setSelectedDevice(null);
                  }}
                  className="modern-button flex-1 bg-gradient-to-r from-gray-700 to-gray-600 text-white py-2.5 rounded-lg hover:from-gray-600 hover:to-gray-500 font-semibold shadow-lg"
                >
                  Bezárás
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* User Edit Modal */}
      {showUserModal && editingUser && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998]"
            onClick={() => {
              setShowUserModal(false);
              setEditingUser(null);
            }}
          />
          {/* Modal Content */}
          <div 
            className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none"
            style={{ overflow: 'auto' }}
          >
            <div 
              className="glass-effect rounded-2xl p-8 w-full max-w-md shadow-2xl pointer-events-auto my-8 mx-4 border border-orange-500/30"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white">
                <FiEdit className="w-6 h-6 text-orange-400" />
                <span>Felhasználó szerkesztése</span>
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">Felhasználónév</label>
                  <input
                    type="text"
                    value={editUser.username}
                    onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">Email</label>
                  <input
                    type="email"
                    value={editUser.email}
                    onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">
                    Új jelszó <span className="text-gray-500 text-xs normal-case">(hagyd üresen, ha nem változtatod)</span>
                  </label>
                  <input
                    type="password"
                    value={editUser.password}
                    onChange={(e) => setEditUser({ ...editUser, password: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    placeholder="Új jelszó"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">Szerepkör</label>
                  <select
                    value={editUser.role}
                    onChange={(e) => setEditUser({ ...editUser, role: e.target.value as 'admin' | 'officer' })}
                    className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                  >
                    <option value="officer">Rendőr</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex items-center gap-3 p-4 glass-card rounded-xl">
                  <input
                    type="checkbox"
                    id="active"
                    checked={editUser.active}
                    onChange={(e) => setEditUser({ ...editUser, active: e.target.checked })}
                    className="w-5 h-5 accent-orange-500"
                  />
                  <label htmlFor="active" className="text-sm font-semibold text-white cursor-pointer">
                    Aktív
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={updateUser}
                  className="modern-button flex-1 bg-gradient-to-r from-orange-600 to-orange-500 text-white py-2.5 rounded-lg hover:from-orange-500 hover:to-orange-600 font-semibold flex items-center justify-center gap-2 shadow-lg"
                >
                  <FiSave className="w-4 h-4" />
                  <span>Mentés</span>
                </button>
                <button
                  onClick={() => {
                    setShowUserModal(false);
                    setEditingUser(null);
                  }}
                  className="modern-button flex-1 bg-gradient-to-r from-gray-700 to-gray-600 text-white py-2.5 rounded-lg hover:from-gray-600 hover:to-gray-500 font-semibold shadow-lg"
                >
                  Mégse
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
