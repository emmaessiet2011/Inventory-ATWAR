import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Search, FileText, FileSpreadsheet, Printer, Download,
  Columns, Trash2, RefreshCcw, Filter,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useGlobalContext } from '@/context/GlobalContext';
import { printDocument, statusBadge as printStatusBadge, paymentBadge as printPaymentBadge } from '@/utils/printUtils';
import { formatDateTimeBySettings } from '@/utils/dateTime';

interface PurchasesProps {
  onNavigate?: (page: string) => void;
}

type ColumnKey =
  'date' | 'referenceNo' | 'location' | 'supplier' |
  'purchaseStatus' | 'paymentStatus' | 'grandTotal' | 'paymentDue' | 'addedBy';

const csvEscape = (value: string): string => {
  const normalized = String(value ?? '');
  return /["\n,]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
};

const escapeHtml = (value: string): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const parseDateMs = (value: string): number => {
  if (!value) return Number.NaN;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const d = new Date(normalized);
  return d.getTime();
};
const normalizeText = (value: string): string => value.trim().toLowerCase();

const formatAppDateTime = (value: string): string => {
  const ms = parseDateMs(value);
  if (Number.isNaN(ms)) return value;
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mins = String(d.getMinutes()).padStart(2, '0');
  const hrs = d.getHours();
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  const h12 = String(hrs % 12 || 12).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${h12}:${mins} ${ampm}`;
};

const Purchases: React.FC<PurchasesProps> = ({ onNavigate }) => {
  const {
    purchases,
    suppliers,
    locations,
    purchaseReturns,
    deletePurchase,
    formatCurrency,
    settings,
    currentUser,
  } = useGlobalContext();

  const [entries, setEntries] = useState(Number(settings.defaultTableEntries) || 25);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>({
    date: true,
    referenceNo: true,
    location: true,
    supplier: true,
    purchaseStatus: true,
    paymentStatus: true,
    grandTotal: true,
    paymentDue: true,
    addedBy: true,
  });

  useEffect(() => {
    if (!showColumnMenu) return;
    const onOutside = (event: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    window.addEventListener('mousedown', onOutside);
    return () => window.removeEventListener('mousedown', onOutside);
  }, [showColumnMenu]);

  const supplierOptions = useMemo(
    () => Array.from(new Set(suppliers.map(s => s.businessName).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [suppliers]
  );
  const locationOptions = useMemo(
    () => Array.from(new Set(locations.map(l => l.name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [locations]
  );

  const filteredPurchases = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;

    return purchases.filter(item => {
      const matchesSearch = !q ||
        item.refNo.toLowerCase().includes(q) ||
        item.supplier.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.addedBy.toLowerCase().includes(q);
      const matchesLocation = locationFilter === 'All' || item.location === locationFilter;
      const matchesSupplier = supplierFilter === 'All' || item.supplier === supplierFilter;
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      const matchesPayment = paymentStatusFilter === 'All' || item.paymentStatus === paymentStatusFilter;
      const ms = parseDateMs(item.date);
      const matchesDate = Number.isNaN(ms) ? true : (ms >= fromMs && ms <= toMs);
      return matchesSearch && matchesLocation && matchesSupplier && matchesStatus && matchesPayment && matchesDate;
    });
  }, [purchases, searchTerm, locationFilter, supplierFilter, statusFilter, paymentStatusFilter, dateFrom, dateTo]);

  useEffect(() => { setPage(1); }, [searchTerm, locationFilter, supplierFilter, statusFilter, paymentStatusFilter, dateFrom, dateTo, entries]);

  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / entries));
  useEffect(() => { setPage(prev => Math.min(prev, totalPages)); }, [totalPages]);
  const pagedPurchases = useMemo(() => {
    const start = (page - 1) * entries;
    return filteredPurchases.slice(start, start + entries);
  }, [filteredPurchases, page, entries]);

  const purchaseReturnTotal = useMemo(() => {
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    const selectedSupplier = normalizeText(supplierFilter);
    return purchaseReturns
      .filter(item => {
        const matchesLocation = locationFilter === 'All' || item.location === locationFilter;
        const supplierFromId = suppliers.find(s => s.id === item.supplierId)?.businessName || '';
        const returnSupplier = normalizeText(item.supplierName || supplierFromId);
        const matchesSupplier = supplierFilter === 'All' || returnSupplier === selectedSupplier;
        const ms = parseDateMs(item.date);
        const matchesDate = Number.isNaN(ms) ? true : (ms >= fromMs && ms <= toMs);
        return matchesLocation && matchesSupplier && matchesDate;
      })
      .reduce((sum, item) => sum + item.grandTotal, 0);
  }, [purchaseReturns, dateFrom, dateTo, locationFilter, supplierFilter, suppliers]);

  const totalGrand = filteredPurchases.reduce((sum, item) => sum + item.grandTotal, 0);
  const totalDue = filteredPurchases.reduce((sum, item) => sum + item.paymentDue, 0);
  const visibleColumnCount = Object.values(visibleCols).filter(Boolean).length;

  const exportRows = filteredPurchases.map(item => ({
    date: formatAppDateTime(item.date),
    referenceNo: item.refNo,
    location: item.location,
    supplier: item.supplier,
    purchaseStatus: item.status,
    paymentStatus: item.paymentStatus,
    grandTotal: item.grandTotal.toFixed(3),
    paymentDue: item.paymentDue.toFixed(3),
    addedBy: item.addedBy,
  }));

  const download = (content: string, type: string, filename: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headers = ['Date', 'Reference No', 'Location', 'Supplier', 'Purchase Status', 'Payment Status', 'Grand Total', 'Payment Due', 'Added By'];
    const rows = exportRows.map(r => [r.date, r.referenceNo, r.location, r.supplier, r.purchaseStatus, r.paymentStatus, r.grandTotal, r.paymentDue, r.addedBy].map(csvEscape).join(','));
    download([headers.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8;', 'purchases.csv');
  };

  const exportExcel = () => {
    const headers = ['Date', 'Reference No', 'Location', 'Supplier', 'Purchase Status', 'Payment Status', 'Grand Total', 'Payment Due', 'Added By'];
    const rows = exportRows.map(r => [r.date, r.referenceNo, r.location, r.supplier, r.purchaseStatus, r.paymentStatus, r.grandTotal, r.paymentDue, r.addedBy].join('\t'));
    download([headers.join('\t'), ...rows].join('\n'), 'application/vnd.ms-excel;charset=utf-8;', 'purchases.xls');
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 44;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('Purchases', 40, y);
    y += 18;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(`Generated: ${formatDateTimeBySettings(new Date().toISOString(), settings.dateFormat, settings.timeFormat, settings.timeZone)}`, 40, y);
    y += 18;
    exportRows.forEach((r, idx) => {
      const line = `${idx + 1}. ${r.referenceNo} | ${r.date} | ${r.supplier} | ${r.grandTotal} | Due ${r.paymentDue}`;
      if (y > 780) { doc.addPage(); y = 44; }
      doc.text(line, 40, y);
      y += 14;
    });
    doc.save('purchases.pdf');
  };

  const handlePrint = () => {
    printDocument({
      title: 'Purchases',
      subtitle: dateFrom && dateTo ? `Period: ${dateFrom} – ${dateTo}` : undefined,
      businessName: settings?.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings?.address || '',
      printedBy: currentUser?.name || '',
      columns: [
        { label: 'Date', width: '80px' },
        { label: 'Reference No', width: '100px' },
        { label: 'Location' },
        { label: 'Supplier' },
        { label: 'Purchase Status', width: '90px' },
        { label: 'Payment Status', width: '80px' },
        { label: 'Grand Total', align: 'right', width: '90px' },
        { label: 'Payment Due', align: 'right', width: '90px' },
        { label: 'Added By', width: '80px' },
      ],
      rows: filteredPurchases.map(item => [
        formatAppDateTime(item.date),
        escapeHtml(item.refNo || ''),
        escapeHtml(item.location || ''),
        escapeHtml(item.supplier || ''),
        printStatusBadge(item.status),
        printPaymentBadge(item.paymentStatus),
        formatCurrency(item.grandTotal),
        formatCurrency(Number(item.paymentDue || 0)),
        escapeHtml(item.addedBy || '--'),
      ]),
      stats: [
        { label: 'Total Purchases', value: String(filteredPurchases.length), color: 'blue' },
        { label: 'Total Amount', value: formatCurrency(totalGrand), color: 'green' },
      ],
      totalRow: ['TOTAL', '', '', '', '', '',
        formatCurrency(totalGrand),
        formatCurrency(filteredPurchases.reduce((sum, item) => sum + Number(item.paymentDue || 0), 0)),
        ''],
    });
  };

  const statusBadge = (status: string): string =>
    status === 'Received' ? 'bg-emerald-100 text-emerald-700' :
      status === 'Pending' ? 'bg-amber-100 text-amber-700' :
        'bg-blue-100 text-blue-700';

  const paymentBadge = (status: string): string =>
    status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
      status === 'Due' ? 'bg-rose-100 text-rose-700' :
        'bg-blue-100 text-blue-700';

  const toggleColumn = (key: ColumnKey) =>
    setVisibleCols(prev => ({ ...prev, [key]: !prev[key] }));

  const handleStartPurchaseReturn = (purchaseId: string) => {
    onNavigate?.(`purchase-return/${purchaseId}`);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 print:p-0">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Purchases</h2>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600 rounded-t-[2rem]"></div>
        <div className="text-slate-600 text-sm font-bold mb-3 flex items-center gap-2 pt-1"><Filter size={16} /> Filters</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Business Location:</label>
            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm">
              <option value="All">All</option>
              {locationOptions.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Supplier:</label>
            <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm">
              <option value="All">All</option>
              {supplierOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Purchase Status:</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm">
              <option value="All">All</option>
              <option value="Received">Received</option>
              <option value="Pending">Pending</option>
              <option value="Ordered">Ordered</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Payment Status:</label>
            <select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm">
              <option value="All">All</option>
              <option value="Paid">Paid</option>
              <option value="Due">Due</option>
              <option value="Partial">Partial</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Date Range:</label>
          <div className="grid grid-cols-2 gap-2 max-w-xl">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-5 border-b border-slate-100 flex flex-col xl:flex-row justify-between gap-4 xl:items-center">
          <div className="text-sm font-bold text-slate-700">All Purchases</div>
          <button onClick={() => onNavigate?.('add-purchase')} className="bg-indigo-600 text-white px-5 py-3 rounded-full text-sm font-bold hover:bg-indigo-700 flex items-center gap-2">
            <Plus size={18} /> Add
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row justify-between gap-3 xl:items-center">
          <div className="flex items-center gap-2 text-sm">
            <span>Show</span>
            <select value={entries} onChange={(e) => setEntries(Number(e.target.value))} className="px-2 py-1 border border-slate-300 rounded">
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={exportCSV} className="px-3 py-2 border border-slate-200 rounded text-xs font-bold flex items-center gap-1"><FileText size={14} /> Export CSV</button>
            <button onClick={exportExcel} className="px-3 py-2 border border-slate-200 rounded text-xs font-bold flex items-center gap-1"><FileSpreadsheet size={14} /> Export Excel</button>
            <button onClick={handlePrint} className="px-3 py-2 border border-slate-200 rounded text-xs font-bold flex items-center gap-1"><Printer size={14} /> Print</button>
            <div className="relative" ref={columnMenuRef}>
              <button onClick={() => setShowColumnMenu(prev => !prev)} className="px-3 py-2 border border-slate-200 rounded text-xs font-bold flex items-center gap-1"><Columns size={14} /> Column visibility</button>
              {showColumnMenu && (
                <div className="absolute z-50 right-0 mt-1 bg-white border border-slate-200 rounded shadow p-2 w-44 space-y-1">
                  {(Object.keys(visibleCols) as ColumnKey[]).map(key => (
                    <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={visibleCols[key]} onChange={() => toggleColumn(key)} />
                      <span>{key}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button onClick={exportPDF} className="px-3 py-2 border border-slate-200 rounded text-xs font-bold flex items-center gap-1"><Download size={14} /> Export PDF</button>
          </div>

          <div className="relative w-full xl:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search ..." className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-2 py-2 sm:px-4 sm:py-3 text-left">Action</th>
                {visibleCols.date && <th className="px-2 py-2 sm:px-4 sm:py-3 text-left">Date</th>}
                {visibleCols.referenceNo && <th className="px-2 py-2 sm:px-4 sm:py-3 text-left">Reference No</th>}
                {visibleCols.location && <th className="px-2 py-2 sm:px-4 sm:py-3 text-left">Location</th>}
                {visibleCols.supplier && <th className="px-2 py-2 sm:px-4 sm:py-3 text-left">Supplier</th>}
                {visibleCols.purchaseStatus && <th className="px-2 py-2 sm:px-4 sm:py-3 text-left">Purchase Status</th>}
                {visibleCols.paymentStatus && <th className="px-2 py-2 sm:px-4 sm:py-3 text-left">Payment Status</th>}
                {visibleCols.grandTotal && <th className="px-2 py-2 sm:px-4 sm:py-3 text-right">Grand Total</th>}
                {visibleCols.paymentDue && <th className="px-2 py-2 sm:px-4 sm:py-3 text-right">Payment Due</th>}
                {visibleCols.addedBy && <th className="px-2 py-2 sm:px-4 sm:py-3 text-left">Added By</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedPurchases.length > 0 ? pagedPurchases.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-2 py-2 sm:px-4 sm:py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleStartPurchaseReturn(item.id)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Return Purchase">
                        <RefreshCcw size={14} />
                      </button>
                      <button onClick={() => { if (confirm('Delete this purchase?')) deletePurchase(item.id); }} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                  {visibleCols.date && <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">{formatAppDateTime(item.date)}</td>}
                  {visibleCols.referenceNo && <td className="px-2 py-2 sm:px-4 sm:py-3 font-bold text-slate-900">{item.refNo}</td>}
                  {visibleCols.location && <td className="px-2 py-2 sm:px-4 sm:py-3">{item.location}</td>}
                  {visibleCols.supplier && <td className="px-2 py-2 sm:px-4 sm:py-3">{item.supplier}</td>}
                  {visibleCols.purchaseStatus && <td className="px-2 py-2 sm:px-4 sm:py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${statusBadge(item.status)}`}>{item.status}</span></td>}
                  {visibleCols.paymentStatus && <td className="px-2 py-2 sm:px-4 sm:py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${paymentBadge(item.paymentStatus)}`}>{item.paymentStatus}</span></td>}
                  {visibleCols.grandTotal && <td className="px-2 py-2 sm:px-4 sm:py-3 text-right font-bold">{formatCurrency(item.grandTotal)}</td>}
                  {visibleCols.paymentDue && <td className="px-2 py-2 sm:px-4 sm:py-3 text-right font-bold">{formatCurrency(item.paymentDue)}</td>}
                  {visibleCols.addedBy && <td className="px-2 py-2 sm:px-4 sm:py-3">{item.addedBy}</td>}
                </tr>
              )) : (
                <tr><td colSpan={1 + visibleColumnCount} className="px-4 py-10 text-center text-slate-400 italic">No data available in table</td></tr>
              )}

              <tr className="bg-slate-100 font-bold">
                <td colSpan={1 + visibleColumnCount} className="px-2 py-2 sm:px-4 sm:py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-6 text-right">
                    <div className="text-lg">Total: {formatCurrency(totalGrand)}</div>
                    <div>Purchase Due - {formatCurrency(totalDue)}</div>
                    <div>Purchase Return - {formatCurrency(purchaseReturnTotal)}</div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-600">
          <div>
            Showing {filteredPurchases.length === 0 ? 0 : ((page - 1) * entries) + 1}
            {' '}to {Math.min(page * entries, filteredPurchases.length)}
            {' '}of {filteredPurchases.length} entries
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50" disabled={page <= 1} onClick={() => setPage(prev => Math.max(1, prev - 1))}>Previous</button>
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50" disabled={page >= totalPages} onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Purchases;
