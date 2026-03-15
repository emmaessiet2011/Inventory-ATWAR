import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { CheckCircle, AlertCircle, Info, X, Bell } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: Date;
  read: boolean;
  /** If true, shows an action-required badge (e.g. pending approvals) */
  actionRequired?: boolean;
  /** Page to navigate to when clicking this notification */
  navigateTo?: string;
  /** Source module (e.g. 'Payments', 'Orders') */
  module?: string;
  /** Who triggered this event */
  triggeredBy?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  unreadCount: number;
  actionCount: number;
}

const STORAGE_KEY = 'app_notifications_v2';
const MAX_STORED = 100;

function loadFromStorage(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: Array<Notification & { timestamp: string }> = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(n => ({ ...n, timestamp: new Date(n.timestamp) }));
  } catch {
    return [];
  }
}

function saveToStorage(notifications: Notification[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_STORED)));
  } catch {
    // storage full — ignore
  }
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>(() => loadFromStorage());

  // Persist to localStorage whenever notifications change
  useEffect(() => {
    saveToStorage(notifications);
  }, [notifications]);

  // Listen for activity broadcasts from GlobalContext via custom DOM events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Omit<Notification, 'id' | 'timestamp' | 'read'>;
      if (!detail?.title) return;
      setNotifications(prev => {
        const newN: Notification = {
          ...detail,
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date(),
          read: false,
        };
        const updated = [newN, ...prev];
        saveToStorage(updated);
        return updated;
      });
    };
    window.addEventListener('atwar-bss-notify', handler);
    return () => window.removeEventListener('atwar-bss-notify', handler);
  }, []);

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...n,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const actionCount = notifications.filter(n => !n.read && n.actionRequired).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        unreadCount,
        actionCount,
      }}
    >
      {children}
      <ToastContainer notifications={notifications} markAsRead={markAsRead} />
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

const ToastContainer: React.FC<{ notifications: Notification[]; markAsRead: (id: string) => void }> = ({
  notifications,
  markAsRead,
}) => {
  const recentToasts = notifications.filter(n => !n.read).slice(0, 3);

  return (
    <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
      {recentToasts.map(n => (
        <Toast key={n.id} notification={n} onClose={() => markAsRead(n.id)} />
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

  useEffect(() => {
    const timer = setTimeout(() => onClose(), 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`pointer-events-auto w-80 p-4 rounded-xl border shadow-lg animate-in slide-in-from-right-full duration-300 ${bgColors[notification.type]}`}>
      <div className="flex gap-3">
        <div className="mt-0.5">{icons[notification.type]}</div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-slate-900">{notification.title}</h4>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notification.message}</p>
          {notification.triggeredBy && (
            <p className="text-[10px] text-slate-400 mt-1">by {notification.triggeredBy}</p>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X size={14} />
        </button>
      </div>
      {notification.actionRequired && (
        <div className="mt-2 pt-2 border-t border-amber-200 text-[10px] font-bold text-amber-600 uppercase tracking-wide flex items-center gap-1">
          <Bell size={10} /> Action Required
        </div>
      )}
    </div>
  );
};
