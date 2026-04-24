import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Printer,
  Search,
  Settings,
  ShoppingBag,UserCheck} from 'lucide-react';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import { useGlobalContext } from '@/context/GlobalContext';

import MultiSelect from '@/components/shared/MultiSelect';

import { printActiveReportTable } from '@/utils/printUtils';
import { parseExpenseDateToMs } from '@/utils/expenses';
import { formatDateTimeBySettings } from '@/utils/dateTime';

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

interface SalesRow {
  id: string;
  dateRaw: string;
  dateMs: number;
  invoice: string;
  customer: string;
  representative: string;
  representativeId: string;
  location: string;
  paymentStatus: 'Paid' | 'Due' | 'Partial' | 'Overdue';
  total: number;
  paid: number;
  remaining: number;
  commission: number;
}

interface ExpenseRow {
  id: string;
  dateRaw: string;
  dateMs: number;
  ref: string;
  category: string;
  location: string;
  status: 'Paid' | 'Due' | 'Partial';
  amount: number;
  expenseFor: string;
  note: string;
  user: string;
}

type TabKey = 'sales_added' | 'sales_commission' | 'expenses';
type SortDirection = 'asc' | 'desc';
type SalesSortKey =
  | 'dateMs'
  | 'invoice'
  | 'customer'
  | 'representative'
  | 'location'
  | 'paymentStatus'
  | 'total'
  | 'paid'
  | 'remaining'
  | 'commission';
type ExpenseSortKey = 'dateMs' | 'ref' | 'category' | 'location' | 'status' | 'amount' | 'expenseFor' | 'note' | 'user';

interface SortState<T extends string> {
  key: T;
  direction: SortDirection;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;
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

const inRange = (ms: number, start: number | null, end: number | null, active: boolean) => {
  if (!active) return true;
  if (!Number.isFinite(ms)) return false;
  if (start != null && ms < start) return false;
  if (end != null && ms > end) return false;
  return true;
};

const formatDate = (ms: number, dateFormat: string) => {
  if (!Number.isFinite(ms)) return '--';
  const date = new Date(ms);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return dateFormat === 'mm/dd/yyyy' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
};

const formatDateTime = (raw: string, dateFormat: string, timeFormat: string) => {
  const ms = parseMs(raw);
  if (!Number.isFinite(ms)) return raw || '--';
  const dateOnly = formatDate(ms, dateFormat);
  const hasTime = /(\d{1,2}:\d{2})|([AP]M)/i.test(raw);
  if (!hasTime) return dateOnly;
  const value = new Date(ms);
  const hh = value.getHours();
  const mm = String(value.getMinutes()).padStart(2, '0');
  if (timeFormat === '24') return `${dateOnly} ${String(hh).padStart(2, '0')}:${mm}`;
  const meridiem = hh >= 12 ? 'PM' : 'AM';
  const hour12 = String(hh % 12 || 12).padStart(2, '0');
  return `${dateOnly} ${hour12}:${mm} ${meridiem}`;
};

const downloadFile = (name: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

const getStatusClass = (status: string) => {
  if (status === 'Paid') return 'bg-[#74c365]';
  if (status === 'Partial') return 'bg-sky-500';
  if (status === 'Overdue') return 'bg-rose-500';
  return 'bg-amber-400';
};

const sortIcon = (isActive: boolean, direction: SortDirection) => (
  <ArrowUpDown
    size={10}
    className={`inline ml-1 ${isActive ? 'text-blue-600' : 'text-slate-400'} ${isActive && direction === 'desc' ? 'rotate-180' : ''}`}
  />
);

const ReportSalesRep: React.FC = () => {
  const { sales, expenses, locations, users, settings, formatCurrency } = useGlobalContext();
  const [showFilters, setShowFilters] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('sales_added');
  const [searchTerm, setSearchTerm] = useState('');
  const [range, setRange] = useState<DateRangeValue>(allTime);
  const [entriesPerPage, setEntriesPerPage] = useState(() => {
    const configured = Number(settings.defaultTableEntries || 25);
    return Number.isFinite(configured) && configured > 0 ? configured : 25;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ user: [] as string[], location: [] as string[] });
  const [salesSort, setSalesSort] = useState<SortState<SalesSortKey>>({ key: 'dateMs', direction: 'desc' });
  const [expenseSort, setExpenseSort] = useState<SortState<ExpenseSortKey>>({ key: 'dateMs', direction: 'desc' });

  const salesRows = useMemo<SalesRow[]>(() => sales
    .filter((sale) => {
      const status = normalize(sale.status || sale.saleStatus || '');
      return !status || status === 'final';
    })
    .map((sale) => {
      const total = Math.max(0, Number(sale.grandTotal ?? sale.totalAmount ?? 0) || 0);
      const paidRaw = Number(sale.totalPaid ?? 0);
      const dueRaw = Number(sale.sellDue ?? (total - paidRaw));
      const paid = round3(Math.max(0, Number.isFinite(paidRaw) ? paidRaw : 0));
      const remaining = round3(Math.max(0, Number.isFinite(dueRaw) ? dueRaw : total - paid));
      const status: SalesRow['paymentStatus'] = sale.paymentStatus
        || (remaining <= 0.0005 ? 'Paid' : paid > 0 ? 'Partial' : 'Due');
      const representative = String(sale.commissionAgentName || sale.addedBy || 'Unknown Agent').trim() || 'Unknown Agent';
      return {
        id: sale.id,
        dateRaw: String(sale.date || '').trim(),
        dateMs: parseMs(sale.date),
        invoice: String(sale.invoiceNo || sale.id || '--').trim() || '--',
        customer: String(sale.customerName || 'Walk-in Customer').trim() || 'Walk-in Customer',
        representative,
        representativeId: String(sale.commissionAgentId || '').trim(),
        location: String(sale.location || '--').trim() || '--',
        paymentStatus: status,
        total: round3(total),
        paid,
        remaining,
        commission: round3(Number(sale.commissionAmount || 0)),
      };
    }), [sales]);

  const expenseRows = useMemo<ExpenseRow[]>(() => expenses.map((expense) => {
    const baseAmount = round3(Math.max(0, Number(expense.totalAmount || expense.amount || 0) || 0));
    const amount = expense.isRefund ? -baseAmount : baseAmount;
    const paid = Number(expense.paidAmount || 0);
    const due = Number.isFinite(Number(expense.paymentDue))
      ? Math.max(0, Number(expense.paymentDue))
      : Math.max(0, baseAmount - Math.max(0, paid));
    const status: ExpenseRow['status'] = expense.paymentStatus
      || (due <= 0.0005 ? 'Paid' : due < baseAmount ? 'Partial' : 'Due');
    return {
      id: expense.id,
      dateRaw: String(expense.date || '').trim(),
      dateMs: parseMs(expense.date),
      ref: String(expense.refNo || expense.id || '--').trim() || '--',
      category: String(expense.category || 'Uncategorized').trim() || 'Uncategorized',
      location: String(expense.location || '--').trim() || '--',
      status,
      amount,
      expenseFor: String(expense.expenseFor || '').trim(),
      note: String(expense.note || '').trim(),
      user: String(expense.addedBy || '--').trim() || '--',
    };
  }), [expenses]);

  const locationOptions = useMemo(() => Array.from(new Set([
    ...locations.map((loc) => String(loc.name || '').trim()),
    ...salesRows.map((row) => row.location),
    ...expenseRows.map((row) => row.location),
  ].filter(Boolean))).sort(), [locations, salesRows, expenseRows]);

  const userOptions = useMemo(() => Array.from(new Set([
    ...users.map((user) => String(user.name || '').trim()),
    ...salesRows.map((row) => row.representative),
    ...expenseRows.map((row) => row.user),
  ].filter(Boolean))).sort(), [users, salesRows, expenseRows]);

  const startMs = useMemo(() => toStartMs(range.startDate), [range.startDate]);
  const endMs = useMemo(() => toEndMs(range.endDate), [range.endDate]);
  const hasDateFilter = startMs != null || endMs != null;
  const selectedUsers = useMemo(() => new Set(filters.user.map(normalize)), [filters.user]);
  const selectedLocations = useMemo(() => new Set(filters.location.map(normalize)), [filters.location]);

  const filteredSales = useMemo(() => {
    const query = normalize(searchTerm);
    return salesRows.filter((sale) => {
      if (!inRange(sale.dateMs, startMs, endMs, hasDateFilter)) return false;
      if (selectedUsers.size > 0 && !selectedUsers.has(normalize(sale.representative))) return false;
      if (selectedLocations.size > 0 && !selectedLocations.has(normalize(sale.location))) return false;
      if (!query) return true;
      const haystack = [sale.invoice, sale.customer, sale.representative, sale.location, sale.paymentStatus].map(normalize);
      return haystack.some((value) => value.includes(query));
    });
  }, [salesRows, searchTerm, startMs, endMs, hasDateFilter, selectedUsers, selectedLocations]);

  const filteredExpenses = useMemo(() => {
    const query = normalize(searchTerm);
    return expenseRows.filter((expense) => {
      if (!inRange(expense.dateMs, startMs, endMs, hasDateFilter)) return false;
      if (selectedUsers.size > 0 && !selectedUsers.has(normalize(expense.user))) return false;
      if (selectedLocations.size > 0 && !selectedLocations.has(normalize(expense.location))) return false;
      if (!query) return true;
      const haystack = [expense.ref, expense.category, expense.location, expense.status, expense.expenseFor, expense.note, expense.user].map(normalize);
      return haystack.some((value) => value.includes(query));
    });
  }, [expenseRows, searchTerm, startMs, endMs, hasDateFilter, selectedUsers, selectedLocations]);

  const sortedSales = useMemo(() => {
    const factor = salesSort.direction === 'asc' ? 1 : -1;
    return [...filteredSales].sort((left, right) => {
      if (salesSort.key === 'dateMs' || salesSort.key === 'total' || salesSort.key === 'paid' || salesSort.key === 'remaining' || salesSort.key === 'commission') {
        return ((left[salesSort.key] as number) - (right[salesSort.key] as number)) * factor;
      }
      return String(left[salesSort.key] || '').localeCompare(String(right[salesSort.key] || ''), undefined, { numeric: true, sensitivity: 'base' }) * factor;
    });
  }, [filteredSales, salesSort]);

  const commissionRows = useMemo(
    () => sortedSales.filter((row) => row.commission > 0),
    [sortedSales],
  );

  const sortedExpenses = useMemo(() => {
    const factor = expenseSort.direction === 'asc' ? 1 : -1;
    return [...filteredExpenses].sort((left, right) => {
      if (expenseSort.key === 'dateMs' || expenseSort.key === 'amount') {
        return ((left[expenseSort.key] as number) - (right[expenseSort.key] as number)) * factor;
      }
      return String(left[expenseSort.key] || '').localeCompare(String(right[expenseSort.key] || ''), undefined, { numeric: true, sensitivity: 'base' }) * factor;
    });
  }, [filteredExpenses, expenseSort]);

  const salesTotals = useMemo(() => filteredSales.reduce((acc, row) => ({
    totalSale: acc.totalSale + row.total,
    totalPaid: acc.totalPaid + row.paid,
    sellDue: acc.sellDue + row.remaining,
    totalCommission: acc.totalCommission + row.commission,
  }), { totalSale: 0, totalPaid: 0, sellDue: 0, totalCommission: 0 }), [filteredSales]);

  const commissionTotals = useMemo(() => commissionRows.reduce((acc, row) => ({
    totalSale: acc.totalSale + row.total,
    totalCommission: acc.totalCommission + row.commission,
  }), { totalSale: 0, totalCommission: 0 }), [commissionRows]);

  const totalExpense = useMemo(() => filteredExpenses.reduce((sum, row) => sum + row.amount, 0), [filteredExpenses]);
  const netAmount = salesTotals.totalSale - totalExpense;

  const activeRows = useMemo(() => {
    if (activeTab === 'sales_added') return sortedSales;
    if (activeTab === 'sales_commission') return commissionRows;
    return sortedExpenses;
  }, [activeTab, sortedSales, commissionRows, sortedExpenses]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, range.startDate, range.endDate, filters, entriesPerPage, salesSort, expenseSort]);

  const totalEntries = activeRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * entriesPerPage;
  const pageRows = activeRows.slice(start, start + entriesPerPage);
  const from = totalEntries === 0 ? 0 : start + 1;
  const to = totalEntries === 0 ? 0 : start + pageRows.length;

  const toggleSalesSort = (key: SalesSortKey) => {
    setSalesSort((prev) => (prev.key === key
      ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: (key === 'dateMs' || key === 'total' || key === 'paid' || key === 'remaining' || key === 'commission') ? 'desc' : 'asc' }));
  };

  const toggleExpenseSort = (key: ExpenseSortKey) => {
    setExpenseSort((prev) => (prev.key === key
      ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: (key === 'dateMs' || key === 'amount') ? 'desc' : 'asc' }));
  };

  const handleExportCsv = () => {
    const exportDate = new Date().toISOString().slice(0, 10);
    if (activeTab === 'expenses') {
      const headers = ['Date', 'Reference No', 'Expense Category', 'Location', 'Payment Status', 'Amount', 'Expense For', 'Expense Note', 'Added By'];
      const lines = sortedExpenses.map((row) => [
        csvEscape(formatDateTime(row.dateRaw, settings.dateFormat, settings.timeFormat)),
        csvEscape(row.ref),
        csvEscape(row.category),
        csvEscape(row.location),
        csvEscape(row.status),
        csvEscape(round3(row.amount).toFixed(3)),
        csvEscape(row.expenseFor),
        csvEscape(row.note),
        csvEscape(row.user),
      ].join(','));
      downloadFile(`sales_rep_expenses_${exportDate}.csv`, [headers.join(','), ...lines].join('\n'), 'text/csv;charset=utf-8;');
      return;
    }

    const sourceRows = activeTab === 'sales_commission' ? commissionRows : sortedSales;
    const includeCommission = activeTab === 'sales_commission';
    const headers = includeCommission
      ? ['Date', 'Invoice No', 'Customer Name', 'Sales Representative', 'Location', 'Payment Status', 'Total Amount', 'Sales Commission']
      : ['Date', 'Invoice No', 'Customer Name', 'Sales Representative', 'Location', 'Payment Status', 'Total Amount', 'Total Paid', 'Total Remaining'];
    const lines = sourceRows.map((row) => (includeCommission
      ? [
          csvEscape(formatDateTime(row.dateRaw, settings.dateFormat, settings.timeFormat)),
          csvEscape(row.invoice),
          csvEscape(row.customer),
          csvEscape(row.representative),
          csvEscape(row.location),
          csvEscape(row.paymentStatus),
          csvEscape(round3(row.total).toFixed(3)),
          csvEscape(round3(row.commission).toFixed(3)),
        ]
      : [
          csvEscape(formatDateTime(row.dateRaw, settings.dateFormat, settings.timeFormat)),
          csvEscape(row.invoice),
          csvEscape(row.customer),
          csvEscape(row.representative),
          csvEscape(row.location),
          csvEscape(row.paymentStatus),
          csvEscape(round3(row.total).toFixed(3)),
          csvEscape(round3(row.paid).toFixed(3)),
          csvEscape(round3(row.remaining).toFixed(3)),
        ]).join(','));
    downloadFile(`sales_rep_${activeTab}_${exportDate}.csv`, [headers.join(','), ...lines].join('\n'), 'text/csv;charset=utf-8;');
  };

  const handleExportExcel = () => {
    const exportDate = new Date().toISOString().slice(0, 10);
    if (activeTab === 'expenses') {
      const headers = ['Date', 'Reference No', 'Expense Category', 'Location', 'Payment Status', 'Amount', 'Expense For', 'Expense Note', 'Added By'];
      const lines = sortedExpenses.map((row) => [
        formatDateTime(row.dateRaw, settings.dateFormat, settings.timeFormat),
        row.ref, row.category, row.location, row.status, round3(row.amount).toFixed(3), row.expenseFor, row.note, row.user,
      ].join('\t'));
      downloadFile(`sales_rep_expenses_${exportDate}.xls`, [headers.join('\t'), ...lines].join('\n'), 'application/vnd.ms-excel;charset=utf-8;');
      return;
    }

    const sourceRows = activeTab === 'sales_commission' ? commissionRows : sortedSales;
    const includeCommission = activeTab === 'sales_commission';
    const headers = includeCommission
      ? ['Date', 'Invoice No', 'Customer Name', 'Sales Representative', 'Location', 'Payment Status', 'Total Amount', 'Sales Commission']
      : ['Date', 'Invoice No', 'Customer Name', 'Sales Representative', 'Location', 'Payment Status', 'Total Amount', 'Total Paid', 'Total Remaining'];
    const lines = sourceRows.map((row) => (includeCommission
      ? [formatDateTime(row.dateRaw, settings.dateFormat, settings.timeFormat), row.invoice, row.customer, row.representative, row.location, row.paymentStatus, round3(row.total).toFixed(3), round3(row.commission).toFixed(3)]
      : [formatDateTime(row.dateRaw, settings.dateFormat, settings.timeFormat), row.invoice, row.customer, row.representative, row.location, row.paymentStatus, round3(row.total).toFixed(3), round3(row.paid).toFixed(3), round3(row.remaining).toFixed(3)]).join('\t'));
    downloadFile(`sales_rep_${activeTab}_${exportDate}.xls`, [headers.join('\t'), ...lines].join('\n'), 'application/vnd.ms-excel;charset=utf-8;');
  };

  const handleExportPdf = () => {
    try {
      const jspdf = (window as any).jspdf;
      const JsPDF = jspdf?.jsPDF;
      if (!JsPDF) { printActiveReportTable(); return; }
      const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const margin = 24;
      const rowHeight = 14;
      const maxY = 560;
      const pageWidth = 842;
      let y = 32;
      const columns = activeTab === 'expenses'
        ? ['Date', 'Ref No', 'Category', 'Location', 'Status', 'Amount', 'Expense For', 'Note', 'User']
        : activeTab === 'sales_commission'
          ? ['Date', 'Invoice', 'Customer', 'Rep', 'Location', 'Status', 'Total', 'Commission']
          : ['Date', 'Invoice', 'Customer', 'Rep', 'Location', 'Status', 'Total', 'Paid', 'Remaining'];
      const width = (pageWidth - margin * 2) / columns.length;
      const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        columns.forEach((header: string, idx: number) => doc.text(header, margin + idx * width, y));
        doc.setFont('helvetica', 'normal');
        y += rowHeight;
      };

      doc.setFontSize(14);
      doc.text('Sales Representative Report', margin, y);
      y += rowHeight + 4;
      doc.setFontSize(9);
      doc.text(`Tab: ${activeTab === 'sales_added' ? 'Sales Added' : activeTab === 'sales_commission' ? 'Sales With Commission' : 'Expenses'}`, margin, y);
      y += rowHeight;
      doc.text(`Date Range: ${range.label || 'Selected range'}`, margin, y);
      y += rowHeight;
      doc.text(`Generated: ${formatDateTimeBySettings(new Date().toISOString(), settings.dateFormat, settings.timeFormat, settings.timeZone)}`, margin, y);
      y += rowHeight + 4;

      drawHeader();
      if (activeRows.length === 0) {
        doc.text('No records found', margin, y);
        y += rowHeight;
      } else {
        const toShort = (value: unknown, max = 18) => String(value ?? '').slice(0, max);
        activeRows.forEach((row) => {
          if (y > maxY) {
            doc.addPage();
            y = 32;
            drawHeader();
          }
          const values = activeTab === 'expenses'
            ? [
                formatDateTime((row as ExpenseRow).dateRaw, settings.dateFormat, settings.timeFormat),
                (row as ExpenseRow).ref, (row as ExpenseRow).category, (row as ExpenseRow).location, (row as ExpenseRow).status,
                round3((row as ExpenseRow).amount).toFixed(3), (row as ExpenseRow).expenseFor, (row as ExpenseRow).note, (row as ExpenseRow).user,
              ]
            : activeTab === 'sales_commission'
              ? [
                  formatDateTime((row as SalesRow).dateRaw, settings.dateFormat, settings.timeFormat),
                  (row as SalesRow).invoice, (row as SalesRow).customer, (row as SalesRow).representative, (row as SalesRow).location,
                  (row as SalesRow).paymentStatus, round3((row as SalesRow).total).toFixed(3), round3((row as SalesRow).commission).toFixed(3),
                ]
              : [
                  formatDateTime((row as SalesRow).dateRaw, settings.dateFormat, settings.timeFormat),
                  (row as SalesRow).invoice, (row as SalesRow).customer, (row as SalesRow).representative, (row as SalesRow).location,
                  (row as SalesRow).paymentStatus, round3((row as SalesRow).total).toFixed(3), round3((row as SalesRow).paid).toFixed(3), round3((row as SalesRow).remaining).toFixed(3),
                ];
          values.forEach((value, idx) => doc.text(toShort(value), margin + idx * width, y));
          y += rowHeight;
        });
      }

      if (y + rowHeight > maxY) { doc.addPage(); y = 32; }
      doc.setFont('helvetica', 'bold');
      if (activeTab === 'expenses') {
        doc.text(`Total: ${formatCurrency(totalExpense)}`, margin, y + rowHeight);
      } else if (activeTab === 'sales_commission') {
        doc.text(`Total Sale: ${formatCurrency(commissionTotals.totalSale)} | Total Commission: ${formatCurrency(commissionTotals.totalCommission)}`, margin, y + rowHeight);
      } else {
        doc.text(`Total Sale: ${formatCurrency(salesTotals.totalSale)} | Total Paid: ${formatCurrency(salesTotals.totalPaid)} | Sell Due: ${formatCurrency(salesTotals.sellDue)}`, margin, y + rowHeight);
      }
      doc.save(`sales_rep_report_${activeTab}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      printActiveReportTable();
    }
  };

  const salesPageRows = pageRows as SalesRow[];
  const expensePageRows = pageRows as ExpenseRow[];

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <UserCheck size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Sales Representative Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Performance metrics per sales representative</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
<div
          className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-sm cursor-pointer w-fit"
          onClick={() => setShowFilters((value) => !value)}
        >
          <Filter size={16} /> Filters
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 animate-in slide-in-from-top-2">
            <MultiSelect
              label="User"
              options={userOptions}
              selected={filters.user}
              onChange={(val) => setFilters((prev) => ({ ...prev, user: val }))}
            />
            <MultiSelect
              label="Business Location"
              options={locationOptions}
              selected={filters.location}
              onChange={(val) => setFilters((prev) => ({ ...prev, location: val }))}
            />
            <DateRangeFilter
              allowAllTime
              initialRange={range}
              onRangeSelect={(nextRange) => setRange(nextRange as DateRangeValue)}
            />
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <h3 className="text-lg font-bold text-slate-800 mb-4">Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="font-medium text-slate-600">
            Total Sale: <span className="font-bold text-slate-800">{formatCurrency(salesTotals.totalSale)}</span>
          </div>
          <div className="font-medium text-slate-600">
            Total Expense: <span className="font-bold text-slate-800">{formatCurrency(totalExpense)}</span>
          </div>
          <div className="font-medium text-slate-600">
            Net (Sale - Expense): <span className="font-bold text-slate-800">{formatCurrency(netAmount)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="flex border-b border-slate-200 bg-slate-50/50">
          <button
            className={`px-6 py-4 text-xs font-bold transition-all border-b-2 ${activeTab === 'sales_added' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            onClick={() => setActiveTab('sales_added')}
          >
            <span className="flex items-center gap-2"><ShoppingBag size={14} /> Sales Added</span>
          </button>
          <button
            className={`px-6 py-4 text-xs font-bold transition-all border-b-2 ${activeTab === 'sales_commission' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            onClick={() => setActiveTab('sales_commission')}
          >
            <span className="flex items-center gap-2"><Settings size={14} /> Sales With Commission</span>
          </button>
          <button
            className={`px-6 py-4 text-xs font-bold transition-all border-b-2 ${activeTab === 'expenses' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            onClick={() => setActiveTab('expenses')}
          >
            <span className="flex items-center gap-2"><CreditCard size={14} /> Expenses</span>
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-bold">Show</span>
            <select
              className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none"
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
            <button type="button" onClick={handleExportCsv} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10} /> Export CSV</button>
            <button type="button" onClick={handleExportExcel} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10} /> Export Excel</button>
            <button type="button" onClick={() => printActiveReportTable()} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={10} /> Print</button>
            <button type="button" onClick={handleExportPdf} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Download size={10} /> Export PDF</button>
          </div>

          <div className="flex items-center gap-2">
            <Search className="text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search..."
              className="pl-2 py-1 border border-slate-300 rounded text-xs outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {activeTab === 'sales_added' && (
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-[10px] text-left border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleSalesSort('dateMs')}>Date {sortIcon(salesSort.key === 'dateMs', salesSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleSalesSort('invoice')}>Invoice No. {sortIcon(salesSort.key === 'invoice', salesSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleSalesSort('customer')}>Customer Name {sortIcon(salesSort.key === 'customer', salesSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleSalesSort('representative')}>Sales Representative {sortIcon(salesSort.key === 'representative', salesSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleSalesSort('location')}>Location {sortIcon(salesSort.key === 'location', salesSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleSalesSort('paymentStatus')}>Payment Status {sortIcon(salesSort.key === 'paymentStatus', salesSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => toggleSalesSort('total')}>Total Amount {sortIcon(salesSort.key === 'total', salesSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => toggleSalesSort('paid')}>Total Paid {sortIcon(salesSort.key === 'paid', salesSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => toggleSalesSort('remaining')}>Total Remaining {sortIcon(salesSort.key === 'remaining', salesSort.direction)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesPageRows.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(item.dateRaw, settings.dateFormat, settings.timeFormat)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.invoice}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.customer}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.representative}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[9px] text-slate-500">{item.location}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-white font-bold uppercase ${getStatusClass(item.paymentStatus)}`}>
                        {item.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(item.total)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(item.paid)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(item.remaining)}</td>
                  </tr>
                ))}
                {salesPageRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400 italic">No data available in table</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right uppercase">Total:</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(salesTotals.totalSale)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(salesTotals.totalPaid)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">Sell Due: {formatCurrency(salesTotals.sellDue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {activeTab === 'sales_commission' && (
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-[10px] text-left border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleSalesSort('dateMs')}>Date {sortIcon(salesSort.key === 'dateMs', salesSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleSalesSort('invoice')}>Invoice No. {sortIcon(salesSort.key === 'invoice', salesSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleSalesSort('customer')}>Customer Name {sortIcon(salesSort.key === 'customer', salesSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleSalesSort('representative')}>Sales Representative {sortIcon(salesSort.key === 'representative', salesSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleSalesSort('location')}>Location {sortIcon(salesSort.key === 'location', salesSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleSalesSort('paymentStatus')}>Payment Status {sortIcon(salesSort.key === 'paymentStatus', salesSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => toggleSalesSort('total')}>Total Amount {sortIcon(salesSort.key === 'total', salesSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => toggleSalesSort('commission')}>Sales Commission {sortIcon(salesSort.key === 'commission', salesSort.direction)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesPageRows.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(item.dateRaw, settings.dateFormat, settings.timeFormat)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.invoice}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.customer}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.representative}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[9px] text-slate-500">{item.location}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-white font-bold uppercase ${getStatusClass(item.paymentStatus)}`}>
                        {item.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(item.total)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(item.commission)}</td>
                  </tr>
                ))}
                {salesPageRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400 italic">No data available in table</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right uppercase">Total:</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(commissionTotals.totalSale)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(commissionTotals.totalCommission)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-[10px] text-left border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleExpenseSort('dateMs')}>Date {sortIcon(expenseSort.key === 'dateMs', expenseSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleExpenseSort('ref')}>Reference No {sortIcon(expenseSort.key === 'ref', expenseSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleExpenseSort('category')}>Expense Category {sortIcon(expenseSort.key === 'category', expenseSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleExpenseSort('location')}>Location {sortIcon(expenseSort.key === 'location', expenseSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleExpenseSort('status')}>Payment Status {sortIcon(expenseSort.key === 'status', expenseSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => toggleExpenseSort('amount')}>Total amount {sortIcon(expenseSort.key === 'amount', expenseSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleExpenseSort('expenseFor')}>Expense for {sortIcon(expenseSort.key === 'expenseFor', expenseSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleExpenseSort('note')}>Expense note {sortIcon(expenseSort.key === 'note', expenseSort.direction)}</th>
                  <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => toggleExpenseSort('user')}>Added by {sortIcon(expenseSort.key === 'user', expenseSort.direction)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expensePageRows.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(item.dateRaw, settings.dateFormat, settings.timeFormat)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.ref}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.category}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[9px] text-slate-500">{item.location}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-white font-bold uppercase ${getStatusClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(item.amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.expenseFor || '--'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.note || '--'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.user}</td>
                  </tr>
                ))}
                {expensePageRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400 italic">No data available in table</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right uppercase">Total:</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(totalExpense)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div>Showing {from} to {to} of {totalEntries} entries</div>
          <div className="flex gap-1">
            <button type="button" onClick={() => setCurrentPage((value) => Math.max(1, value - 1))} disabled={safePage <= 1} className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
            <span className="px-2 py-1 bg-blue-600 text-white rounded shadow-sm" aria-current="page">{safePage}</span>
            <button type="button" onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages} className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-200 text-[10px] text-slate-400 font-medium text-center sm:text-left">
        Wingital - V6.4 | Copyright 2026 All rights reserved.
      </div>
    </div>
  );
};

export default ReportSalesRep;
