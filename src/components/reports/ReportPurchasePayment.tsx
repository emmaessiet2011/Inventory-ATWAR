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
import { formatDateTimeBySettings } from '@/utils/dateTime';

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
  purchaseRef: string;
  supplier: string;
  location: string;
  method: string;
  addedBy: string;
  account: string;
  note: string;
  amount: number;
}

type SortDirection = 'asc' | 'desc';
type SortKey = 'dateMs' | 'ref' | 'purchaseRef' | 'supplier' | 'location' | 'method' | 'addedBy' | 'amount';

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

const ReportPurchasePayment: React.FC = () => {
  const { locations, suppliers, purchases, payments, settings, formatCurrency } = useGlobalContext();
  const [showFilters, setShowFilters] = useState(true);
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeValue>(allTime);
  const [filters, setFilters] = useState({
    supplier: [] as string[],
    location: [] as string[],
    paymentMethod: [] as string[],
    user: [] as string[],
  });
  const [sort, setSort] = useState<SortState>({ key: 'dateMs', direction: 'desc' });

  const purchaseByRef = useMemo(() => {
    const map = new Map<string, (typeof purchases)[number]>();
    purchases.forEach((purchase) => {
      const key = normalize(purchase.refNo);
      if (!key) return;
      map.set(key, purchase);
    });
    return map;
  }, [purchases]);

  const knownPurchaseRefs = useMemo(() => (
    purchases
      .map((purchase) => String(purchase.refNo || '').trim())
      .filter(Boolean)
  ), [purchases]);

  const supplierById = useMemo(() => {
    const map = new Map<string, (typeof suppliers)[number]>();
    suppliers.forEach((supplier) => {
      const key = String(supplier.id || '').trim();
      if (!key) return;
      map.set(key, supplier);
    });
    return map;
  }, [suppliers]);

  const supplierByName = useMemo(() => {
    const map = new Map<string, (typeof suppliers)[number]>();
    suppliers.forEach((supplier) => {
      const key = normalize(supplier.businessName);
      if (!key) return;
      map.set(key, supplier);
    });
    return map;
  }, [suppliers]);

  const rows = useMemo<ReportRow[]>(() => {
    const inferPurchaseRef = (payment: (typeof payments)[number]) => {
      const linked = Array.isArray(payment.linkedInvoices)
        ? payment.linkedInvoices.map((value) => String(value || '').trim()).filter(Boolean)
        : [];
      if (linked.length > 0) return linked[0];

      const source = `${payment.referenceNo || ''} ${payment.note || ''}`.trim();
      if (!source) return '';
      const directRef = knownPurchaseRefs.find((ref) => source.toLowerCase().includes(ref.toLowerCase()));
      if (directRef) return directRef;

      const tokenMatch = source.match(/\b(?:PUR\d{4}[/-]\d+|PO[-/]\d{4}[-/]\d+|[A-Z]{2,8}\d{4}[/-]\d+)\b/i);
      return tokenMatch ? tokenMatch[0] : '';
    };

    return payments
      .filter((payment) => payment.contactType === 'Supplier' && payment.type === 'sent')
      .map((payment) => {
        const inferredPurchaseRef = inferPurchaseRef(payment);
        const linkedPurchase = purchaseByRef.get(normalize(inferredPurchaseRef));
        const supplierRecord = (
          supplierById.get(String(payment.contactId || '').trim())
          || supplierByName.get(normalize(payment.contactName))
        );
        const supplierName = String(
          payment.contactName
          || supplierRecord?.businessName
          || linkedPurchase?.supplier
          || '--',
        ).trim() || '--';
        return {
          id: payment.id,
          dateRaw: String(payment.date || '').trim(),
          dateMs: parseMs(payment.date),
          ref: String(payment.referenceNo || payment.id || '--').trim() || '--',
          purchaseRef: String(inferredPurchaseRef || linkedPurchase?.refNo || '--').trim() || '--',
          supplier: supplierName,
          location: String(payment.location || linkedPurchase?.location || '').trim(),
          method: String(payment.method || settings.defaultPurchasePaymentMethod || '--').trim() || '--',
          addedBy: String(payment.addedBy || '--').trim() || '--',
          account: String(payment.account || '').trim(),
          note: String(payment.note || '').trim(),
          amount: round3(Number(payment.amount || 0)),
        };
      })
      .sort((left, right) => {
        const leftMs = Number.isFinite(left.dateMs) ? left.dateMs : Number.MIN_SAFE_INTEGER;
        const rightMs = Number.isFinite(right.dateMs) ? right.dateMs : Number.MIN_SAFE_INTEGER;
        return rightMs - leftMs;
      });
  }, [payments, settings.defaultPurchasePaymentMethod, knownPurchaseRefs, purchaseByRef, supplierById, supplierByName]);

  const supplierOptions = useMemo(() => (
    Array.from(new Set([
      ...suppliers.map((supplier) => String(supplier.businessName || '').trim()),
      ...rows.map((row) => row.supplier),
    ].filter(Boolean) as string[])).sort((left, right) => String(left).localeCompare(String(right)))
  ), [suppliers, rows]);

  const locationOptions = useMemo(() => (
    Array.from(new Set([
      ...locations.map((location) => String(location.name || '').trim()),
      ...rows.map((row) => row.location),
    ].filter(Boolean) as string[])).sort((left, right) => String(left).localeCompare(String(right)))
  ), [locations, rows]);

  const paymentMethodOptions = useMemo(() => (
    Array.from(new Set(rows.map((row) => row.method).filter(Boolean) as string[])).sort((left, right) => String(left).localeCompare(String(right)))
  ), [rows]);

  const userOptions = useMemo(() => (
    Array.from(new Set(rows.map((row) => row.addedBy).filter((value) => value && value !== '--') as string[])).sort((left, right) => String(left).localeCompare(String(right)))
  ), [rows]);

  const startMs = useMemo(() => toStartMs(dateRange.startDate), [dateRange.startDate]);
  const endMs = useMemo(() => toEndMs(dateRange.endDate), [dateRange.endDate]);
  const hasDateFilter = startMs != null || endMs != null;

  const selectedSupplierSet = useMemo(() => new Set(filters.supplier.map(normalize)), [filters.supplier]);
  const selectedLocationSet = useMemo(() => new Set(filters.location.map(normalize)), [filters.location]);
  const selectedMethodSet = useMemo(() => new Set(filters.paymentMethod.map(normalize)), [filters.paymentMethod]);
  const selectedUserSet = useMemo(() => new Set(filters.user.map(normalize)), [filters.user]);

  const filteredRows = useMemo(() => {
    const query = normalize(searchTerm);
    return rows.filter((row) => {
      if (!inRange(row.dateMs, startMs, endMs, hasDateFilter)) return false;
      if (selectedSupplierSet.size > 0 && !selectedSupplierSet.has(normalize(row.supplier))) return false;
      if (selectedLocationSet.size > 0 && !selectedLocationSet.has(normalize(row.location))) return false;
      if (selectedMethodSet.size > 0 && !selectedMethodSet.has(normalize(row.method))) return false;
      if (selectedUserSet.size > 0 && !selectedUserSet.has(normalize(row.addedBy))) return false;
      if (!query) return true;
      const haystack = [
        row.ref,
        row.purchaseRef,
        row.supplier,
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
    selectedSupplierSet,
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
    const headers = ['Paid on', 'Reference No', 'Purchase Ref', 'Supplier', 'Location', 'Payment Method', 'Added By', 'Amount'];
    const lines = sortedRows.map((row) => ([
      csvEscape(formatDateTime(row.dateRaw, settings.dateFormat, settings.timeFormat)),
      csvEscape(row.ref),
      csvEscape(row.purchaseRef),
      csvEscape(row.supplier),
      csvEscape(row.location || '--'),
      csvEscape(row.method),
      csvEscape(row.addedBy),
      csvEscape(round3(row.amount).toFixed(3)),
    ].join(',')));
    downloadFile(
      `purchase_payment_report_${new Date().toISOString().slice(0, 10)}.csv`,
      [headers.join(','), ...lines].join('\n'),
      'text/csv;charset=utf-8;',
    );
  };

  const handleExportExcel = () => {
    const headers = ['Paid on', 'Reference No', 'Purchase Ref', 'Supplier', 'Location', 'Payment Method', 'Added By', 'Amount'];
    const lines = sortedRows.map((row) => ([
      formatDateTime(row.dateRaw, settings.dateFormat, settings.timeFormat),
      row.ref,
      row.purchaseRef,
      row.supplier,
      row.location || '--',
      row.method,
      row.addedBy,
      round3(row.amount).toFixed(3),
    ].join('\t')));
    downloadFile(
      `purchase_payment_report_${new Date().toISOString().slice(0, 10)}.xls`,
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
      const columns = ['Paid on', 'Reference', 'Purchase Ref', 'Supplier', 'Location', 'Method', 'User', 'Amount'];
      const width = (pageWidth - margin * 2) / columns.length;

      const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        columns.forEach((header, idx) => doc.text(header, margin + idx * width, y));
        doc.setFont('helvetica', 'normal');
        y += rowHeight;
      };

      doc.setFontSize(14);
      doc.text('Purchase Payment Report', margin, y);
      y += rowHeight + 4;
      doc.setFontSize(9);
      doc.text(`Date Range: ${dateRange.label || 'Selected range'}`, margin, y);
      y += rowHeight;
      doc.text(`Generated: ${formatDateTimeBySettings(new Date().toISOString(), settings.dateFormat, settings.timeFormat, settings.timeZone)}`, margin, y);
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
            row.purchaseRef,
            row.supplier,
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
      doc.save(`purchase_payment_report_${new Date().toISOString().slice(0, 10)}.pdf`);
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
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Purchase Payment Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Payments made to suppliers</p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2 animate-in slide-in-from-top-2">
            <MultiSelect
              label="Supplier"
              options={supplierOptions}
              selected={filters.supplier}
              onChange={(value) => setFilters((prev) => ({ ...prev, supplier: value }))}
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
                <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('purchaseRef')}>Purchase Ref <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'purchaseRef' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'purchaseRef' && sort.direction === 'desc' ? 'rotate-180' : ''}`} /></th>
                <th className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('supplier')}>Supplier <ArrowUpDown size={10} className={`inline ml-1 ${sort.key === 'supplier' ? 'text-blue-600' : 'text-slate-400'} ${sort.key === 'supplier' && sort.direction === 'desc' ? 'rotate-180' : ''}`} /></th>
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
                  <td className="px-4 py-3 text-slate-600">{row.purchaseRef}</td>
                  <td className="px-4 py-3 text-slate-700 font-bold">{row.supplier}</td>
                  <td className="px-4 py-3 text-slate-600">{row.location || '--'}</td>
                  <td className="px-4 py-3 text-slate-600">{row.method}</td>
                  <td className="px-4 py-3 text-slate-600">{row.addedBy}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(row.amount)}</td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400 italic">No records found</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-slate-800 text-[10px] border-t border-slate-300">
              <tr>
                <td colSpan={7} className="px-4 py-3 text-right uppercase">Total:</td>
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

export default ReportPurchasePayment;


