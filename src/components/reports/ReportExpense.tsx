import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Filter, FileText, FileSpreadsheet, Printer, Columns, Search, ArrowUpDown, Download, Receipt} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import { useGlobalContext } from '@/context/GlobalContext';
import SafeResponsiveContainer from '@/components/shared/SafeResponsiveContainer';

import MultiSelect from '@/components/shared/MultiSelect';

import { printActiveReportTable } from '@/utils/printUtils';
import { getExpenseTotalAmount, parseExpenseDateToMs } from '@/utils/expenses';
import { formatDateTimeBySettings } from '@/utils/dateTime';

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

type SortDirection = 'asc' | 'desc';
type SortKey = 'category' | 'total';
type ColumnKey = 'category' | 'total';

interface SortState {
  key: SortKey;
  direction: SortDirection;
}

interface CategoryRow {
  category: string;
  total: number;
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const allTimeRange = (): DateRangeValue => ({ startDate: null, endDate: null, label: 'All Time' });
const roundByPrecision = (value: number, precision: number) => Number(value.toFixed(Math.max(0, precision)));
const toStartMs = (value: Date | null): number | null => (
  value ? new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0).getTime() : null
);
const toEndMs = (value: Date | null): number | null => (
  value ? new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999).getTime() : null
);

const downloadFile = (name: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

const ReportExpense: React.FC = () => {
  const { locations, expenses, expenseCategories, formatCurrency, settings } = useGlobalContext();
  const [showFilters, setShowFilters] = useState(true);
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [range, setRange] = useState<DateRangeValue>(allTimeRange);
  const [filters, setFilters] = useState({ location: [] as string[], category: [] as string[] });
  const [sort, setSort] = useState<SortState>({ key: 'total', direction: 'desc' });
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    category: true,
    total: true,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);

  const startMs = useMemo(() => toStartMs(range.startDate), [range.startDate]);
  const endMs = useMemo(() => toEndMs(range.endDate), [range.endDate]);
  const hasDateFilter = startMs != null || endMs != null;

  const categoryOptions = useMemo(
    () => Array.from(new Set([...expenseCategories.map((c) => c.name), ...expenses.map((e) => e.category)].filter(Boolean))).sort(),
    [expenseCategories, expenses],
  );

  const filteredExpenses = useMemo(() => {
    const q = normalize(searchTerm);
    const selectedLocationSet = new Set(filters.location.map(normalize));
    const selectedCategorySet = new Set(filters.category.map(normalize));

    return expenses.filter((expense) => {
      const category = String(expense.category || '').trim();
      const location = String(expense.location || '').trim();
      if (q) {
        const hay = [
          expense.refNo,
          category,
          expense.subCategory,
          expense.note,
          expense.expenseFor,
          expense.contact,
        ].map(normalize).join(' ');
        if (!hay.includes(q)) return false;
      }
      if (selectedLocationSet.size > 0 && !selectedLocationSet.has(normalize(location))) return false;
      if (selectedCategorySet.size > 0 && !selectedCategorySet.has(normalize(category))) return false;
      if (hasDateFilter) {
        const ms = parseExpenseDateToMs(expense.date);
        if (!Number.isFinite(ms)) return false;
        if (startMs != null && ms < startMs) return false;
        if (endMs != null && ms > endMs) return false;
      }
      return true;
    });
  }, [expenses, searchTerm, filters, hasDateFilter, startMs, endMs]);

  const groupedRows = useMemo<CategoryRow[]>(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach((expense) => {
      const category = String(expense.category || 'Uncategorized').trim() || 'Uncategorized';
      const amount = getExpenseTotalAmount(expense);
      const signedAmount = expense.isRefund ? -amount : amount;
      map.set(category, (map.get(category) || 0) + signedAmount);
    });
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total: roundByPrecision(total, settings.currencyPrecision) }));
  }, [filteredExpenses, settings.currencyPrecision]);

  const sortedRows = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...groupedRows].sort((left, right) => {
      if (sort.key === 'total') return (left.total - right.total) * factor;
      return left.category.localeCompare(right.category, undefined, { numeric: true, sensitivity: 'base' }) * factor;
    });
  }, [groupedRows, sort]);

  useEffect(() => {
    setCurrentPage(1);
  }, [entriesPerPage, searchTerm, filters, range.startDate, range.endDate, sort]);

  useEffect(() => {
    if (!showColumnMenu) return undefined;
    const onClickOutside = (event: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showColumnMenu]);

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * entriesPerPage;
  const pageRows = sortedRows.slice(start, start + entriesPerPage);
  const from = totalEntries === 0 ? 0 : start + 1;
  const to = totalEntries === 0 ? 0 : start + pageRows.length;
  const visibleColumnCount = (visibleColumns.category ? 1 : 0) + (visibleColumns.total ? 1 : 0);

  const chartData = useMemo(
    () => [...groupedRows]
      .sort((left, right) => Math.abs(right.total) - Math.abs(left.total))
      .map((item) => ({ name: item.category, expense: item.total })),
    [groupedRows],
  );
  const totalExpense = useMemo(
    () => roundByPrecision(sortedRows.reduce((sum, item) => sum + item.total, 0), settings.currencyPrecision),
    [sortedRows, settings.currencyPrecision],
  );

  const handleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: key === 'total' ? 'desc' : 'asc' };
    });
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      const enabledCount = Object.values(prev).filter(Boolean).length;
      if (enabledCount === 1 && prev[key]) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  };

  const exportCsv = () => {
    const headers = ['Expense Category', 'Total Expense'];
    const rows = sortedRows.map((item) => [
      csvEscape(item.category),
      csvEscape(item.total.toFixed(settings.currencyPrecision)),
    ].join(','));
    rows.push([csvEscape('Total'), csvEscape(totalExpense.toFixed(settings.currencyPrecision))].join(','));
    downloadFile(
      `expense_report_${new Date().toISOString().slice(0, 10)}.csv`,
      [headers.join(','), ...rows].join('\n'),
      'text/csv;charset=utf-8;',
    );
  };

  const exportExcel = () => {
    const headers = ['Expense Category', 'Total Expense'];
    const rows = sortedRows.map((item) => [item.category, item.total.toFixed(settings.currencyPrecision)].join('\t'));
    rows.push(['Total', totalExpense.toFixed(settings.currencyPrecision)].join('\t'));
    downloadFile(
      `expense_report_${new Date().toISOString().slice(0, 10)}.xls`,
      [headers.join('\t'), ...rows].join('\n'),
      'application/vnd.ms-excel;charset=utf-8;',
    );
  };

  const exportPdf = () => {
    try {
      const jspdf = (window as any).jspdf;
      const JsPDF = jspdf?.jsPDF;
      if (!JsPDF) { printActiveReportTable(); return; }
      const doc = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const margin = 24;
      const pageWidth = 595;
      const rowHeight = 16;
      const maxY = 800;
      let y = 40;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Expense Report', margin, y);
      y += rowHeight + 2;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date Range: ${range.label || 'All Time'}`, margin, y);
      y += rowHeight;
      doc.text(`Generated: ${formatDateTimeBySettings(new Date().toISOString(), settings.dateFormat, settings.timeFormat, settings.timeZone)}`, margin, y);
      y += rowHeight + 4;

      const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        doc.text('Expense Category', margin, y);
        doc.text('Total Expense', pageWidth - margin, y, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        y += rowHeight;
      };

      drawHeader();
      if (sortedRows.length === 0) {
        doc.text('No records found', margin, y);
        y += rowHeight;
      } else {
        sortedRows.forEach((item) => {
          if (y > maxY) {
            doc.addPage();
            y = 40;
            drawHeader();
          }
          doc.text(item.category.slice(0, 55), margin, y);
          doc.text(item.total.toFixed(settings.currencyPrecision), pageWidth - margin, y, { align: 'right' });
          y += rowHeight;
        });
      }

      if (y + rowHeight > maxY) {
        doc.addPage();
        y = 40;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`Total: ${formatCurrency(totalExpense)}`, margin, y + rowHeight);
      doc.save(`expense_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      printActiveReportTable();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <Receipt size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Expense Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Analyse expenses by category and date range</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
<div className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-sm cursor-pointer w-fit" onClick={() => setShowFilters(!showFilters)}>
          <Filter size={16} /> Filters
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 animate-in slide-in-from-top-2">
            <MultiSelect label="Business Location" options={locations.map((loc) => loc.name)} selected={filters.location} onChange={(val) => setFilters({ ...filters, location: val })} />
            <MultiSelect label="Category" options={categoryOptions} selected={filters.category} onChange={(val) => setFilters({ ...filters, category: val })} />
            <DateRangeFilter allowAllTime initialRange={range} onRangeSelect={(nextRange) => setRange(nextRange as DateRangeValue)} />
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <h3 className="font-bold text-slate-800 text-sm mb-4 text-center">Expense Report</h3>
        <div className="h-80 w-full">
          <SafeResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                formatter={(value) => [formatCurrency(Number(value || 0)), 'Total Expense']}
              />
              <Bar dataKey="expense" fill="#7cb5ec" name="Total Expense" barSize={50} />
            </BarChart>
          </SafeResponsiveContainer>
        </div>
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
            <button onClick={exportCsv} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10} /> Export CSV</button>
            <button onClick={exportExcel} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10} /> Export Excel</button>
            <button onClick={() => printActiveReportTable()} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={10} /> Print</button>
            <button onClick={exportPdf} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Download size={10} /> Export PDF</button>
            <div className="relative" ref={columnMenuRef}>
              <button type="button" onClick={() => setShowColumnMenu((value) => !value)} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={10} /> Column visibility</button>
              {showColumnMenu && (
                <div className="absolute right-0 mt-1 w-44 rounded border border-slate-200 bg-white shadow-lg p-2 z-20">
                  <label className="flex items-center gap-2 py-1 text-xs text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={visibleColumns.category} onChange={() => toggleColumn('category')} />
                    Expense Categories
                  </label>
                  <label className="flex items-center gap-2 py-1 text-xs text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={visibleColumns.total} onChange={() => toggleColumn('total')} />
                    Total Expense
                  </label>
                  {visibleColumnCount === 1 && (
                    <p className="pt-1 text-[10px] text-slate-400">At least one column must stay visible.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Search className="text-slate-400" size={14} />
            <input type="text" placeholder="Search..." className="pl-2 py-1 border border-slate-300 rounded text-xs outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[200px]">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                {visibleColumns.category && (
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('category')}>
                    Expense Categories <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'category' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'category' && sort.direction === 'desc' ? 'rotate-180' : ''}`} />
                  </th>
                )}
                {visibleColumns.total && (
                  <th className="px-4 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort('total')}>
                    Total Expense <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'total' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'total' && sort.direction === 'desc' ? 'rotate-180' : ''}`} />
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.length > 0 ? pageRows.map((item) => (
                <tr key={item.category} className="hover:bg-slate-50">
                  {visibleColumns.category && <td className="px-4 py-3 text-slate-700 font-medium">{item.category}</td>}
                  {visibleColumns.total && <td className="px-4 py-3 text-right text-slate-800 font-bold">{formatCurrency(item.total)}</td>}
                </tr>
              )) : (
                <tr><td colSpan={Math.max(1, visibleColumnCount)} className="px-4 py-8 text-center text-slate-400 italic">No data available in table</td></tr>
              )}
            </tbody>
            {pageRows.length > 0 && (
              <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                <tr>
                  {visibleColumns.category && <td className="px-4 py-3 text-right uppercase">Total:</td>}
                  {visibleColumns.total && (
                    <td className="px-4 py-3 text-right">
                      {visibleColumns.category ? formatCurrency(totalExpense) : `Total: ${formatCurrency(totalExpense)}`}
                    </td>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div>Showing {from} to {to} of {totalEntries} entries</div>
          <div className="flex gap-3 items-center">
            <span>Date Range: <span className="font-bold text-slate-700">{range.label || 'All Time'}</span></span>
            <button type="button" onClick={() => setCurrentPage((value) => Math.max(1, value - 1))} disabled={safePage <= 1} className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
            <button className="px-2 py-1 bg-blue-600 text-white rounded shadow-sm">{safePage}</button>
            <button type="button" onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages} className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportExpense;


