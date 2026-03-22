import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpDown, Banknote, ChevronDown, Columns, CreditCard, Edit, Eye, FileSpreadsheet,
  FileText, Filter, Printer, RotateCcw, Search, Trash2, X,
} from 'lucide-react';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import MultiSelect from '@/components/shared/MultiSelect';
import AddPaymentModal from '@/components/payments/AddPaymentModal';
import ViewSellReturnDetails from './ViewSellReturnDetails';
import ViewSellReturnPaymentsModal from './ViewSellReturnPaymentsModal';
import { SellReturn, useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { printDocument, paymentBadge } from '@/utils/printUtils';

interface ListReturnsProps {
  onNavigate: (page: string) => void;
}

interface DateRangeSelection {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  transformOrigin: string;
}

type SortKey = 'date' | 'referenceNo' | 'parentSale' | 'customerName' | 'location' | 'paymentStatus' | 'total' | 'paymentDue' | 'addedBy';
type ColumnKey = 'date' | 'referenceNo' | 'parentSale' | 'customerName' | 'location' | 'paymentStatus' | 'total' | 'paymentDue' | 'addedBy' | 'action';
type ReturnRow = SellReturn & { parentSaleDisplay: string; addedByDisplay: string };

const ListReturns: React.FC<ListReturnsProps> = ({ onNavigate }) => {
  const { addNotification } = useNotifications();
  const {
    sellReturns, deleteSellReturn: globalDeleteSellReturn, sales, locations, users, addPayment: globalAddPayment,
    formatCurrency, settings, currentUser, roles,
  } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<ColumnKey[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [entriesPerPage, setEntriesPerPage] = useState<number>(Number(settings.defaultTableEntries || 25));
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState<DateRangeSelection>(() => {
    const now = new Date();
    return { startDate: new Date(now.getFullYear(), 0, 1), endDate: new Date(now.getFullYear(), 11, 31), label: 'This Year' };
  });
  const [filters, setFilters] = useState({ location: [] as string[], customer: [] as string[], user: [] as string[] });

  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-right' });
  const [viewReturnModalOpen, setViewReturnModalOpen] = useState(false);
  const [viewReturnPaymentsModalOpen, setViewReturnPaymentsModalOpen] = useState(false);
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false);
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);
  const [autoPrintDetails, setAutoPrintDetails] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  const columnDefs: Array<{ key: ColumnKey; label: string }> = [
    { key: 'date', label: 'Date' }, { key: 'referenceNo', label: 'Credit Note No.' }, { key: 'parentSale', label: 'Parent Sale' },
    { key: 'customerName', label: 'Customer Name' }, { key: 'location', label: 'Location' }, { key: 'paymentStatus', label: 'Payment Status' },
    { key: 'total', label: 'Total Amount' }, { key: 'paymentDue', label: 'Payment Due' }, { key: 'addedBy', label: 'Added By' }, { key: 'action', label: 'Action' },
  ];

  const currentRoleRecord = roles.find(role => role.name === currentUser?.role);
  const rolePermissions = currentRoleRecord?.permissions || [];
  const roleHasExplicitPermissions = rolePermissions.length > 0;
  const hasRolePermission = (moduleName: string, permission: string) => {
    if (!currentUser) return false;
    if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
    if (!roleHasExplicitPermissions) return true;
    return rolePermissions.includes(permission) || rolePermissions.includes(`${moduleName}::${permission}`);
  };

  const canAccessAllSellReturns = hasRolePermission('Sell', 'Access all sell return');
  const canAccessOwnSellReturns = hasRolePermission('Sell', 'Access own sell return');
  const canAccessSellReturns = canAccessAllSellReturns || canAccessOwnSellReturns;

  const saleMap = useMemo(() => {
    const map = new Map<string, string>();
    sales.forEach(sale => map.set(sale.id, sale.invoiceNo));
    return map;
  }, [sales]);

  const baseReturns = useMemo<ReturnRow[]>(() => sellReturns.map(record => ({
    ...record,
    parentSaleDisplay: record.parentInvoiceNo || saleMap.get(record.parentSaleId) || '--',
    addedByDisplay: record.addedBy || '--',
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [sellReturns, saleMap]);

  const scopedReturns = useMemo(() => {
    if (canAccessAllSellReturns) return baseReturns;
    if (!canAccessOwnSellReturns) return [];
    const owner = String(currentUser?.name || '').trim().toLowerCase();
    return baseReturns.filter(record => String(record.addedBy || '').trim().toLowerCase() === owner);
  }, [baseReturns, canAccessAllSellReturns, canAccessOwnSellReturns, currentUser?.name]);

  const locationFilterOptions = useMemo(() => locations.map(location => location.name), [locations]);
  const customerFilterOptions = useMemo(() => Array.from(new Set(scopedReturns.map(record => record.customerName))).sort(), [scopedReturns]);
  const userFilterOptions = useMemo(() => Array.from(new Set(users.map(user => user.name))).sort(), [users]);

  const parseDateValue = (value?: string): Date | null => {
    if (!value) return null;
    const dmyWithTime = value.match(
      /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i
    );
    if (dmyWithTime) {
      const day = Number(dmyWithTime[1]);
      const month = Number(dmyWithTime[2]) - 1;
      const year = Number(dmyWithTime[3]);
      const rawHour = Number(dmyWithTime[4] || 0);
      const minute = Number(dmyWithTime[5] || 0);
      const ampm = (dmyWithTime[6] || '').toUpperCase();
      const hour24 = ampm
        ? ((rawHour % 12) + (ampm === 'PM' ? 12 : 0))
        : rawHour;
      const parsed = new Date(year, month, day, hour24, minute);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDateTimeDisplay = (value?: string): string => {
    if (!value) return '--';
    const parsed = parseDateValue(value);
    if (!parsed) return value;
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

  const filteredReturns = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return scopedReturns.filter(record => {
      const textMatch = !normalizedSearch || [record.referenceNo, record.parentSaleDisplay, record.customerName]
        .some(value => String(value || '').toLowerCase().includes(normalizedSearch));
      if (!textMatch) return false;
      if (filters.location.length > 0 && !filters.location.includes(record.location)) return false;
      if (filters.customer.length > 0 && !filters.customer.includes(record.customerName)) return false;
      if (filters.user.length > 0 && !filters.user.includes(record.addedByDisplay)) return false;
      if (dateRange.startDate && dateRange.endDate) {
        const dt = parseDateValue(record.date);
        if (!dt) return false;
        const start = new Date(dateRange.startDate); start.setHours(0, 0, 0, 0);
        const end = new Date(dateRange.endDate); end.setHours(23, 59, 59, 999);
        if (dt < start || dt > end) return false;
      }
      return true;
    });
  }, [scopedReturns, searchTerm, filters, dateRange]);

  const sortedReturns = useMemo(() => {
    const direction = sortDir === 'asc' ? 1 : -1;
    const copy = [...filteredReturns];
    copy.sort((a, b) => {
      if (sortKey === 'date') return ((parseDateValue(a.date)?.getTime() || 0) - (parseDateValue(b.date)?.getTime() || 0)) * direction;
      if (sortKey === 'total' || sortKey === 'paymentDue') return (Number((a as any)[sortKey] || 0) - Number((b as any)[sortKey] || 0)) * direction;
      const left = sortKey === 'parentSale'
        ? a.parentSaleDisplay
        : sortKey === 'addedBy'
          ? a.addedByDisplay
          : String((a as any)[sortKey] || '');
      const right = sortKey === 'parentSale'
        ? b.parentSaleDisplay
        : sortKey === 'addedBy'
          ? b.addedByDisplay
          : String((b as any)[sortKey] || '');
      return String(left || '').toLowerCase().localeCompare(String(right || '').toLowerCase()) * direction;
    });
    return copy;
  }, [filteredReturns, sortKey, sortDir]);

  const totalRows = sortedReturns.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / entriesPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * entriesPerPage;
  const pagedReturns = sortedReturns.slice(startIndex, startIndex + entriesPerPage);
  const totals = useMemo(() => sortedReturns.reduce((acc, row) => ({
    amount: acc.amount + Number(row.total || 0), due: acc.due + Number(row.paymentDue || 0),
  }), { amount: 0, due: 0 }), [sortedReturns]);

  const selectedReturn = useMemo(
    () => (selectedReturnId ? sellReturns.find(record => record.id === selectedReturnId) || null : null),
    [sellReturns, selectedReturnId]
  );

  const getSelectedReturnForPayment = () => selectedReturn ? ({
    customerId: selectedReturn.customerId,
    customerName: selectedReturn.customerName,
    invoiceNo: selectedReturn.referenceNo,
    location: selectedReturn.location,
    totalAmount: selectedReturn.total,
    grandTotal: selectedReturn.total,
    sellDue: selectedReturn.paymentDue,
    sellNote: selectedReturn.note || 'Sell Return Refund',
    status: 'Final',
    saleStatus: 'Final',
  }) : null;

  const canAccessReturnRecord = (record?: ReturnRow | null) => {
    if (!record) return false;
    if (canAccessAllSellReturns) return true;
    if (!canAccessOwnSellReturns) return false;
    const owner = String(currentUser?.name || '').trim().toLowerCase();
    return owner.length > 0 && String(record.addedBy || '').trim().toLowerCase() === owner;
  };

  const toggleActions = (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    if (activeActionId === id) {
      setActiveActionId(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const dropdownHeight = 260;
    const isDropUp = window.innerHeight - rect.bottom < dropdownHeight;
    setDropdownPosition({
      top: isDropUp ? undefined : rect.bottom + 8,
      bottom: isDropUp ? window.innerHeight - rect.top + 8 : undefined,
      left: rect.left - 140,
      transformOrigin: isDropUp ? 'origin-bottom-right' : 'origin-top-right',
    });
    setActiveActionId(id);
  };

  const toggleColumn = (key: ColumnKey) => setHiddenColumns(prev => (
    prev.includes(key) ? prev.filter(column => column !== key) : [...prev, key]
  ));
  const isColumnVisible = (key: ColumnKey) => !hiddenColumns.includes(key);
  const getColumnStyle = (key: ColumnKey): React.CSSProperties | undefined => isColumnVisible(key) ? undefined : { display: 'none' };
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  };

  const escapeCsv = (value: string) => {
    const escaped = String(value || '').replace(/"/g, '""');
    return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
  };
  const downloadFile = (fileName: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const buildExportRows = (rows: ReturnRow[]) => rows.map(record => ([
    formatDateTimeDisplay(record.date), record.referenceNo, record.parentSaleDisplay, record.customerName, record.location,
    record.paymentStatus, Number(record.total || 0).toFixed(3), Number(record.paymentDue || 0).toFixed(3), record.addedByDisplay,
  ]));
  const handlePrintList = () => {
    printDocument({
      title: 'Sell Returns (Credit Notes)',
      subtitle: dateRange?.label ? `Period: ${dateRange.label}` : undefined,
      businessName: settings?.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings?.address || '',
      printedBy: currentUser?.name || '',
      columns: [
        { label: 'Date', width: '80px' },
        { label: 'Credit Note No.', width: '110px' },
        { label: 'Parent Sale', width: '100px' },
        { label: 'Customer' },
        { label: 'Location', width: '80px' },
        { label: 'Payment Status', width: '80px' },
        { label: 'Total Amount', align: 'right', width: '90px' },
        { label: 'Payment Due', align: 'right', width: '90px' },
        { label: 'Added By', width: '80px' },
      ],
      rows: sortedReturns.map(record => [
        record.date ? new Date(record.date).toLocaleDateString() : '--',
        record.referenceNo,
        record.parentSaleDisplay,
        record.customerName,
        record.location || '--',
        paymentBadge(record.paymentStatus || 'Due'),
        formatCurrency(Number(record.total || 0)),
        formatCurrency(Number(record.paymentDue || 0)),
        record.addedByDisplay,
      ]),
      stats: [
        { label: 'Total Returns', value: String(sortedReturns.length), color: 'blue' },
        { label: 'Total Amount', value: formatCurrency(totals.amount), color: 'amber' },
        { label: 'Total Due', value: formatCurrency(totals.due), color: 'rose' },
      ],
      totalRow: ['TOTAL', '', '', '', '', '',
        formatCurrency(totals.amount), formatCurrency(totals.due), ''],
    });
  };

  const handleExportCsv = () => {
    const headers = ['Date', 'Credit Note No.', 'Parent Sale', 'Customer', 'Location', 'Payment Status', 'Total Amount', 'Payment Due', 'Added By'];
    const csv = [headers, ...buildExportRows(sortedReturns)].map(row => row.map(cell => escapeCsv(cell)).join(',')).join('\n');
    downloadFile('sell-returns.csv', csv, 'text/csv;charset=utf-8;');
  };
  const handleExportExcel = () => {
    const headers = ['Date', 'Credit Note No.', 'Parent Sale', 'Customer', 'Location', 'Payment Status', 'Total Amount', 'Payment Due', 'Added By'];
    const tsv = [headers, ...buildExportRows(sortedReturns)].map(row => row.join('\t')).join('\n');
    downloadFile('sell-returns.xls', tsv, 'application/vnd.ms-excel;charset=utf-8;');
  };
  const handleExportPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(14);
      doc.text('Sell Returns', 14, 16);
      doc.setFontSize(9);
      let y = 24;
      buildExportRows(sortedReturns).forEach(row => {
        if (y > 190) { doc.addPage(); y = 18; }
        doc.text(row.join(' | '), 14, y);
        y += 6;
      });
      doc.save('sell-returns.pdf');
    } catch {
      addNotification({ title: 'PDF export failed', message: 'Could not generate PDF. Use Print as fallback.', type: 'error' });
    }
  };

  const handleView = (id: string) => {
    setSelectedReturnId(id);
    setAutoPrintDetails(false);
    setViewReturnModalOpen(true);
    setActiveActionId(null);
  };
  const handleEdit = (id: string) => {
    const record = scopedReturns.find(row => row.id === id);
    if (!canAccessReturnRecord(record)) {
      addNotification({ title: 'Permission denied', message: 'You do not have permission to edit this sell return.', type: 'error' });
      setActiveActionId(null);
      return;
    }
    localStorage.setItem('app_edit_sell_return_id', id);
    localStorage.setItem('app_sell_return_sale_id', record?.parentSaleId || '');
    onNavigate('add-sell-return');
    setActiveActionId(null);
  };
  const handleDelete = (id: string) => {
    const record = scopedReturns.find(row => row.id === id);
    if (!canAccessReturnRecord(record)) {
      addNotification({ title: 'Permission denied', message: 'You do not have permission to delete this sell return.', type: 'error' });
      setActiveActionId(null);
      return;
    }
    if (confirm(`Delete credit note ${record?.referenceNo || id}?`)) {
      globalDeleteSellReturn(id);
      addNotification({ title: 'Sell Return Deleted', message: `Credit note ${record?.referenceNo || id} was removed.`, type: 'success' });
    }
    setActiveActionId(null);
  };
  const handlePrint = (id: string) => {
    setSelectedReturnId(id);
    setAutoPrintDetails(true);
    setViewReturnModalOpen(true);
    setActiveActionId(null);
  };
  const handleAddPayment = (id: string) => {
    const record = scopedReturns.find(row => row.id === id);
    if (!canAccessReturnRecord(record)) {
      addNotification({ title: 'Permission denied', message: 'You do not have permission to add payment for this sell return.', type: 'error' });
      setActiveActionId(null);
      return;
    }
    if ((record?.paymentDue || 0) <= 0.001) {
      addNotification({ title: 'No due amount', message: 'This sell return is already fully refunded.', type: 'info' });
      setActiveActionId(null);
      return;
    }
    setSelectedReturnId(id);
    setAddPaymentModalOpen(true);
    setActiveActionId(null);
  };
  const handleViewPayments = (id: string) => {
    setSelectedReturnId(id);
    setViewReturnPaymentsModalOpen(true);
    setActiveActionId(null);
  };

  useEffect(() => { setEntriesPerPage(Number(settings.defaultTableEntries || 25)); }, [settings.defaultTableEntries]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filters, dateRange, entriesPerPage]);
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) return;
      if (columnMenuRef.current && columnMenuRef.current.contains(event.target as Node)) return;
      setActiveActionId(null);
      setShowColumnMenu(false);
    };
    const hideActions = () => setActiveActionId(null);
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', hideActions, true);
    window.addEventListener('resize', hideActions);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', hideActions, true);
      window.removeEventListener('resize', hideActions);
    };
  }, []);

  if (!canAccessSellReturns) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400">
        <h2 className="text-2xl font-bold text-slate-300 mb-2">Access Denied</h2>
        <p>You do not have permission to access Sell Returns.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
            <RotateCcw size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Sell Returns</h1>
            <p className="text-slate-500 text-sm mt-0.5">Credit notes and return management</p>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 shadow-sm bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-red-600"></div>
        <div className="p-5">
          <div className="flex items-center gap-2 cursor-pointer text-blue-600 mb-4" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={16} /><span className="text-sm font-medium">Filters</span>
          </div>
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
              <MultiSelect label="Business Location" options={locationFilterOptions} selected={filters.location} onChange={(v) => setFilters(prev => ({ ...prev, location: v }))} />
              <MultiSelect label="Customer" options={customerFilterOptions} selected={filters.customer} onChange={(v) => setFilters(prev => ({ ...prev, customer: v }))} />
              <DateRangeFilter onRangeSelect={(range) => setDateRange(range)} />
              <MultiSelect label="User" options={userFilterOptions} selected={filters.user} onChange={(v) => setFilters(prev => ({ ...prev, user: v }))} />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 shadow-sm bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Show</span>
            <select value={entriesPerPage} onChange={(e) => setEntriesPerPage(Number(e.target.value))} className="px-3 py-2.5 rounded-xl border-0 bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-medium text-slate-700 appearance-none cursor-pointer">
              {[10, 25, 50, 100].map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <span className="text-sm text-slate-600">entries</span>
          </div>
          <div className="flex gap-1 flex-wrap justify-center">
            <button onClick={handleExportCsv} className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><FileText size={12} /> Export CSV</button>
            <button onClick={handleExportExcel} className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><FileSpreadsheet size={12} /> Export Excel</button>
            <button onClick={handlePrintList} className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><Printer size={12} /> Print</button>
            <div className="relative" ref={columnMenuRef}>
              <button onClick={() => setShowColumnMenu(prev => !prev)} className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><Columns size={12} /> Column visibility</button>
              {showColumnMenu && (
                <div className="absolute right-0 mt-2 z-30 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-2 max-h-80 overflow-y-auto">
                  {columnDefs.map(column => (
                    <label key={column.key} className="flex items-center gap-2 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 rounded">
                      <input type="checkbox" checked={isColumnVisible(column.key)} onChange={() => toggleColumn(column.key)} />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleExportPdf} className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><FileText size={12} /> Export PDF</button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search..." className="pl-9 pr-4 py-2.5 rounded-xl border-0 bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-medium text-slate-700" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-white text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th style={getColumnStyle('date')} className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('date')}>Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th style={getColumnStyle('referenceNo')} className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('referenceNo')}>Credit Note No. <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th style={getColumnStyle('parentSale')} className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('parentSale')}>Parent Sale <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th style={getColumnStyle('customerName')} className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('customerName')}>Customer Name <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th style={getColumnStyle('location')} className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('location')}>Location <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th style={getColumnStyle('paymentStatus')} className="px-4 py-3 whitespace-nowrap text-center cursor-pointer" onClick={() => handleSort('paymentStatus')}>Payment Status <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th style={getColumnStyle('total')} className="px-4 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort('total')}>Total Amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th style={getColumnStyle('paymentDue')} className="px-4 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort('paymentDue')}>Payment Due <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th style={getColumnStyle('addedBy')} className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('addedBy')}>Added By <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th style={getColumnStyle('action')} className="px-4 py-3 whitespace-nowrap text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedReturns.map(record => (
                <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                  <td style={getColumnStyle('date')} className="px-4 py-3">{formatDateTimeDisplay(record.date)}</td>
                  <td style={getColumnStyle('referenceNo')} className="px-4 py-3 font-semibold text-slate-800">{record.referenceNo}</td>
                  <td style={getColumnStyle('parentSale')} className="px-4 py-3">
                    <button
                      onClick={() => record.parentSaleId ? onNavigate(`edit-sale/${record.parentSaleId}`) : addNotification({ title: 'Parent sale not available', message: 'This return is not linked to a parent sale record.', type: 'warning' })}
                      className="text-blue-600 hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-100"
                    >
                      {record.parentSaleDisplay}
                    </button>
                  </td>
                  <td style={getColumnStyle('customerName')} className="px-4 py-3">{record.customerName}</td>
                  <td style={getColumnStyle('location')} className="px-4 py-3">{record.location}</td>
                  <td style={getColumnStyle('paymentStatus')} className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${record.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700' : record.paymentStatus === 'Partial' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{record.paymentStatus}</span>
                  </td>
                  <td style={getColumnStyle('total')} className="px-4 py-3 text-right">{formatCurrency(Number(record.total || 0))}</td>
                  <td style={getColumnStyle('paymentDue')} className="px-4 py-3 text-right">{formatCurrency(Number(record.paymentDue || 0))}</td>
                  <td style={getColumnStyle('addedBy')} className="px-4 py-3">{record.addedByDisplay}</td>
                  <td style={getColumnStyle('action')} className="px-4 py-3 text-center">
                    <button onClick={(e) => toggleActions(e, record.id)} className="px-3 py-1 rounded bg-blue-600 text-white font-bold flex items-center gap-1 transition-all hover:bg-blue-700 text-[10px] mx-auto">Actions <ChevronDown size={10} /></button>
                  </td>
                </tr>
              ))}
              {pagedReturns.length === 0 && <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">No sell returns found.</td></tr>}
            </tbody>
            <tfoot className="bg-slate-200/60 font-bold text-slate-800 border-t border-slate-300">
              <tr>
                <td colSpan={6} className="px-4 py-3 text-right">Total:</td>
                <td style={getColumnStyle('total')} className="px-4 py-3 text-right">{formatCurrency(totals.amount)}</td>
                <td style={getColumnStyle('paymentDue')} className="px-4 py-3 text-right">{formatCurrency(totals.due)}</td>
                <td style={getColumnStyle('addedBy')}></td>
                <td style={getColumnStyle('action')}></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div>Showing {totalRows === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + entriesPerPage, totalRows)} of {totalRows} entries</div>
          <div className="flex gap-1">
            <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}>Previous</button>
            <button className="px-3 py-1 bg-blue-600 text-white rounded shadow-sm">{safeCurrentPage}</button>
            <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}>Next</button>
          </div>
        </div>
      </div>

      {activeActionId && createPortal(
        <div ref={dropdownRef} className={`fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 w-48 animate-in fade-in zoom-in-95 duration-200 overflow-y-auto ${dropdownPosition.transformOrigin}`} style={{ top: dropdownPosition.top, left: dropdownPosition.left, bottom: dropdownPosition.bottom }} onClick={(e) => e.stopPropagation()}>
          <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</span>
            <button onClick={() => setActiveActionId(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={14} /></button>
          </div>
          <div className="py-1">
            <button onClick={() => handleView(activeActionId)} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"><Eye size={14} className="text-blue-500" /> View</button>
            <button onClick={() => handleEdit(activeActionId)} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"><Edit size={14} className="text-amber-500" /> Edit</button>
            <button onClick={() => handleDelete(activeActionId)} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"><Trash2 size={14} className="text-rose-500" /> Delete</button>
            <button onClick={() => handlePrint(activeActionId)} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"><Printer size={14} className="text-slate-500" /> Print</button>
            <div className="h-px bg-slate-100 my-1 mx-2"></div>
            <button onClick={() => handleAddPayment(activeActionId)} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"><CreditCard size={14} className="text-emerald-500" /> Add Payment</button>
            <button onClick={() => handleViewPayments(activeActionId)} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"><Banknote size={14} className="text-indigo-500" /> View Payments</button>
          </div>
        </div>,
        document.body
      )}

      <ViewSellReturnDetails
        isOpen={viewReturnModalOpen}
        onClose={() => { setViewReturnModalOpen(false); setAutoPrintDetails(false); }}
        sellReturnId={selectedReturnId}
        autoPrint={autoPrintDetails}
        onAfterPrint={() => setAutoPrintDetails(false)}
      />
      <ViewSellReturnPaymentsModal isOpen={viewReturnPaymentsModalOpen} onClose={() => setViewReturnPaymentsModalOpen(false)} sellReturnId={selectedReturnId} />
      {addPaymentModalOpen && (
        <AddPaymentModal
          isOpen={addPaymentModalOpen}
          onClose={() => setAddPaymentModalOpen(false)}
          sale={getSelectedReturnForPayment()}
          onSave={globalAddPayment}
          paymentType="sent"
          documentLabel="Credit Note No."
        />
      )}
    </div>
  );
};

export default ListReturns;
