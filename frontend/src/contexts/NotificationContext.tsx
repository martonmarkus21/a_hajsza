import React, { createContext, useContext, useState, useCallback } from 'react';
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi';

export type NotificationType = 'success' | 'error' | 'info';

export interface NotificationHistoryItem {
    id: string;
    type: NotificationType;
    message: string;
    timestamp: Date;
    read: boolean;
    isGlobal: boolean;
}

interface Notification {
    id: string;
    type: NotificationType;
    message: string;
    exiting?: boolean;
}

interface NotificationContextType {
    addNotification: (type: NotificationType, message: string, isGlobal?: boolean) => void;
    history: NotificationHistoryItem[];
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearHistory: () => void;
    deleteNotification: (id: string) => void;
    loadHistoryForUser: (username: string) => void;
    unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [history, setHistory] = useState<NotificationHistoryItem[]>(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                const stored = localStorage.getItem(`mw_notifications_${user.username}`);
                if (stored) {
                    return JSON.parse(stored).map((item: any) => ({
                        ...item,
                        timestamp: new Date(item.timestamp)
                    }));
                }
            } catch (e) {
                console.error('Hiba a history inicializálásakor:', e);
            }
        }
        return [];
    });

    const removeNotification = useCallback((id: string) => {
        // First mark as exiting for animation
        setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, exiting: true } : n));

        // Then remove after animation completes
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, 300);
    }, []);

    const saveHistory = useCallback((action: (prev: NotificationHistoryItem[]) => NotificationHistoryItem[]) => {
        setHistory((prev) => {
            const newHistory = action(prev);
            const userStr = localStorage.getItem('user');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    localStorage.setItem(`mw_notifications_${user.username}`, JSON.stringify(newHistory));
                } catch (e) {
                    console.error('Hiba a history mentésekor:', e);
                }
            }
            return newHistory;
        });
    }, []);

    const loadHistoryForUser = useCallback((username: string) => {
        const stored = localStorage.getItem(`mw_notifications_${username}`);
        if (stored) {
            try {
                const parsed = JSON.parse(stored).map((item: any) => ({
                    ...item,
                    timestamp: new Date(item.timestamp)
                }));
                setHistory(parsed);
            } catch (e) {
                console.error('Hiba az értesítések betöltésekor:', e);
                setHistory([]);
            }
        } else {
            setHistory([]);
        }
    }, []);

    const addNotification = useCallback((type: NotificationType, message: string, isGlobal: boolean = false) => {
        const id = Math.random().toString(36).substring(2, 9);
        
        // Add to active toasts
        setNotifications((prev) => [...prev, { id, type, message, exiting: false }]);

        // Add to permanent history
        saveHistory((prev) => [
            { id, type, message, timestamp: new Date(), read: false, isGlobal },
            ...prev
        ].slice(0, 100));

        // Auto remove from active toasts after 5 seconds
        setTimeout(() => {
            removeNotification(id);
        }, 5000);
    }, [removeNotification, saveHistory]);

    const markAsRead = useCallback((id: string) => {
        saveHistory((prev) => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }, [saveHistory]);

    const markAllAsRead = useCallback(() => {
        saveHistory((prev) => prev.map(n => ({ ...n, read: true })));
    }, [saveHistory]);

    const deleteNotification = useCallback((id: string) => {
        saveHistory((prev) => prev.filter(n => n.id !== id));
    }, [saveHistory]);

    const clearHistory = useCallback(() => {
        saveHistory(() => []);
    }, [saveHistory]);

    const unreadCount = history.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{ 
            addNotification, 
            history, 
            markAsRead, 
            markAllAsRead, 
            clearHistory,
            deleteNotification,
            loadHistoryForUser,
            unreadCount 
        }}>
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
                            onClick={() => {
                                removeNotification(notification.id);
                                markAsRead(notification.id);
                            }}
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
