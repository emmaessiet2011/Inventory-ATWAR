import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Bell, CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: Date;
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...n,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [newNotification, ...prev]);

    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      // We don't remove from history, just for the toast UI which we'll handle separately if needed
    }, 5000);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        unreadCount,
      }}
    >
      {children}
      <ToastContainer notifications={notifications} removeNotification={removeNotification} />
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

const ToastContainer: React.FC<{ notifications: Notification[]; removeNotification: (id: string) => void }> = ({ 
  notifications, 
  removeNotification 
}) => {
  // Only show the most recent 3 unread notifications as toasts
  const recentToasts = notifications.filter(n => !n.read).slice(0, 3);

  return (
    <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
      {recentToasts.map((n) => (
        <Toast key={n.id} notification={n} onClose={() => removeNotification(n.id)} />
      ))}
    </div>
  );
};

const Toast: React.FC<{ notification: Notification; onClose: () => void }> = ({ notification, onClose }) => {
  const icons = {
    success: <CheckCircle className="text-emerald-500" size={18} />,
    error: <AlertCircle className="text-rose-500" size={18} />,
    info: <Info className="text-blue-500" size={18} />,
    warning: <AlertCircle className="text-amber-500" size={18} />,
  };

  const bgColors = {
    success: 'bg-emerald-50 border-emerald-100',
    error: 'bg-rose-50 border-rose-100',
    info: 'bg-blue-50 border-blue-100',
    warning: 'bg-amber-50 border-amber-100',
  };

  return (
    <div className={`pointer-events-auto w-80 p-4 rounded-xl border shadow-lg animate-in slide-in-from-right-full duration-300 ${bgColors[notification.type]}`}>
      <div className="flex gap-3">
        <div className="mt-0.5">{icons[notification.type]}</div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-slate-900">{notification.title}</h4>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notification.message}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
