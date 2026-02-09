import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: React.ReactNode;
    children: React.ReactNode;
    maxWidth?: string;
    variant?: 'orange' | 'blue' | 'red';
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-lg', variant = 'orange' }: ModalProps) {
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
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible && !isOpen) return null;

    const getGradient = () => {
        switch (variant) {
            case 'blue': return 'from-blue-500/10';
            case 'red': return 'from-red-500/10';
            default: return 'from-orange-500/10';
        }
    };

    return (
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 ${isAnimating || !isOpen ? 'pointer-events-none' : ''}`}>
            <div
                className={`fixed inset-0 bg-black/80 backdrop-blur-sm ${isAnimating || !isOpen ? 'animate-fade-out' : 'animate-fade-in'}`}
                onClick={onClose}
            />
            <div className={`relative w-full ${maxWidth} bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden ${isAnimating || !isOpen ? 'animate-scale-out' : 'animate-scale-in'} z-10 will-change-transform`}>
                <div className={`p-6 border-b border-white/5 bg-gradient-to-r ${getGradient()} to-transparent flex items-center justify-between`}>
                    <div className="text-xl font-bold text-white flex items-center gap-2">
                        {title}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
