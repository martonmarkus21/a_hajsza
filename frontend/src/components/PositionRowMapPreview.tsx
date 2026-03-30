import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';

function CenterOnPoint({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], 14, { animate: false });
    map.invalidateSize({ animate: false });
  }, [map, lat, lon]);
  return null;
}

interface PositionRowMapPreviewProps {
  lat: number;
  lon: number;
  onClick: () => void;
  title?: string;
}

/**
 * Lista sor: kis térkép előnézet, kattintásra részletes nézet.
 */
export default function PositionRowMapPreview({ lat, lon, onClick, title }: PositionRowMapPreviewProps) {
  return (
    <button
      type="button"
      title={title || 'Megtekintés térképen'}
      onClick={onClick}
      className="group relative block mx-auto rounded-2xl overflow-hidden border border-white/15 bg-black/40 shadow-inner w-[7.5rem] h-[5.25rem] shrink-0 transition-all duration-200 hover:border-white/25 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50"
    >
      <span className="absolute inset-0 z-[400] bg-black/0 group-hover:bg-black/45 transition-colors duration-200 pointer-events-none rounded-2xl backdrop-blur-0 group-hover:backdrop-blur-[6px]" />
      <div className="absolute inset-0 z-[410] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none px-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.85)]">
          Megnyitás
        </span>
      </div>
      <div className="h-full w-full pointer-events-none [&_.leaflet-container]:pointer-events-none">
      <MapContainer
        center={[lat, lon]}
        zoom={14}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        boxZoom={false}
        keyboard={false}
        attributionControl={false}
        className="!h-full !w-full !z-0"
        style={{ background: '#0a0a0a' }}
      >
        <CenterOnPoint lat={lat} lon={lon} />
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="" />
        <CircleMarker
          center={[lat, lon]}
          radius={8}
          pathOptions={{
            color: '#fff',
            weight: 2,
            fillColor: '#3b82f6',
            fillOpacity: 0.95,
          }}
        />
      </MapContainer>
      </div>
    </button>
  );
}
