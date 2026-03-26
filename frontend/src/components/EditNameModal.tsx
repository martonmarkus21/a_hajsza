import { useState, useEffect } from 'react';
import { FiEdit3, FiCheckCircle } from 'react-icons/fi';
import Modal from './Modal';

interface EditNameModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newName: string | null) => void;
    initialName: string;
}

export default function EditNameModal({ isOpen, onClose, onSave, initialName }: EditNameModalProps) {
    const [name, setName] = useState(initialName);

    // Reset name when modal opens with new initialName
    useEffect(() => {
        setName(initialName);
    }, [initialName, isOpen]);

    const handleSave = () => {
        // If name is empty or just whitespace, pass null to clear it
        const trimmedName = name.trim();
        onSave(trimmedName === '' ? null : trimmedName);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            variant="blue"
            title={
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 p-2 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <FiEdit3 className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-xl font-bold text-white leading-tight">Pár átnevezése</span>
                </div>
            }
        >
            <div className="p-6">
                <label className="block text-gray-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Új csapatnév</label>
                <input
                    type="text"
                    autoFocus={isOpen} // Only autofocus when open
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    className="w-full h-[52px] px-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/5 transition-colors"
                    placeholder="Pl. Bravo csapat"
                />
                <p className="text-[10px] text-gray-500 mt-2 font-bold uppercase tracking-wider">
                    Hagyja üresen a törléshez
                </p>
            </div>
            <div className="p-6 border-t border-white/5 bg-black/20 flex gap-3">
                <button
                    onClick={onClose}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold transition-all"
                >
                    Mégse
                </button>
                <button
                    onClick={handleSave}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
                >
                    <FiCheckCircle className="w-5 h-5" />
                    Mentés
                </button>
            </div>
        </Modal>
    );
}
