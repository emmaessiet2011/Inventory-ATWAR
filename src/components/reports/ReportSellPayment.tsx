import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Printer,
  Search,CreditCard} from 'lucide-react';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import { useGlobalContext } from '@/context/GlobalContext';

import MultiSelect from '@/components/shared/MultiSelect';

import { printActiveReportTable } from '@/utils/printUtils';
import { parseExpenseDateToMs } from '@/utils/expenses';

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

interface ReportRow {
  id: string;
  dateRaw: string;
  dateMs: number;
  ref: string;
  invoiceNo: string;
  customer: string;
  customerGroup: string;
  location: string;
  method: string;
  addedBy: string;
  account: string;
  note: string;
  amount: number;
}

type SortDirection = 'asc' | 'desc';
type SortKey = 'dateMs' | 'ref' | 'invoiceNo' | 'customer' | 'customerGroup' | 'location' | 'method' | 'addedBy' | 'amount';

interface SortState {
  key: SortKey;
  direction: SortDirection;
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const round3 = (value: number) => Math.round(value * 1000) / 1000;
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

const ReportSellPayment: React.FC = () => {
  const { locations, customers, customerGroups, sales, payments, settings, formatCurrency } = useGlobalContext();
  const [showFilters, setShowFilters] = useState(true);
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeValue>(allTime);
  const [filters, setFilters] = useState({
    customer: [] as string[],
    customerGroup: [] as string[],
    location: [] as string[],
    paymentMethod: [] as string[],
    user: [] as string[],
  });
  const [sort, setSort] = useState<SortState>({ key: 'dateMs', direction: 'desc' });

  const customerById = useMemo(() => {
    const map = new Map<string, (typeof customers)[number]>();
    customers.forEach((customer) => {
      const key = String(customer.id || '').trim();
      if (!key) return;
      map.set(key, customer);
    });
    return map;
  }, [customers]);

  const customerByName = useMemo(() => {
    const map = new Map<string, (typeof customers)[number]>();
    customers.forEach((customer) => {
      const key = normalize(customer.businessName || customer.name);
      if (!key) return;
      map.set(key, customer);
    });
    return map;
  }, [customers]);

  const customerGroupById = useMemo(() => {
    const map = new Map<string, string>();
    customerGroups.forEach((group) => {
      const key = normalize(group.id);
      if (!key) return;
      map.set(key, String(group.name || '').trim());
    });
    return map;
  }, [customerGroups]);

  const saleByInvoice = useMemo(() => {
    const map = new Map<string, (typeof sales)[number]>();
    sales.forEach((sale) => {
      const key = String(sale.invoiceNo || '').trim();
      if (!key) return;
      map.set(key, sale);
    });
    return map;
  }, [sales]);

  const rows = useMemo<ReportRow[]>(() => {
    const extractInvoiceNo = (payment: (typeof payments)[number]): string => {
      const linked = Array.isArray(payment.linkedInvoices)
        ? payment.linkedInvoices.map((value) => String(value || '').trim()).filter(Boolean)
        : [];
      if (linked.length > 0) return linked[0];
      const source = `${payment.referenceNo || ''} ${payment.note || ''}`;
      const match = source.match(/\b(?:INV[-/]\d{4}-\d+|K\d{4}-\d+|[A-Z]{1,5}\d{4}-\d+)\b/i);
      return match ? match[0] : '--';
    };

    const paymentRows = payments
      .filter((payment) => payment.contactType === 'Customer' && payment.type === 'received')
      .map((payment) => {
        const rawAmount = Number(payment.amount);
        if (!Number.isFinite(rawAmount) || rawAmount <= 0) return null;
        const invoiceNo = extractInvoiceNo(payment);
        const linkedSale = saleByInvoice.get(invoiceNo);
        const customer = (
          customerById.get(String(payment.contactId || '').trim())
          || customerByName.get(normalize(payment.contactName))
        );
        const customerLabel = String(payment.contactName || customer?.businessName || customer?.name || '--').trim() || '--';
        const customerGroup = String(
          linkedSale?.customerGroup
          || customerGroupById.get(normalize(linkedSale?.customerGroupId))
          || customer?.customerGroup
          || customerGroupById.get(normalize(customer?.customerGroupId))
          || 'Ungrouped',
        ).trim() || 'Ungrouped';
        return {
          id: payment.id,
          dateRaw: String(payment.date || '').trim(),
          dateMs: parseMs(payment.date),
          ref: String(payment.referenceNo || payment.id || '--').trim() || '--',
          invoiceNo,
          customer: customerLabel,
          customerGroup,
          location: String(payment.location || linkedSale?.location || '').trim(),
          method: String(payment.method || '--').trim() || '--',
          addedBy: String(payment.addedBy || '--').trim() || '--',
          account: String(payment.account || '').trim(),
          note: String(payment.note || '').trim(),
          amount: round3(rawAmount),
        };
      })
      .filter((row): row is ReportRow => !!row);

    const coveredInvoiceSet = new Set(
      paymentRows
        .map((row) => String(row.invoiceNo || '').trim())
        .filter((invoiceNo) => invoiceNo && invoiceNo !== '--'),
    );

    const inferredRows = sales
      .filter((sale) => {
        const saleStatus = normalize(sale.status || sale.saleStatus);
        if (saleStatus !== 'final') return false;
        const paid = Number(sale.totalPaid || 0);
        if (!Number.isFinite(paid) || paid <= 0) return false;
        const invoiceNo = String(sale.invoiceNo || '').trim();
        if (!invoiceNo || coveredInvoiceSet.has(invoiceNo)) return false;
        return true;
      })
      .map((sale) => {
        const customer = (
          customerById.get(String(sale.customerId || '').trim())
          || customerByName.get(normalize(sale.customerName))
        );
        const customerLabel = String(sale.customerName || customer?.businessName || customer?.name || '--').trim() || '--';
        const customerGroup = String(
          sale.customerGroup
          || customerGroupById.get(normalize(sale.customerGroupId))
          || customer?.customerGroup
          || customerGroupById.get(normalize(customer?.customerGroupId))
          || 'Ungrouped',
        ).trim() || 'Ungrouped';
        const invoiceNo = String(sale.invoiceNo || '--').trim() || '--';
        const ref = `SP-${invoiceNo === '--' ? String(sale.id || '').trim() || Date.now() : invoiceNo}`;
        return {
          id: `inferred-${sale.id}`,
          dateRaw: String(sale.paymentDate || sale.date || '').trim(),
          dateMs: parseMs(sale.paymentDate || sale.date),
          ref,
          invoiceNo,
          customer: customerLabel,
          customerGroup,
          location: String(sale.location || '').trim(),
          method: String(sale.paymentMethod || '--').trim() || '--',
          addedBy: String(sale.addedBy || '--').trim() || '--',
          account: String((sale as any).paymentAccount || '').trim(),
          note: `Recovered from paid invoice ${invoiceNo}`,
          amount: round3(Number(sale.totalPaid || 0)),
        };
      });

    return [...paymentRows, ...inferredRows]
      .sort((left, right) => {
        const leftMs = Number.isFinite(left.dateMs) ? left.dateMs : Number.MIN_SAFE_INTEGER;
        const rightMs = Number.isFinite(right.dateMs) ? right.dateMs : Number.MIN_SAFE_INTEGER;
        return rightMs - leftMs;
      });
  }, [payments, sales, saleByInvoice, customerById, customerByName, customerGroupById]);

  const customerOptions = useMemo(() => (
    Array.from(new Set(rows.map((row) => row.customer).filter(Boolean) as string[]))
      .sort((left, right) => String(left).localeCompare(String(right)))
  ), [rows]);

  const customerGroupOptions = useMemo(() => (
    Array.from(new Set(rows.map((row) => row.customerGroup).filter(Boolean) as string[]))
      .sort((left, right) => String(left).localeCompare(String(right)))
  ), [rows]);

  const locationOptions = useMemo(() => (
    Array.from(new Set([
      ...locations.map((location) => String(location.name || '').trim()),
      ...rows.map((row) => row.location),
    ].filter(Boolean) as string[]))
      .sort((left, right) => String(left).localeCompare(String(right)))
  ), [locations, rows]);

  const paymentMethodOptions = useMemo(() => (
    Array.from(new Set(rows.map((row) => row.method).filter(Boolean) as string[]))
      .sort((left, right) => String(left).localeCompare(String(right)))
  ), [rows]);

  const userOptions = useMemo(() => (
    Array.from(new Set(rows.map((row) => row.addedBy).filter((value) => value && value !== '--') as string[]))
      .sort((left, right) => String(left).localeCompare(String(right)))
  ), [rows]);

  const startMs = useMemo(() => toStartMs(dateRange.startDate), [dateRange.startDate]);
  const endMs = useMemo(() => toEndMs(dateRange.endDate), [dateRange.endDate]);
  const hasDateFilter = startMs != null || endMs != null;

  const selectedCustomerSet = useMemo(() => new Set(filters.customer.map(normalize)), [filters.customer]);
  const selectedCustomerGroupSet = useMemo(() => new Set(filters.customerGroup.map(normalize)), [filters.customerGroup]);
  const selectedLocationSet = useMemo(() => new Set(filters.location.map(normalize)), [filters.location]);
  const selectedMethodSet = useMemo(() => new Set(filters.paymentMethod.map(normalize)), [filters.paymentMethod]);
  const selectedUserSet = useMemo(() => new Set(filters.user.map(normalize)), [filters.user]);

  const filteredRows = useMemo(() => {
    const query = normalize(searchTerm);
    return rows.filter((row) => {
      if (!inRange(row.dateMs, startMs, endMs, hasDateFilter)) return false;
      if (selectedCustomerSet.size > 0 && !selectedCustomerSet.has(normalize(row.customer))) return false;
      if (selectedCustomerGroupSet.size > 0 && !selectedCustomerGroupSet.has(normalize(row.customerGroup))) return false;
      if (selectedLocationSet.size > 0 && !selectedLocationSet.has(normalize(row.location))) return false;
      if (selectedMethodSet.size > 0 && !selectedMethodSet.has(normalize(row.method))) return false;
      if (selectedUserSet.size > 0 && !selectedUserSet.has(normalize(row.addedBy))) return false;
      if (!query) return true;
      const haystack = [
        row.ref,
        row.invoiceNo,
        row.customer,
        row.customerGroup,
        row.location,
        row.method,
        row.addedBy,
        row.account,
        row.note,
      ].map(normalize);
      return haystack.some((value) => value.includes(query));
    });
  }, [
    rows,
    startMs,
    endMs,
    hasDateFilter,
    selectedCustomerSet,
    selectedCustomerGroupSet,
    selectedLocationSet,
    selectedMethodSet,
    selectedUserSet,
    searchTerm,
  ]);

  const sortedRows = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...filteredRows].sort((left, right) => {
      if (sort.key === 'amount' || sort.key === 'dateMs') {
        return ((left[sort.key] as number) - (right[sort.key] as number)) * factor;
      }
      return String(left[sort.key] || '').localeCompare(String(right[sort.key] || ''), undefined, { numeric: true, sensitivity: 'base' }) * factor;
    });
  }, [filteredRows, sort]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateRange.startDate, dateRange.endDate, filters, entriesPerPage, sort]);

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * entriesPerPage;
  const pageRows = sortedRows.slice(start, start + entriesPerPage);
  const from = totalEntries === 0 ? 0 : start + 1;
  const to = totalEntries === 0 ? 0 : start + pageRows.length;

  const totalAmount = useMemo(() => (
    round3(sortedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0))
  ), [sortedRows]);

  const handleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: key === 'amount' || key === 'dateMs' ? 'desc' : 'asc' };
    });
  };

  const handleExportCsv = () => {
    const headers = ['Paid on', 'Reference No', 'Invoice', 'Customer', 'Customer Group', 'Location', 'Payment Method', 'Added By', 'Amount'];
    const lines = sortedRows.map((row) => ([
      csvEscape(formatDateTime(row.dateRaw, settings.dateFormat, settings.timeFormat)),
      csvEscape(row.ref),
      csvEscape(row.invoiceNo),
      csvEscape(row.customer),
      csvEscape(row.customerGroup),
      csvEscape(row.location || '--'),
      csvEscape(row.method),
      csvEscape(row.addedBy),
      csvEscape(round3(row.amount).toFixed(3)),
    ].join(',')));
    downloadFile(
      `sell_payment_report_${new Date().toISOString().slice(0, 10)}.csv`,
      [headers.join(','), ...lines].join('\n'),
      'text/csv;charset=utf-8;',
    );
  };

  const handleExportExcel = () => {
    const headers = ['Paid on', 'Reference No', 'Invoice', 'Customer', 'Customer Group', 'Location', 'Payment Method', 'Added By', 'Amount'];
    const lines = sortedRows.map((row) => ([
      formatDateTime(row.dateRaw, settings.dateFormat, settings.timeFormat),
      row.ref,
      row.invoiceNo,
      row.customer,
      row.customerGroup,
      row.location || '--',
      row.method,
      row.addedBy,
      round3(row.amount).toFixed(3),
    ].join('\t')));
    downloadFile(
      `sell_payment_report_${new Date().toISOString().slice(0, 10)}.xls`,
      [headers.join('\t'), ...lines].join('\n'),
      'application/vnd.ms-excel;charset=utf-8;',
    );
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
      const columns = ['Paid on', 'Reference', 'Invoice', 'Customer', 'Group', 'Location', 'Method', 'User', 'Amount'];
      const width = (pageWidth - margin * 2) / columns.length;

      const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        columns.forEach((header, idx) => doc.text(header, margin + idx * width, y));
        doc.setFont('helvetica', 'normal');
        y += rowHeight;
      };

      doc.setFontSize(14);
      doc.text('Sell Payment Report', margin, y);
      y += rowHeight + 4;
      doc.setFontSize(9);
      doc.text(`Date Range: ${dateRange.label || 'Selected range'}`, margin, y);
      y += rowHeight;
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
      y += rowHeight + 4;

      drawHeader();
      if (sortedRows.length === 0) {
        doc.text('No records found', margin, y);
        y += rowHeight;
      } else {
        sortedRows.forEach((row) => {
          if (y > maxY) {
            doc.addPage();
            y = 32;
            drawHeader();
          }
          const values = [
            formatDateTime(row.dateRaw, settings.dateFormat, settings.timeFormat),
            row.ref,
            row.invoiceNo,
            row.customer,
            row.customerGroup,
            row.location || '--',
            row.method,
            row.addedBy,
            round3(row.amount).toFixed(3),
          ];
          values.forEach((value, idx) => doc.text(String(value).slice(0, 18), margin + idx * width, y));
          y += rowHeight;
        });
      }
      if (y + rowHeight > maxY) { doc.addPage(); y = 32; }
      doc.setFont('helvetica', 'bold');
      doc.text(`Total: ${formatCurrency(totalAmount)}`, margin, y + rowHeight);
      doc.save(`sell_payment_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      printActiveReportTable();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <CreditCard size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Sell Payment Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Payments received from customers</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
<div
          className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-sm cursor-pointer w-fit"
          onClick={() => setShowFilters((value) => !value)}
        >
          <Filter size={16} /> Filters
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2 animate-in slide-in-from-top-2">
            <MultiSelect
              label="Customer"
              options={customerOptions}
              selected={filters.customer}
              onChange={(value) => setFilters((prev) => ({ ...prev, customer: value }))}
            />
            <MultiSelect
              label="Customer Group"
              options={customerGroupOptions}
              selected={filters.customerGroup}
              onChange={(value) => setFilters((prev) => ({ ...prev, customerGroup: value }))}
            />
            <MultiSelect
              label="Business Location"
              options={locationOptions}
              selected={filters.location}
              onChange={(value) => setFilters((prev) => ({ ...prev, location: value }))}
            />
            <MultiSelect
              label="Payment Method"
              options={paymentMethodOptions}
              selected={filters.paymentMethod}
              onChange={(value) => setFilters((prev) => ({ ...prev, paymentMethod: value }))}
            />
            <MultiSelect
              label="User"
              options={userOptions}
              selected={filters.user}
              onChange={(value) => setFilters((prev) => ({ ...prev, user: value }))}
            />
            <DateRangeFilter allowAllTime initialRange={dateRange} onRangeSelect={(range) => setDateRange(range as DateRangeValue)} />
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
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[420px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('dateMs')}>Paid on <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'dateMs' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'dateMs' && sort.direction === 'desc' ? 'rotate-180' : ''}`} /></th>
                <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('ref')}>Reference No <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'ref' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'ref' && sort.direction === 'desc' ? 'rotate-180' : ''}`} /></th>
                <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('invoiceNo')}>Invoice <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'invoiceNo' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'invoiceNo' && sort.direction === 'desc' ? 'rotate-180' : ''}`} /></th>
                <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('customer')}>Customer <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'customer' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'customer' && sort.direction === 'desc' ? 'rotate-180' : ''}`} /></th>
                <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('customerGroup')}>Customer Group <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'customerGroup' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'customerGroup' && sort.direction === 'desc' ? 'rotate-180' : ''}`} /></th>
                <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('location')}>Location <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'location' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'location' && sort.direction === 'desc' ? 'rotate-180' : ''}`} /></th>
                <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('method')}>Payment Method <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'method' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'method' && sort.direction === 'desc' ? 'rotate-180' : ''}`} /></th>
                <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('addedBy')}>Added By <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'addedBy' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'addedBy' && sort.direction === 'desc' ? 'rotate-180' : ''}`} /></th>
                <th className="px-4 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort('amount')}>Amount <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'amount' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'amount' && sort.direction === 'desc' ? 'rotate-180' : ''}`} /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateTime(row.dateRaw, settings.dateFormat, settings.timeFormat)}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{row.ref}</td>
                  <td className="px-4 py-3 text-slate-700 font-mono">{row.invoiceNo}</td>
                  <td className="px-4 py-3 text-slate-700">{row.customer}</td>
                  <td className="px-4 py-3 text-slate-600">{row.customerGroup}</td>
                  <td className="px-4 py-3 text-slate-600">{row.location || '--'}</td>
                  <td className="px-4 py-3 text-slate-600">{row.method}</td>
                  <td className="px-4 py-3 text-slate-600">{row.addedBy}</td>
                  <td className="px-4 py-3 text-right text-slate-800 font-bold whitespace-nowrap">{formatCurrency(row.amount)}</td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400 italic">No records found</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-slate-800 text-[10px] border-t border-slate-300 uppercase">
              <tr>
                <td colSpan={8} className="px-4 py-3 text-right">Total:</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div>Showing {from} to {to} of {totalEntries} entries</div>
          <div className="flex gap-1">
            <button type="button" onClick={() => setCurrentPage((value) => Math.max(1, value - 1))} disabled={safePage <= 1} className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
            <button className="px-2 py-1 bg-blue-600 text-white rounded shadow-sm">{safePage}</button>
            <button type="button" onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages} className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportSellPayment;

