import React, { useEffect, useMemo, useState } from 'react';
import {
  Filter,
  FileText,
  FileSpreadsheet,
  Printer,
  Search,
  Eye,
  ArrowUpDown,
  Download,
  X,Landmark} from 'lucide-react';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import { useGlobalContext } from '@/context/GlobalContext';

import MultiSelect from '@/components/shared/MultiSelect';

import { printActiveReportTable } from '@/utils/printUtils';
import {
  bootstrapRegisterFromDB,
  getActiveRegisterSession,
  getRegisterSessions,
  getRegisterTransactions,
  RegisterSessionRecord,
  RegisterTransaction,
} from '@/utils/registerLedger';

interface DateRangeSelection {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

interface RegisterReportRow {
  id: string;
  openTime: string;
  closeTime: string;
  openMs: number;
  closeMs: number;
  location: string;
  user: string;
  status: 'Open' | 'Closed';
  totalCard: number;
  totalCheque: number;
  totalCash: number;
  totalBank: number;
  totalAdvance: number;
  credit: number;
  other: number;
  total: number;
}

type SortDirection = 'asc' | 'desc';
type SortKey =
  | 'openMs'
  | 'closeMs'
  | 'location'
  | 'user'
  | 'status'
  | 'totalCard'
  | 'totalCheque'
  | 'totalCash'
  | 'totalBank'
  | 'totalAdvance'
  | 'credit'
  | 'other'
  | 'total';

interface SortState {
  key: SortKey;
  direction: SortDirection;
}

const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase();
const allTimeRange = (): DateRangeSelection => ({ startDate: null, endDate: null, label: 'All Time' });

const escapeCSV = (value: string | number) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const roundByPrecision = (value: number, precision: number) => Number(value.toFixed(Math.max(0, precision)));

const parseDateMs = (value: string): number => {
  if (!value) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const toStartMs = (value: Date | null): number | null => (
  value ? new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0).getTime() : null
);

const toEndMs = (value: Date | null): number | null => (
  value ? new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999).getTime() : null
);

const downloadBlob = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const ReportRegister: React.FC = () => {
  const { formatCurrency, settings } = useGlobalContext();
  const precision = Math.max(0, Math.min(6, Math.round(Number(settings.currencyPrecision ?? 3))));
  const [showFilters, setShowFilters] = useState(true);
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'openMs', direction: 'desc' });
  const [filters, setFilters] = useState({
    user: [] as string[],
    status: [] as string[],
    location: [] as string[],
  });
  const [dateRange, setDateRange] = useState<DateRangeSelection>(allTimeRange);
  const [viewingRow, setViewingRow] = useState<RegisterReportRow | null>(null);
  const [sessions, setSessions] = useState<RegisterSessionRecord[]>([]);
  const [transactions, setTransactions] = useState<RegisterTransaction[]>([]);

  useEffect(() => {
    let cancelled = false;

    const refreshFromDB = async () => {
      await bootstrapRegisterFromDB().catch(() => {});
      if (cancelled) return;
      const list = getRegisterSessions();
      const active = getActiveRegisterSession();
      const merged = active && !list.some((item) => item.id === active.id)
        ? [active, ...list]
        : list;
      setSessions(merged);
      setTransactions(getRegisterTransactions());
    };

    void refreshFromDB();
    const onFocus = () => { void refreshFromDB(); };
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const formatDateTimeDisplay = (value?: string) => {
    if (!value) return '--';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    const hours24 = parsed.getHours();
    const hours12 = String(hours24 % 12 || 12).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    const meridiem = hours24 >= 12 ? 'PM' : 'AM';
    const dateOnly = settings.dateFormat === 'mm/dd/yyyy'
      ? `${month}/${day}/${year}`
      : `${day}/${month}/${year}`;
    return settings.timeFormat === '24'
      ? `${dateOnly} ${String(hours24).padStart(2, '0')}:${minutes}`
      : `${dateOnly} ${hours12}:${minutes} ${meridiem}`;
  };

  const rows = useMemo<RegisterReportRow[]>(() => (
    sessions.map((session) => {
      const tx = transactions.filter((item) => item.sessionId === session.id);
      let totalCard = 0;
      let totalCheque = 0;
      let totalCash = 0;
      let totalBank = 0;
      let totalAdvance = 0;
      let credit = 0;
      let other = 0;

      tx.forEach((item) => {
        const amount = Number(item.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0) return;
        if (item.type !== 'sale' && item.type !== 'payment' && item.type !== 'expense') return;

        const method = normalizeText(item.method);
        const isOutflow = item.type === 'expense';
        const signedAmount = isOutflow ? -amount : amount;

        if (!isOutflow && !method) {
          credit += amount;
          return;
        }

        if (method === 'card') {
          totalCard += signedAmount;
          return;
        }
        if (method === 'cheque' || method === 'check') {
          totalCheque += signedAmount;
          return;
        }
        if (method.includes('bank') || method.includes('transfer') || method === 'emad') {
          totalBank += signedAmount;
          return;
        }
        if (method.includes('advance')) {
          totalAdvance += signedAmount;
          return;
        }
        if (!method || method === 'cash') {
          totalCash += signedAmount;
          return;
        }

        other += signedAmount;
      });

      const total = totalCard + totalCheque + totalCash + totalBank + totalAdvance + credit + other;

      return {
        id: session.id,
        openTime: session.openedAt,
        closeTime: session.closedAt || '',
        openMs: parseDateMs(session.openedAt),
        closeMs: parseDateMs(session.closedAt || ''),
        location: session.locationName || '--',
        user: session.openedBy || '--',
        status: session.status,
        totalCard: roundByPrecision(totalCard, precision),
        totalCheque: roundByPrecision(totalCheque, precision),
        totalCash: roundByPrecision(totalCash, precision),
        totalBank: roundByPrecision(totalBank, precision),
        totalAdvance: roundByPrecision(totalAdvance, precision),
        credit: roundByPrecision(credit, precision),
        other: roundByPrecision(other, precision),
        total: roundByPrecision(total, precision),
      };
    })
  ), [sessions, transactions, precision]);

  const userOptions = useMemo(
    () => {
      const values = rows.map((row) => String(row.user || '')).filter((value) => Boolean(value));
      return Array.from(new Set<string>(values)).sort((a, b) => String(a).localeCompare(String(b)));
    },
    [rows],
  );
  const locationOptions = useMemo(
    () => {
      const values = rows.map((row) => String(row.location || '')).filter((value) => Boolean(value));
      return Array.from(new Set<string>(values)).sort((a, b) => String(a).localeCompare(String(b)));
    },
    [rows],
  );

  const startMs = useMemo(() => toStartMs(dateRange.startDate), [dateRange.startDate]);
  const endMs = useMemo(() => toEndMs(dateRange.endDate), [dateRange.endDate]);
  const hasDateFilter = startMs != null || endMs != null;
  const selectedUsers = useMemo(() => new Set(filters.user.map(normalizeText)), [filters.user]);
  const selectedStatuses = useMemo(() => new Set(filters.status.map(normalizeText)), [filters.status]);
  const selectedLocations = useMemo(() => new Set(filters.location.map(normalizeText)), [filters.location]);

  const filteredData = useMemo(() => (
    rows.filter((item) => {
      const query = normalizeText(searchTerm);
      const textMatch = !query || [
        item.id,
        item.user,
        item.location,
        item.status,
      ].map(normalizeText).some((value) => value.includes(query));

      if (!textMatch) return false;
      if (selectedUsers.size > 0 && !selectedUsers.has(normalizeText(item.user))) return false;
      if (selectedStatuses.size > 0 && !selectedStatuses.has(normalizeText(item.status))) return false;
      if (selectedLocations.size > 0 && !selectedLocations.has(normalizeText(item.location))) return false;
      if (!hasDateFilter) return true;
      if (!Number.isFinite(item.openMs)) return false;
      if (startMs != null && item.openMs < startMs) return false;
      if (endMs != null && item.openMs > endMs) return false;
      return true;
    })
  ), [rows, searchTerm, selectedUsers, selectedStatuses, selectedLocations, hasDateFilter, startMs, endMs]);

  const sortedData = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...filteredData].sort((left, right) => {
      const key = sort.key;
      const numericKeys: SortKey[] = [
        'openMs', 'closeMs',
        'totalCard', 'totalCheque', 'totalCash', 'totalBank', 'totalAdvance', 'credit', 'other', 'total',
      ];
      if (numericKeys.includes(key)) {
        return ((left[key] as number) - (right[key] as number)) * factor;
      }
      return String(left[key] || '').localeCompare(String(right[key] || ''), undefined, { numeric: true, sensitivity: 'base' }) * factor;
    });
  }, [filteredData, sort]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, dateRange.startDate, dateRange.endDate, entriesPerPage, sort]);

  const totalEntries = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * entriesPerPage;
  const pageRows = sortedData.slice(start, start + entriesPerPage);
  const from = totalEntries === 0 ? 0 : start + 1;
  const to = totalEntries === 0 ? 0 : start + pageRows.length;

  const totals = useMemo(() => sortedData.reduce((acc, row) => ({
    totalCard: acc.totalCard + row.totalCard,
    totalCheque: acc.totalCheque + row.totalCheque,
    totalCash: acc.totalCash + row.totalCash,
    totalBank: acc.totalBank + row.totalBank,
    totalAdvance: acc.totalAdvance + row.totalAdvance,
    credit: acc.credit + row.credit,
    other: acc.other + row.other,
    total: acc.total + row.total,
  }), {
    totalCard: 0,
    totalCheque: 0,
    totalCash: 0,
    totalBank: 0,
    totalAdvance: 0,
    credit: 0,
    other: 0,
    total: 0,
  }), [sortedData]);

  const handleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key === key) return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      return { key, direction: key === 'openMs' || key === 'closeMs' || key === 'total' ? 'desc' : 'asc' };
    });
  };

  const exportReport = (format: 'csv' | 'excel') => {
    const headers = [
      'Register ID',
      'Open Time',
      'Close Time',
      'Location',
      'User',
      'Status',
      'Total Card',
      'Total Cheque',
      'Total Cash',
      'Total Bank',
      'Total Advance',
      'Credit',
      'Other',
      'Total',
    ];
    const lines = [
      format === 'excel' ? headers.join('\t') : headers.join(','),
      ...sortedData.map((row) => {
        const values = [
          row.id,
          formatDateTimeDisplay(row.openTime),
          formatDateTimeDisplay(row.closeTime),
          row.location,
          row.user,
          row.status,
          row.totalCard.toFixed(precision),
          row.totalCheque.toFixed(precision),
          row.totalCash.toFixed(precision),
          row.totalBank.toFixed(precision),
          row.totalAdvance.toFixed(precision),
          row.credit.toFixed(precision),
          row.other.toFixed(precision),
          row.total.toFixed(precision),
        ];
        return format === 'excel'
          ? values.join('\t')
          : values.map(escapeCSV).join(',');
      }),
    ];
    const datePart = new Date().toISOString().slice(0, 10);
    if (format === 'excel') {
      downloadBlob(`register-report-${datePart}.xls`, lines.join('\n'), 'application/vnd.ms-excel;charset=utf-8;');
      return;
    }
    downloadBlob(`register-report-${datePart}.csv`, lines.join('\n'), 'text/csv;charset=utf-8;');
  };

  const exportPdf = () => {
    try {
      const jspdf = (window as any).jspdf;
      const JsPDF = jspdf?.jsPDF;
      if (!JsPDF) { printActiveReportTable(); return; }
      const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const margin = 20;
      const pageWidth = 842;
      const rowHeight = 14;
      const maxY = 560;
      const columns = ['Register', 'Open', 'Close', 'Location', 'User', 'Status', 'Card', 'Cheque', 'Cash', 'Bank', 'Advance', 'Credit', 'Other', 'Total'];
      const width = (pageWidth - margin * 2) / columns.length;
      let y = 30;

      const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        columns.forEach((header, idx) => doc.text(header, margin + idx * width, y));
        doc.setFont('helvetica', 'normal');
        y += rowHeight;
      };

      doc.setFontSize(14);
      doc.text('Register Report', margin, y);
      y += rowHeight + 4;
      doc.setFontSize(9);
      doc.text(`Date Range: ${dateRange.label || 'All Time'}`, margin, y);
      y += rowHeight;
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
      y += rowHeight + 4;

      drawHeader();
      if (sortedData.length === 0) {
        doc.text('No records found', margin, y);
      } else {
        sortedData.forEach((row) => {
          if (y > maxY) {
            doc.addPage();
            y = 30;
            drawHeader();
          }
          const values = [
            row.id,
            formatDateTimeDisplay(row.openTime),
            formatDateTimeDisplay(row.closeTime),
            row.location,
            row.user,
            row.status,
            row.totalCard.toFixed(precision),
            row.totalCheque.toFixed(precision),
            row.totalCash.toFixed(precision),
            row.totalBank.toFixed(precision),
            row.totalAdvance.toFixed(precision),
            row.credit.toFixed(precision),
            row.other.toFixed(precision),
            row.total.toFixed(precision),
          ];
          values.forEach((value, idx) => doc.text(String(value).slice(0, 18), margin + idx * width, y));
          y += rowHeight;
        });
      }

      if (y + rowHeight > maxY) {
        doc.addPage();
        y = 30;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`Grand Total: ${formatCurrency(roundByPrecision(totals.total, precision))}`, margin, y + rowHeight);
      doc.save(`register-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      printActiveReportTable();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <Landmark size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Register Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Cash register sessions and transactions</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
<div className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-sm cursor-pointer w-fit" onClick={() => setShowFilters(!showFilters)}>
          <Filter size={16} /> Filters
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2 animate-in slide-in-from-top-2">
            <MultiSelect
              label="User"
              options={userOptions}
              selected={filters.user}
              onChange={(value) => setFilters((prev) => ({ ...prev, user: value }))}
            />
            <MultiSelect
              label="Status"
              options={['Open', 'Closed']}
              selected={filters.status}
              onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
            />
            <MultiSelect
              label="Business Location"
              options={locationOptions}
              selected={filters.location}
              onChange={(value) => setFilters((prev) => ({ ...prev, location: value }))}
            />
            <DateRangeFilter allowAllTime initialRange={dateRange} onRangeSelect={(range) => setDateRange(range as DateRangeSelection)} />
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
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

          <div className="flex gap-1">
            <button onClick={() => exportReport('csv')} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10} /> Export CSV</button>
            <button onClick={() => exportReport('excel')} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10} /> Export Excel</button>
            <button onClick={() => printActiveReportTable()} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={10} /> Print</button>
            <button onClick={exportPdf} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Download size={10} /> Export PDF</button>
          </div>

          <div className="flex items-center gap-2">
            <Search className="text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search..."
              className="pl-2 py-1 border border-slate-300 rounded text-xs outline-none"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[420px]">
          <table className="w-full text-[11px] text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('openMs')}>
                  Open Time <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'openMs' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'openMs' && sort.direction === 'desc' ? 'rotate-180' : ''}`} />
                </th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('closeMs')}>
                  Close Time <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'closeMs' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'closeMs' && sort.direction === 'desc' ? 'rotate-180' : ''}`} />
                </th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('location')}>
                  Location <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'location' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'location' && sort.direction === 'desc' ? 'rotate-180' : ''}`} />
                </th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('user')}>
                  User <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'user' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'user' && sort.direction === 'desc' ? 'rotate-180' : ''}`} />
                </th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('totalCard')}>
                  Total Card <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'totalCard' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'totalCard' && sort.direction === 'desc' ? 'rotate-180' : ''}`} />
                </th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('totalCheque')}>
                  Total Cheque <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'totalCheque' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'totalCheque' && sort.direction === 'desc' ? 'rotate-180' : ''}`} />
                </th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('totalCash')}>
                  Total Cash <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'totalCash' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'totalCash' && sort.direction === 'desc' ? 'rotate-180' : ''}`} />
                </th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('totalBank')}>
                  Total Bank <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'totalBank' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'totalBank' && sort.direction === 'desc' ? 'rotate-180' : ''}`} />
                </th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('totalAdvance')}>
                  Total Advance <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'totalAdvance' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'totalAdvance' && sort.direction === 'desc' ? 'rotate-180' : ''}`} />
                </th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('credit')}>
                  Credit <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'credit' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'credit' && sort.direction === 'desc' ? 'rotate-180' : ''}`} />
                </th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('other')}>
                  Other <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'other' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'other' && sort.direction === 'desc' ? 'rotate-180' : ''}`} />
                </th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('total')}>
                  Total <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'total' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'total' && sort.direction === 'desc' ? 'rotate-180' : ''}`} />
                </th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{formatDateTimeDisplay(item.openTime)}</td>
                  <td className="px-4 py-3">{formatDateTimeDisplay(item.closeTime)}</td>
                  <td className="px-4 py-3 truncate max-w-[150px]">{item.location}</td>
                  <td className="px-4 py-3">
                    <div>{item.user}</div>
                    <div className={`text-[9px] font-bold ${item.status === 'Open' ? 'text-emerald-600' : 'text-slate-500'}`}>{item.status}</div>
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.totalCard)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.totalCheque)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.totalCash)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.totalBank)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.totalAdvance)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.credit)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.other)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(item.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setViewingRow(item)}
                      className="inline-flex items-center justify-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-[10px] font-bold border border-blue-100 hover:bg-blue-100"
                    >
                      <Eye size={10} /> View
                    </button>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-slate-400 italic">No register data available.</td>
                </tr>
              )}
            </tbody>
            {pageRows.length > 0 && (
              <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right uppercase">Total:</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(roundByPrecision(totals.totalCard, precision))}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(roundByPrecision(totals.totalCheque, precision))}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(roundByPrecision(totals.totalCash, precision))}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(roundByPrecision(totals.totalBank, precision))}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(roundByPrecision(totals.totalAdvance, precision))}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(roundByPrecision(totals.credit, precision))}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(roundByPrecision(totals.other, precision))}</td>
                  <td className="px-4 py-3 text-right font-black">{formatCurrency(roundByPrecision(totals.total, precision))}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div>Showing {from} to {to} of {totalEntries} entries</div>
          <div className="flex gap-3 items-center">
            <span>Date Range: <span className="font-bold text-slate-700">{dateRange.label || 'All Time'}</span></span>
            <button type="button" onClick={() => setCurrentPage((value) => Math.max(1, value - 1))} disabled={safePage <= 1} className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
            <button className="px-2 py-1 bg-blue-600 text-white rounded shadow-sm">{safePage}</button>
            <button type="button" onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages} className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      </div>

      {viewingRow && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl bg-white border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Register Details</h3>
              <button onClick={() => setViewingRow(null)} className="p-1 rounded hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3 text-xs">
              <div><span className="font-bold text-slate-700">Register ID:</span> {viewingRow.id}</div>
              <div><span className="font-bold text-slate-700">Status:</span> {viewingRow.status}</div>
              <div><span className="font-bold text-slate-700">Opened:</span> {formatDateTimeDisplay(viewingRow.openTime)}</div>
              <div><span className="font-bold text-slate-700">Closed:</span> {formatDateTimeDisplay(viewingRow.closeTime)}</div>
              <div><span className="font-bold text-slate-700">User:</span> {viewingRow.user}</div>
              <div><span className="font-bold text-slate-700">Location:</span> {viewingRow.location}</div>
              <div><span className="font-bold text-slate-700">Cash:</span> {formatCurrency(viewingRow.totalCash)}</div>
              <div><span className="font-bold text-slate-700">Card:</span> {formatCurrency(viewingRow.totalCard)}</div>
              <div><span className="font-bold text-slate-700">Cheque:</span> {formatCurrency(viewingRow.totalCheque)}</div>
              <div><span className="font-bold text-slate-700">Bank:</span> {formatCurrency(viewingRow.totalBank)}</div>
              <div><span className="font-bold text-slate-700">Advance:</span> {formatCurrency(viewingRow.totalAdvance)}</div>
              <div><span className="font-bold text-slate-700">Credit:</span> {formatCurrency(viewingRow.credit)}</div>
              <div><span className="font-bold text-slate-700">Other:</span> {formatCurrency(viewingRow.other)}</div>
              <div className="text-sm"><span className="font-black text-slate-900">Total:</span> <span className="font-black text-slate-900">{formatCurrency(viewingRow.total)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportRegister;


