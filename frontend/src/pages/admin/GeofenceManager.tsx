
import { MapContainer, TileLayer, LayersControl, Circle, Popup, useMapEvents } from 'react-leaflet';
import { FiMap, FiPlus, FiTrash2, FiEye, FiEyeOff, FiMapPin } from 'react-icons/fi';

interface GeofenceManagerProps {
    geofences: any[];
    newGeofence: any;
    setNewGeofence: (geofence: any) => void;
    createGeofence: () => void;
    handleToggleGeofence: (id: number, active: boolean) => void;
    handleDeleteGeofence: (id: number, name: string) => void;
    mapClickMode: boolean;
    setMapClickMode: (mode: boolean) => void;
    handleMapClick: (lat: number, lon: number) => void;
    getGeofenceTypeLabel: (type: string) => string;
    pairs: any[];
}

// Map helper
function MapClickHandler({ onClick }: { onClick: (lat: number, lon: number) => void }) {
    useMapEvents({
        click: (e) => onClick(e.latlng.lat, e.latlng.lng),
    });
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
    getGeofenceTypeLabel
}: GeofenceManagerProps) {
    return (
        <div className="space-y-6">
            {/* Create Geofence Card */}
            <div className="mw-card">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <FiMap className="w-6 h-6 text-orange-500" />
                    Új Geofence Létrehozása
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end mb-4">
                    <div>
                        <label className="block text-gray-400 text-xs font-bold mb-1 uppercase">Név</label>
                        <input
                            type="text"
                            value={newGeofence.name}
                            onChange={(e) => setNewGeofence({ ...newGeofence, name: e.target.value })}
                            className="mw-input"
                            placeholder="Zóna neve"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 text-xs font-bold mb-1 uppercase">Típus</label>
                        <select
                            value={newGeofence.geofenceType}
                            onChange={(e) => setNewGeofence({ ...newGeofence, geofenceType: e.target.value })}
                            className="mw-input appearance-none"
                        >
                            <option value="scenario">Scenarió (Játékmenet)</option>
                            <option value="game_area">Játékterület (Határ)</option>
                            <option value="crossing_point">Átkelési Pont</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-gray-400 text-xs font-bold mb-1 uppercase">Sugár (méter)</label>
                        <input
                            type="number"
                            value={newGeofence.radiusM}
                            onChange={(e) => setNewGeofence({ ...newGeofence, radiusM: parseInt(e.target.value) || 0 })}
                            className="mw-input"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-gray-400 text-xs font-bold mb-1 uppercase">Latitude</label>
                            <input
                                type="number"
                                value={newGeofence.centerLat}
                                onChange={(e) => setNewGeofence({ ...newGeofence, centerLat: parseFloat(e.target.value) || 0 })}
                                className="mw-input font-mono text-sm"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-gray-400 text-xs font-bold mb-1 uppercase">Longitude</label>
                            <input
                                type="number"
                                value={newGeofence.centerLon}
                                onChange={(e) => setNewGeofence({ ...newGeofence, centerLon: parseFloat(e.target.value) || 0 })}
                                className="mw-input font-mono text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setMapClickMode(!mapClickMode)}
                            className={`flex-1 px-4 py-3 rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${mapClickMode
                                ? 'bg-orange-500 text-white animate-pulse'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                        >
                            <FiMapPin className="w-5 h-5" />
                            {mapClickMode ? 'Kattints a térképen!' : 'Pozíció térképről'}
                        </button>
                        <button
                            onClick={createGeofence}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <FiPlus className="w-5 h-5" />
                            Létrehozás
                        </button>
                    </div>
                </div>
            </div>

            {/* Geofence Map Preview */}
            <div className="mw-card p-0 overflow-hidden h-96 relative border border-orange-500/20">
                <MapContainer
                    center={[47.4979, 19.0402]}
                    zoom={10}
                    style={{ height: '100%', width: '100%' }}
                >
                    <LayersControl position="topright">
                        <LayersControl.BaseLayer checked name="Térkép">
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                        </LayersControl.BaseLayer>
                        <LayersControl.BaseLayer name="Műhold">
                            <TileLayer
                                attribution='Tiles &copy; Esri'
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            />
                        </LayersControl.BaseLayer>
                        <LayersControl.BaseLayer name="Sötét mód">
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            />
                        </LayersControl.BaseLayer>
                    </LayersControl>

                    {mapClickMode && <MapClickHandler onClick={handleMapClick} />}

                    {/* Show Existing Geofences */}
                    {geofences.map((geo) => (
                        <Circle
                            key={geo.id}
                            center={[geo.centerLat, geo.centerLon]}
                            radius={geo.radiusM}
                            pathOptions={{
                                color: geo.active ? (geo.geofenceType === 'game_area' ? '#3b82f6' : '#f36f26') : '#6b7280',
                                fillColor: geo.active ? (geo.geofenceType === 'game_area' ? '#3b82f6' : '#f36f26') : '#6b7280',
                                fillOpacity: 0.1,
                                dashArray: geo.active ? undefined : '5, 10'
                            }}
                        >
                            <Popup>
                                <div className="text-gray-900">
                                    <strong>{geo.name}</strong><br />
                                    <span className="text-xs uppercase text-gray-500">{getGeofenceTypeLabel(geo.geofenceType)}</span>
                                </div>
                            </Popup>
                        </Circle>
                    ))}

                    {/* Show Preview of New Geofence */}
                    {newGeofence.centerLat && newGeofence.centerLon && (
                        <Circle
                            center={[newGeofence.centerLat, newGeofence.centerLon]}
                            radius={newGeofence.radiusM || 100}
                            pathOptions={{
                                color: '#10b981',
                                fillColor: '#10b981',
                                fillOpacity: 0.2,
                                dashArray: '10, 10'
                            }}
                        />
                    )}
                </MapContainer>
            </div>

            {/* Geofence List Table */}
            <div className="mw-card overflow-hidden p-0">
                <div className="p-6 border-b border-white/5">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <FiMap className="w-6 h-6 text-orange-500" />
                        Létrehozott Zónák
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="mw-table">
                        <thead>
                            <tr>
                                <th>Név</th>
                                <th>Típus</th>
                                <th className="text-center">Státusz</th>
                                <th className="text-right">Műveletek</th>
                            </tr>
                        </thead>
                        <tbody>
                            {geofences.map((geo) => (
                                <tr key={geo.id}>
                                    <td className="font-semibold text-white">{geo.name}</td>
                                    <td>
                                        <span className="text-xs uppercase tracking-wide text-gray-400 bg-white/5 px-2 py-1 rounded">
                                            {getGeofenceTypeLabel(geo.geofenceType)}
                                        </span>
                                    </td>
                                    <td className="text-center">
                                        <button
                                            onClick={() => handleToggleGeofence(geo.id, !geo.active)}
                                            className={`mw-badge cursor-pointer hover:scale-105 transition-transform ${geo.active ? 'active' : 'inactive'}`}
                                        >
                                            {geo.active ? <FiEye /> : <FiEyeOff />}
                                            {geo.active ? 'Aktív' : 'Inaktív'}
                                        </button>
                                    </td>
                                    <td className="text-right">
                                        <button
                                            onClick={() => handleDeleteGeofence(geo.id, geo.name)}
                                            className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <FiTrash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
