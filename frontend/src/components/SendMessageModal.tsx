import { useState, useEffect } from 'react';
import { FiSend, FiMessageSquare } from 'react-icons/fi';
import Modal from './Modal';

interface SendMessageModalProps {
  isOpen: boolean;
  pairId: number | null;
  pairAssignedNumber?: number | null;
  pairName?: string | null;
  onClose: () => void;
  onSend: (pairId: number | null, title: string, body: string) => void;
}

export default function SendMessageModal({
  isOpen,
  pairId,
  pairAssignedNumber,
  pairName,
  onClose,
  onSend,
}: SendMessageModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  // Reset fields when opening
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setBody('');
    }
  }, [isOpen]);

  const handleSend = () => {
    if (title.trim() && body.trim()) {
      onSend(pairId, title.trim(), body.trim());
      onClose();
    }
  };

  const modalTitle = (
    <div className="flex items-start gap-4">
      <div className="mt-1 p-2 rounded-lg bg-blue-500/20 flex items-center justify-center">
        <FiMessageSquare className="w-5 h-5 text-blue-400" />
      </div>
      <div className="flex flex-col">
        <span className="text-xl font-bold leading-tight text-white">
          Üzenetküldés
        </span>
        <span className="text-sm font-normal text-gray-400">
          {pairAssignedNumber
            ? `${pairAssignedNumber}. pár részére${pairName ? ` (${pairName})` : ''}`
            : 'Összes pár részére'}
        </span>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      variant="blue"
      maxWidth="max-w-lg"
    >
      <div className="px-6 py-6 space-y-4">
        <div>
          <label className="block text-gray-400 text-xs font-bold mb-2 uppercase tracking-wider">
            Üzenet tárgya
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Adja meg az üzenet tárgyát..."
            className="w-full h-[54px] px-5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/5 transition-colors appearance-none text-base"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-gray-400 text-xs font-bold mb-2 uppercase tracking-wider">
            Üzenet szövege
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Írja be az üzenet tartalmát..."
            rows={6}
            className="w-full p-5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/5 transition-colors resize-none text-base leading-relaxed"
          />
        </div>
      </div>

      <div className="p-6 border-t border-white/5 bg-black/20 flex gap-4">
        <button
          onClick={onClose}
          className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold transition-all text-base"
        >
          Mégse
        </button>
        <button
          onClick={handleSend}
          disabled={!title.trim() || !body.trim()}
          className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiSend className="w-5 h-5" />
          Küldés
        </button>
      </div>
    </Modal>
  );
}
