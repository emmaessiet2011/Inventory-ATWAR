import React, { useMemo, useState } from 'react';
import { Bell, Search, CheckCheck, Trash2, Check, Clock } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { useGlobalContext } from '@/context/GlobalContext';
import { formatDateTimeBySettings } from '@/utils/dateTime';

interface NotificationsPageProps {
  onNavigate?: (page: string) => void;
}

const normalize = (value: unknown) => String(value || '').trim().toLowerCase();

const NotificationsPage: React.FC<NotificationsPageProps> = ({ onNavigate }) => {
  const {
    notifications,
    unreadCount,
    actionCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
  } = useNotifications();
  const { settings } = useGlobalContext();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Unread' | 'Action Required'>('All');
  const [moduleFilter, setModuleFilter] = useState('All');

  const moduleOptions = useMemo(() => {
    const moduleNames = notifications
      .map((n) => String(n.module || '').trim())
      .filter((value): value is string => value.length > 0);
    const uniqueModules = Array.from(new Set<string>(moduleNames)).sort((a, b) => a.localeCompare(b));
    return ['All', ...uniqueModules];
  }, [notifications]);

  const filtered = useMemo(() => {
    const query = normalize(search);
    return notifications.filter((item) => {
      if (statusFilter === 'Unread' && item.read) return false;
      if (statusFilter === 'Action Required' && !item.actionRequired) return false;
      if (moduleFilter !== 'All' && String(item.module || '').trim() !== moduleFilter) return false;
      if (!query) return true;
      const haystack = [
        item.title,
        item.message,
        item.module,
        item.triggeredBy,
      ].map(normalize);
      return haystack.some((part) => part.includes(query));
    });
  }, [notifications, search, statusFilter, moduleFilter]);

  const openNotification = (id: string, navigateTo?: string) => {
    markAsRead(id);
    if (navigateTo && onNavigate) {
      onNavigate(navigateTo);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 rounded-2xl shadow-md">
            <Bell size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Notifications</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              {unreadCount} unread • {actionCount} action required
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 transition flex items-center gap-2"
          >
            <CheckCheck size={15} /> Mark all read
          </button>
          <button
            onClick={clearAllNotifications}
            className="px-4 py-2 rounded-xl border border-rose-200 bg-white text-rose-700 text-sm font-bold hover:bg-rose-50 transition flex items-center gap-2"
          >
            <Trash2 size={15} /> Clear all
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/60">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search notifications..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'All' | 'Unread' | 'Action Required')}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
            >
              <option value="All">All statuses</option>
              <option value="Unread">Unread</option>
              <option value="Action Required">Action required</option>
            </select>
            <select
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
            >
              {moduleOptions.map((moduleName) => (
                <option key={moduleName} value={moduleName}>
                  {moduleName === 'All' ? 'All modules' : moduleName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`p-4 md:p-5 hover:bg-slate-50 transition cursor-pointer group ${!item.read ? (item.actionRequired ? 'bg-amber-50/50' : 'bg-blue-50/30') : ''}`}
              onClick={() => openNotification(item.id, item.navigateTo)}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  item.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                  item.type === 'error' ? 'bg-rose-100 text-rose-600' :
                  item.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {item.type === 'success' ? <Check size={14} /> : <Clock size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm ${item.read ? 'font-semibold text-slate-700' : 'font-bold text-slate-900'}`}>{item.title}</p>
                    {item.actionRequired && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-wide">Action</span>
                    )}
                    {item.module && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wide">{item.module}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{item.message}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {formatDateTimeBySettings(String(item.timestamp || ''), settings.dateFormat, settings.timeFormat, settings.timeZone)}
                    {item.triggeredBy ? ` • by ${item.triggeredBy}` : ''}
                  </p>
                </div>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    removeNotification(item.id);
                  }}
                  className="p-1.5 text-slate-300 hover:text-slate-500 transition opacity-0 group-hover:opacity-100"
                  title="Remove notification"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-10 text-center text-slate-400">
              <Bell size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">No notifications found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
