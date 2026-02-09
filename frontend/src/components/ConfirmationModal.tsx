import { FiAlertTriangle, FiX } from 'react-icons/fi';
import { useEffect, useState } from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Igen',
  cancelLabel = 'Mégse',
  isDangerous = false,
  onConfirm,
  onCancel
}: ConfirmationModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsAnimating(false);
    } else if (isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsAnimating(false);
      }, 200); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;

  const theme = isDangerous ? {
    iconWrapper: 'bg-red-500/20',
    icon: 'text-red-500',
    headerGradient: 'from-red-500/10',
    button: 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-red-900/20'
  } : {
    iconWrapper: 'bg-orange-500/20',
    icon: 'text-orange-500',
    headerGradient: 'from-orange-500/10',
    button: 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 shadow-orange-900/20'
  };

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all ${isAnimating || !isOpen ? 'pointer-events-none' : ''}`}>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm ${isAnimating || !isOpen ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={onCancel}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-sm bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden ${isAnimating || !isOpen ? 'animate-scale-out' : 'animate-scale-in'}`}>

        {/* Header */}
        <div className={`p-5 border-b border-white/5 bg-gradient-to-r ${theme.headerGradient} to-transparent flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${theme.iconWrapper}`}>
              <FiAlertTriangle className={`w-5 h-5 ${theme.icon}`} />
            </div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
          </div>
          <button onClick={onCancel} className="text-white/40 hover:text-white transition-colors">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-7">
          <p className="text-gray-300 leading-relaxed text-base">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 bg-black/20 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold transition-all text-sm"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 text-white rounded-xl font-bold shadow-lg transition-all text-sm ${theme.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
