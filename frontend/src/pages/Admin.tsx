import { useState, useEffect, useRef } from 'react';
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
import PairDetails from '../components/PairDetails';

// Shared Components
import SendMessageModal from '../components/SendMessageModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { useNotification } from '../contexts/NotificationContext';

// Styles
import 'leaflet/dist/leaflet.css';


// Import Pair from types
import { Pair } from '../types';

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
  const { addNotification } = useNotification();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPair, setSelectedPair] = useState<Pair | null>(null);
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
  const { socket } = useSocket();

  // Sync pairs from hook BUT preserve socket-updated distancePosition
  // This prevents the jumping issue where API data overwrites socket data
  useEffect(() => {
    if (initialPairs.length > 0) {
      setPairs(prevPairs => {
        // Merge API data with existing socket-updated data
        return initialPairs.map(apiPair => {
          const existing = prevPairs.find(p => p.id === apiPair.id);
          if (existing) {
            // Preserve distancePosition from socket (distanceUpdate events)
            // Preserve lastPosition from socket (positionUpdate events)
            return {
              ...apiPair,
              lastPosition: existing.lastPosition || apiPair.lastPosition,
              distancePosition: existing.distancePosition, // Keep socket-updated distance position
            };
          }
          return apiPair;
        });
      });
    }
  }, [initialPairs]);

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

    socket.on('distanceUpdate', handleDistanceUpdate);
    socket.on('positionUpdate', handlePositionUpdate);

    return () => {
      socket.off('distanceUpdate', handleDistanceUpdate);
      socket.off('positionUpdate', handlePositionUpdate);
    };
  }, [socket]);



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

      // Helper function to save location
      const saveLocation = (lat: number, lon: number) => {
        setBrowserLocation({ lat, lon });
      };

      // Get initial position immediately
      navigator.geolocation.getCurrentPosition(
        (position) => {
          saveLocation(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('Error getting browser location:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      // Watch position for continuous updates
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          saveLocation(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('Error watching browser location:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
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
  }, []);
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeDevices, setActiveDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [gameSettings, setGameSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      const response = await fetch('http://localhost:3000/api/game-settings', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        setGameSettings(await response.json());
      }
    } catch (error) { console.error(error); }
  };

  // fetchPairs removed, handled by usePairs hook

  const fetchDevices = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/devices', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) setDevices(await response.json());
    } catch (error) { console.error(error); }
  };

  const fetchActiveDevices = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/devices/active', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) setActiveDevices(await response.json());
    } catch (error) { console.error(error); }
  };

  const fetchGeofences = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/geofence', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) setGeofences(await response.json());
    } catch (error) { console.error(error); }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) setUsers(await response.json());
    } catch (error) { console.error(error); }
  };

  // Actions
  const startTimer = async () => {
    await fetch('http://localhost:3000/api/game-settings/timer/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    fetchGameSettings();
  };

  const stopTimer = async () => {
    await fetch('http://localhost:3000/api/game-settings/timer/stop', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    fetchGameSettings();
  };

  const updateInterval = async (minutes: number) => {
    await fetch('http://localhost:3000/api/game-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ locationUpdateIntervalMinutes: minutes }),
    });
    fetchGameSettings();
    addNotification('success', 'Időköz frissítve');
  };

  const createPair = async () => {
    if (!newPair.assignedNumber) {
      addNotification('error', 'Add meg a számot!');
      return;
    }
    const res = await fetch('http://localhost:3000/api/pairs', {
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
        await fetch(`http://localhost:3000/api/pairs/${id}`, {
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

    await fetch(`http://localhost:3000/api/pairs/${pair.id}/name`, {
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
    const pair = pairs.find(p => p.id === pairId);
    if (pair?.mostWanted) {
      await fetch(`http://localhost:3000/api/mw/${pairId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
    } else {
      await fetch('http://localhost:3000/api/mw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ pairId }),
      });
    }
    fetchPairs();
  };

  // Direct capture for PairDetails modal (which has its own confirmation)
  const handleCaptureDirect = async (pairId: number) => {
    try {
      const response = await fetch('http://localhost:3000/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ pairId }),
      });

      if (!response.ok) {
        throw new Error('Hiba az elfogás során');
      }

      fetchPairs();
      addNotification('success', 'Elfogás rögzítve');
    } catch (error) {
      console.error('Capture error:', error);
      addNotification('error', 'Hiba történt az elfogás során');
    }
  };

  const handleCapture = async (pairId: number) => {
    setConfirmation({
      isOpen: true,
      title: 'Pár elfogása',
      message: 'Megerősíti a páros elfogását?',
      isDangerous: false,
      confirmLabel: 'Elfogás',
      action: async () => {
        await handleCaptureDirect(pairId);
        setConfirmation(prev => ({ ...prev, isOpen: false }));
      }
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
          const res = await fetch(`http://localhost:3000/api/devices/force-logout/${deviceId}`, {
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
          const res = await fetch(`http://localhost:3000/api/devices/${deviceId}`, {
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
      const res = await fetch('http://localhost:3000/api/users', {
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
          const res = await fetch(`http://localhost:3000/api/users/${id}`, {
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
      const res = await fetch(`http://localhost:3000/api/users/${editingUser.id}`, {
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
    const res = await fetch('http://localhost:3000/api/geofence', {
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
      addNotification('success', 'Geofence létrehozva');
    }
  };

  const handleToggleGeofence = async (id: number, active: boolean) => {
    await fetch(`http://localhost:3000/api/geofence/${id}/${active ? 'activate' : 'deactivate'}`, {
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
        await fetch(`http://localhost:3000/api/geofence/${id}`, {
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
      const res = await fetch('http://localhost:3000/api/game-area', {
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
      const res = await fetch('http://localhost:3000/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ pairId, title, body }),
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
            activePairsCount={pairs.filter(p => p.active && !p.captured).length}
            activeDevicesCount={activeDevices.length}
            activeGeofencesCount={geofences.filter(g => g.active).length}
            startTimer={startTimer}
            stopTimer={stopTimer}
          />
        );
      case 'game_control':
        return (
          <GameControl
            gameSettings={gameSettings}
            intervalInputValue={intervalInputValue}
            isEditingInterval={isEditingInterval}
            setIntervalInputValue={setIntervalInputValue}
            setIsEditingInterval={setIsEditingInterval}
            updateInterval={updateInterval}
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
            showCreateModal={showCreatePairModal}
            setShowCreateModal={setShowCreatePairModal}
            onPairSelect={setSelectedPair}
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
          />
        );
      default:
        return <div>Válassz egy menüpontot</div>;
    }
  };

  return (
    <AdminLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      loading={loading}
      onLogout={handleLogout}
      headerActions={headerActions}
    >
      {(sidebarOpen: boolean) => (
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
            onSendMessage={(id) => {
              setSelectedMessagePair(pairs.find(p => p.id === id) || null);
              setShowMessageModal(true);
            }}
          />

          {/* Global Modals (Rendered last to appear on top of PairDetails) */}
          <SendMessageModal
            isOpen={showMessageModal}
            pairId={selectedMessagePair?.id || null}
            pairAssignedNumber={selectedMessagePair?.assignedNumber}
            pairName={selectedMessagePair?.name}
            onClose={() => setShowMessageModal(false)}
            onSend={handleSendMessage}
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
                    <span>Létrehozva: {editingUser && new Date(editingUser.createdAt).toLocaleDateString()}</span>
                    {editingUser?.updatedAt && (
                      <>
                        <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                        <span>Módosítva: {new Date(editingUser.updatedAt).toLocaleDateString()}</span>
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
        </>
      )}
    </AdminLayout>
  );
}
