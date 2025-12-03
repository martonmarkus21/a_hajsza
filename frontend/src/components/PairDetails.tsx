import { Pair } from '../types';
import { FiMap, FiNavigation, FiExternalLink, FiX, FiLock, FiEdit, FiSend, FiStar } from 'react-icons/fi';

interface PairDetailsProps {
  pair: Pair | null;
  browserLocation: { lat: number; lon: number } | null;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
  onClose: () => void;
  onCapture: (pairId: number) => void;
  onMw: (pairId: number) => void;
  onAssignName: (pairId: number) => void;
  onSendMessage: (pairId: number) => void;
}

export default function PairDetails({
  pair,
  browserLocation,
  calculateDistance,
  onClose,
  onCapture,
  onMw,
  onAssignName,
  onSendMessage,
}: PairDetailsProps) {
  if (!pair) return null;

  // Determine background color and border color based on status (same as map markers)
  const getBackgroundColor = () => {
    if (pair.mostWanted) return '#f36f26';
    return '#2a2a2a';
  };
  
  const backgroundColor = getBackgroundColor();
  const borderColor = '#f36f26';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999]" onClick={onClose}>
      <div className="glass-effect rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl border border-orange-500/30" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            {/* Circle number badge (same style as map markers) */}
            <div 
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: backgroundColor,
                border: `3px solid ${borderColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '24px',
                boxShadow: '0 4px 12px rgba(243, 111, 38, 0.3)',
              }}
            >
              {pair.assignedNumber}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Pár #{pair.assignedNumber}</h2>
              {pair.name && (
                <div className="text-lg text-gray-300 font-medium mt-1">{pair.name}</div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800/50 text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            {pair.captured && (
              <span className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full text-sm font-bold shadow-lg">
                Elfogva
              </span>
            )}
            {pair.mostWanted && (
              <span className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full text-sm font-bold shadow-lg flex items-center gap-1">
                <FiStar className="w-3 h-3" />
                MOST WANTED
              </span>
            )}
            {pair.active && !pair.captured && (
              <span className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full text-sm font-bold shadow-lg">
                Aktív
              </span>
            )}
          </div>
        </div>

        {pair.lastPosition && (
          <div className="mb-6 glass-card rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-3 uppercase tracking-wide font-semibold">Utolsó pozíció</div>
            <div className="text-sm font-medium text-gray-300 mb-2">
              {new Date(pair.lastPosition.timestamp).toLocaleString('hu-HU')}
            </div>
            <div className="text-xs text-gray-500 mb-4 font-mono bg-gray-800/50 p-2 rounded border border-gray-700">
              {pair.lastPosition.lat.toFixed(6)}, {pair.lastPosition.lon.toFixed(6)}
            </div>
            <div className="flex gap-2">
              <a
                href={`https://www.google.com/maps?q=${pair.lastPosition.lat},${pair.lastPosition.lon}`}
                target="_blank"
                rel="noopener noreferrer"
                className="modern-button flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm rounded-lg font-semibold shadow-lg"
              >
                <FiMap className="w-4 h-4" />
                <span>Google Maps</span>
                <FiExternalLink className="w-3 h-3" />
              </a>
              <a
                href={`https://waze.com/ul?ll=${pair.lastPosition.lat},${pair.lastPosition.lon}&navigate=yes`}
                target="_blank"
                rel="noopener noreferrer"
                className="modern-button flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm rounded-lg font-semibold shadow-lg"
              >
                <FiNavigation className="w-4 h-4" />
                <span>Waze</span>
                <FiExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {browserLocation && (pair.distancePosition || pair.lastPosition) && (
          <div className="mb-6 glass-card rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-semibold">Légvonalbeli távolság</div>
            <div className="text-2xl font-bold text-orange-400">
              {(() => {
                const position = pair.distancePosition || pair.lastPosition;
                if (!position) return 'N/A';
                
                const distanceMeters = calculateDistance(
                  browserLocation.lat,
                  browserLocation.lon,
                  position.lat,
                  position.lon
                );
                return distanceMeters < 1000 
                  ? `${Math.round(distanceMeters)} m`
                  : `${(distanceMeters / 1000).toFixed(1)} km`;
              })()}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            onClick={() => {
              onCapture(pair.id);
              onClose();
            }}
            disabled={pair.captured}
            className="modern-button flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold shadow-lg disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed"
          >
            <FiLock className="w-4 h-4" />
            <span>Bilincs</span>
          </button>
          <button
            onClick={() => {
              onMw(pair.id);
            }}
            className={`modern-button flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold shadow-lg ${
              pair.mostWanted
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <FiStar className="w-4 h-4" />
            <span>{pair.mostWanted ? 'MW eltávolítása' : 'MW jelölés'}</span>
          </button>
          <button
            onClick={() => {
              onAssignName(pair.id);
            }}
            className="modern-button flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold shadow-lg"
          >
            <FiEdit className="w-4 h-4" />
            <span>Név szerkesztése</span>
          </button>
          <button
            onClick={() => {
              onSendMessage(pair.id);
            }}
            className="modern-button flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold shadow-lg"
          >
            <FiSend className="w-4 h-4" />
            <span>Üzenet</span>
          </button>
        </div>
      </div>
    </div>
  );
}

