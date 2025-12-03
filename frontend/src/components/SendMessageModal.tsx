import { useState } from 'react';
import { FiX, FiSend } from 'react-icons/fi';

interface SendMessageModalProps {
  pairId: number | null;
  pairAssignedNumber?: number | null;
  pairName?: string | null;
  pairMostWanted?: boolean;
  onClose: () => void;
  onSend: (pairId: number | null, title: string, body: string) => void;
}

export default function SendMessageModal({
  pairId,
  pairAssignedNumber,
  pairName,
  pairMostWanted,
  onClose,
  onSend,
}: SendMessageModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const handleSend = () => {
    if (title.trim() && body.trim()) {
      onSend(pairId, title.trim(), body.trim());
      setTitle('');
      setBody('');
      onClose();
    }
  };

  // Determine background color and border color based on status (same as map markers)
  const getBackgroundColor = () => {
    if (pairMostWanted) return '#f36f26';
    return '#2a2a2a';
  };
  
  const backgroundColor = getBackgroundColor();
  const borderColor = '#f36f26';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999]" onClick={onClose}>
      <div className="glass-effect rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl border border-orange-500/30" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            {pairAssignedNumber && (
              <div 
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: backgroundColor,
                  border: `3px solid ${borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              >
                {pairAssignedNumber}
              </div>
            )}
            <h2 className="text-2xl font-bold text-white">
              Üzenet küldése {pairAssignedNumber ? `párhoz #${pairAssignedNumber}${pairName ? ` (${pairName})` : ''}` : 'minden párnak'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800/50 text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wide">
            Cím
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Üzenet címe"
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wide">
            Üzenet
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Üzenet szövege"
            rows={5}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSend}
            disabled={!title.trim() || !body.trim()}
            className="modern-button flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg font-semibold shadow-lg disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed"
          >
            <FiSend className="w-4 h-4" />
            <span>Küldés</span>
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 font-semibold transition-colors"
          >
            Mégse
          </button>
        </div>
      </div>
    </div>
  );
}

