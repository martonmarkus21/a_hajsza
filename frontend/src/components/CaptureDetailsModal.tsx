import { useEffect, useState } from 'react';
import { FiMapPin, FiClock, FiUser, FiInfo, FiExternalLink } from 'react-icons/fi';
import { FaHandcuffs } from 'react-icons/fa6';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import Modal from './Modal';
import type { Pair } from '../types';
import { formatDateTimeBudapest } from '../utils/formatDateTimeBudapest';
import 'leaflet/dist/leaflet.css';

function CenterCaptureMap({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], 15, { animate: false });
    map.invalidateSize({ animate: false });
  }, [map, lat, lon]);
  return null;
}

function CaptureLocationMap({ lat, lon }: { lat: number; lon: number }) {
  return (
    <div className="h-44 w-full rounded-xl overflow-hidden border border-white/10 [&_.leaflet-container]:!h-full [&_.leaflet-container]:!w-full">
      <MapContainer
        center={[lat, lon]}
        zoom={15}
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
        <CenterCaptureMap lat={lat} lon={lon} />
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="" />
        <CircleMarker
          center={[lat, lon]}
          radius={9}
          pathOptions={{
            color: '#fff',
            weight: 2,
            fillColor: '#ef4444',
            fillOpacity: 0.95,
          }}
        />
      </MapContainer>
    </div>
  );
}

interface CaptureDetailsModalProps {
  pair: Pair | null;
  isOpen: boolean;
  onClose: () => void;
}

/** Csak az elfogás részletei (pár részletei modaltól és a párok listájától is megnyitható). */
export default function CaptureDetailsModal({ pair, isOpen, onClose }: CaptureDetailsModalProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    window.setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  if (!pair) return null;

  return (
    <Modal
      isOpen={isOpen && !isClosing}
      onClose={handleClose}
      variant="red"
      title={
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <FaHandcuffs className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Elfogás részletei</h3>
            <p className="text-xs text-gray-400">
              {pair.assignedNumber}. pár
              {pair.name ? ` · ${pair.name}` : ''}
            </p>
          </div>
        </div>
      }
    >
      <div className="p-6 space-y-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-2">
            <FiMapPin className="w-4 h-4 text-red-400/90 shrink-0" />
            <span>Elfogáskor rögzített hely</span>
          </div>
          {pair.captureLocation != null &&
          Number.isFinite(pair.captureLocation.lat) &&
          Number.isFinite(pair.captureLocation.lon) ? (
            <>
              <CaptureLocationMap lat={pair.captureLocation.lat} lon={pair.captureLocation.lon} />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 font-mono">
                <span>
                  {pair.captureLocation.lat.toFixed(5)}, {pair.captureLocation.lon.toFixed(5)}
                </span>
                <a
                  href={`https://www.google.com/maps?q=${pair.captureLocation.lat},${pair.captureLocation.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-400 hover:text-orange-300 font-sans font-semibold inline-flex items-center gap-1"
                >
                  <FiExternalLink className="w-3 h-3 opacity-70" />
                  Megnyitás Google Mapsben
                </a>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">Ehhez az elfogáshoz nincs rögzített helyadat.</p>
          )}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <FiUser className="w-4 h-4 text-red-400/90 shrink-0" />
              <div className="min-w-0">
                <div className="text-gray-400 text-[10px] uppercase tracking-wider leading-tight">Rögzítő</div>
                <p className="text-white font-medium text-sm truncate">{pair.capturedByUsername ?? '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 min-w-0 sm:justify-end sm:text-right">
              <FiClock className="w-4 h-4 text-red-400/90 shrink-0" />
              <div className="min-w-0">
                <div className="text-gray-400 text-[10px] uppercase tracking-wider leading-tight">Rögzítés ideje</div>
                <p className="text-white font-medium text-sm tabular-nums">
                  {pair.captureTimestamp ? formatDateTimeBudapest(pair.captureTimestamp) : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-2">
            <FiInfo className="w-4 h-4 text-red-400/90 shrink-0" />
            <span>Információ</span>
          </div>
          <p className="text-gray-200 text-sm leading-relaxed">
            {pair.captureNote ?? 'A pár elfogottnak van jelölve; a térképen és a listában a szabályok szerint jelenik meg.'}
          </p>
        </div>
      </div>
    </Modal>
  );
}
