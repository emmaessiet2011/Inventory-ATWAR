import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, ReactNode } from 'react';
import { CheckCircle, AlertCircle, Info, X, Bell } from 'lucide-react';
import { useGlobalContext, type ActivityLogEntry } from '@/context/GlobalContext';

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
  /** Links bell items to DB-backed activity logs */
  sourceActivityId?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  unreadCount: number;
  actionCount: number;
}

type NotificationDraft = Omit<Notification, 'id' | 'timestamp' | 'read'> & {
  timestamp?: string | Date;
};

type NotificationBroadcastDetail = NotificationDraft & {
  activityId?: string;
};

const STORAGE_PREFIX = 'app_notifications_v3';
const SEEN_ACTIVITY_PREFIX = 'app_notification_seen_activity_v1';
const MAX_STORED = 200;
const MAX_SEEN_ACTIVITY_IDS = 5000;
const NOTIFY_MODULES = new Set(['Payments', 'Sales', 'Sell Returns', 'Orders', 'Purchases', 'Field Payments']);

const parseTimestamp = (value?: string | Date): Date => {
  if (value instanceof Date) return value;
  const parsed = new Date(String(value || ''));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const randomId = () => Math.random().toString(36).substring(2, 11);

const normalizeActivityToNotification = (entry: Pick<ActivityLogEntry, 'action' | 'module' | 'description'>): NotificationDraft | null => {
  const module = String(entry.module || '').trim();
  const action = String(entry.action || '').trim();
  const desc = String(entry.description || '').trim();
  if (!module || !action) return null;
  if (!NOTIFY_MODULES.has(module)) return null;
  if (action === 'Blocked' || action === 'Viewed') return null;

  const isOrder = module === 'Orders';
  const isFieldPayment = module === 'Field Payments';
  const isPayment = module === 'Payments';
  const actionRequired =
    (isOrder && action === 'Created') ||
    (isFieldPayment && action === 'Created');

  let notifType: NotificationType = 'info';
  if (action === 'Created' || action === 'Received') notifType = 'success';
  if (isFieldPayment && action === 'Created') notifType = 'warning';
  if (actionRequired) notifType = 'warning';

  const navigateTo =
    module === 'Sales' ? 'sales' :
    module === 'Payments' ? 'list-payments' :
    module === 'Sell Returns' ? 'returns' :
    module === 'Orders' ? 'list-orders' :
    module === 'Purchases' ? 'purchases' :
    module === 'Field Payments' ? 'field-payments' :
    undefined;

  const isPaymentIn = /^received payment/i.test(desc);
  const isPaymentOut = /^sent payment/i.test(desc);
  const normalizedMessage =
    module === 'Orders' && action === 'Created'
      ? desc.replace(/^created order:\s*/i, 'Order No: ')
      : isPayment && action === 'Created'
        ? desc.replace(/^(received|sent) payment:\s*/i, 'Reference: ')
        : desc;

  const notificationTitle =
    module === 'Orders' && action === 'Created'
      ? 'New order created'
      : module === 'Payments' && action === 'Created'
        ? (isPaymentIn ? 'New payment received' : (isPaymentOut ? 'Payment sent' : 'New payment recorded'))
        : module === 'Sales' && action === 'Created'
          ? 'New sale created'
          : module === 'Field Payments' && action === 'Created'
            ? 'Field payment pending approval'
            : `${action}: ${module}`;

  return {
    title: notificationTitle,
    message: normalizedMessage,
    type: notifType,
    actionRequired,
    module,
    navigateTo,
  };
};

function loadFromStorage(storageKey: string): Notification[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: Array<Notification & { timestamp: string }> = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((n) => ({ ...n, timestamp: parseTimestamp(n.timestamp) }));
  } catch {
    return [];
  }
}

function saveToStorage(storageKey: string, notifications: Notification[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(notifications.slice(0, MAX_STORED)));
  } catch {
    // storage full - ignore
  }
}

function loadSeenActivityIds(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((id) => String(id || '').trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, roles, activityLogs, syncStatus } = useGlobalContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasLoadedSeenIds, setHasLoadedSeenIds] = useState(false);
  const [hasBootstrappedActivitySeen, setHasBootstrappedActivitySeen] = useState(false);
  const seenActivityIdsRef = useRef<Set<string>>(new Set());

  const userStorageScope = useMemo(
    () => String(currentUser?.id || 'guest').trim() || 'guest',
    [currentUser?.id],
  );
  const notificationStorageKey = useMemo(
    () => `${STORAGE_PREFIX}:${userStorageScope}`,
    [userStorageScope],
  );
  const seenActivityStorageKey = useMemo(
    () => `${SEEN_ACTIVITY_PREFIX}:${userStorageScope}`,
    [userStorageScope],
  );

  const currentRoleRecord = useMemo(
    () => roles.find((role) => role.name === currentUser?.role),
    [roles, currentUser?.role],
  );
  const rolePermissions = currentRoleRecord?.permissions || [];
  const roleHasExplicitPermissions = rolePermissions.length > 0;

  const hasRolePermission = useCallback((moduleName: string, permission: string) => {
    if (!currentUser) return false;
    if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
    if (!roleHasExplicitPermissions) return true;
    return (
      rolePermissions.includes(permission) ||
      rolePermissions.includes(`${moduleName}::${permission}`)
    );
  }, [currentUser, currentRoleRecord?.isSystem, roleHasExplicitPermissions, rolePermissions]);

  const hasAnyRolePermission = useCallback((moduleName: string, permissions: string[]) => (
    permissions.some((permission) => hasRolePermission(moduleName, permission))
  ), [hasRolePermission]);

  const canReceiveModuleNotification = useCallback((moduleName: string): boolean => {
    if (!currentUser) return false;
    if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
    if (!roleHasExplicitPermissions) return true;

    if (moduleName === 'Orders') {
      return hasAnyRolePermission('Order', ['View order', 'Add order', 'Edit order', 'Delete order', 'Approve order']);
    }
    if (moduleName === 'Payments') {
      return (
        hasAnyRolePermission('Sell', ['Add sell payment', 'Edit sell payment', 'Delete sell payment', 'View customer payment ledger']) ||
        hasAnyRolePermission('POS', ['Add/Edit Payment']) ||
        hasAnyRolePermission('Field Payment', ['View field payment', 'Add field payment', 'Edit field payment', 'Delete field payment', 'Approval field payment'])
      );
    }
    if (moduleName === 'Sales') {
      return hasAnyRolePermission('Sell', [
        'View all sell',
        'View own sell only',
        'View paid sells only',
        'View due sells only',
        'View partially paid sells only',
        'View overdue sells only',
        'Add Sell',
        'Update Sell',
      ]);
    }
    if (moduleName === 'Sell Returns') {
      return hasAnyRolePermission('Sell', ['Access all sell return', 'Access own sell return']);
    }
    if (moduleName === 'Purchases') {
      return (
        hasAnyRolePermission('Purchase & Stock Adjustment', [
          'View all Purchase & Stock Adjustment',
          'View own Purchase & Stock Adjustment',
          'Add purchase & Stock Adjustment',
          'Edit purchase & Stock Adjustment',
          'Delete purchase & Stock Adjustment',
          'Update Status',
        ]) ||
        hasAnyRolePermission('Purchase Requisition', [
          'View all purchase requisition',
          'View own purchase requisition',
          'Create purchase requisition',
          'Delete purchase requisition',
        ]) ||
        hasAnyRolePermission('Purchase Order', [
          'View all purchase order',
          'View own purchase order',
          'Create purchase order',
          'Edit purchase order',
          'Delete purchase order',
        ])
      );
    }
    if (moduleName === 'Field Payments') {
      return hasAnyRolePermission('Field Payment', ['View field payment', 'Add field payment', 'Edit field payment', 'Delete field payment', 'Approval field payment']);
    }

    return false;
  }, [currentUser, currentRoleRecord?.isSystem, roleHasExplicitPermissions, hasAnyRolePermission]);

  const persistSeenActivityIds = useCallback(() => {
    try {
      let ids = Array.from(seenActivityIdsRef.current);
      if (ids.length > MAX_SEEN_ACTIVITY_IDS) {
        ids = ids.slice(ids.length - MAX_SEEN_ACTIVITY_IDS);
        seenActivityIdsRef.current = new Set(ids);
      }
      localStorage.setItem(seenActivityStorageKey, JSON.stringify(ids));
    } catch {
      // ignore persistence errors
    }
  }, [seenActivityStorageKey]);

  const markActivitySeen = useCallback((activityId?: string) => {
    const normalized = String(activityId || '').trim();
    if (!normalized) return;
    if (seenActivityIdsRef.current.has(normalized)) return;
    seenActivityIdsRef.current.add(normalized);
    persistSeenActivityIds();
  }, [persistSeenActivityIds]);

  const appendNotification = useCallback((draft: NotificationDraft) => {
    if (!draft?.title) return;
    const moduleName = String(draft.module || '').trim();
    if (moduleName && !canReceiveModuleNotification(moduleName)) return;

    const sourceActivityId = String(draft.sourceActivityId || '').trim() || undefined;
    if (sourceActivityId) markActivitySeen(sourceActivityId);

    setNotifications((prev) => {
      if (sourceActivityId && prev.some((row) => row.sourceActivityId === sourceActivityId)) return prev;
      const next: Notification = {
        ...draft,
        sourceActivityId,
        id: randomId(),
        timestamp: parseTimestamp(draft.timestamp),
        read: false,
      };
      return [next, ...prev].slice(0, MAX_STORED);
    });
  }, [canReceiveModuleNotification, markActivitySeen]);

  // Load persisted notifications and seen-activity set when user changes
  useEffect(() => {
    setHasLoadedSeenIds(false);
    setHasBootstrappedActivitySeen(false);

    const loadedNotifications = loadFromStorage(notificationStorageKey);
    setNotifications(loadedNotifications);

    const seen = loadSeenActivityIds(seenActivityStorageKey);
    loadedNotifications.forEach((row) => {
      const sourceActivityId = String(row.sourceActivityId || '').trim();
      if (sourceActivityId) seen.add(sourceActivityId);
    });
    seenActivityIdsRef.current = seen;
    setHasLoadedSeenIds(true);
  }, [notificationStorageKey, seenActivityStorageKey]);

  // Persist to localStorage whenever notifications change
  useEffect(() => {
    saveToStorage(notificationStorageKey, notifications);
  }, [notificationStorageKey, notifications]);

  // Listen for immediate in-tab broadcasts from GlobalContext
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as NotificationBroadcastDetail;
      if (!detail?.title) return;
      appendNotification({
        ...detail,
        sourceActivityId: detail.sourceActivityId || detail.activityId,
      });
    };
    window.addEventListener('atwar-bss-notify', handler);
    return () => window.removeEventListener('atwar-bss-notify', handler);
  }, [appendNotification]);

  // First-time bootstrap: prevent notification flood by seeding seen IDs
  // with existing history once core sync has settled for this user.
  useEffect(() => {
    if (!currentUser) return;
    if (!hasLoadedSeenIds || hasBootstrappedActivitySeen) return;
    if (syncStatus !== 'synced' && syncStatus !== 'error') return;

    if (seenActivityIdsRef.current.size === 0) {
      activityLogs.forEach((entry) => {
        const id = String(entry.id || '').trim();
        if (id) seenActivityIdsRef.current.add(id);
      });
      persistSeenActivityIds();
    }

    setHasBootstrappedActivitySeen(true);
  }, [
    currentUser,
    hasLoadedSeenIds,
    hasBootstrappedActivitySeen,
    syncStatus,
    activityLogs,
    persistSeenActivityIds,
  ]);

  // Convert newly fetched activity log rows into bell notifications.
  useEffect(() => {
    if (!currentUser) return;
    if (!hasBootstrappedActivitySeen) return;

    const unseenActivityRows = activityLogs
      .filter((entry) => {
        const id = String(entry.id || '').trim();
        return !!id && !seenActivityIdsRef.current.has(id);
      })
      .sort((left, right) => parseTimestamp(left.date).getTime() - parseTimestamp(right.date).getTime());

    if (unseenActivityRows.length === 0) return;

    unseenActivityRows.forEach((entry) => {
      const id = String(entry.id || '').trim();
      if (!id) return;
      markActivitySeen(id);
      const normalized = normalizeActivityToNotification(entry);
      if (!normalized) return;
      if (!canReceiveModuleNotification(String(normalized.module || ''))) return;
      appendNotification({
        ...normalized,
        sourceActivityId: id,
        triggeredBy: String(entry.user || '').trim() || 'System',
        timestamp: entry.date,
      });
    });
  }, [
    currentUser,
    hasBootstrappedActivitySeen,
    activityLogs,
    canReceiveModuleNotification,
    markActivitySeen,
    appendNotification,
  ]);

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    appendNotification({ ...n });
  }, [appendNotification]);

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

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const actionCount = notifications.filter((n) => !n.read && n.actionRequired).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAllNotifications,
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
  const recentToasts = notifications.filter((n) => !n.read).slice(0, 3);

  return (
    <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
      {recentToasts.map((n) => (
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
