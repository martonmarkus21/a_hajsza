import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// New Components
import AdminLayout from './admin/AdminLayout';
import DashboardHome from './admin/DashboardHome';
import GameControl from './admin/GameControl';
import PairsManagement from './admin/PairsManagement';
import DeviceManagement from './admin/DeviceManagement';
import UserManagement from './admin/UserManagement';
import GeofenceManager from './admin/GeofenceManager';

// Shared Components
import SendMessageModal from '../components/SendMessageModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { NotificationProvider, useNotification } from '../contexts/NotificationContext';

// Styles
import 'leaflet/dist/leaflet.css';

interface Geofence {
  id: number;
  name: string;
  centerLat: number;
  centerLon: number;
  radiusM: number;
  active: boolean;
  geofenceType: string;
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

function AdminContent() {
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const [activeTab, setActiveTab] = useState('dashboard');

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

  // Data States
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
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

  const fetchPairs = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/pairs', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPairs(data.pairs || []);
      }
    } catch (error) { console.error(error); }
  };

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
      addNotification('error', 'Hiba a pár létrehozásakor');
    }
  };

  const deletePair = async (id: number) => {
    setConfirmation({
      isOpen: true,
      title: 'Pár Törlése',
      message: 'Biztosan törölni szeretnéd ezt a párt? A művelet végleges.',
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

  const handleEditPairName = async (pair: Pair) => {
    const name = prompt('Adj meg új nevet:', pair.name || '');
    if (name === null) return;
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

  const handleCapture = async (pairId: number) => {
    setConfirmation({
      isOpen: true,
      title: 'Pár Elfogása',
      message: 'Megerősíted az elfogást?',
      isDangerous: false,
      confirmLabel: 'Elfogás',
      action: async () => {
        await fetch('http://localhost:3000/api/capture', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ pairId }),
        });
        fetchPairs();
        addNotification('success', 'Elfogás rögzítve');
        setConfirmation(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleForceLogout = async (deviceId: string) => {
    setConfirmation({
      isOpen: true,
      title: 'Kényszerített Kijelentkeztetés',
      message: 'Biztosan kijelentkezteted az eszközt távolról?',
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
      title: 'Eszköz Törlése',
      message: 'Biztosan törölni szeretnéd ezt az eszközt? A művelet végleges.',
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
      return;
    }
    if (newUser.password.length < 6) {
      addNotification('error', 'A jelszónak legalább 6 karakternek kell lennie!');
      return;
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
      } else {
        const err = await res.json();
        addNotification('error', `Hiba: ${err.message || 'Ismeretlen hiba'}`);
      }
    } catch (error) {
      addNotification('error', 'Hálózati hiba történt');
    }
  };

  const deleteUser = (id: number, username: string) => {
    setConfirmation({
      isOpen: true,
      title: 'Felhasználó Törlése',
      message: `Biztosan törölni szeretnéd a következő felhasználót: ${username}? Ez a művelet nem vonható vissza.`,
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
    if (editUserForm.password) updateData.password = editUserForm.password;

    await fetch(`http://localhost:3000/api/users/${editingUser.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(updateData),
    });
    setShowUserModal(false);
    fetchUsers();
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
      title: 'Geofence Törlése',
      message: `Törlöd a zónát: ${name}?`,
      isDangerous: true,
      confirmLabel: 'Törlés',
      action: async () => {
        await fetch(`http://localhost:3000/api/geofence/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        fetchGeofences();
        setConfirmation(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleSendMessage = async (pairId: number | null, title: string, body: string) => {
    await fetch('http://localhost:3000/api/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ pairId, title, body }),
    });
    addNotification('success', 'Üzenet elküldve');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Render Content based on active Tab
  const renderContent = () => {
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
          />
        );
      case 'devices':
        return (
          <DeviceManagement
            devices={devices}
            activeDevices={activeDevices}
            handleForceLogout={handleForceLogout}
            handleDeleteDevice={handleDeleteDevice}
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
            getGeofenceTypeLabel={(type: string) => {
              const types: Record<string, string> = {
                safe_zone: 'Biztonsági Zóna',
                danger_zone: 'Veszélyzóna'
              };
              return types[type] || type;
            }}
            pairs={pairs}
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
    >
      {renderContent()}

      {/* Global Modals */}
      {showMessageModal && (
        <SendMessageModal
          pairId={selectedMessagePair?.id || null}
          pairAssignedNumber={selectedMessagePair?.assignedNumber}
          pairName={selectedMessagePair?.name}
          pairMostWanted={selectedMessagePair?.mostWanted}
          onClose={() => {
            setShowMessageModal(false);
            setSelectedMessagePair(null);
          }}
          onSend={handleSendMessage}
        />
      )}

      {/* User Edit Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="mw-card w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Felhasználó Szerkesztése</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-xs font-bold mb-1">Felhasználónév</label>
                <input
                  className="mw-input"
                  value={editUserForm.username}
                  onChange={(e) => setEditUserForm({ ...editUserForm, username: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs font-bold mb-1">Email</label>
                <input
                  className="mw-input"
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs font-bold mb-1">Jelszó (üresen hagyva nem változik)</label>
                <input
                  type="password"
                  className="mw-input"
                  value={editUserForm.password}
                  onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
                />
              </div>
              <div className="flex gap-4">
                <button onClick={submitUserEdit} className="flex-1 py-2 bg-orange-500 rounded-lg font-bold text-white hover:bg-orange-600">Mentés</button>
                <button onClick={() => setShowUserModal(false)} className="flex-1 py-2 bg-gray-700 rounded-lg text-gray-300 hover:bg-gray-600">Mégse</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
    </AdminLayout>
  );
}

// Wrap with Provider
export default function Admin() {
  return (
    <NotificationProvider>
      <AdminContent />
    </NotificationProvider>
  );
}
