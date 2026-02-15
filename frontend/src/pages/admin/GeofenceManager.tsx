import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Circle, Polygon, Popup, Marker, useMapEvents, useMap, ZoomControl } from 'react-leaflet';
import { FiPlus, FiTrash2, FiMapPin, FiGlobe, FiTarget, FiX, FiCheck, FiMap, FiSearch } from 'react-icons/fi';

import L from 'leaflet';
import mwOrangeImage from '../../assets/images/mw_orange.png';
import { useNotification } from '../../contexts/NotificationContext';

import { Pair } from '../../types';

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
    getGeofenceTypeLabel: (type: string) => string;
    pairs: Pair[];
    onActivateHungary?: () => void;
    onToggleHungary?: (active: boolean) => void;
    onPairSelect?: (pair: Pair) => void;
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
    getGeofenceTypeLabel,
    pairs,
    onActivateHungary,
    onToggleHungary,
    onPairSelect
}: GeofenceManagerProps) {
    const { addNotification } = useNotification();
    const [browserLocation, setBrowserLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Tab State for Sidebar
    const [activeTab, setActiveTab] = useState<'custom' | 'counties'>('counties');
    const [searchTerm, setSearchTerm] = useState('');



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

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            'game_area': 'Játékterület',
            'scenario': 'Scenarió',
            'crossing_point': 'Átkelési pont',
        };
        return labels[type] || getGeofenceTypeLabel(type) || type;
    };

    const getGeofenceColor = (geo: Geofence) => {
        if (!geo.active) return '#6b7280';
        if (geo.geofenceType === 'game_area') return '#f36f26';
        if (geo.geofenceType === 'scenario') return '#10b981';
        return '#f59e0b';
    };

    const handleCreate = async () => {
        // If Hungary is active, deactivate it before creating custom zone
        if (hungaryGeofence?.active && onToggleHungary) {
            await onToggleHungary(false);
        }
        createGeofence();
        handleModalClose();
    };

    // Handle map click when creating zone
    const handleMapClickForZone = (lat: number, lon: number) => {
        setNewGeofence({ ...newGeofence, centerLat: lat, centerLon: lon });
        setMapClickMode(false); // Auto-disable after selecting position
    };

    const handleHungaryToggle = async () => {
        if (hungaryGeofence?.active) {
            // Deactivate Hungary
            if (onToggleHungary) {
                onToggleHungary(false);
            }
        } else {
            // Activate Hungary - deactivate all custom zones and counties first
            for (const zone of allCustomGeofences.filter(z => z.active)) {
                await handleToggleGeofence(zone.id, false);
            }
            for (const county of countyGeofences.filter(c => c.active)) {
                await handleToggleGeofence(county.id, false);
            }
            if (onActivateHungary) {
                onActivateHungary();
            }
        }
    };

    // Handle county toggle
    const handleCountyToggle = async (county: { code: string; name: string; id?: number; active: boolean }) => {
        if (!county.active && hungaryGeofence?.active && onToggleHungary) {
            await onToggleHungary(false);
        }

        // Exclusive Logic: Budapest <-> Pest vármegye
        if (!county.active) { // If turning ON
            if (county.name === 'Budapest') {
                const pest = countyGeofences.find(c => c.name.includes('Pest'));
                if (pest && pest.active) {
                    await handleToggleGeofence(pest.id, false);
                    addNotification('info', `${pest.name} deaktiválva`);
                }
            } else if (county.name.includes('Pest')) {
                const budapest = countyGeofences.find(c => c.name === 'Budapest');
                if (budapest && budapest.active) {
                    await handleToggleGeofence(budapest.id, false);
                    addNotification('info', 'Budapest deaktiválva');
                }
            }
        }

        if (county.id) {
            handleToggleGeofence(county.id, !county.active);
            if (!county.active) {
                addNotification('success', `${county.name} aktiválva`);
            } else {
                addNotification('info', `${county.name} deaktiválva`);
            }
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
                    window.location.reload();
                }
            } catch (error) {
                addNotification('error', 'Hiba történt');
            }
        }
    };

    // Handle custom zone toggle
    const handleCustomZoneToggle = async (id: number, newActive: boolean) => {
        const zone = allCustomGeofences.find(z => z.id === id);

        if (newActive && hungaryGeofence?.active && onToggleHungary) {
            await onToggleHungary(false);
        }

        handleToggleGeofence(id, newActive);

        if (newActive) {
            addNotification('success', `${zone?.name || 'Zóna'} aktiválva`);
        } else {
            addNotification('info', `${zone?.name || 'Zóna'} deaktiválva`);
        }
    };

    // Pair icon constants - SAME AS MAIN PAGE
    const PAIR_ICON_SIZE = 32;
    const PAIR_BORDER_WIDTH = 3;
    const PAIR_FONT_SIZE = 18;
    const MARKER_SIZE = 28;

    return (
        <div className="flex gap-4 h-[calc(100vh-180px)] geofence-manager">
            {/* Left side - Lists - hidden when create modal is open */}
            <div className={`flex-shrink-0 flex flex-col gap-0 overflow-hidden transition-all duration-500 ease-out mw-card p-0 ${showCreateModal ? 'w-0 opacity-0' : 'w-[400px] opacity-100'}`}>

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
                    <div className="relative group">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors pointer-events-none w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Keresés..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="mw-input pl-11 py-2.5 w-full"
                        />
                    </div>

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

                            <div className={`relative z-10 rounded-2xl p-4 flex items-center justify-between h-full w-full ${hungaryGeofence?.active ? 'bg-transparent' : ''}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-xl transition-colors ${hungaryGeofence?.active ? 'bg-white/10 text-white shadow-lg' : 'bg-white/5 text-gray-400 group-hover:text-white'}`}>
                                        <FiGlobe className="w-6 h-6 drop-shadow-md" />
                                    </div>
                                    <div className="drop-shadow-md">
                                        <div className="font-bold text-white text-base">Magyarország</div>
                                        <div className={`text-[13px] ${hungaryGeofence?.active ? 'text-gray-100 font-medium' : 'text-gray-500'}`}>
                                            {hungaryGeofence?.active ? 'Aktív játékterület' : 'Teljes nézet'}
                                        </div>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shadow-lg rounded-full">
                                    <input
                                        type="checkbox"
                                        checked={hungaryGeofence?.active || false}
                                        onChange={handleHungaryToggle}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-[#404040] peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 transition-colors duration-200 shadow-inner border border-white/5"></div>
                                    <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-md transition-transform duration-200 peer-checked:translate-x-5"></div>
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
                                <div className="text-center py-12 opacity-50">
                                    <div className="bg-white/5 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <FiMapPin className="w-6 h-6 text-gray-500" />
                                    </div>
                                    <div className="text-sm text-gray-400">Nincs találat</div>
                                </div>
                            ) : (
                                filteredAllCounties.map((county) => (
                                    <div
                                        key={county.code}
                                        className={`group flex items-center justify-between p-3 mx-1 rounded-2xl border transition-all duration-200 ${county.active ? 'bg-orange-500/10 border-orange-500/20' : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'}`}
                                    >
                                        <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => handleCountyToggle(county)}>
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${county.active ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-500 group-hover:text-gray-300'}`}>
                                                <FiMap className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className={`text-[15px] font-semibold transition-colors ${county.active ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                                                    {county.name}
                                                </div>
                                                <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">{county.name === 'Budapest' ? 'FŐVÁROS' : 'VÁRMEGYE'}</div>
                                            </div>
                                        </div>

                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={county.active}
                                                onChange={() => handleCountyToggle(county)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-[#404040] peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 transition-colors duration-200 shadow-inner border border-white/5"></div>
                                            <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-md transition-transform duration-200 peer-checked:translate-x-5"></div>
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
                                    <div className="text-center py-12 opacity-50">
                                        <div className="bg-white/5 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <FiTarget className="w-6 h-6 text-gray-500" />
                                        </div>
                                        <div className="text-sm text-gray-400">{searchTerm ? 'Nincs találat' : 'Nincs zóna'}</div>
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
                                                        {getTypeLabel(geo.geofenceType)}
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

                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={geo.active}
                                                        onChange={() => handleCustomZoneToggle(geo.id, !geo.active)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-[#404040] peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 transition-colors duration-200 shadow-inner border border-white/5"></div>
                                                    <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-md transition-transform duration-200 peer-checked:translate-x-5"></div>
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

            {/* Right side - Map */}
            <div className={`flex-1 mw-card p-0 overflow-hidden relative min-w-0 transition-all duration-500 ease-out ${showCreateModal ? 'mr-[360px]' : ''}`}>
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
                                                            <div className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">{getTypeLabel(geo.geofenceType)}</div>
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
                                                        <div className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">{getTypeLabel(geo.geofenceType)}</div>
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

                    {/* Preview circle for new zone */}
                    {showCreateModal && newGeofence.centerLat && newGeofence.centerLon && (
                        <Circle
                            center={[newGeofence.centerLat, newGeofence.centerLon]}
                            radius={newGeofence.radiusM || 100}
                            pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.3, dashArray: '5, 5' }}
                        />
                    )}

                    {/* Browser location marker */}
                    {browserLocation && (
                        <Marker
                            position={[browserLocation.lat, browserLocation.lon]}
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
                        </Marker>
                    )}

                    {/* Pair markers - SAME STYLE AS MAIN PAGE */}
                    {pairs.filter(p => p.active && p.lastPosition && p.lastPosition.lat != null && p.lastPosition.lon != null && !p.captured).map((pair) => {
                        const backgroundColor = pair.mostWanted ? '#f36f26' : '#2a2a2a';
                        const borderColor = '#f36f26';
                        return (
                            <Marker
                                key={`pair-${pair.id}`}
                                position={[pair.lastPosition!.lat, pair.lastPosition!.lon]}
                                icon={L.divIcon({
                                    className: 'custom-pair-marker',
                                    html: `<div style="background-color:${backgroundColor};width:${PAIR_ICON_SIZE}px;height:${PAIR_ICON_SIZE}px;border-radius:50%;border:${PAIR_BORDER_WIDTH}px solid ${borderColor};display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:${PAIR_FONT_SIZE}px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${pair.assignedNumber}</div>`,
                                    iconSize: [PAIR_ICON_SIZE, PAIR_ICON_SIZE],
                                    iconAnchor: [PAIR_ICON_SIZE / 2, PAIR_ICON_SIZE / 2],
                                })}
                                eventHandlers={{
                                    click: () => {
                                        // Prevent map click if needed, though Marker usually captures it
                                        // e.originalEvent.stopPropagation();
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
                            <div style={{ backgroundColor: '#1A1A1AD9' }} className="backdrop-blur-md border border-orange-500/50 text-gray-300 px-4 py-2 rounded-xl flex items-center gap-2.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                </span>
                                <span className="text-xs">Válassz pozíciót</span>
                            </div>
                        </div>
                    )
                }
            </div >

            {/* Create Zone Modal */}
            < div className={`fixed top-0 right-0 h-full w-[360px] bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] z-[9999] flex flex-col border-l border-green-500/30 transform transition-all duration-500 ease-out ${showCreateModal ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}>
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-green-500/10 to-transparent pointer-events-none"></div>

                <div className="relative flex items-center justify-between p-5 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                            <FiTarget className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Új zóna</h3>
                            <p className="text-xs text-gray-400">Egyedi terület létrehozása</p>
                        </div>
                    </div>
                    <button
                        onClick={handleModalClose}
                        className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                    >
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 p-5 space-y-5 overflow-y-auto custom-scrollbar">
                    <div className="space-y-2">
                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider">Zóna neve</label>
                        <input
                            type="text"
                            value={newGeofence.name}
                            onChange={(e) => setNewGeofence({ ...newGeofence, name: e.target.value })}
                            className="mw-input"
                            placeholder="Pl. Városháza környéke"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider">Típus</label>
                        <div className="relative">
                            <select
                                value={newGeofence.geofenceType}
                                onChange={(e) => setNewGeofence({ ...newGeofence, geofenceType: e.target.value })}
                                className="mw-input appearance-none cursor-pointer"
                            >
                                <option value="scenario" className="bg-gray-900">Scenarió</option>
                                <option value="crossing_point" className="bg-gray-900">Átkelési pont</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider">Sugár (méter)</label>
                        <input
                            type="number"
                            value={newGeofence.radiusM}
                            onChange={(e) => setNewGeofence({ ...newGeofence, radiusM: parseInt(e.target.value) || 0 })}
                            className="mw-input"
                        />
                    </div>

                    <div className="space-y-3 pt-3 border-t border-white/10">
                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider">Pozíció kiválasztása</label>
                        <button
                            onClick={() => setMapClickMode(!mapClickMode)}
                            onMouseUp={(e) => (e.currentTarget as HTMLButtonElement).blur()}
                            className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${mapClickMode
                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                                : 'mw-btn-secondary text-gray-300'
                                }`}
                        >
                            <FiMapPin className={`w-4 h-4 ${mapClickMode ? 'animate-bounce' : ''}`} />
                            {mapClickMode ? 'Kattints a térképen!' : 'Kiválasztás térképről'}
                        </button>

                        {newGeofence.centerLat && newGeofence.centerLon && (
                            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                                <FiCheck className="w-4 h-4 text-green-400 flex-shrink-0" />
                                <span className="text-xs text-green-400 font-mono">
                                    {newGeofence.centerLat.toFixed(5)}, {newGeofence.centerLon.toFixed(5)}
                                </span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="block text-gray-500 text-[10px] uppercase tracking-wider">Szélesség</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={newGeofence.centerLat || ''}
                                    onChange={(e) => setNewGeofence({ ...newGeofence, centerLat: parseFloat(e.target.value) || 0 })}
                                    className="mw-input py-2 text-xs font-mono"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-gray-500 text-[10px] uppercase tracking-wider">Hosszúság</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={newGeofence.centerLon || ''}
                                    onChange={(e) => setNewGeofence({ ...newGeofence, centerLon: parseFloat(e.target.value) || 0 })}
                                    className="mw-input py-2 text-xs font-mono"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-white/10 bg-black/20">
                    <button
                        onClick={handleCreate}
                        disabled={!newGeofence.name || !newGeofence.centerLat || !newGeofence.centerLon}
                        className="w-full mw-btn mw-btn-primary justify-center py-4 text-base disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                    >
                        <FiPlus className="w-5 h-5" />
                        <span>Zóna létrehozása</span>
                    </button>
                </div>
            </div >
        </div >
    );
}
