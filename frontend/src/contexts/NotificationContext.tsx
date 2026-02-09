import React, { createContext, useContext, useState, useCallback } from 'react';
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
    id: string;
    type: NotificationType;
    message: string;
    exiting?: boolean;
}

interface NotificationContextType {
    addNotification: (type: NotificationType, message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const removeNotification = useCallback((id: string) => {
        // First mark as exiting for animation
        setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, exiting: true } : n));

        // Then remove after animation completes
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, 300);
    }, []);

    const addNotification = useCallback((type: NotificationType, message: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        setNotifications((prev) => [...prev, { id, type, message, exiting: false }]);

        // Auto remove after 5 seconds
        setTimeout(() => {
            removeNotification(id);
        }, 5000);
    }, [removeNotification]);

    return (
        <NotificationContext.Provider value={{ addNotification }}>
            {children}

            {/* Toast Container */}
            <div className="fixed bottom-6 right-6 z-[10000] flex flex-col gap-3 pointer-events-none">
                {notifications.map((notification) => (
                    <div
                        key={notification.id}
                        className={`
                            pointer-events-auto w-full max-w-sm rounded-2xl 
                            bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 
                            shadow-2xl shadow-black/50 
                            p-4 flex items-center gap-4 relative overflow-hidden
                            ${notification.exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}
                        `}
                    >
                        {/* Status Line */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 
                            ${notification.type === 'success' ? 'bg-gradient-to-b from-green-500 to-green-600' : ''}
                            ${notification.type === 'error' ? 'bg-gradient-to-b from-red-500 to-red-600' : ''}
                            ${notification.type === 'info' ? 'bg-gradient-to-b from-blue-500 to-blue-600' : ''}
                        `} />

                        {/* Icon */}
                        <div className={`
                            flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-lg
                            ${notification.type === 'success' ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/20' : ''}
                            ${notification.type === 'error' ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/20' : ''}
                            ${notification.type === 'info' ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/20' : ''}
                        `}>
                            {notification.type === 'success' && <FiCheckCircle className="w-5 h-5" />}
                            {notification.type === 'error' && <FiAlertCircle className="w-5 h-5" />}
                            {notification.type === 'info' && <FiInfo className="w-5 h-5" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pr-6">
                            <h4 className={`text-xs font-bold uppercase tracking-wider mb-0.5
                                ${notification.type === 'success' ? 'text-green-500' : ''}
                                ${notification.type === 'error' ? 'text-red-500' : ''}
                                ${notification.type === 'info' ? 'text-blue-500' : ''}
                            `}>
                                {notification.type === 'success' ? 'Siker' : notification.type === 'error' ? 'Hiba' : 'Információ'}
                            </h4>
                            <p className="text-white/90 font-medium text-sm leading-snug break-words">
                                {notification.message}
                            </p>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={() => removeNotification(notification.id)}
                            className="absolute top-3 right-3 p-1 rounded-lg text-white/20 hover:text-white hover:bg-white/10 transition-all"
                        >
                            <FiX className="w-4 h-4" />
                        </button>

                        {/* Background Glow Effect */}
                        <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full blur-3xl opacity-20 pointer-events-none
                            ${notification.type === 'success' ? 'bg-green-500' : ''}
                            ${notification.type === 'error' ? 'bg-red-500' : ''}
                            ${notification.type === 'info' ? 'bg-blue-500' : ''}
                        `} />
                    </div>
                ))}
            </div>
        </NotificationContext.Provider >
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}
