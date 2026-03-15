import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, FileText, FileSpreadsheet, Printer, Search,
  Columns, Edit, Trash2, ChevronDown, 
  Filter, Eye, CreditCard, 
  ArrowUpDown, 
  Undo2, ScrollText, Banknote, Link, Truck, Calendar as CalendarIcon, Package,
  X
} from 'lucide-react';
import ViewSaleDetails from './ViewSaleDetails'; 
import PackingSlip from './PackingSlip'; 
import DeliveryNote from './DeliveryNote'; 
import EditShippingModal from './EditShippingModal'; 
import AddPaymentModal from './AddPaymentModal'; 
import ViewPaymentsModal from './ViewPaymentsModal'; 
import InvoiceURLModal from './InvoiceURLModal';
import MultiSelect from './MultiSelect';
import DateRangeFilter from './DateRangeFilter';
import { useNotifications } from '../src/context/NotificationContext';
import { Sale as GlobalSale, useGlobalContext } from '../src/context/GlobalContext';
import { printActiveReportTable } from '../src/utils/printUtils';
import { getActiveRegisterSession } from '../src/utils/registerLedger';
import { findLocationByIdOrName, notifyReceiptPrintFallback } from '../src/utils/receiptPrinting';
import { buildPaginationItems } from '../src/utils/pagination';

interface POSSale {
  id: string;
  customerId: string;
  date: string;
  invoiceNo: string;
  customerName: string;
  contactNumber: string;
  location: string;
  paymentStatus: 'Paid' | 'Due' | 'Partial' | 'Overdue';
  paymentMethod: string;
  totalAmount: number;
  totalPaid: number;
  sellDue: number;
  sellReturnDue: number;
  shippingStatus: string;
  totalItems: number;
  addedBy: string;
  sellNote: string;
  staffNote: string;
  shippingDetails: string;
  saleType: string;
}

interface ListPOSProps {
    onNavigate: (page: string) => void;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  transformOrigin: string;
  maxHeight?: number;
}

interface DateRangeSelection {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

const escapeCSV = (value: string | number | undefined | null): string => {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const downloadBlob = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

type SortKey = 'date' | 'invoiceNo' | 'customerName' | 'totalAmount';
type ColumnKey =
  | 'action'
  | 'date'
  | 'invoiceNo'
  | 'customerName'
  | 'contactNumber'
  | 'location'
  | 'paymentStatus'
  | 'paymentMethod'
  | 'totalAmount'
  | 'totalPaid'
  | 'sellDue'
  | 'sellReturnDue'
  | 'shippingStatus'
  | 'totalItems'
  | 'addedBy'
  | 'sellNote'
  | 'staffNote'
  | 'shippingDetails';

const ListPOS: React.FC<ListPOSProps> = ({
  onNavigate }) => {
  const { addNotification } = useNotifications();
  const {
    locations,
    printers,
    customers,
    users,
    sales: globalSales,
    sellReturns,
    addPayment: globalAddPayment,
    updateSale: globalUpdateSale,
    deleteSale: globalDeleteSale,
    currentUser,
    roles,
    settings,
    formatCurrency,
  } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [showSubscriptionsOnly, setShowSubscriptionsOnly] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<ColumnKey[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [entriesPerPage, setEntriesPerPage] = useState<number>(Number(settings.defaultTableEntries || 25));
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState<DateRangeSelection>(() => {
    const now = new Date();
    return {
      startDate: new Date(now.getFullYear(), 0, 1),
      endDate: new Date(now.getFullYear(), 11, 31),
      label: 'This Year',
    };
  });
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-right' });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  
  // State for View Details Modal
  const [viewOrderModalOpen, setViewOrderModalOpen] = useState(false);
  const [packingSlipModalOpen, setPackingSlipModalOpen] = useState(false);
  const [deliveryNoteModalOpen, setDeliveryNoteModalOpen] = useState(false);
  const [editShippingModalOpen, setEditShippingModalOpen] = useState(false);
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false);
  const [viewPaymentsModalOpen, setViewPaymentsModalOpen] = useState(false);
  const [invoiceURLModalOpen, setInvoiceURLModalOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [invoiceAutoPrintRequestId, setInvoiceAutoPrintRequestId] = useState<string | null>(null);
  
  // Filter States
  const [filters, setFilters] = useState({
      location: [] as string[],
      customer: [] as string[],
      paymentStatus: [] as string[],
      user: [] as string[],
      shippingStatus: [] as string[]
  });

  const columnDefs: Array<{ key: ColumnKey; label: string }> = [
    { key: 'action', label: 'Action' },
    { key: 'date', label: 'Date' },
    { key: 'invoiceNo', label: 'Invoice No.' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'contactNumber', label: 'Contact Number' },
    { key: 'location', label: 'Location' },
    { key: 'paymentStatus', label: 'Payment Status' },
    { key: 'paymentMethod', label: 'Payment Method' },
    { key: 'totalAmount', label: 'Total Amount' },
    { key: 'totalPaid', label: 'Total Paid' },
    { key: 'sellDue', label: 'Sell Due' },
    { key: 'sellReturnDue', label: 'Sell Return Due' },
    { key: 'shippingStatus', label: 'Shipping Status' },
    { key: 'totalItems', label: 'Total Items' },
    { key: 'addedBy', label: 'Added By' },
    { key: 'sellNote', label: 'Sell Note' },
    { key: 'staffNote', label: 'Staff Note' },
    { key: 'shippingDetails', label: 'Shipping Details' },
  ];

  const isColumnVisible = (key: ColumnKey) => !hiddenColumns.includes(key);
  const getColumnStyle = (key: ColumnKey): React.CSSProperties | undefined =>
    isColumnVisible(key) ? undefined : { display: 'none' };
  const toggleColumn = (key: ColumnKey) => {
    setHiddenColumns(prev => (
      prev.includes(key)
        ? prev.filter(col => col !== key)
        : [...prev, key]
    ));
  };
  const visibleColumnCount = Math.max(1, columnDefs.length - hiddenColumns.length);

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
  const canAccessSellReturnSale = (sale?: GlobalSale | null): boolean => {
    if (!sale) return false;
    if (canAccessAllSellReturns) return true;
    if (!canAccessOwnSellReturns) return false;
    const owner = String(currentUser?.name || '').trim().toLowerCase();
    return owner.length > 0 && String(sale.addedBy || '').trim().toLowerCase() === owner;
  };

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

  const formatDateTimeDisplay = (value?: string) => {
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

  const isFinalizedSale = (sale?: GlobalSale | null): boolean =>
    !!sale && ((sale.status || sale.saleStatus || '').trim() === 'Final');

  const isPOSSale = (sale: GlobalSale): boolean =>
    String(sale.saleType || '').trim().toLowerCase() === 'pos';

  const sales = useMemo<POSSale[]>(() => {
    return globalSales
      .filter(s => isFinalizedSale(s) && isPOSSale(s))
      .map(s => {
        const matchedCustomer = customers.find(c => c.id === String(s.customerId));
        const grandTotal = s.grandTotal || s.totalAmount || 0;
        const totalPaid = s.totalPaid || 0;
        return {
          id: s.id,
          customerId: String(s.customerId || ''),
          date: s.date,
          invoiceNo: s.invoiceNo,
          customerName: s.customerName || matchedCustomer?.businessName || 'Walk-in Customer',
          contactNumber: s.contactNumber || matchedCustomer?.mobile || '--',
          location: s.location || '--',
          paymentStatus: s.paymentStatus,
          paymentMethod: s.paymentMethod || '--',
          totalAmount: grandTotal,
          totalPaid,
          sellDue: s.sellDue ?? Math.max(0, grandTotal - totalPaid),
          sellReturnDue: s.sellReturnDue || 0,
          shippingStatus: s.shippingStatus || 'Ordered',
          totalItems: s.totalItems || (s.items || []).reduce((acc, item) => acc + (item.qty || 0), 0),
          addedBy: s.addedBy || '--',
          sellNote: s.sellNote || '',
          staffNote: s.staffNote || '',
          shippingDetails: s.shippingDetails || '',
          saleType: s.saleType || '',
        };
      });
  }, [globalSales, customers]);

  const customerFilterOptions = useMemo(
    () => Array.from(new Set(sales.map(s => s.customerName))).sort(),
    [sales]
  );
  const userFilterOptions = useMemo(
    () => Array.from(new Set(users.map(u => u.name))).sort(),
    [users]
  );
  const shippingFilterOptions = useMemo(
    () => Array.from(new Set(sales.map(s => s.shippingStatus))).sort(),
    [sales]
  );


  const filteredSales = useMemo(() => (
    sales.filter(s => {
      const textMatch =
        s.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.location.toLowerCase().includes(searchTerm.toLowerCase());

      const filterMatch =
        (filters.location.length === 0 || filters.location.includes(s.location)) &&
        (filters.customer.length === 0 || filters.customer.includes(s.customerName)) &&
        (filters.paymentStatus.length === 0 || filters.paymentStatus.includes(s.paymentStatus)) &&
        (filters.user.length === 0 || filters.user.includes(s.addedBy)) &&
        (filters.shippingStatus.length === 0 || filters.shippingStatus.includes(s.shippingStatus));

      const dateMatch = (() => {
        if (!dateRange.startDate || !dateRange.endDate) return true;
        const saleDate = parseDateValue(s.date);
        if (!saleDate) return false;
        const rangeStart = new Date(dateRange.startDate);
        rangeStart.setHours(0, 0, 0, 0);
        const rangeEnd = new Date(dateRange.endDate);
        rangeEnd.setHours(23, 59, 59, 999);
        return saleDate >= rangeStart && saleDate <= rangeEnd;
      })();

      const subscriptionMatch = (() => {
        if (!showSubscriptionsOnly) return true;
        const text = `${s.saleType} ${s.sellNote} ${s.invoiceNo}`.toLowerCase();
        return text.includes('subscription') || text.includes('sub');
      })();

      return textMatch && filterMatch && dateMatch && subscriptionMatch;
    })
  ), [sales, searchTerm, filters, dateRange, showSubscriptionsOnly]);

  const sortedSales = useMemo(() => {
    const copy = [...filteredSales];
    copy.sort((a, b) => {
      const direction = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'date') {
        const ad = parseDateValue(a.date)?.getTime() || 0;
        const bd = parseDateValue(b.date)?.getTime() || 0;
        return (ad - bd) * direction;
      }
      if (sortKey === 'totalAmount') return (a.totalAmount - b.totalAmount) * direction;
      const av = String(a[sortKey] || '').toLowerCase();
      const bv = String(b[sortKey] || '').toLowerCase();
      return av.localeCompare(bv) * direction;
    });
    return copy;
  }, [filteredSales, sortDir, sortKey]);

  const totals = useMemo(() => (
    sortedSales.reduce((acc, curr) => ({
      amount: acc.amount + curr.totalAmount,
      paid: acc.paid + curr.totalPaid,
      due: acc.due + curr.sellDue,
      returnDue: acc.returnDue + curr.sellReturnDue
    }), { amount: 0, paid: 0, due: 0, returnDue: 0 })
  ), [sortedSales]);

  const totalPages = Math.max(1, Math.ceil(sortedSales.length / entriesPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginationItems = buildPaginationItems(safeCurrentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * entriesPerPage;
  const pageEnd = pageStart + entriesPerPage;
  const pagedSales = sortedSales.slice(pageStart, pageEnd);
  const showingFrom = sortedSales.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + pagedSales.length, sortedSales.length);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDir(key === 'date' ? 'desc' : 'asc');
  };

  const toggleActions = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (activeActionId === id) {
      setActiveActionId(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      const desiredHeight = 450; 
      const isDropUp = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
      
      const maxHeight = isDropUp 
          ? Math.min(desiredHeight, spaceAbove - 20) 
          : Math.min(desiredHeight, spaceBelow - 20);

      setDropdownPosition({
        top: isDropUp ? undefined : rect.bottom + 8,
        bottom: isDropUp ? window.innerHeight - rect.top + 8 : undefined,
        left: rect.left, 
        transformOrigin: isDropUp ? 'origin-bottom-left' : 'origin-top-left',
        maxHeight: maxHeight
      });
      setActiveActionId(id);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
        const target = event.target as Node;
        if (dropdownRef.current && dropdownRef.current.contains(target)) return;
        if (columnMenuRef.current && columnMenuRef.current.contains(target)) return;
        setActiveActionId(null);
        setShowColumnMenu(false);
    };

    const handleScroll = () => setActiveActionId(null);
    const handleResize = () => {
      setActiveActionId(null);
      setShowColumnMenu(false);
    };
    
    if (activeActionId || showColumnMenu) {
        window.addEventListener('mousedown', handleOutsideClick);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
    }
    return () => {
        window.removeEventListener('mousedown', handleOutsideClick);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
    };
  }, [activeActionId, showColumnMenu]);

  useEffect(() => {
    const parsed = Number(settings.defaultTableEntries || 25);
    if (Number.isFinite(parsed) && parsed > 0) {
      setEntriesPerPage(parsed);
    }
  }, [settings.defaultTableEntries]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, dateRange, entriesPerPage, showSubscriptionsOnly]);

  const handleViewDetails = (saleId: string) => {
      setSelectedSaleId(saleId);
      setInvoiceAutoPrintRequestId(null);
      setViewOrderModalOpen(true);
      setActiveActionId(null);
  };

  const handlePrintInvoice = (saleId: string) => {
      const sale = sales.find(s => s.id === saleId);
      const saleLocation = findLocationByIdOrName(locations, sale?.location);
      notifyReceiptPrintFallback({
        location: saleLocation,
        printers,
        addNotification,
        documentLabel: 'Invoice',
      });
      setSelectedSaleId(saleId);
      setViewOrderModalOpen(true);
      setInvoiceAutoPrintRequestId(`${saleId}-${Date.now()}`);
      setActiveActionId(null);
  };
  
  const handlePackingSlip = (saleId: string) => {
      setSelectedSaleId(saleId);
      setPackingSlipModalOpen(true);
      setActiveActionId(null);
  };

  const handleDeliveryNote = (saleId: string) => {
      setSelectedSaleId(saleId);
      setDeliveryNoteModalOpen(true);
      setActiveActionId(null);
  };

  const handleEditShipping = (saleId: string) => {
      setSelectedSaleId(saleId);
      setEditShippingModalOpen(true);
      setActiveActionId(null);
  };
  
  const handleAddPayment = (saleId: string) => {
      const sale = globalSales.find(s => s.id === saleId);
      if (!isFinalizedSale(sale)) {
        addNotification({
          title: 'Action blocked',
          message: 'Payment can only be added to Final sales.',
          type: 'error',
        });
        setActiveActionId(null);
        return;
      }
      setSelectedSaleId(saleId);
      setAddPaymentModalOpen(true);
      setActiveActionId(null);
  };

  const handleViewPayments = (saleId: string) => {
      setSelectedSaleId(saleId);
      setViewPaymentsModalOpen(true);
      setActiveActionId(null);
  };
  
  const handleInvoiceURL = (saleId: string) => {
      setSelectedSaleId(saleId);
      setInvoiceURLModalOpen(true);
      setActiveActionId(null);
  };

  const handleSellReturn = (saleId: string) => {
      const sale = globalSales.find(s => s.id === saleId);
      if (!isFinalizedSale(sale)) {
        addNotification({
          title: 'Action blocked',
          message: 'Sell Return can only be created from Final sales.',
          type: 'error',
        });
        setActiveActionId(null);
        return;
      }
      if (!canAccessSellReturns || !canAccessSellReturnSale(sale)) {
        addNotification({
          title: 'Permission denied',
          message: 'You do not have permission to create sell return for this sale.',
          type: 'error',
        });
        setActiveActionId(null);
        return;
      }
      if (onNavigate) {
          localStorage.setItem('app_sell_return_sale_id', saleId);
          onNavigate('add-sell-return');
      }
      setActiveActionId(null);
  };

  const handleEditSale = (saleId: string) => {
      if (onNavigate) onNavigate(`edit-sale/${saleId}`);
      setActiveActionId(null);
  };

  const handleDeleteSale = (saleId: string) => {
      if (sellReturns.some(ret => ret.parentSaleId === saleId)) {
          addNotification({
            title: 'Action blocked',
            message: 'Delete linked sell return records first.',
            type: 'error',
          });
          setActiveActionId(null);
          return;
      }
      const invoiceNo = sales.find(s => s.id === saleId)?.invoiceNo || 'this sale';
      if (confirm(`Delete ${invoiceNo}?`)) {
          globalDeleteSale(saleId);
          addNotification({
            title: 'Sale Deleted',
            message: `${invoiceNo} has been deleted.`,
            type: 'success',
          });
      }
      setActiveActionId(null);
  };

  const exportCurrentSales = (format: 'csv' | 'excel') => {
    const rows = sortedSales;
    const headers = [
      'Date',
      'Invoice No',
      'Customer',
      'Contact Number',
      'Location',
      'Payment Status',
      'Payment Method',
      'Total Amount',
      'Total Paid',
      'Sell Due',
      'Sell Return Due',
      'Shipping Status',
      'Total Items',
      'Added By',
    ];
    const lines = [
      headers.join(','),
      ...rows.map(s => [
        formatDateTimeDisplay(s.date),
        s.invoiceNo,
        s.customerName,
        s.contactNumber,
        s.location,
        s.paymentStatus,
        s.paymentMethod,
        Number(s.totalAmount || 0).toFixed(3),
        Number(s.totalPaid || 0).toFixed(3),
        Number(s.sellDue || 0).toFixed(3),
        Number(s.sellReturnDue || 0).toFixed(3),
        s.shippingStatus,
        Number(s.totalItems || 0).toFixed(3),
        s.addedBy,
      ].map(escapeCSV).join(',')),
    ];
    const content = lines.join('\n');
    const datePart = new Date().toISOString().slice(0, 10);
    if (format === 'excel') {
      downloadBlob(`pos-sales-${datePart}.xls`, content, 'application/vnd.ms-excel;charset=utf-8;');
      return;
    }
    downloadBlob(`pos-sales-${datePart}.csv`, content, 'text/csv;charset=utf-8;');
  };

  const exportCurrentSalesPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape' });
      let y = 12;
      doc.setFontSize(12);
      doc.text('POS Sales Export', 14, y);
      y += 7;
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
      y += 8;

      const headers = ['Date', 'Invoice', 'Customer', 'Status', 'Total', 'Paid', 'Due'];
      doc.text(headers.join(' | '), 14, y);
      y += 6;

      sortedSales.forEach((sale) => {
        if (y > 190) {
          doc.addPage();
          y = 14;
        }
        const line = [
          formatDateTimeDisplay(sale.date),
          sale.invoiceNo || '--',
          sale.customerName || '--',
          sale.paymentStatus || '--',
          Number(sale.totalAmount || 0).toFixed(3),
          Number(sale.totalPaid || 0).toFixed(3),
          Number(sale.sellDue || 0).toFixed(3),
        ].join(' | ');
        doc.text(line, 14, y);
        y += 5;
      });

      const datePart = new Date().toISOString().slice(0, 10);
      doc.save(`pos-sales-${datePart}.pdf`);
    } catch (error) {
      addNotification({
        title: 'Export failed',
        message: 'Unable to generate PDF export for POS sales.',
        type: 'error',
      });
    }
  };

  const selectedSale = selectedSaleId ? (sales.find(s => s.id === selectedSaleId) || null) : null;
  const selectedSaleRaw = selectedSaleId ? (globalSales.find(s => s.id === selectedSaleId) || null) : null;
  const activeSaleRaw = activeActionId ? (globalSales.find(s => s.id === activeActionId) || null) : null;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">POS</h2>
        </div>
        <button
          onClick={() => setShowFilters(prev => !prev)}
          className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
        >
            <CalendarIcon size={16} /> {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {/* Filter Section (Collapsible) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div 
            className="flex items-center gap-2 p-4 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
            onClick={() => setShowFilters(!showFilters)}
          >
              <Filter size={16} className="text-blue-600" />
              <span className="text-sm font-bold text-slate-700">Filters</span>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </div>
          
          {showFilters && (
              <div className="p-6 bg-slate-50/50 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
                      {/* Business Location */}
                      <div className="group">
                          <MultiSelect 
                            label="Business Location"
                            options={locations.map(loc => loc.name)}
                            selected={filters.location}
                            onChange={(val) => setFilters({...filters, location: val})}
                          />
                      </div>
                      {/* Customer */}
                      <div className="group">
                          <MultiSelect 
                            label="Customer"
                            options={customerFilterOptions}
                            selected={filters.customer}
                            onChange={(val) => setFilters({...filters, customer: val})}
                          />
                      </div>
                      {/* Payment Status */}
                      <div className="group">
                           <MultiSelect 
                            label="Payment Status"
                            options={['Paid', 'Due', 'Partial', 'Overdue']}
                            selected={filters.paymentStatus}
                            onChange={(val) => setFilters({...filters, paymentStatus: val})}
                          />
                      </div>
                      {/* Date Range */}
                      <div className="group">
                          <DateRangeFilter onRangeSelect={(range) => setDateRange(range)} />
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                      {/* User */}
                      <div className="group">
                          <MultiSelect 
                            label="User"
                            options={userFilterOptions}
                            selected={filters.user}
                            onChange={(val) => setFilters({...filters, user: val})}
                          />
                      </div>
                      {/* Shipping Status */}
                      <div className="group">
                           <MultiSelect 
                            label="Shipping Status"
                            options={shippingFilterOptions}
                            selected={filters.shippingStatus}
                            onChange={(val) => setFilters({...filters, shippingStatus: val})}
                          />
                      </div>
                      {/* Subscriptions Checkbox */}
                      <div className="group flex items-center h-full pb-2.5">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={showSubscriptionsOnly}
                                onChange={(e) => setShowSubscriptionsOnly(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs font-medium text-slate-700">Subscriptions</span>
                          </label>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500"></div>
        
        {/* Controls Bar */}
        <div className="p-5 border-b border-slate-100 bg-white">
           <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
              
              <div className="flex items-center gap-3 w-full xl:w-auto">
                  <h3 className="text-lg font-medium text-slate-700 mr-4">List POS</h3>
                  <span className="text-xs font-medium text-slate-500">Show</span>
                  <div className="relative">
                      <select
                        value={entriesPerPage}
                        onChange={(e) => {
                          const parsed = Number(e.target.value);
                          setEntriesPerPage(Number.isFinite(parsed) && parsed > 0 ? parsed : 25);
                        }}
                        className="border border-slate-300 bg-white rounded px-2 py-1 text-xs font-medium focus:outline-none cursor-pointer appearance-none pr-6"
                      >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                      </select>
                      <ChevronDown size={12} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <span className="text-xs font-medium text-slate-500">entries</span>
              </div>

              <div className="relative flex flex-wrap justify-center gap-1 w-full xl:w-auto" ref={columnMenuRef}>
                  <button
                    onClick={() => exportCurrentSales('csv')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm whitespace-nowrap"
                  >
                    <FileText size={12} /> Export CSV
                  </button>
                  <button
                    onClick={() => exportCurrentSales('excel')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm whitespace-nowrap"
                  >
                    <FileSpreadsheet size={12} /> Export Excel
                  </button>
                  <button
                    onClick={() => printActiveReportTable()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm whitespace-nowrap"
                  >
                    <Printer size={12} /> Print
                  </button>
                  <button
                    onClick={() => setShowColumnMenu(prev => !prev)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm whitespace-nowrap"
                  >
                    <Columns size={12} /> Column visibility
                  </button>
                  <button
                    onClick={() => { void exportCurrentSalesPdf(); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm whitespace-nowrap"
                  >
                    <FileText size={12} /> Export PDF
                  </button>

                  {showColumnMenu && (
                    <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-xl z-30 p-3">
                      <div className="text-xs font-bold text-slate-600 mb-2">Toggle Columns</div>
                      <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                        {columnDefs.map(col => (
                          <label key={col.key} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isColumnVisible(col.key)}
                              onChange={() => toggleColumn(col.key)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{col.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              <div className="flex items-center gap-2 w-full xl:w-auto">
                  <div className="relative flex-1 xl:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input 
                          type="text" 
                          placeholder="Search..." 
                          className="w-full pl-8 pr-3 py-1.5 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-xs placeholder:text-slate-400"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                      />
                  </div>
                  <button 
                    onClick={() => onNavigate(getActiveRegisterSession() ? 'pos' : 'open-register')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-full shadow-md text-xs font-bold transition-all flex-shrink-0 flex items-center gap-1"
                    title="Add POS Sale"
                  >
                      <Plus size={14} /> Add
                  </button>
              </div>
           </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[500px]">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead className="bg-white text-slate-800 font-bold border-b border-slate-200 z-10">
              <tr>
                <th style={getColumnStyle('action')} className="px-4 py-3 whitespace-nowrap">Action</th>
                <th style={getColumnStyle('date')} className="px-4 py-3 whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort('date')}>Date <ArrowUpDown size={10} className={`inline ml-1 ${sortKey === 'date' ? 'text-blue-500' : 'text-slate-400'}`} /></th>
                <th style={getColumnStyle('invoiceNo')} className="px-4 py-3 whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort('invoiceNo')}>Invoice No. <ArrowUpDown size={10} className={`inline ml-1 ${sortKey === 'invoiceNo' ? 'text-blue-500' : 'text-slate-400'}`} /></th>
                <th style={getColumnStyle('customerName')} className="px-4 py-3 whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort('customerName')}>Customer Name <ArrowUpDown size={10} className={`inline ml-1 ${sortKey === 'customerName' ? 'text-blue-500' : 'text-slate-400'}`} /></th>
                <th style={getColumnStyle('contactNumber')} className="px-4 py-3 whitespace-nowrap">Contact Number</th>
                <th style={getColumnStyle('location')} className="px-4 py-3 whitespace-nowrap">Location</th>
                <th style={getColumnStyle('paymentStatus')} className="px-4 py-3 whitespace-nowrap">Payment Status</th>
                <th style={getColumnStyle('paymentMethod')} className="px-4 py-3 whitespace-nowrap">Payment Method</th>
                <th style={getColumnStyle('totalAmount')} className="px-4 py-3 whitespace-nowrap text-right cursor-pointer select-none" onClick={() => handleSort('totalAmount')}>Total amount <ArrowUpDown size={10} className={`inline ml-1 ${sortKey === 'totalAmount' ? 'text-blue-500' : 'text-slate-400'}`} /></th>
                <th style={getColumnStyle('totalPaid')} className="px-4 py-3 whitespace-nowrap text-right">Total paid</th>
                <th style={getColumnStyle('sellDue')} className="px-4 py-3 whitespace-nowrap text-right">Sell Due</th>
                <th style={getColumnStyle('sellReturnDue')} className="px-4 py-3 whitespace-nowrap text-right">Sell Return Due</th>
                <th style={getColumnStyle('shippingStatus')} className="px-4 py-3 whitespace-nowrap">Shipping Status</th>
                <th style={getColumnStyle('totalItems')} className="px-4 py-3 whitespace-nowrap text-right">Total Items</th>
                <th style={getColumnStyle('addedBy')} className="px-4 py-3 whitespace-nowrap">Added By</th>
                <th style={getColumnStyle('sellNote')} className="px-4 py-3 whitespace-nowrap">Sell note</th>
                <th style={getColumnStyle('staffNote')} className="px-4 py-3 whitespace-nowrap">Staff note</th>
                <th style={getColumnStyle('shippingDetails')} className="px-4 py-3 whitespace-nowrap">Shipping Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedSales.length > 0 ? (
                  pagedSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors group text-xs text-slate-700">
                      <td style={getColumnStyle('action')} className="px-4 py-3 text-center">
                          <button 
                            onClick={(e) => toggleActions(e, sale.id)}
                            className={`px-3 py-1 rounded bg-blue-600 text-white font-bold flex items-center gap-1 transition-all hover:bg-blue-700 text-[10px]`}
                          >
                              Actions <ChevronDown size={10} />
                          </button>
                      </td>
                      <td style={getColumnStyle('date')} className="px-4 py-3 whitespace-nowrap">
                          {formatDateTimeDisplay(sale.date)}
                      </td>
                      <td style={getColumnStyle('invoiceNo')} className="px-4 py-3 whitespace-nowrap">
                           {sale.invoiceNo}
                      </td>
                      <td style={getColumnStyle('customerName')} className="px-4 py-3 whitespace-nowrap">
                           {sale.customerName}
                      </td>
                      <td style={getColumnStyle('contactNumber')} className="px-4 py-3 whitespace-nowrap">
                           {sale.contactNumber}
                      </td>
                      <td style={getColumnStyle('location')} className="px-4 py-3 whitespace-nowrap">
                           {sale.location}
                      </td>
                      <td style={getColumnStyle('paymentStatus')} className="px-4 py-3">
                           <span className={`inline-block px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                               sale.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 
                               sale.paymentStatus === 'Partial' ? 'bg-blue-100 text-blue-700' :
                               'bg-yellow-100 text-yellow-700'
                           }`}>
                               {sale.paymentStatus}
                           </span>
                      </td>
                      <td style={getColumnStyle('paymentMethod')} className="px-4 py-3 whitespace-nowrap">
                           {sale.paymentMethod}
                      </td>
                      <td style={getColumnStyle('totalAmount')} className="px-4 py-3 text-right whitespace-nowrap">
                          {formatCurrency(sale.totalAmount)}
                      </td>
                      <td style={getColumnStyle('totalPaid')} className="px-4 py-3 text-right whitespace-nowrap">
                          {formatCurrency(sale.totalPaid)}
                      </td>
                      <td style={getColumnStyle('sellDue')} className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={sale.sellDue > 0 ? 'text-amber-600 font-bold' : ''}>{formatCurrency(sale.sellDue)}</span>
                      </td>
                      <td style={getColumnStyle('sellReturnDue')} className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={sale.sellReturnDue > 0 ? 'text-rose-600 font-bold' : ''}>{formatCurrency(sale.sellReturnDue)}</span>
                      </td>
                      <td style={getColumnStyle('shippingStatus')} className="px-4 py-3">
                           <span className={`inline-block px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                               sale.shippingStatus === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                           }`}>
                               {sale.shippingStatus}
                           </span>
                      </td>
                      <td style={getColumnStyle('totalItems')} className="px-4 py-3 text-right whitespace-nowrap">
                          {sale.totalItems.toFixed(3)}
                      </td>
                      <td style={getColumnStyle('addedBy')} className="px-4 py-3 whitespace-nowrap">
                          {sale.addedBy}
                      </td>
                      <td style={getColumnStyle('sellNote')} className="px-4 py-3 whitespace-nowrap">
                          {sale.sellNote}
                      </td>
                      <td style={getColumnStyle('staffNote')} className="px-4 py-3 whitespace-nowrap">
                          {sale.staffNote}
                      </td>
                      <td style={getColumnStyle('shippingDetails')} className="px-4 py-3 whitespace-nowrap">
                          {sale.shippingDetails}
                      </td>
                    </tr>
                  ))
              ) : (
                  <tr>
                      <td colSpan={visibleColumnCount} className="px-6 py-12 text-center text-slate-400 italic">
                          No data available in table
                      </td>
                  </tr>
              )}
            </tbody>
            {/* Footer Totals */}
            <tfoot className="bg-slate-200 font-bold text-slate-800 text-[11px] border-t border-slate-300 sticky bottom-0 z-20">
                <tr>
                    <td colSpan={visibleColumnCount} className="px-4 py-3 text-right">
                      Total: {formatCurrency(totals.amount)} | Paid: {formatCurrency(totals.paid)} | Due: {formatCurrency(totals.due)} | Return Due: {formatCurrency(totals.returnDue)}
                    </td>
                </tr>
            </tfoot>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-white">
            <div>
              {sortedSales.length === 0
                ? 'Showing 0 to 0 of 0 entries'
                : `Showing ${showingFrom} to ${showingTo} of ${sortedSales.length} entries`}
            </div>
            <div className="flex gap-1">
                 <button
                   className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
                   disabled={safeCurrentPage <= 1}
                   onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                 >
                   Previous
                 </button>
                 {paginationItems.map((item, index) => item === '...'
                   ? <span key={`page-ellipsis-${index}`} className="px-2 py-1 text-slate-400">...</span>
                   : (
                     <button
                       key={item}
                       onClick={() => setCurrentPage(item)}
                       className={`px-3 py-1 rounded border ${
                         item === safeCurrentPage
                           ? 'bg-blue-600 text-white border-blue-600'
                           : 'bg-white border-slate-200 hover:bg-slate-50'
                       }`}
                     >
                       {item}
                     </button>
                   ))}
                 <button
                   className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
                   disabled={safeCurrentPage >= totalPages}
                   onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                 >
                   Next
                 </button>
            </div>
        </div>

      </div>

      {/* Action Menu Portal */}
      {activeActionId && createPortal(
        <div 
            ref={dropdownRef}
            className={`fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 w-64 animate-in fade-in zoom-in-95 duration-200 overflow-y-auto ${dropdownPosition.transformOrigin}`}
            style={{ 
                top: dropdownPosition.top, 
                left: dropdownPosition.left, 
                bottom: dropdownPosition.bottom,
                maxHeight: dropdownPosition.maxHeight 
            }}
            onClick={(e) => e.stopPropagation()} 
        >
            <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                     Invoice #{sales.find(s => s.id === activeActionId)?.invoiceNo?.split('-').pop() || '--'}
                 </span>
                 <button onClick={() => setActiveActionId(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                     <X size={14} />
                 </button>
            </div>
            
            {/* Quick Actions Grid */}
            <div className="p-2 grid grid-cols-4 gap-1 border-b border-slate-100">
                <button 
                    onClick={() => { if (activeActionId) handleViewDetails(activeActionId); }}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors group"
                    title="View Details"
                >
                    <Eye size={18} className="text-slate-400 group-hover:text-blue-600" />
                    <span className="text-[10px] font-medium">View</span>
                </button>
                <button 
                     onClick={() => { if (activeActionId) handleEditSale(activeActionId); }}
                      className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-amber-50 text-slate-600 hover:text-amber-600 transition-colors group"
                    title="Edit Sale"
                >
                    <Edit size={18} className="text-slate-400 group-hover:text-amber-600" />
                    <span className="text-[10px] font-medium">Edit</span>
                </button>
                <button 
                     onClick={() => { if (activeActionId) handlePrintInvoice(activeActionId); }}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-800 transition-colors group"
                    title="Print Invoice"
                >
                    <Printer size={18} className="text-slate-400 group-hover:text-slate-800" />
                    <span className="text-[10px] font-medium">Print</span>
                </button>
                <button 
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors group"
                    title="Delete Sale"
                    onClick={() => { if (activeActionId) handleDeleteSale(activeActionId); }}
                >
                    <Trash2 size={18} className="text-slate-400 group-hover:text-rose-600" />
                    <span className="text-[10px] font-medium">Delete</span>
                </button>
            </div>

            {/* List Actions */}
            <div className="py-1">
                 <button 
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                    onClick={() => { if (activeActionId) handlePackingSlip(activeActionId); }}
                >
                    <Package size={14} className="text-slate-400" /> Packing Slip
                </button>
                <button 
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                    onClick={() => { if (activeActionId) handleDeliveryNote(activeActionId); }}
                >
                    <ScrollText size={14} className="text-slate-400" /> Delivery Note
                </button>
                 <button 
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                    onClick={() => { if (activeActionId) handleEditShipping(activeActionId); }}
                >
                    <Truck size={14} className="text-slate-400" /> Edit Shipping
                </button>
                
                <div className="h-px bg-slate-100 my-1 mx-2"></div>
                
                <button 
                    className={`w-full text-left px-4 py-2 text-xs font-medium flex items-center gap-3 transition-colors ${
                      isFinalizedSale(activeSaleRaw)
                        ? 'text-slate-600 hover:bg-slate-50'
                        : 'text-slate-300 cursor-not-allowed'
                    }`}
                    onClick={() => { if (activeActionId && isFinalizedSale(activeSaleRaw)) handleAddPayment(activeActionId); }}
                    disabled={!isFinalizedSale(activeSaleRaw)}
                >
                    <CreditCard size={14} className={isFinalizedSale(activeSaleRaw) ? 'text-emerald-500' : 'text-slate-300'} /> Add Payment
                </button>
                 <button 
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                    onClick={() => { if (activeActionId) handleViewPayments(activeActionId); }}
                >
                    <Banknote size={14} className="text-slate-400" /> View Payments
                </button>
                
                <div className="h-px bg-slate-100 my-1 mx-2"></div>
                
                 <button 
                    className={`w-full text-left px-4 py-2 text-xs font-medium flex items-center gap-3 transition-colors ${
                      isFinalizedSale(activeSaleRaw) && canAccessSellReturnSale(activeSaleRaw)
                        ? 'text-slate-600 hover:bg-slate-50'
                        : 'text-slate-300 cursor-not-allowed'
                    }`}
                    onClick={() => { if (activeActionId && isFinalizedSale(activeSaleRaw) && canAccessSellReturnSale(activeSaleRaw)) handleSellReturn(activeActionId); }}
                    disabled={!isFinalizedSale(activeSaleRaw) || !canAccessSellReturnSale(activeSaleRaw)}
                >
                    <Undo2 size={14} className={isFinalizedSale(activeSaleRaw) && canAccessSellReturnSale(activeSaleRaw) ? 'text-orange-500' : 'text-slate-300'} /> Sell Return
                </button>
                 <button 
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                    onClick={() => { if (activeActionId) handleInvoiceURL(activeActionId); }}
                >
                    <Link size={14} className="text-indigo-500" /> Invoice URL
                </button>
            </div>
        </div>,
        document.body
      )}

      {/* View Details Modal */}
      {viewOrderModalOpen && (
          <ViewSaleDetails
            isOpen={viewOrderModalOpen}
            onClose={() => {
              setViewOrderModalOpen(false);
              setInvoiceAutoPrintRequestId(null);
            }}
            saleId={selectedSaleId}
            autoPrintRequestId={invoiceAutoPrintRequestId}
            onOpenPackingSlip={() => {
              setViewOrderModalOpen(false);
              setInvoiceAutoPrintRequestId(null);
              setPackingSlipModalOpen(true);
            }}
          />
      )}

      {/* Packing Slip Modal */}
      {packingSlipModalOpen && (
          <PackingSlip 
            onClose={() => setPackingSlipModalOpen(false)} 
            invoiceNo={selectedSale?.invoiceNo}
            date={selectedSale?.date}
            sale={selectedSaleRaw || undefined}
          />
      )}

      {/* Delivery Note Modal */}
      {deliveryNoteModalOpen && (
          <DeliveryNote
            onClose={() => setDeliveryNoteModalOpen(false)} 
            invoiceNo={selectedSale?.invoiceNo}
            date={selectedSale?.date}
            sale={selectedSaleRaw || undefined}
          />
      )}

      {/* Edit Shipping Modal */}
      {editShippingModalOpen && (
          <EditShippingModal 
            isOpen={editShippingModalOpen}
            onClose={() => setEditShippingModalOpen(false)}
            sale={selectedSaleRaw}
            onSave={(updatedSale) => globalUpdateSale(updatedSale)}
          />
      )}

      {/* Add Payment Modal */}
      {addPaymentModalOpen && (
          <AddPaymentModal
            isOpen={addPaymentModalOpen}
            onClose={() => setAddPaymentModalOpen(false)}
            sale={selectedSaleRaw}
            onSave={globalAddPayment}
          />
      )}

      {/* View Payments Modal */}
      {viewPaymentsModalOpen && (
          <ViewPaymentsModal
            isOpen={viewPaymentsModalOpen}
            onClose={() => setViewPaymentsModalOpen(false)}
            invoiceNo={selectedSale?.invoiceNo}
          />
      )}

      {/* Invoice URL Modal */}
      {invoiceURLModalOpen && (
          <InvoiceURLModal
            isOpen={invoiceURLModalOpen}
            onClose={() => setInvoiceURLModalOpen(false)}
            invoiceNo={selectedSale?.invoiceNo}
            saleId={selectedSaleId || undefined}
          />
      )}

    </div>
  );
};

export default ListPOS;

