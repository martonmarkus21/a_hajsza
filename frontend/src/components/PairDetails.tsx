import { useState, useEffect, useRef } from 'react';
import { Pair } from '../types';
import { FiNavigation, FiLock, FiShield, FiInfo, FiCheckCircle, FiXCircle, FiCrosshair, FiSend, FiX, FiExternalLink } from 'react-icons/fi';
import { FaMapMarkerAlt, FaWaze } from 'react-icons/fa';
import { HiPencil } from 'react-icons/hi2';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
import { useNotification } from '../contexts/NotificationContext';

interface PairDetailsProps {
  pair: Pair | null;
  browserLocation: { lat: number; lon: number } | null;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
  onClose: () => void;
  onCapture: (pairId: number) => void;
  onMw: (pairId: number) => void;
  onRename: (pairId: number, name: string) => void;
  onSendMessage: (pairId: number) => void;
  onClosingStart?: () => void;
}

export default function PairDetails({
  pair,
  browserLocation,
  calculateDistance,
  onClose,
  onCapture,
  onMw,
  onRename,
  onSendMessage,
  onClosingStart,
}: PairDetailsProps) {
  const { addNotification } = useNotification();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Track previous pair ID to detect actual pair switch vs just data update
  const prevPairIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (pair) {
      // Only reset edit name if we switched to a DIFFERENT pair
      if (pair.id !== prevPairIdRef.current) {
        setEditName(pair.name || '');
        setIsEditing(false);
        prevPairIdRef.current = pair.id;
      } else if (!isEditing) {
        // If staying on same pair and NOT editing, update name to reflect external changes
        setEditName(pair.name || '');
      }
    }
  }, [pair, isEditing]);

  if (!pair) return null;

  const isMw = pair.mostWanted;

  const handleClose = () => {
    if (onClosingStart) onClosingStart();
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false); // Reset for next time if component mounts again
    }, 300); // Match Modal animation duration
  };

  const handleSaveName = () => {
    if (editName !== pair.name) {
      onRename(pair.id, editName);
      addNotification('success', 'Pár neve sikeresen módosítva');
    }
    setIsEditing(false);
  };

  return (
    <>
      <Modal
        isOpen={!!pair && !isClosing}
        onClose={handleClose}
        title={
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-orange-500/20`}>
              <FiInfo className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Pár részletei</h3>
              <p className="text-xs text-gray-500 font-normal flex items-center gap-1.5">
                Szám: <span className="font-mono text-gray-300 pt-0.5">{pair.assignedNumber}</span>
              </p>
            </div>
          </div>
        }
        variant="orange"
      >
        <div className="p-6 space-y-6">
          {/* Alapadatok Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Alapadatok</h4>
            <div className="flex items-center gap-5 p-4 bg-white/5 rounded-2xl border border-white/5 relative group">
              {/* Status Badge */}
              {/* Status Badge - Updated style to match sidebar */}
              <div className={`flex items-center justify-center w-20 h-20 rounded-full text-white font-bold text-4xl shadow-lg transition-all duration-300 border-[4px] border-orange-500 pb-1 ${isMw ? 'bg-orange-500' : 'bg-[#222]'}`}>
                {pair.assignedNumber}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 min-h-[32px]">
                  {isEditing ? (
                    <div className="flex items-center gap-2 w-full max-w-xs relative bg-black/40 rounded-lg p-1 border border-orange-500/50">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleSaveName}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveName();
                          if (e.key === 'Escape') {
                            setEditName(pair.name || '');
                            setIsEditing(false);
                          }
                        }}
                        autoFocus
                        className="w-full bg-transparent px-2 py-0.5 text-white text-xl font-bold focus:outline-none placeholder-white/20"
                        placeholder="Pár neve"
                      />
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent blur
                          setEditName(pair.name || '');
                          setIsEditing(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded"
                        title="Mégse"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-white leading-none">
                        {pair.name || <span className="text-gray-500 italic">Névtelen pár</span>}
                      </h2>
                      <button
                        onClick={() => {
                          setEditName(pair.name || '');
                          setIsEditing(true);
                        }}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="Név szerkesztése"
                      >
                        <HiPencil className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {pair.captured && (
                    <span className="px-2.5 py-1 bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <FiXCircle className="w-3.5 h-3.5" /> Elfogva
                    </span>
                  )}
                  {isMw && (
                    <span className="px-2.5 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <FiShield className="w-3.5 h-3.5 fill-current" /> Most Wanted
                    </span>
                  )}
                  {pair.active && !pair.captured && (
                    <span className="px-2.5 py-1 bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <FiCheckCircle className="w-3.5 h-3.5" /> Aktív
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Helyzet Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Helyzet és Navigáció</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Location */}
              <div className="p-4 bg-black/20 rounded-xl border border-white/5 relative">
                <div className="absolute top-4 right-4 text-blue-500/20">
                  <FiCrosshair className="w-8 h-8" />
                </div>
                <label className="block text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Utolsó pozíció</label>
                {pair.lastPosition && pair.lastPosition.lat != null && pair.lastPosition.lon != null ? (
                  <>
                    <div className="text-white font-medium mb-1">
                      {new Date(pair.lastPosition.timestamp).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-1 rounded w-fit">
                      {pair.lastPosition.lat.toFixed(5)}, {pair.lastPosition.lon.toFixed(5)}
                    </div>
                  </>
                ) : (
                  <div className="text-gray-500 italic text-sm">Nincs adat</div>
                )}
              </div>

              {/* Distance */}
              <div className="p-4 bg-black/20 rounded-xl border border-white/5 relative">
                <div className="absolute top-4 right-4 text-orange-500/20">
                  <FiNavigation className="w-8 h-8" />
                </div>
                <label className="block text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Légvonalbeli távolság</label>
                <div className="text-2xl font-bold gradient-text">
                  {(() => {
                    if (!browserLocation) return 'N/A';
                    const pos = pair.distancePosition || pair.lastPosition;
                    if (!pos || pos.lat == null || pos.lon == null) return 'N/A';
                    const dist = calculateDistance(browserLocation.lat, browserLocation.lon, pos.lat, pos.lon);
                    return dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`;
                  })()}
                </div>
              </div>
            </div>

            {/* Navigation Actions */}
            {pair.lastPosition && pair.lastPosition.lat != null && pair.lastPosition.lon != null && (
              <div className="flex gap-3 mt-2">
                <a
                  href={`https://www.google.com/maps?q=${pair.lastPosition.lat},${pair.lastPosition.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm relative group"
                >
                  <FaMapMarkerAlt className="w-4 h-4" />
                  <span>Google Maps</span>
                  <FiExternalLink className="w-3.5 h-3.5 opacity-50" />
                </a>
                <a
                  href={`https://waze.com/ul?ll=${pair.lastPosition.lat},${pair.lastPosition.lon}&navigate=yes`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm relative group"
                >
                  <FaWaze className="w-5 h-5" />
                  <span>Waze</span>
                  <FiExternalLink className="w-3.5 h-3.5 opacity-50" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/5 bg-black/20">
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={pair.captured}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold transition-all flex items-center justify-center gap-2 focus:outline-none"
              onMouseDown={(e) => e.preventDefault()}
            >
              <FiLock className="w-4 h-4" />
              Bilincs
            </button>
            <div
              id="mw-toggle-div"
              onClick={() => {
                onMw(pair.id);
                addNotification('success', isMw ? 'Most Wanted státusz eltávolítva' : 'Most Wanted státusz beállítva');
              }}
              className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer select-none ${isMw
                ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              style={{
                border: 'none',
                outline: 'none',
                boxShadow: isMw ? 'inset 0 0 0 1px rgba(249, 115, 22, 0.2)' : 'none', // Simulated border
                WebkitTapHighlightColor: 'transparent',
              }}
              tabIndex={-1}
            >
              <FiShield className={`w-4 h-4 pointer-events-none ${isMw ? 'fill-current' : ''}`} />
              <span className="pointer-events-none">{isMw ? 'MW' : 'MW'}</span>
            </div>
            {/* Send Message - Subtler Button */}
            <button
              onClick={() => onSendMessage(pair.id)}
              className="flex-[1.2] py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/20 rounded-xl font-bold transition-all flex items-center justify-center gap-2 focus:outline-none"
              onMouseDown={(e) => e.preventDefault()}
            >
              <FiSend className="w-4 h-4" />
              Üzenet
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal for Capture */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        title="Pár elfogása"
        message={`Biztosan elfogottnak jelöli a(z) ${pair.assignedNumber}. számú párt?`}
        onConfirm={async () => {
          onCapture(pair.id);
          setShowConfirmModal(false);
          handleClose();
        }}
        onCancel={() => setShowConfirmModal(false)}
        confirmLabel="Elfogás"
        isDangerous={true}
      />
    </>
  );
}
