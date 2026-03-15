import React, { useEffect, useMemo, useState } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  Printer,
  User,
  Clock,
  FileText,
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import { useGlobalContext } from '../src/context/GlobalContext';

import MultiSelect from './MultiSelect';

import { printActiveReportTable } from '../src/utils/printUtils';
import { parseExpenseDateToMs } from '../src/utils/expenses';
import { formatDateTimeBySettings } from '../src/utils/dateTime';

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

interface ActivityRow {
  id: string;
  user: string;
  action: string;
  module: string;
  description: string;
  dateRaw: string;
  dateMs: number;
  ipAddress: string;
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const allTime = (): DateRangeValue => ({ startDate: null, endDate: null, label: 'All Time' });

const parseMs = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return Number.NaN;
  const direct = Date.parse(raw);
  if (Number.isFinite(direct)) return direct;
  return parseExpenseDateToMs(raw);
};

const toStartMs = (value: Date | null): number | null => (
  value ? new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0).getTime() : null
);
const toEndMs = (value: Date | null): number | null => (
  value ? new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999).getTime() : null
);

const formatDateTime = (raw: string, dateFormat: string, timeFormat: string, timeZone?: string) =>
  formatDateTimeBySettings(raw, dateFormat, timeFormat, timeZone);

const downloadFile = (name: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

const ActivityLog: React.FC = () => {
  const { activityLogs, settings } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [entriesPerPage, setEntriesPerPage] = useState(() => {
    const configured = Number(settings.defaultTableEntries || 25);
    return Number.isFinite(configured) && configured > 0 ? configured : 25;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState<DateRangeValue>(allTime);
  const [filters, setFilters] = useState({
    user: [] as string[],
    module: [] as string[],
    action: [] as string[],
  });

  const rows = useMemo<ActivityRow[]>(() => (
    activityLogs
      .map((row) => ({
        id: String(row.id || '').trim(),
        user: String(row.user || '--').trim() || '--',
        action: String(row.action || '--').trim() || '--',
        module: String(row.module || '--').trim() || '--',
        description: String(row.description || '').trim() || '--',
        dateRaw: String(row.date || '').trim(),
        dateMs: parseMs(row.date),
        ipAddress: String(row.ipAddress || '--').trim() || '--',
      }))
      .sort((a, b) => {
        const left = Number.isFinite(a.dateMs) ? a.dateMs : Number.MIN_SAFE_INTEGER;
        const right = Number.isFinite(b.dateMs) ? b.dateMs : Number.MIN_SAFE_INTEGER;
        return right - left;
      })
  ), [activityLogs]);

  const userOptions = useMemo(() => (
    Array.from(new Set(rows.map((row) => row.user).filter(Boolean)))
      .sort((a, b) => String(a).localeCompare(String(b)))
  ), [rows]);
  const moduleOptions = useMemo(() => (
    Array.from(new Set(rows.map((row) => row.module).filter(Boolean)))
      .sort((a, b) => String(a).localeCompare(String(b)))
  ), [rows]);
  const actionOptions = useMemo(() => (
    Array.from(new Set(rows.map((row) => row.action).filter(Boolean)))
      .sort((a, b) => String(a).localeCompare(String(b)))
  ), [rows]);

  const startMs = useMemo(() => toStartMs(dateRange.startDate), [dateRange.startDate]);
  const endMs = useMemo(() => toEndMs(dateRange.endDate), [dateRange.endDate]);
  const hasDateFilter = startMs != null || endMs != null;
  const selectedUsers = useMemo(() => new Set(filters.user.map(normalize)), [filters.user]);
  const selectedModules = useMemo(() => new Set(filters.module.map(normalize)), [filters.module]);
  const selectedActions = useMemo(() => new Set(filters.action.map(normalize)), [filters.action]);

  const filteredRows = useMemo(() => {
    const query = normalize(searchTerm);
    return rows.filter((row) => {
      if (hasDateFilter) {
        if (!Number.isFinite(row.dateMs)) return false;
        if (startMs != null && row.dateMs < startMs) return false;
        if (endMs != null && row.dateMs > endMs) return false;
      }
      if (selectedUsers.size > 0 && !selectedUsers.has(normalize(row.user))) return false;
      if (selectedModules.size > 0 && !selectedModules.has(normalize(row.module))) return false;
      if (selectedActions.size > 0 && !selectedActions.has(normalize(row.action))) return false;
      if (!query) return true;
      const haystack = [row.user, row.action, row.module, row.description, row.ipAddress].map(normalize);
      return haystack.some((value) => value.includes(query));
    });
  }, [rows, searchTerm, hasDateFilter, startMs, endMs, selectedUsers, selectedModules, selectedActions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateRange.startDate, dateRange.endDate, filters, entriesPerPage]);

  const totalEntries = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * entriesPerPage;
  const pageRows = filteredRows.slice(start, start + entriesPerPage);
  const from = totalEntries === 0 ? 0 : start + 1;
  const to = totalEntries === 0 ? 0 : start + pageRows.length;

  const handleExportCsv = () => {
    const headers = ['Date', 'User', 'Action', 'Module', 'Description', 'IP Address'];
    const lines = filteredRows.map((row) => ([
      csvEscape(formatDateTime(row.dateRaw, settings.dateFormat, settings.timeFormat, settings.timeZone)),
      csvEscape(row.user),
      csvEscape(row.action),
      csvEscape(row.module),
      csvEscape(row.description),
      csvEscape(row.ipAddress || '--'),
    ].join(',')));
    downloadFile(
      `activity_log_${new Date().toISOString().slice(0, 10)}.csv`,
      [headers.join(','), ...lines].join('\n'),
      'text/csv;charset=utf-8;',
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <History className="text-slate-600" size={32} />
            Activity Log
          </h2>
          <p className="text-slate-500 mt-1">Track all system activities and user actions.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => printActiveReportTable()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm">
            <Printer size={16} /> Print
          </button>
          <button onClick={handleExportCsv} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-900/20">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-500 to-slate-700"></div>

        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-1 min-w-[220px] xl:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search activity..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-500 focus:outline-none text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <DateRangeFilter
                allowAllTime
                initialRange={dateRange}
                onRangeSelect={(range) => setDateRange(range as DateRangeValue)}
              />
              <button
                onClick={() => setShowFilters((value) => !value)}
                className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition shadow-sm"
                title="Filters"
              >
                <Filter size={18} />
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <MultiSelect
                label="User"
                options={userOptions}
                selected={filters.user}
                onChange={(value) => setFilters((prev) => ({ ...prev, user: value }))}
              />
              <MultiSelect
                label="Module"
                options={moduleOptions}
                selected={filters.module}
                onChange={(value) => setFilters((prev) => ({ ...prev, module: value }))}
              />
              <MultiSelect
                label="Action"
                options={actionOptions}
                selected={filters.action}
                onChange={(value) => setFilters((prev) => ({ ...prev, action: value }))}
              />
            </div>
          )}
        </div>

        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-bold">Show</span>
            <select
              className="border border-slate-300 rounded px-2 py-1 text-xs outline-none"
              value={entriesPerPage}
              onChange={(event) => setEntriesPerPage(Number(event.target.value) || 25)}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-xs text-slate-600 font-bold">entries</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Module</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((activity) => (
                <tr key={activity.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-mono">
                      <Clock size={12} />
                      {formatDateTime(activity.dateRaw, settings.dateFormat, settings.timeFormat, settings.timeZone)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                        <User size={14} />
                      </div>
                      <span className="font-bold text-slate-900">{activity.user}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      activity.action === 'Created' ? 'bg-emerald-100 text-emerald-700' :
                      activity.action === 'Updated' ? 'bg-blue-100 text-blue-700' :
                      activity.action === 'Deleted' ? 'bg-rose-100 text-rose-700' :
                      activity.action === 'Login' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {activity.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <FileText size={14} className="text-slate-400" />
                      {activity.module}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={activity.description}>
                    {activity.description}
                  </td>
                  <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                    {activity.ipAddress || '--'}
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">No activity recorded</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/30 flex justify-between items-center">
          <p className="text-xs text-slate-500 font-medium">Showing {from} to {to} of {totalEntries} activities</p>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage((value) => Math.max(1, value - 1))} disabled={safePage <= 1} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-400 disabled:cursor-not-allowed">Previous</button>
            <button className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 shadow-sm">{safePage}</button>
            <button onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-400 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityLog;


