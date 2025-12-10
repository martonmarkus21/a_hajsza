import React, { createContext, useContext, useState, useCallback } from 'react';
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
    id: string;
    type: NotificationType;
    message: string;
}

interface NotificationContextType {
    addNotification: (type: NotificationType, message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotification = useCallback((type: NotificationType, message: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        setNotifications((prev) => [...prev, { id, type, message }]);

        // Auto remove after 3 seconds
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, 5000);
    }, []);

    const removeNotification = (id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    return (
        <NotificationContext.Provider value={{ addNotification }}>
            {children}

            {/* Toast Container */}
            <div className="fixed bottom-6 right-6 z-[10000] flex flex-col gap-3 pointer-events-none">
                {notifications.map((notification) => (
                    <div
                        key={notification.id}
                        className={`
              pointer-events-auto min-w-[300px] max-w-md p-4 rounded-xl border backdrop-blur-md shadow-2xl flex items-start gap-3 animate-slide-in-right
              ${notification.type === 'success' ? 'bg-green-500/10 border-green-500/50 text-green-400' : ''}
              ${notification.type === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-400' : ''}
              ${notification.type === 'info' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : ''}
            `}
                    >
                        <div className="mt-0.5">
                            {notification.type === 'success' && <FiCheckCircle className="w-5 h-5" />}
                            {notification.type === 'error' && <FiAlertCircle className="w-5 h-5" />}
                            {notification.type === 'info' && <FiInfo className="w-5 h-5" />}
                        </div>

                        <p className="font-medium text-sm flex-1 leading-snug text-white/90">
                            {notification.message}
                        </p>

                        <button
                            onClick={() => removeNotification(notification.id)}
                            className="opacity-70 hover:opacity-100 transition-opacity"
                        >
                            <FiX className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}
