import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Circle, Polygon, Popup, useMapEvents, useMap, ZoomControl } from 'react-leaflet';
import { FiPlus, FiTrash2, FiMapPin, FiGlobe, FiTarget, FiX, FiMap } from 'react-icons/fi';

import L from 'leaflet';
import mwOrangeImage from '../../assets/images/mw_orange.png';
import { useNotification } from '../../contexts/NotificationContext';

import { Pair } from '../../types';
import SmoothAnimatedMarker from '../../components/SmoothAnimatedMarker';
import { buildPairMarkerDivHtml } from '../../utils/pairMapMarkerHtml';
import MwTableSearchInput from '../../components/MwTableSearchInput';

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

interface AvailableCounty {
    code: string;
    name: string;
    polygon?: number[][];
    active?: boolean;
}

interface GeofenceManagerProps {
    geofences: Geofence[];
    newGeofence: any;
    setNewGeofence: (geofence: any) => void;
    createGeofence: () => void;
    handleToggleGeofence: (id: number, active: boolean) => void;
    handleDeleteGeofence: (id: number, name: string) => void;
    mapClickMode: boolean;
    setMapClickMode: (mode: boolean) => void;
    handleMapClick: (lat: number, lon: number) => void;

    pairs: Pair[];
    onActivateHungary?: () => void;
    onToggleHungary?: (active: boolean) => void;
    onPairSelect?: (pair: Pair) => void;
    onRefresh: () => void;
    /** Aktív játékterület elhagyása — piros jelző a térképi pár ikonon */
    activeGameAreaExitViolations?: Record<number, boolean>;
}

// Map click handler - passes lat/lng to parent
function MapClickHandler({ onClick, active }: { onClick: (lat: number, lon: number) => void; active: boolean }) {
    useMapEvents({
        click: (e) => {
            if (active) {
                e.originalEvent.stopPropagation();
                onClick(e.latlng.lat, e.latlng.lng);
            }
        },
    });
    return null;
}

// Custom County SVG Icon Component
function CountyIcon({ polygon, active, className }: { polygon?: number[][], active: boolean, className?: string }) {
    if (!polygon || polygon.length === 0) {
        return <FiMap className={className || "w-5 h-5"} />;
    }

    // Calculate bounding box for the viewBox
    const lats = polygon.map(p => p[1]);
    const lons = polygon.map(p => p[0]);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    // Calculate the mean latitude for the cosine correction (aspect ratio fix)
    const meanLat = (minLat + maxLat) / 2;
    const cosLat = Math.cos(meanLat * (Math.PI / 180));

    // Scale longitudes by the cosine of the mean latitude to fix the "squashed" look
    const scaledLons = lons.map(lon => lon * cosLat);
    const minX = Math.min(...scaledLons);
    const maxX = Math.max(...scaledLons);

    // Calculate width and height in corrected coordinates
    const width = maxX - minX;
    const height = maxLat - minLat;

    // Add padding (2% instead of 10% to make it fill the box more)
    const padX = width * 0.02;
    const padY = height * 0.02;

    // SVG coordinate system has Y going down, but latitudes go up
    // We need to invert the Y coordinates when drawing
    const viewBox = `${minX - padX} ${-(maxLat + padY)} ${width + padX * 2} ${height + padY * 2}`;

    // Generate path data
    const pathData = polygon.map((point, index) => {
        // [lon, lat] -> x, y (inverting lat for SVG Y-axis, scaling lon for aspect ratio)
        const x = point[0] * cosLat;
        const y = -point[1];
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ') + ' Z';

    return (
        <svg
            viewBox={viewBox}
            className={className || "w-6 h-6 drop-shadow-sm transition-all duration-300"}
            fill={active ? "currentColor" : "rgba(255,255,255,0.1)"}
            stroke={active ? "rgba(255,255,255,0.8)" : "currentColor"}
            strokeWidth={(width + height) / 2 * 0.05} // Dynamic stroke width based on bounds
            strokeLinejoin="round"
        >
            <path d={pathData} />
        </svg>
    );
}

// Component to handle map resize dynamically using ResizeObserver (same as main page)
function MapResizeHandler() {
    const map = useMap();

    useEffect(() => {
        // ResizeObserver monitors the map container for size changes
        // This ensures that when the sidebar is toggled (or window resized),
        // the map adapts smoothly and immediately, avoiding the "laggy" feel.
        const resizeObserver = new ResizeObserver(() => {
            // invalidateSize({ animate: false }) checks if the container size changed
            // and updates the map logic. animate: false prevents double-animation stutter.
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

export default function GeofenceManager({
    geofences,
    newGeofence,
    setNewGeofence,
    createGeofence,
    handleToggleGeofence,
    handleDeleteGeofence,
    mapClickMode,
    setMapClickMode,
    handleMapClick,
    pairs,
    onActivateHungary,
    onToggleHungary,
    onPairSelect,
    onRefresh,
    activeGameAreaExitViolations,
}: GeofenceManagerProps) {
    const { addNotification } = useNotification();
    const [browserLocation, setBrowserLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Tab State for Sidebar
    const [activeTab, setActiveTab] = useState<'custom' | 'counties'>('counties');
    const [searchTerm, setSearchTerm] = useState('');
    const [radiusUnit, setRadiusUnit] = useState<'m' | 'km'>('m');



    const [availableCounties, setAvailableCounties] = useState<AvailableCounty[]>([]);
    const mapRef = useRef<L.Map | null>(null);

    // Reset mapClickMode when component unmounts (navigation away)
    useEffect(() => {
        return () => {
            setMapClickMode(false);
        };
    }, [setMapClickMode]);

    // Fetch available counties from API
    useEffect(() => {
        const fetchCounties = async () => {
            try {
                const response = await fetch('http://localhost:3000/api/game-area/counties', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                });
                if (response.ok) {
                    const data = await response.json();
                    setAvailableCounties(data);
                    console.log('Loaded available counties:', data.length);
                }
            } catch (error) {
                console.error('Error fetching counties:', error);
            }
        };
        fetchCounties();
    }, []);

    // Get browser location
    useEffect(() => {
        if (navigator.geolocation) {
            const watchId = navigator.geolocation.watchPosition(
                (position) => {
                    setBrowserLocation({
                        lat: position.coords.latitude,
                        lon: position.coords.longitude,
                    });
                },
                (error) => console.log('Geolocation error:', error),
                { enableHighAccuracy: true, maximumAge: 30000, timeout: 5000 }
            );
            return () => navigator.geolocation.clearWatch(watchId);
        }
    }, []);

    // Invalidate map size when modal or sidebar changes
    const invalidateMapSize = useCallback(() => {
        if (mapRef.current) {
            setTimeout(() => mapRef.current?.invalidateSize(), 100);
            setTimeout(() => mapRef.current?.invalidateSize(), 300);
            setTimeout(() => mapRef.current?.invalidateSize(), 600);
            setTimeout(() => mapRef.current?.invalidateSize(), 1000);
        }
    }, []);

    // Handle modal open/close with map resize
    const handleModalOpen = useCallback(() => {
        setShowCreateModal(true);
        invalidateMapSize();
    }, [invalidateMapSize]);

    const handleModalClose = useCallback(() => {
        setShowCreateModal(false);
        setMapClickMode(false);
        invalidateMapSize();
    }, [setMapClickMode, invalidateMapSize]);

    // Separate geofences by type
    const countyGeofences = geofences.filter(g =>
        g.geofenceType === 'game_area' &&
        g.metadataJson?.polygon &&
        g.name !== 'Magyarország'
    );

    const hungaryGeofence = geofences.find(g =>
        g.geofenceType === 'game_area' && g.name === 'Magyarország'
    );

    // Base custom geofences (for map)
    const allCustomGeofences = geofences.filter(g =>
        g.geofenceType !== 'game_area'
    );

    // Filtered custom geofences (for list)
    const filteredCustomGeofences = allCustomGeofences.filter(g =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter out "Magyarország" from available counties
    const filteredAvailableCounties = availableCounties.filter(
        c => c.name.toLowerCase() !== 'magyarország' && c.code.toLowerCase() !== 'magyarorszag'
    );

    // Merge available counties with existing geofences to show all counties
    const baseAllCounties = filteredAvailableCounties.map(county => {
        const existing = countyGeofences.find(g =>
            g.name === county.name ||
            g.metadataJson?.countyCode === county.code
        );
        return {
            code: county.code,
            name: county.name,
            id: existing?.id,
            active: existing?.active || false,
            hasGeofence: !!existing,
            polygon: county.polygon,
        };
    });

    const filteredAllCounties = baseAllCounties.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => {
        // Sort by Active First
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;

        return a.name.localeCompare(b.name, 'hu');
    });

    const getTypeLabel = (geo: Geofence) => {
        if (geo.geofenceType === 'game_area') return 'Játékterület';
        const radiusKm = parseFloat((geo.radiusM / 1000).toFixed(3));
        return `${radiusKm} km-es zóna`;
    };

    const getGeofenceColor = (geo: Geofence) => {
        if (!geo.active) return '#6b7280';
        if (geo.geofenceType === 'game_area') return '#f36f26';
        if (geo.geofenceType === 'scenario') return '#10b981';
        return '#f59e0b';
    };

    const handleCreate = async () => {
        // Prepare base payload
        const payload: any = {
            name: newGeofence.name,
            centerLat: newGeofence.centerLat,
            centerLon: newGeofence.centerLon,
            radiusM: newGeofence.radiusM,
            geofenceType: newGeofence.geofenceType,
            active: true // Default to active
        };

        // If Hungary is active -> Create as INACTIVE, then Atomic Switch
        if (hungaryGeofence?.active && hungaryGeofence.id) {
            payload.active = false;
        }

        // Call createGeofence with modified payload
        // We need to modify createGeofence to accept payload or modify it before calling
        // Since createGeofence is a prop, we assume it takes the state 'newGeofence'. 
        // But 'newGeofence' state doesn't have 'active'.
        // We need to verify how createGeofence works.
        // Looking at Admin.tsx via previous reads or inferred: 
        // createGeofence usually reads 'newGeofence' state from parent? 
        // No, createGeofence in Admin.tsx takes NO arguments and reads 'newGeofence' state from Admin.tsx.
        // BUT here in GeofenceManager, 'newGeofence' and 'setNewGeofence' are props passed DOWN.
        // So if we update 'newGeofence' state here, it updates in parent.
        // However, 'active' property might not be on the 'newGeofence' object structure defined in types?
        // Let's check Geofence structure or NewGeofence type.
        // Assuming we can add 'active' to it. If not, we might need to cast.

        // A better approach if we can't easily change the prop signature or type immediately:
        // We might need to manually call the fetch here if createGeofence is too rigid.
        // Let's look at how createGeofence is implemented in Admin.tsx.
        // It uses 'newGeofence' state.

        // Converting this thought process to action:
        // I will first check Admin.tsx to see if I can override 'active' or if I should implement the fetch here locally.
        // Actually, to ensure professional efficiency, I will IMPLEMENT THE FETCH HERE LOCALLY 
        // for the atomic path, or pass the 'active' flag if possible.
        // Given I cannot see Admin.tsx createGeofence implementation right now (I saw it earlier but verify),
        // I'll implement a local create logic for the special case to be safe and precise.

        try {
            const token = localStorage.getItem('token');
            const body = { ...newGeofence, active: true };

            // Special Case: Atomic Switch from Hungary
            if (hungaryGeofence?.active && hungaryGeofence.id) {
                body.active = false;

                // 1. Create Inactive
                const res = await fetch('http://localhost:3000/api/geofence', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(body)
                });

                if (res.ok) {
                    const data = await res.json();
                    const newZoneId = data.geofence.id;

                    // 2. Atomic Switch
                    await fetch('http://localhost:3000/api/geofence/bulk-status', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                            activateIds: [newZoneId],
                            deactivateIds: [hungaryGeofence.id]
                        }),
                    });

                    if (onToggleHungary) onToggleHungary(false);
                    addNotification('success', 'Új zóna létrehozva és aktiválva');
                    onRefresh();
                    handleModalClose();
                    setNewGeofence({ name: '', centerLat: 47.4979, centerLon: 19.0402, radiusM: 25000, geofenceType: 'scenario' });
                    return;
                }
            }

            // Standard Create (Active by default)
            await createGeofence();
            onRefresh();
            handleModalClose();
            setNewGeofence({ name: '', centerLat: 47.4979, centerLon: 19.0402, radiusM: 25000, geofenceType: 'scenario' });

        } catch (error) {
            console.error(error);
            addNotification('error', 'Hálózati hiba');
        }
    };

    // Handle map click when creating zone
    const handleMapClickForZone = (lat: number, lon: number) => {
        setNewGeofence({ ...newGeofence, centerLat: lat, centerLon: lon });
        setMapClickMode(false); // Auto-disable after selecting position
    };

    const handleHungaryToggle = async () => {
        if (!hungaryGeofence) return;

        if (hungaryGeofence.active) {
            // Deactivate Hungary
            if (onToggleHungary) {
                onToggleHungary(false);
            }
        } else {
            // Activate Hungary - deactivate all custom zones and counties first
            // Atomic Bulk Update
            const idsToDeactivate = [
                ...allCustomGeofences.filter(z => z.active).map(z => z.id),
                ...countyGeofences.filter(c => c.active).map(c => c.id)
            ];

            if (idsToDeactivate.length > 0) {
                try {
                    await fetch('http://localhost:3000/api/geofence/bulk-status', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${localStorage.getItem('token')}`,
                        },
                        body: JSON.stringify({
                            activateIds: [hungaryGeofence.id],
                            deactivateIds: idsToDeactivate
                        }),
                    });

                    if (onActivateHungary) onActivateHungary();
                    onRefresh();
                } catch (err) {
                    console.error("Bulk switch failed", err);
                    addNotification('error', 'Hiba történt a váltás közben');
                }
            } else {
                if (onActivateHungary) onActivateHungary();
            }
        }
    };

    // Handle county toggle
    const handleCountyToggle = async (county: { code: string; name: string; id?: number; active: boolean }) => {
        // If turning ON a county while Hungary is active -> Turn OFF Hungary + Turn ON County atomically
        const hungaryId = hungaryGeofence?.id;
        if (!county.active && hungaryGeofence?.active && hungaryId) {
            const deactivateIds = [hungaryId];
            const activateIds = [];

            // Exclusive Logic: Budapest <-> Pest mutual exclusion
            if (county.name === 'Budapest') {
                const pest = countyGeofences.find(c => c.name.includes('Pest'));
                if (pest && pest.active) deactivateIds.push(pest.id);
            } else if (county.name.includes('Pest')) {
                const budapest = countyGeofences.find(c => c.name === 'Budapest');
                if (budapest && budapest.active) deactivateIds.push(budapest.id);
            }

            // Handle County Activation (via ID or code)
            if (county.id) {
                activateIds.push(county.id);

                try {
                    await fetch('http://localhost:3000/api/geofence/bulk-status', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${localStorage.getItem('token')}`,
                        },
                        body: JSON.stringify({ activateIds, deactivateIds }),
                    });

                    if (onToggleHungary) onToggleHungary(false);
                    addNotification('success', `${county.name} aktiválva`);
                    onRefresh();
                    return;
                } catch (e) {
                    console.error(e);
                }
            }
        }

        // Standard Exclusive Logic (Not involving Hungary active state, just normal toggle)
        if (!county.active) { // If turning ON
            const deactivateIds: number[] = [];

            if (county.name === 'Budapest') {
                const pest = countyGeofences.find(c => c.name.includes('Pest'));
                if (pest && pest.active) deactivateIds.push(pest.id);
            } else if (county.name.includes('Pest')) {
                const budapest = countyGeofences.find(c => c.name === 'Budapest');
                if (budapest && budapest.active) deactivateIds.push(budapest.id);
            }

            if (deactivateIds.length > 0 && county.id) {
                // Atomic switch for Budapest/Pest
                try {
                    await fetch('http://localhost:3000/api/geofence/bulk-status', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${localStorage.getItem('token')}`,
                        },
                        body: JSON.stringify({
                            activateIds: [county.id],
                            deactivateIds
                        }),
                    });
                    addNotification('success', `${county.name} aktiválva`);
                    onRefresh();
                    return; // Skip default handler
                } catch (e) { console.error(e); }
            }
        }

        if (county.id) {
            handleToggleGeofence(county.id, !county.active);
            if (!county.active) {
                addNotification('success', `${county.name} aktiválva`);
            } else {
                addNotification('info', `${county.name} deaktiválva`);
            }
            onRefresh();
        } else {
            try {
                const response = await fetch('http://localhost:3000/api/game-area', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                    body: JSON.stringify({ activeCounties: [county.code] }),
                });
                if (response.ok) {
                    addNotification('success', `${county.name} aktiválva`);
                    onRefresh();
                }
            } catch (error) {
                addNotification('error', 'Hiba történt');
            }
        }
    };

    // Handle custom zone toggle
    const handleCustomZoneToggle = async (id: number, newActive: boolean) => {
        const zone = allCustomGeofences.find(z => z.id === id);

        // Atomic switch: If activating a custom zone while Hungary is active
        if (newActive && hungaryGeofence?.active && hungaryGeofence.id) {
            const deactivateIds = [hungaryGeofence.id];
            const activateIds = [id];

            try {
                await fetch('http://localhost:3000/api/geofence/bulk-status', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                    body: JSON.stringify({ activateIds, deactivateIds }),
                });

                if (onToggleHungary) onToggleHungary(false);
                addNotification('success', `${zone?.name || 'Zóna'} aktiválva`);
                onRefresh();
                return;
            } catch (e) {
                console.error(e);
                addNotification('error', 'Hiba történt a váltás közben');
            }
        }

        // Standard toggle
        await handleToggleGeofence(id, newActive);

        if (newActive) {
            addNotification('success', `${zone?.name || 'Zóna'} aktiválva`);
        } else {
            addNotification('info', `${zone?.name || 'Zóna'} deaktiválva`);
        }
        onRefresh();
    };

    // Pair icon constants - SAME AS MAIN PAGE
    const PAIR_ICON_SIZE = 32;
    const PAIR_BORDER_WIDTH = 3;
    const PAIR_FONT_SIZE = 18;
    const MARKER_SIZE = 28;

    return (
        <div className="flex gap-4 h-[calc(100vh-180px)] geofence-manager">
            {/* Left side - Lists - hidden when create modal is open */}
            <div className={`flex-shrink-0 flex flex-col gap-0 overflow-hidden transition-all duration-500 ease-out mw-card p-0 ${showCreateModal ? 'w-0 opacity-0 !border-none !my-0' : 'w-[400px] opacity-100'}`}>
                <div className="w-[400px] flex flex-col h-full flex-shrink-0">
                    {/* Header - Spacious (Reverted) */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-orange-500/20 text-orange-500">
                            <FiMap className="w-6 h-6" />
                        </div>
                        Térképkezelés
                    </h3>
                </div>

                {/* Controls Area: Search & Tabs - Spacious (Reverted) */}
                <div className="p-5 space-y-4 border-b border-white/5">
                    {/* Search Input */}
                    <MwTableSearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Keresés..."
                        className="w-full"
                        inputClassName="py-2.5 w-full"
                    />

                    {/* Filter Tabs as Standard Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('counties')}
                            className={`mw-btn flex-1 justify-center gap-2 items-center ${activeTab === 'counties' ? 'mw-btn-primary' : 'mw-btn-secondary'}`}
                        >
                            <FiMap className="w-4 h-4" />
                            Vármegyék
                        </button>
                        <button
                            onClick={() => setActiveTab('custom')}
                            className={`mw-btn flex-1 justify-center gap-2 items-center ${activeTab === 'custom' ? 'mw-btn-primary' : 'mw-btn-secondary'}`}
                        >
                            <FiTarget className="w-4 h-4" />
                            Egyedi zónák
                        </button>
                    </div>
                </div>

                {/* Main List Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-0">

                    {/* Hungary Pinned Item (Only on Counties Tab) */}
                    {activeTab === 'counties' && (
                        <div className={`mx-5 mt-5 relative overflow-hidden rounded-2xl p-[1px] group transition-all duration-300 transform-gpu ${hungaryGeofence?.active ? 'border-white/10' : 'border-white/5 hover:border-white/10 bg-[#2a2a2a]'}`}>

                            {/* Animated Background Gradient Layer (Active Only) */}
                            {hungaryGeofence?.active && (
                                <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
                                    <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[#2a2a2a] z-0"></div>
                                    <div className="absolute -top-10 -left-10 w-64 h-64 bg-red-600/70 rounded-full filter blur-[60px] animate-slow-flow-contained"></div>
                                    <div className="absolute -top-10 -right-10 w-64 h-64 bg-green-600/70 rounded-full filter blur-[60px] animate-slow-flow-contained-reverse animation-delay-2000"></div>
                                    <div className="absolute -bottom-20 left-[20%] w-64 h-64 bg-white/20 rounded-full filter blur-[60px] animate-drift animation-delay-4000"></div>
                                </div>
                            )}

                            <div className={`relative z-10 rounded-2xl p-3 flex items-center justify-between h-full w-full ${hungaryGeofence?.active ? 'bg-transparent' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 flex-shrink-0 rounded-xl transition-colors flex items-center justify-center ${hungaryGeofence?.active ? 'bg-white/10 text-white shadow-lg' : 'bg-white/5 text-gray-400 group-hover:text-white'}`}>
                                        {hungaryGeofence?.metadataJson?.polygon ? (
                                            <CountyIcon polygon={hungaryGeofence.metadataJson.polygon} active={hungaryGeofence.active} className="w-7 h-7 drop-shadow-md" />
                                        ) : (
                                            <FiGlobe className="w-7 h-7 drop-shadow-md" />
                                        )}
                                    </div>
                                    <div className="drop-shadow-md">
                                        <div className="font-semibold text-white text-[15px] leading-tight mb-0.5">Magyarország</div>
                                        <div className={`text-[11px] font-bold uppercase tracking-wider ${hungaryGeofence?.active ? 'text-gray-100' : 'text-gray-500'}`}>
                                            {hungaryGeofence?.active ? 'Aktív játékterület' : 'Teljes nézet'}
                                        </div>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shadow-md rounded-full flex-shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={hungaryGeofence?.active || false}
                                        onChange={handleHungaryToggle}
                                        className="sr-only peer"
                                    />
                                    <div className="w-10 h-6 bg-[#404040] peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 transition-colors duration-200"></div>
                                    <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-200 peer-checked:translate-x-4"></div>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Section Label */}
                    {/* Section Label */}
                    <div className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center justify-between">
                        <span>{activeTab === 'counties' ? 'Vármegyék listája' : 'Létrehozott zónák'}</span>
                        <span className="bg-white/5 px-2 py-1 rounded text-[10px] text-gray-400">
                            {activeTab === 'counties' ? filteredAllCounties.length : filteredCustomGeofences.length}
                        </span>
                    </div>

                    {/* Lists */}
                    <div className="space-y-1 px-4 pb-4">
                        {activeTab === 'counties' ? (
                            filteredAllCounties.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2 px-2">
                                    <FiMapPin className="w-8 h-8 opacity-30" />
                                    <p className="font-medium text-sm">
                                        {searchTerm.trim() ? 'Nincs találat a keresésre.' : 'Nincs megjeleníthető vármegye.'}
                                    </p>
                                    <p className="text-xs text-gray-600 max-w-md text-center">
                                        {searchTerm.trim()
                                            ? 'Próbáljon más keresőkifejezést, vagy törölje a szűrést a mező kiürítésével.'
                                            : 'Győződjön meg róla, hogy a szerver fut és betöltötte a megyeadatokat — szükség esetén frissítse az oldalt.'}
                                    </p>
                                </div>
                            ) : (
                                filteredAllCounties.map((county) => (
                                    <div
                                        key={county.code}
                                        className={`group flex items-center justify-between p-3 mx-1 rounded-2xl border transition-all duration-200 ${county.active ? 'bg-orange-500/10 border-orange-500/20' : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'}`}
                                    >
                                        <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => handleCountyToggle(county)}>
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${county.active ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-500 group-hover:text-gray-300'}`}>
                                                <CountyIcon polygon={county.polygon} active={county.active} />
                                            </div>
                                            <div>
                                                <div className={`text-[15px] font-semibold transition-colors ${county.active ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                                                    {county.name}
                                                </div>
                                                <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">{county.name === 'Budapest' ? 'FŐVÁROS' : 'VÁRMEGYE'}</div>
                                            </div>
                                        </div>

                                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={county.active}
                                                onChange={() => handleCountyToggle(county)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-10 h-6 bg-[#404040] peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 transition-colors duration-200"></div>
                                            <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-200 peer-checked:translate-x-4"></div>
                                        </label>
                                    </div>
                                ))
                            )
                        ) : (
                            /* Custom Zones */
                            <>
                                <div className="px-1 mb-2">
                                    <button
                                        onClick={handleModalOpen}
                                        className="w-full mw-btn mw-btn-secondary justify-center hover:bg-white/10 group dashed-border py-4 text-[15px] rounded-2xl"
                                        style={{ borderStyle: 'dashed' }}
                                    >
                                        <FiPlus className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform" />
                                        Új zóna létrehozása
                                    </button>
                                </div>

                                {filteredCustomGeofences.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2 px-2">
                                        <FiTarget className="w-8 h-8 opacity-30" />
                                        <p className="font-medium text-sm">
                                            {searchTerm.trim() ? 'Nincs találat a keresésre.' : 'Nincs létrehozott egyedi zóna.'}
                                        </p>
                                        <p className="text-xs text-gray-600 max-w-md text-center">
                                            {searchTerm.trim()
                                                ? 'Próbáljon más keresőkifejezést a név alapján, vagy törölje a szűrést a mező kiürítésével.'
                                                : 'Használja az „Új zóna létrehozása” gombot, majd jelölje ki a középpontot a térképen — a lista itt fog megjelenni.'}
                                        </p>
                                    </div>
                                ) : (
                                    filteredCustomGeofences.map((geo) => (
                                        <div
                                            key={geo.id}
                                            className={`group flex items-center justify-between p-3 mx-1 rounded-2xl border transition-all duration-200 ${geo.active ? 'bg-green-500/10 border-green-500/20' : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'}`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div
                                                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${geo.active ? 'bg-green-500 text-white' : ''}`}
                                                    style={!geo.active ? {
                                                        backgroundColor: `${getGeofenceColor(geo)}20`,
                                                        color: getGeofenceColor(geo)
                                                    } : {}}
                                                >
                                                    <FiTarget className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className={`font-semibold text-[15px] truncate ${geo.active ? 'text-white' : 'text-gray-300'}`}>
                                                        {geo.name}
                                                    </div>
                                                    <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                                                        {getTypeLabel(geo)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleDeleteGeofence(geo.id, geo.name)}
                                                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                    title="Törlés"
                                                >
                                                    <FiTrash2 className="w-4 h-4" />
                                                </button>

                                                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={geo.active}
                                                        onChange={() => handleCustomZoneToggle(geo.id, !geo.active)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-10 h-6 bg-[#404040] peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 transition-colors duration-200"></div>
                                                    <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-200 peer-checked:translate-x-4"></div>
                                                </label>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </>
                        )}
                    </div>
                </div>
                </div>
            </div>

            {/* Right side - Map */}
            <div className={`flex-1 mw-card p-0 overflow-hidden relative min-w-0 transition-all duration-500 ease-out ${showCreateModal ? 'mr-[380px]' : ''}`}>
                <MapContainer
                    center={[47.1625, 19.5033]}
                    zoom={7}
                    style={{ height: '100%', width: '100%' }}
                    attributionControl={false}
                    zoomControl={false}
                    ref={mapRef}
                >
                    <ZoomControl position="topleft" zoomInTitle="Nagyítás" zoomOutTitle="Kicsinyítés" />
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                    <MapClickHandler onClick={showCreateModal ? handleMapClickForZone : handleMapClick} active={mapClickMode} />
                    <MapResizeHandler />

                    {/* Hungary polygon */}
                    {hungaryGeofence && hungaryGeofence.metadataJson?.polygon && (
                        <Polygon
                            positions={hungaryGeofence.metadataJson.polygon.map(([lon, lat]) => [lat, lon] as [number, number])}
                            pathOptions={{
                                color: getGeofenceColor(hungaryGeofence),
                                fillColor: getGeofenceColor(hungaryGeofence),
                                fillOpacity: hungaryGeofence.active ? 0.15 : 0.03,
                                weight: hungaryGeofence.active ? 2 : 1,
                                dashArray: hungaryGeofence.active ? undefined : '5, 10'
                            }}
                            eventHandlers={{
                                click: (e) => { if (mapClickMode) e.originalEvent.stopPropagation(); }
                            }}
                        >
                            {!mapClickMode && (
                                <Popup>
                                    <div className="flex flex-col gap-3 p-4 min-w-[240px]">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_12px] ${hungaryGeofence.active ? 'bg-green-500 shadow-green-500' : 'bg-gray-600 shadow-transparent'}`} />
                                                <span className="font-bold text-white text-base leading-none">Magyarország</span>
                                            </div>
                                            <button
                                                onClick={() => mapRef.current?.closePopup()}
                                                className="text-gray-400 hover:text-white transition-colors p-0.5 -mr-1 -mt-1"
                                            >
                                                <FiX className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="h-px bg-white/10 w-full" />

                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Státusz</span>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={hungaryGeofence.active}
                                                    onChange={handleHungaryToggle}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-10 h-6 bg-red-500 peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 transition-colors duration-200"></div>
                                                <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-md transition-transform duration-200 peer-checked:translate-x-4"></div>
                                            </label>
                                        </div>
                                    </div>
                                </Popup>
                            )}
                        </Polygon>
                    )}

                    {/* County polygons */}
                    {countyGeofences.map((geo) => {
                        if (!geo.metadataJson?.polygon) return null;
                        const color = getGeofenceColor(geo);
                        return (
                            <Polygon
                                key={geo.id}
                                positions={geo.metadataJson.polygon.map(([lon, lat]) => [lat, lon] as [number, number])}
                                pathOptions={{
                                    color: color,
                                    fillColor: color,
                                    fillOpacity: geo.active ? 0.25 : 0.05,
                                    weight: geo.active ? 3 : 1,
                                    dashArray: geo.active ? undefined : '5, 10'
                                }}
                                eventHandlers={{
                                    click: (e) => { if (mapClickMode) e.originalEvent.stopPropagation(); }
                                }}
                            >
                                {!mapClickMode && (
                                    <Popup>
                                        <div className="flex flex-col gap-3 p-4 min-w-[240px]">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-2 h-2 rounded-full shadow-[0_0_10px] ${geo.active ? 'bg-green-500 shadow-green-500' : 'bg-gray-600 shadow-transparent'}`} />
                                                    <div>
                                                        <div className="font-bold text-white text-base leading-none mb-0.5">{geo.name}</div>
                                                        <div className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">{geo.name === 'Budapest' ? 'FŐVÁROS' : 'VÁRMEGYE'}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => mapRef.current?.closePopup()}
                                                    className="text-gray-400 hover:text-white transition-colors p-0.5 -mr-1 -mt-1"
                                                >
                                                    <FiX className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="h-px bg-white/10 w-full" />

                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Státusz</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={geo.active}
                                                        onChange={() => handleCountyToggle({ code: geo.metadataJson?.countyCode || '', name: geo.name, id: geo.id, active: geo.active })}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-10 h-6 bg-red-500 peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 transition-colors duration-200"></div>
                                                    <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-md transition-transform duration-200 peer-checked:translate-x-4"></div>
                                                </label>
                                            </div>
                                        </div>
                                    </Popup>
                                )}
                            </Polygon>
                        );
                    })}

                    {/* Custom zones */}
                    {allCustomGeofences.map((geo) => {
                        const color = getGeofenceColor(geo);
                        if (geo.metadataJson?.polygon && geo.metadataJson?.type === 'polygon') {
                            return (
                                <Polygon
                                    key={geo.id}
                                    positions={geo.metadataJson.polygon.map(([lon, lat]) => [lat, lon] as [number, number])}
                                    pathOptions={{
                                        color: color,
                                        fillColor: color,
                                        fillOpacity: geo.active ? 0.3 : 0.05,
                                        weight: geo.active ? 3 : 1,
                                    }}
                                    eventHandlers={{
                                        click: (e) => { if (mapClickMode) e.originalEvent.stopPropagation(); }
                                    }}
                                >
                                    {!mapClickMode && (
                                        <Popup>
                                            <div className="flex flex-col gap-3 p-4 min-w-[240px]">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`w-2 h-2 rounded-full shadow-[0_0_10px] ${geo.active ? 'bg-green-500 shadow-green-500' : 'bg-gray-600 shadow-transparent'}`} />
                                                        <div>
                                                            <div className="font-bold text-white text-base leading-none mb-0.5">{geo.name}</div>
                                                            <div className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">{getTypeLabel(geo)}</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => mapRef.current?.closePopup()}
                                                        className="text-gray-400 hover:text-white transition-colors p-0.5 -mr-1 -mt-1"
                                                    >
                                                        <FiX className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="h-px bg-white/10 w-full" />

                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Státusz</span>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={geo.active}
                                                            onChange={() => handleCustomZoneToggle(geo.id, !geo.active)}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-10 h-6 bg-red-500 peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 transition-colors duration-200"></div>
                                                        <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-md transition-transform duration-200 peer-checked:translate-x-4"></div>
                                                    </label>
                                                </div>
                                            </div>
                                        </Popup>
                                    )}
                                </Polygon>
                            );
                        }
                        return (
                            <Circle
                                key={geo.id}
                                center={[geo.centerLat, geo.centerLon]}
                                radius={geo.radiusM}
                                pathOptions={{
                                    color: color,
                                    fillColor: color,
                                    fillOpacity: geo.active ? 0.3 : 0.05,
                                    weight: geo.active ? 2 : 1,
                                }}
                                eventHandlers={{
                                    click: (e) => { if (mapClickMode) e.originalEvent.stopPropagation(); }
                                }}
                            >
                                {!mapClickMode && (
                                    <Popup>
                                        <div className="flex flex-col gap-3 p-4 min-w-[240px]">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-2 h-2 rounded-full shadow-[0_0_10px] ${geo.active ? 'bg-green-500 shadow-green-500' : 'bg-gray-600 shadow-transparent'}`} />
                                                    <div>
                                                        <div className="font-bold text-white text-base leading-none mb-0.5">{geo.name}</div>
                                                        <div className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">{getTypeLabel(geo)}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => mapRef.current?.closePopup()}
                                                    className="text-gray-400 hover:text-white transition-colors p-0.5 -mr-1 -mt-1"
                                                >
                                                    <FiX className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="h-px bg-white/10 w-full" />

                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Státusz</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={geo.active}
                                                        onChange={() => handleCustomZoneToggle(geo.id, !geo.active)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-10 h-6 bg-red-500 peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 transition-colors duration-200"></div>
                                                    <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-md transition-transform duration-200 peer-checked:translate-x-4"></div>
                                                </label>
                                            </div>
                                        </div>
                                    </Popup>
                                )}
                            </Circle>
                        );
                    })}

                    {showCreateModal && newGeofence.centerLat && newGeofence.centerLon && newGeofence.radiusM > 0 && (
                        <Circle
                            center={[newGeofence.centerLat, newGeofence.centerLon]}
                            radius={newGeofence.radiusM}
                            pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.3, dashArray: '5, 5' }}
                        />
                    )}

                    {/* Browser location marker */}
                    {browserLocation && (
                        <SmoothAnimatedMarker
                            key="admin-browser-location"
                            position={[browserLocation.lat, browserLocation.lon]}
                            duration={380}
                            icon={L.divIcon({
                                className: 'custom-browser-location-marker',
                                html: `<div style="width:${MARKER_SIZE}px;height:${MARKER_SIZE}px;border-radius:50%;box-shadow:0 3px 10px rgba(0,0,0,0.4);background-image:url(${mwOrangeImage});background-size:cover;background-position:center;overflow:hidden;"></div>`,
                                iconSize: [MARKER_SIZE, MARKER_SIZE],
                                iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
                            })}
                        >
                            <Popup>
                                <div className="p-3 min-w-[200px]">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <FiMapPin className="w-4 h-4 text-orange-500" />
                                            <strong className="text-white">Saját pozíció</strong>
                                        </div>
                                        <button
                                            onClick={() => mapRef.current?.closePopup()}
                                            className="text-gray-400 hover:text-white transition-colors"
                                        >
                                            <FiX className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                                        <div className="text-xs text-gray-400 flex items-center justify-between">
                                            <span>Szélesség:</span>
                                            <span className="font-mono text-white">{browserLocation.lat.toFixed(5)}</span>
                                        </div>
                                        <div className="text-xs text-gray-400 flex items-center justify-between mt-1">
                                            <span>Hosszúság:</span>
                                            <span className="font-mono text-white">{browserLocation.lon.toFixed(5)}</span>
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </SmoothAnimatedMarker>
                    )}

                    {/* Pair markers - SAME STYLE AS MAIN PAGE */}
                    {pairs.filter(p => p.active && p.lastPosition && p.lastPosition.lat != null && p.lastPosition.lon != null && !p.captured).map((pair) => {
                        const hasViolation = !!activeGameAreaExitViolations?.[pair.id];
                        return (
                            <SmoothAnimatedMarker
                                key={`pair-${pair.id}`}
                                position={[pair.lastPosition!.lat, pair.lastPosition!.lon]}
                                duration={400}
                                icon={L.divIcon({
                                    className: 'custom-pair-marker',
                                    html: buildPairMarkerDivHtml({
                                        assignedNumber: pair.assignedNumber,
                                        mostWanted: !!pair.mostWanted,
                                        hasViolation,
                                        size: PAIR_ICON_SIZE,
                                        fontSize: PAIR_FONT_SIZE,
                                        borderWidth: PAIR_BORDER_WIDTH,
                                        borderColor: '#f36f26',
                                    }),
                                    iconSize: [PAIR_ICON_SIZE, PAIR_ICON_SIZE],
                                    iconAnchor: [PAIR_ICON_SIZE / 2, PAIR_ICON_SIZE / 2],
                                })}
                                eventHandlers={{
                                    click: () => {
                                        if (onPairSelect) onPairSelect(pair);
                                    }
                                }}
                            />
                        );
                    })}
                </MapContainer>

                {/* Map click mode indicator */}
                {
                    mapClickMode && (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000]">
                            <div className="bg-[#1a1a1a]/85 backdrop-blur-[12px] border border-white/10 text-[#f36f26] px-4 py-2 rounded-xl flex items-center gap-2.5 shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                </span>
                                <span className="text-xs font-bold text-gray-300">Válasszon pozíciót</span>
                            </div>
                        </div>
                    )
                }
            </div >

            {/* Create Zone Modal - Floating Glass Panel (Professional & Clean) */}
            <div className={`fixed top-4 right-4 bottom-4 w-[360px] z-[9999] flex flex-col transform transition-all duration-500 ease-out ${showCreateModal ? 'translate-x-0 opacity-100' : 'translate-x-[calc(100%+20px)] opacity-0 pointer-events-none'}`}>

                {/* Main Glass Container */}
                <div className="flex-1 flex flex-col bg-[#121212]/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[24px] overflow-hidden relative">

                    {/* Header - Clean & Minimal */}
                    <div className="h-[80px] flex items-center justify-between px-6 border-b border-white/10 bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-orange-500 flex items-center justify-center">
                                <FiPlus className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white leading-tight">Új zóna</h3>
                                <p className="text-xs text-gray-500 font-medium mt-0.5">Létrehozás</p>
                            </div>
                        </div>
                        <button
                            onClick={handleModalClose}
                            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-all"
                            title="Bezárás"
                        >
                            <FiX className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar">

                        {/* 1. Kártya: Általános Beállítások */}
                        <div className="bg-white/[0.03] border border-white/5 rounded-[20px] p-5 space-y-5">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500">
                                    <span className="text-xs font-bold">1</span>
                                </div>
                                <h4 className="text-white text-sm font-semibold">Alapinformációk</h4>
                            </div>

                            {/* Name Input */}
                            <div className="space-y-2">
                                <label className="block text-gray-400 text-[11px] font-bold uppercase tracking-wider ml-1">Zóna neve</label>
                                <input
                                    type="text"
                                    value={newGeofence.name}
                                    onChange={(e) => setNewGeofence({ ...newGeofence, name: e.target.value })}
                                    className="mw-input w-full bg-black/20 focus:bg-black/40 transition-colors border-white/10"
                                    placeholder="Pl. Városháza környéke"
                                />
                            </div>
                        </div>

                        {/* 2. Kártya: Térbeli Elhelyezkedés */}
                        <div className="bg-white/[0.03] border border-white/5 rounded-[20px] p-5 space-y-5">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500">
                                    <span className="text-xs font-bold">2</span>
                                </div>
                                <h4 className="text-white text-sm font-semibold">Térbeli adatok</h4>
                            </div>

                            {/* Radius Input with custom wrapper */}
                            <div className="space-y-2">
                                <label className="block text-gray-400 text-[11px] font-bold uppercase tracking-wider ml-1">Zóna hatósugara</label>
                                <div className="relative flex items-center bg-black/20 focus-within:bg-black/40 border border-white/10 focus-within:border-[#f36f26]/50 rounded-[14px] transition-all duration-200 overflow-hidden group">
                                    <input
                                        type="number"
                                        value={newGeofence.radiusM ? (radiusUnit === 'km' ? newGeofence.radiusM / 1000 : newGeofence.radiusM) : ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '') {
                                                setNewGeofence({ ...newGeofence, radiusM: '' });
                                            } else {
                                                const parsed = parseFloat(val);
                                                setNewGeofence({ ...newGeofence, radiusM: radiusUnit === 'km' ? Math.round(parsed * 1000) : Math.round(parsed) });
                                            }
                                        }}
                                        className="w-full bg-transparent border-none text-white pl-4 pr-[150px] py-3 text-[14px] focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder-gray-600 outline-none"
                                        placeholder={`Hatósugár (${radiusUnit === 'km' ? 'km' : 'm'})`}
                                        step={radiusUnit === 'km' ? "0.1" : "100"}
                                    />
                                    
                                    <div className="absolute right-2 flex items-center gap-2">
                                        <button 
                                            onClick={() => setRadiusUnit(u => u === 'm' ? 'km' : 'm')}
                                            className="text-[10px] font-bold text-gray-500 hover:text-white uppercase transition-colors px-1"
                                            title="Mértékegység váltása"
                                        >
                                            {radiusUnit === 'km' ? 'kilométer' : 'méter'}
                                        </button>
                                        <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg border border-white/5 opacity-80 group-focus-within:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => {
                                                    const step = radiusUnit === 'km' ? 1000 : 100;
                                                    setNewGeofence({ ...newGeofence, radiusM: Math.max(0, (newGeofence.radiusM || 0) - step) });
                                                }}
                                                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-all active:scale-95"
                                                title={`-${radiusUnit === 'km' ? '1km' : '100m'}`}
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                            </button>
                                            <span className="w-px h-3 bg-white/10"></span>
                                            <button 
                                                onClick={() => {
                                                    const step = radiusUnit === 'km' ? 1000 : 100;
                                                    setNewGeofence({ ...newGeofence, radiusM: (newGeofence.radiusM || 0) + step });
                                                }}
                                                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-all active:scale-95"
                                                title={`+${radiusUnit === 'km' ? '1km' : '100m'}`}
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Divider Line within card */}
                            <div className="h-px bg-white/5 w-full my-4" />

                            {/* Location Picker Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="block text-gray-400 text-[11px] font-bold uppercase tracking-wider ml-1">Térképi pozíció</label>
                                    {newGeofence.centerLat && newGeofence.centerLon ? (
                                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full flex items-center gap-1.5 border border-emerald-400/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                            Kiválasztva
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-full flex items-center gap-1.5 border border-white/5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                                            Nincs megadva
                                        </span>
                                    )}
                                </div>

                                <button
                                    onClick={() => setMapClickMode(!mapClickMode)}
                                    className={`relative w-full py-4 rounded-xl font-medium text-[13px] uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-2.5 border overflow-hidden group ${mapClickMode
                                        ? 'bg-orange-500/10 text-orange-400 border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)]'
                                        : 'bg-black/20 text-gray-300 border-white/5 hover:bg-black/40 hover:border-white/20 hover:text-white'
                                        }`}
                                >
                                    {/* Map Ping Animation Background when active */}
                                    {mapClickMode && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/10 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite] pointer-events-none"></div>
                                    )}

                                    <FiMapPin className={`w-4 h-4 relative z-10 transition-transform ${mapClickMode ? 'scale-110 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]' : 'group-hover:translate-y-[-2px] text-gray-400 group-hover:text-white'}`} />
                                    <span className="relative z-10 font-bold">{mapClickMode ? 'Kattintson a térképre...' : 'Pozíció kijelölése'}</span>

                                    {/* Animated Ring when active */}
                                    {mapClickMode && (
                                        <span className="absolute flex h-2 w-2 top-3 right-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                        </span>
                                    )}
                                </button>

                                {/* Coordinates Formatted Cleanly */}
                                <div className="bg-black/30 rounded-xl p-3 border border-white/5 relative overflow-hidden">
                                    {/* Background decoration */}
                                    <div className="absolute -right-2 -bottom-2 opacity-[0.03] pointer-events-none text-white">
                                        <FiGlobe className="w-24 h-24" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 relative z-10">
                                        <div className="space-y-1 relative">
                                            <label className="block text-gray-500 text-[9px] uppercase tracking-wider font-bold">Szélesség (LAT)</label>
                                            <input
                                                type="number"
                                                value={newGeofence.centerLat || ''}
                                                onChange={(e) => setNewGeofence({ ...newGeofence, centerLat: parseFloat(e.target.value) || 0 })}
                                                className="w-full bg-transparent border-none p-0 text-[13px] font-mono text-gray-300 focus:ring-0 focus:text-white transition-colors placeholder:text-gray-700"
                                                placeholder="0.00000"
                                            />
                                        </div>
                                        <div className="space-y-1 relative pl-3 before:content-[''] before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[1px] before:bg-white/10">
                                            <label className="block text-gray-500 text-[9px] uppercase tracking-wider font-bold">Hosszúság (LON)</label>
                                            <input
                                                type="number"
                                                value={newGeofence.centerLon || ''}
                                                onChange={(e) => setNewGeofence({ ...newGeofence, centerLon: parseFloat(e.target.value) || 0 })}
                                                className="w-full bg-transparent border-none p-0 text-[13px] font-mono text-gray-300 focus:ring-0 focus:text-white transition-colors placeholder:text-gray-700"
                                                placeholder="0.00000"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer - Premium Styling */}
                    <div className="p-5 border-t border-white/10 bg-black/20 backdrop-blur-md relative">
                        <button
                            onClick={handleCreate}
                            disabled={!newGeofence.name || !newGeofence.centerLat || !newGeofence.centerLon || !newGeofence.radiusM || newGeofence.radiusM <= 0}
                            className="relative w-full group overflow-hidden rounded-[14px] p-[1px] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {/* Animated gradient border wrapper */}
                            <span className="absolute inset-0 bg-gradient-to-r from-orange-600 via-orange-400 to-orange-600 rounded-[14px] opacity-70 group-hover:opacity-100 transition-opacity"></span>

                            {/* Inner button surface */}
                            <div className="relative bg-[#1a1a1a] group-hover:bg-[#222222] transition-colors rounded-[13px] px-6 py-3.5 flex items-center justify-center gap-2">
                                <FiPlus className="w-5 h-5 text-orange-500" />
                                <span className="font-bold text-[15px] text-white tracking-wide">Zóna létrehozása</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div >
        </div >
    );
}
