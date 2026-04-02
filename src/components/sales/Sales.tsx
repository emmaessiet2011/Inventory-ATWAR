import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, FileText, FileSpreadsheet, Printer, 
  Columns, Edit, Trash2, X, ChevronDown, 
  ArrowUpDown, Filter, Eye,
  CreditCard, Truck, 
  Undo2, Package, ScrollText, Banknote, Link
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import PackingSlip from '@/components/shipping/PackingSlip'; 
import DeliveryNote from '@/components/shipping/DeliveryNote'; 
import EditShippingModal from '@/components/shipping/EditShippingModal'; 
import AddPaymentModal from '@/components/payments/AddPaymentModal'; 
import ViewPaymentsModal from '@/components/payments/ViewPaymentsModal'; 
import InvoiceURLModal from '@/components/shared/InvoiceURLModal';
import ViewSaleDetails from './ViewSaleDetails';
import MultiSelect from '@/components/shared/MultiSelect';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import { useGlobalContext, Sale as GlobalSale } from '@/context/GlobalContext';
import { formatDateTimeBySettings } from '@/utils/dateTime';
import { findLocationByIdOrName, notifyReceiptPrintFallback } from '@/utils/receiptPrinting';
import { printDocument, paymentBadge, statusBadge } from '@/utils/printUtils';
import { buildPaginationItems } from '@/utils/pagination';

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
  maxHeight?: number;
}

interface SalesProps {
    onNavigate?: (page: string) => void;
    statusFilter?: 'Final' | 'Draft' | 'Quotation';
    title?: string;
    addPage?: string;
    addButtonLabel?: string;
}

const Sales: React.FC<SalesProps> = ({
  onNavigate,
  statusFilter = 'Final',
  title,
  addPage,
  addButtonLabel,
}) => {
  const { addNotification } = useNotifications();
  const {
    sales: globalSales,
    sellReturns,
    locations,
    printers,
    deleteSale: globalDeleteSale,
    updateSale: globalUpdateSale,
    users,
    addPayment: globalAddPayment,
    formatCurrency,
    settings,
    currentUser,
    roles,
  } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-right' });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  type ColumnKey =
    | 'action'
    | 'date'
    | 'invoiceNo'
    | 'customerName'
    | 'contactNumber'
    | 'location'
    | 'status'
    | 'paymentStatus'
    | 'saleType'
    | 'commissionAgent'
    | 'commission'
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
  const paymentStatusColumnLabel = statusFilter === 'Final'
    ? 'Payment Status'
    : 'Payment Status (Final Only)';
  const paymentStatusFilterEnabled = statusFilter === 'Final';
  const columnDefs: Array<{ key: ColumnKey; label: string }> = [
    { key: 'action', label: 'Action' },
    { key: 'date', label: 'Date' },
    { key: 'invoiceNo', label: 'Invoice No.' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'contactNumber', label: 'Contact Number' },
    { key: 'location', label: 'Location' },
    { key: 'status', label: 'Status' },
    { key: 'paymentStatus', label: paymentStatusColumnLabel },
    { key: 'saleType', label: 'Sale Type' },
    { key: 'commissionAgent', label: 'Commission Agent' },
    { key: 'commission', label: 'Commission' },
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
  const [hiddenColumns, setHiddenColumns] = useState<ColumnKey[]>([]);
  const [dateRange, setDateRange] = useState<DateRangeSelection>(() => {
    const now = new Date();
    return {
      startDate: new Date(now.getFullYear(), 0, 1),
      endDate: new Date(now.getFullYear(), 11, 31),
      label: 'This Year',
    };
  });
  const [entriesPerPage, setEntriesPerPage] = useState<number>(Number(settings.defaultTableEntries || 25));
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<'date' | 'invoiceNo' | 'customerName' | 'grandTotal'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Filter States
  const [filters, setFilters] = useState({
      location: [] as string[],
      customer: [] as string[],
      paymentStatus: [] as string[],
      shippingStatus: [] as string[],
      user: [] as string[]
  });
  
  // Modal States
  const [viewOrderModalOpen, setViewOrderModalOpen] = useState(false);
  const [packingSlipModalOpen, setPackingSlipModalOpen] = useState(false);
  const [deliveryNoteModalOpen, setDeliveryNoteModalOpen] = useState(false);
  const [editShippingModalOpen, setEditShippingModalOpen] = useState(false);
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false);
  const [viewPaymentsModalOpen, setViewPaymentsModalOpen] = useState(false);
  const [invoiceURLModalOpen, setInvoiceURLModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void} | null>(null);
  
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [invoiceAutoPrintRequestId, setInvoiceAutoPrintRequestId] = useState<string | null>(null);
  const sales = globalSales;
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
  const isFinalizedSale = (sale?: GlobalSale | null): boolean =>
    !!sale && ((sale.status || sale.saleStatus || '').trim() === 'Final');
  const saleStatusLabel = (sale?: GlobalSale | null): string =>
    String(sale?.saleStatus || sale?.status || '--').trim() || '--';
  const getDocumentLabel = (sale?: GlobalSale | null): string => {
    const normalized = saleStatusLabel(sale);
    if (normalized === 'Quotation') return 'Quotation';
    if (normalized === 'Proforma') return 'Proforma Invoice';
    if (normalized === 'Draft' || normalized === 'Suspend') return 'Draft';
    return 'Invoice';
  };
  const getDisplaySellDue = (sale?: GlobalSale | null): number =>
    isFinalizedSale(sale) ? Number(sale?.sellDue || 0) : 0;
  const getDisplaySellReturnDue = (sale?: GlobalSale | null): number =>
    isFinalizedSale(sale) ? Number(sale?.sellReturnDue || 0) : 0;
  const getDisplayPaymentStatus = (sale?: GlobalSale | null): string =>
    isFinalizedSale(sale) ? String(sale?.paymentStatus || '--') : 'N/A';

  const currentRoleRecord = roles.find(r => r.name === currentUser?.role);
  const rolePermissions = currentRoleRecord?.permissions || [];
  const roleHasExplicitPermissions = rolePermissions.length > 0;
  const hasRolePermission = (moduleName: string, permission: string) => {
    if (!currentUser) return false;
    if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
    if (!roleHasExplicitPermissions) return true;
    return (
      rolePermissions.includes(permission) ||
      rolePermissions.includes(`${moduleName}::${permission}`)
    );
  };
  const canViewAllQuotations = hasRolePermission('Quotation', 'View all quotations');
  const canViewOwnQuotations = hasRolePermission('Quotation', 'View own quotations');
  const canEditQuotations = hasRolePermission('Quotation', 'Edit quotation');
  const canDeleteQuotations = hasRolePermission('Quotation', 'Delete quotation');
  const canCreateQuotations = hasRolePermission('Sell', 'Add Sell') || canEditQuotations;
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
  const isQuotationList = statusFilter === 'Quotation';
  const canAddInCurrentList = !isQuotationList || canCreateQuotations;

  const activeSale = useMemo(
    () => (activeActionId ? sales.find(s => s.id === activeActionId) : undefined),
    [sales, activeActionId]
  );
  const activeSaleIsFinal = isFinalizedSale(activeSale);
  const activeSaleDocumentLabel = getDocumentLabel(activeSale);
  const activeSaleCanEdit = !isQuotationList || canEditQuotations;
  const activeSaleCanDelete = !isQuotationList || canDeleteQuotations;
  const activeSaleCanSellReturn = activeSaleIsFinal && canAccessSellReturnSale(activeSale);

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
    return formatDateTimeBySettings(
      value,
      settings.dateFormat,
      settings.timeFormat,
      settings.timeZone
    );
  };

  const handleSort = (key: 'date' | 'invoiceNo' | 'customerName' | 'grandTotal') => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'date' ? 'desc' : 'asc');
  };

  const escapeCSV = (value: string | number): string => {
    const raw = String(value ?? '');
    const escaped = raw.replace(/"/g, '""');
    return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
  };

  const downloadBlob = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
        top: isDropUp ? undefined : rect.bottom + 6,
        bottom: isDropUp ? window.innerHeight - rect.top + 6 : undefined,
        left: rect.left, 
        transformOrigin: isDropUp ? 'origin-bottom-left' : 'origin-top-left',
        maxHeight: maxHeight
      });
      setActiveActionId(id);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
        if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
            return;
        }
        if (columnMenuRef.current && columnMenuRef.current.contains(event.target as Node)) {
            return;
        }
        setActiveActionId(null);
        setShowColumnMenu(false);
    };

    const handleScroll = () => {
      setActiveActionId(null);
      setShowColumnMenu(false);
    };
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

  const handleViewDetails = (saleId: string) => {
      setActiveActionId(null);
      if (onNavigate) {
        onNavigate(`view-sale/${saleId}`);
      } else {
        setSelectedSaleId(saleId);
        setInvoiceAutoPrintRequestId(null);
        setViewOrderModalOpen(true);
      }
  };

  const handlePrintInvoice = (saleId: string) => {
      const sale = sales.find(s => s.id === saleId);
      const saleLocation = findLocationByIdOrName(locations, sale?.location);
      notifyReceiptPrintFallback({
        location: saleLocation,
        printers,
        addNotification,
        documentLabel: getDocumentLabel(sale),
      });
      setActiveActionId(null);
      if (onNavigate) {
        // Dedicated print route auto-opens print dialog (different from View route).
        onNavigate(`print-sale/${saleId}`);
      } else {
        setSelectedSaleId(saleId);
        setViewOrderModalOpen(true);
        setInvoiceAutoPrintRequestId(`${saleId}-${Date.now()}`);
      }
  };
  
  const handlePackingSlip = (saleId: string) => {
      const sale = sales.find(s => s.id === saleId);
      if (!isFinalizedSale(sale)) {
        addNotification({
          title: 'Action blocked',
          message: 'Packing Slip is available only for Final sales.',
          type: 'error',
        });
        setActiveActionId(null);
        return;
      }
      setSelectedSaleId(saleId);
      setPackingSlipModalOpen(true);
      setActiveActionId(null);
  };
  
  const handleDeliveryNote = (saleId: string) => {
      const sale = sales.find(s => s.id === saleId);
      if (!isFinalizedSale(sale)) {
        addNotification({
          title: 'Action blocked',
          message: 'Delivery Note is available only for Final sales.',
          type: 'error',
        });
        setActiveActionId(null);
        return;
      }
      setSelectedSaleId(saleId);
      setDeliveryNoteModalOpen(true);
      setActiveActionId(null);
  };
  
  const handleEditShipping = (saleId: string) => {
      const sale = sales.find(s => s.id === saleId);
      if (!isFinalizedSale(sale)) {
        addNotification({
          title: 'Action blocked',
          message: 'Edit Shipping is available only for Final sales.',
          type: 'error',
        });
        setActiveActionId(null);
        return;
      }
      setSelectedSaleId(saleId);
      setEditShippingModalOpen(true);
      setActiveActionId(null);
  };
  
  const handleAddPayment = (saleId: string) => {
      const sale = sales.find(s => s.id === saleId);
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
      const sale = sales.find(s => s.id === saleId);
      if (!isFinalizedSale(sale)) {
        addNotification({
          title: 'Action blocked',
          message: 'View Payments is available only for Final sales.',
          type: 'error',
        });
        setActiveActionId(null);
        return;
      }
      setSelectedSaleId(saleId);
      setViewPaymentsModalOpen(true);
      setActiveActionId(null);
  };

  const handleInvoiceURL = (saleId: string) => {
      const sale = sales.find(s => s.id === saleId);
      setSelectedSaleId(saleId);
      setInvoiceURLModalOpen(true);
      setActiveActionId(null);
      const documentLabel = getDocumentLabel(sale);
      addNotification({
        title: `${documentLabel} URL Generated`,
        message: `Public link for ${documentLabel.toLowerCase()} ${sale?.invoiceNo} has been generated.`,
        type: 'info'
      });
  };

  const handleDeleteSale = (saleId: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (sellReturns.some(ret => ret.parentSaleId === saleId)) {
      addNotification({
        title: 'Action blocked',
        message: 'Delete the linked sell return records first.',
        type: 'error',
      });
      setActiveActionId(null);
      return;
    }
    if (isQuotationList && !canDeleteQuotations) {
      addNotification({
        title: 'Permission denied',
        message: 'You do not have permission to delete quotations.',
        type: 'error',
      });
      setActiveActionId(null);
      return;
    }
    const documentLabel = getDocumentLabel(sale);
    setActiveActionId(null);
    setConfirmModal({
      isOpen: true,
      title: `Delete ${documentLabel}`,
      message: `Are you sure you want to delete ${documentLabel.toLowerCase()} ${sale?.invoiceNo}? This will restore stock for Final sales only.`,
      onConfirm: () => {
        globalDeleteSale(saleId);
        addNotification({ title: `${documentLabel} Deleted`, message: `${documentLabel} ${sale?.invoiceNo} has been removed.`, type: 'success' });
        setConfirmModal(null);
      },
    });
  };

  const handleSellReturn = (saleId: string) => {
      const sale = sales.find(s => s.id === saleId);
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
    if (isQuotationList && !canEditQuotations) {
      addNotification({
        title: 'Permission denied',
        message: 'You do not have permission to edit quotations.',
        type: 'error',
      });
      setActiveActionId(null);
      return;
    }
    const editDays = Number(settings.transactionEditDays);
    if (editDays > 0) {
      const sale = globalSales.find(s => s.id === saleId);
      if (sale) {
        const saleDate = new Date(sale.date);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > editDays) {
          addNotification({
            title: 'Edit not allowed',
            message: `This sale is older than ${editDays} day(s) and cannot be edited.`,
            type: 'error',
          });
          setActiveActionId(null);
          return;
        }
      }
    }
    if (onNavigate) {
      onNavigate(`edit-sale/${saleId}`);
    }
    setActiveActionId(null);
  };

  const exportCurrentSales = (format: 'csv' | 'excel') => {
    const rows = sortedSales;
    const headers = [
      'Date',
      isQuotationList ? 'Document No' : 'Invoice No',
      'Customer',
      'Location',
      'Status',
      paymentStatusColumnLabel,
      'Sale Type',
      'Total Amount',
      'Total Paid',
      'Sell Due',
      'Shipping Status',
      'Added By',
    ];
    const lines = [
      headers.join(','),
      ...rows.map(s => [
        formatDateTimeDisplay(s.date),
        s.invoiceNo || '',
        s.customerName || '',
        s.location || '',
        saleStatusLabel(s),
        getDisplayPaymentStatus(s),
        s.saleType || '',
        Number(s.grandTotal || s.totalAmount || 0).toFixed(3),
        Number(s.totalPaid || 0).toFixed(3),
        Number(getDisplaySellDue(s)).toFixed(3),
        s.shippingStatus || '',
        s.addedBy || '',
      ].map(escapeCSV).join(',')),
    ];
    const content = lines.join('\n');
    const datePart = new Date().toISOString().slice(0, 10);
    const filePrefix = isQuotationList ? 'quotations' : statusFilter === 'Draft' ? 'drafts' : 'sales';
    if (format === 'excel') {
      downloadBlob(`${filePrefix}-${datePart}.xls`, content, 'application/vnd.ms-excel;charset=utf-8;');
      return;
    }
    downloadBlob(`${filePrefix}-${datePart}.csv`, content, 'text/csv;charset=utf-8;');
  };

  const exportCurrentSalesPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape' });
      let y = 12;
      doc.setFontSize(12);
      const exportTitle = isQuotationList ? 'Quotations Export' : statusFilter === 'Draft' ? 'Drafts Export' : 'Sales Export';
      doc.text(exportTitle, 14, y);
      y += 7;
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
      y += 8;

      const headers = ['Date', isQuotationList ? 'Document' : 'Invoice', 'Customer', 'Status', 'Total', 'Paid', 'Due'];
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
          saleStatusLabel(sale),
          Number(sale.grandTotal || sale.totalAmount || 0).toFixed(3),
          Number(sale.totalPaid || 0).toFixed(3),
          Number(getDisplaySellDue(sale)).toFixed(3),
        ].join(' | ');
        doc.text(line, 14, y);
        y += 5;
      });

      const datePart = new Date().toISOString().slice(0, 10);
      const filePrefix = isQuotationList ? 'quotations' : statusFilter === 'Draft' ? 'drafts' : 'sales';
      doc.save(`${filePrefix}-${datePart}.pdf`);
    } catch (error) {
      addNotification({
        title: 'Export failed',
        message: 'Unable to generate PDF export for sales.',
        type: 'error',
      });
    }
  };

  const handlePrint = () => {
    const title = isQuotationList ? 'Quotations' : statusFilter === 'Draft' ? 'Drafts' : 'Sales';
    const totalGrand = sortedSales.reduce((sum, s) => sum + Number(s.grandTotal || s.totalAmount || 0), 0);
    printDocument({
      title,
      subtitle: dateRange?.startDate && dateRange?.endDate
        ? `Period: ${new Date(dateRange.startDate).toLocaleDateString()} – ${new Date(dateRange.endDate).toLocaleDateString()}`
        : undefined,
      businessName: settings?.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings?.address || '',
      printedBy: currentUser?.name || '',
      columns: [
        { label: 'Date', width: '80px' },
        { label: 'Invoice No', width: '100px' },
        { label: 'Customer' },
        { label: 'Location', width: '90px' },
        { label: paymentStatusColumnLabel, width: '120px' },
        { label: 'Shipping Status', width: '80px' },
        { label: 'Total', align: 'right', width: '90px' },
        { label: 'Added By', width: '80px' },
      ],
      rows: sortedSales.map(s => {
        const dateVal = s.date ? new Date(s.date.includes('T') ? s.date : s.date + 'T00:00:00') : null;
        return [
          dateVal ? dateVal.toLocaleDateString() : (s.date || '--'),
          s.invoiceNo || '--',
          s.customerName || '--',
          s.location || '--',
          paymentBadge(getDisplayPaymentStatus(s)),
          statusBadge(s.shippingStatus || 'Pending'),
          formatCurrency(Number(s.grandTotal || s.totalAmount || 0)),
          s.addedBy || '--',
        ];
      }),
      stats: [
        { label: `Total ${title}`, value: String(sortedSales.length), color: 'blue' },
        { label: 'Total Amount', value: formatCurrency(totalGrand), color: 'green' },
      ],
      totalRow: ['TOTAL', '', '', '', '', '', formatCurrency(totalGrand), ''],
    });
  };

  const scopedSales = useMemo(() => (
    sales.filter(s => {
      if (!statusFilter) return true;
      const normalizedStatus = (s.status || s.saleStatus || '').trim();
      if (statusFilter === 'Quotation') {
        const isQuotationRecord = normalizedStatus === 'Quotation' || normalizedStatus === 'Proforma';
        if (!canViewAllQuotations && !canViewOwnQuotations) return false;
        if (!isQuotationRecord) return false;
        if (!canViewAllQuotations && canViewOwnQuotations) {
          const owner = String(currentUser?.name || '').trim().toLowerCase();
          return String(s.addedBy || '').trim().toLowerCase() === owner;
        }
        return true;
      }
      if (statusFilter === 'Draft') {
        return normalizedStatus === 'Draft' || String(s.saleStatus || '').trim() === 'Suspend';
      }
      return normalizedStatus === statusFilter;
    })
  ), [sales, statusFilter, canViewAllQuotations, canViewOwnQuotations, currentUser?.name]);

  const filteredSales = useMemo(() => (
    scopedSales.filter(s => {
      const textMatch =
        (s.invoiceNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.location || '').toLowerCase().includes(searchTerm.toLowerCase());

      const filterMatch =
        (filters.location.length === 0 || filters.location.includes(s.location || '')) &&
        (filters.customer.length === 0 || filters.customer.includes(s.customerName || '')) &&
        (!paymentStatusFilterEnabled || filters.paymentStatus.length === 0 || filters.paymentStatus.includes(s.paymentStatus || '')) &&
        (filters.shippingStatus.length === 0 || filters.shippingStatus.includes(s.shippingStatus || '')) &&
        (filters.user.length === 0 || filters.user.includes(s.addedBy || ''));

      const saleDate = parseDateValue(s.date);
      const dateMatch = (() => {
        if (!dateRange.startDate || !dateRange.endDate) return true;
        if (saleDate === null) return false;
        const rangeStart = new Date(dateRange.startDate);
        rangeStart.setHours(0, 0, 0, 0);
        const rangeEnd = new Date(dateRange.endDate);
        rangeEnd.setHours(23, 59, 59, 999);
        return saleDate >= rangeStart && saleDate <= rangeEnd;
      })();

      return textMatch && filterMatch && dateMatch;
    })
  ), [scopedSales, searchTerm, filters, dateRange, paymentStatusFilterEnabled]);

  const sortedSales = useMemo(() => {
    const copy = [...filteredSales];
    copy.sort((a, b) => {
      const direction = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'date') {
        const ad = parseDateValue(a.date)?.getTime() || 0;
        const bd = parseDateValue(b.date)?.getTime() || 0;
        return (ad - bd) * direction;
      }
      if (sortKey === 'grandTotal') {
        const at = Number(a.grandTotal || a.totalAmount || 0);
        const bt = Number(b.grandTotal || b.totalAmount || 0);
        return (at - bt) * direction;
      }
      const av = String(a[sortKey] || '').toLowerCase();
      const bv = String(b[sortKey] || '').toLowerCase();
      return av.localeCompare(bv) * direction;
    });
    return copy;
  }, [filteredSales, sortDir, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedSales.length / entriesPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginationItems = buildPaginationItems(safeCurrentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * entriesPerPage;
  const pageEnd = pageStart + entriesPerPage;
  const pagedSales = sortedSales.slice(pageStart, pageEnd);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, statusFilter, dateRange, entriesPerPage]);

  const totals = sortedSales.reduce((acc, curr) => ({
      amount: acc.amount + (curr.grandTotal || curr.totalAmount || 0),
      paid: acc.paid + (curr.totalPaid || 0),
      due: acc.due + getDisplaySellDue(curr),
      returnDue: acc.returnDue + getDisplaySellReturnDue(curr)
  }), { amount: 0, paid: 0, due: 0, returnDue: 0 });

  return (
    <div className="space-y-6 animate-fade-in pb-16 print:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">{title || (statusFilter === 'Draft' ? 'Drafts' : statusFilter === 'Quotation' ? 'Quotations' : 'Sales')}</h2>
          <p className="text-slate-500 mt-0.5 text-sm">
            {statusFilter === 'Quotation'
              ? 'Manage quotation and proforma documents.'
              : statusFilter === 'Draft'
                ? 'Manage saved drafts and suspended records.'
                : 'Manage your sales transactions, invoices, and shipping.'}
          </p>
        </div>
        {canAddInCurrentList && (
          <button 
            onClick={() => onNavigate && onNavigate(addPage || (statusFilter === 'Draft' ? 'add-draft' : statusFilter === 'Quotation' ? 'add-quotation' : 'add-sale'))}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
          >
            <Plus size={18} /> {addButtonLabel || (statusFilter === 'Draft' ? 'Add Draft' : statusFilter === 'Quotation' ? 'Add Quotation' : 'Add Sale')}
          </button>
        )}
      </div>

      {/* Filter Section */}
      <div className="relative z-30 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-visible print:hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600 rounded-t-[2rem]" />
          <div
            className="flex items-center gap-2 p-4 pt-5 cursor-pointer hover:bg-slate-50/70 transition-colors border-b border-slate-100 rounded-t-[2rem]"
            onClick={() => setShowFilters(!showFilters)}
          >
              <Filter size={16} className="text-slate-600" />
              <span className="text-sm font-bold text-slate-700">Filters</span>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </div>
          
          {showFilters && (
              <div className="relative p-6 bg-slate-50/50 animate-in slide-in-from-top-2 overflow-visible">
                  <div className="relative grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 overflow-visible">
                      <MultiSelect 
                          label="Business Location"
                          options={locations.map(loc => loc.name)}
                          selected={filters.location}
                          onChange={(val) => setFilters({...filters, location: val})}
                      />
                      <MultiSelect
                          label="Customer"
                          options={[...new Set(scopedSales.map(s => s.customerName).filter(Boolean))] as string[]}
                          selected={filters.customer}
                          onChange={(val) => setFilters({...filters, customer: val})}
                      />
                      {paymentStatusFilterEnabled && (
                        <MultiSelect 
                            label="Payment Status"
                            options={['Paid', 'Due', 'Partial', 'Overdue']}
                            selected={filters.paymentStatus}
                            onChange={(val) => setFilters({...filters, paymentStatus: val})}
                        />
                      )}
                      <MultiSelect 
                          label="Shipping Status"
                          options={['Delivered', 'Pending', 'Shipped', 'Ordered', 'Packed', 'Cancelled']}
                          selected={filters.shippingStatus}
                          onChange={(val) => setFilters({...filters, shippingStatus: val})}
                      />
                       <MultiSelect
                          label="User"
                          options={users.map(u => u.name)}
                          selected={filters.user}
                          onChange={(val) => setFilters({...filters, user: val})}
                      />
                      <div className="group">
                          <DateRangeFilter onRangeSelect={(range) => setDateRange(range)} />
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500"></div>
        
        {/* Controls Bar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
           <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
              
              <div className="flex items-center gap-3 w-full xl:w-auto">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show</span>
                  <div className="relative">
                      <select
                          value={entriesPerPage}
                          onChange={(e) => {
                            const parsed = Number(e.target.value);
                            setEntriesPerPage(Number.isFinite(parsed) && parsed > 0 ? parsed : 25);
                          }}
                          className="border-0 bg-white shadow-sm ring-1 ring-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer appearance-none"
                      >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto relative" ref={columnMenuRef}>
                  <button
                    onClick={() => exportCurrentSales('csv')}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap"
                  >
                    <FileText size={14} /> Export CSV
                  </button>
                  <button
                    onClick={() => exportCurrentSales('excel')}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap"
                  >
                    <FileSpreadsheet size={14} /> Export Excel
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap"
                  >
                    <Printer size={14} /> Print
                  </button>
                  <button
                    onClick={() => setShowColumnMenu(prev => !prev)}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap"
                  >
                    <Columns size={14} /> Column visibility
                  </button>
                  <button
                    onClick={() => { void exportCurrentSalesPdf(); }}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap"
                  >
                    <FileText size={14} /> Export PDF
                  </button>

                  {showColumnMenu && (
                    <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-xl z-30 p-3">
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

              <div className="relative w-full xl:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                      type="text" 
                      placeholder="Search..." 
                      className="w-full xl:w-64 pl-9 pr-4 py-2 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm placeholder:text-slate-400"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
           </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[500px]">
          <table className="w-full text-[10px] sm:text-xs text-left border-collapse">
            <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 text-slate-500 font-semibold border-b border-slate-200 z-10">
              <tr>
                <th style={getColumnStyle('action')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">Action</th>
                <th style={getColumnStyle('date')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort('date')}>
                  Date <ArrowUpDown size={12} className={`inline ml-1 ${sortKey === 'date' ? 'text-blue-500' : 'text-slate-400'}`} />
                </th>
                <th style={getColumnStyle('invoiceNo')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort('invoiceNo')}>
                  Invoice No. <ArrowUpDown size={12} className={`inline ml-1 ${sortKey === 'invoiceNo' ? 'text-blue-500' : 'text-slate-400'}`} />
                </th>
                <th style={getColumnStyle('customerName')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort('customerName')}>
                  Customer Name <ArrowUpDown size={12} className={`inline ml-1 ${sortKey === 'customerName' ? 'text-blue-500' : 'text-slate-400'}`} />
                </th>
                <th style={getColumnStyle('contactNumber')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">Contact Number</th>
                <th style={getColumnStyle('location')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">Location</th>
                <th style={getColumnStyle('status')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap text-center">Status</th>
                <th style={getColumnStyle('paymentStatus')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap text-center">{paymentStatusColumnLabel}</th>
                <th style={getColumnStyle('saleType')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap text-center">Sale Type</th>
                <th style={getColumnStyle('commissionAgent')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">Commission Agent</th>
                <th style={getColumnStyle('commission')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap text-right">Commission</th>
                <th style={getColumnStyle('paymentMethod')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap text-center">Payment Method</th>
                <th style={getColumnStyle('totalAmount')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap text-right cursor-pointer select-none" onClick={() => handleSort('grandTotal')}>
                  Total Amount <ArrowUpDown size={12} className={`inline ml-1 ${sortKey === 'grandTotal' ? 'text-blue-500' : 'text-slate-400'}`} />
                </th>
                <th style={getColumnStyle('totalPaid')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap text-right">Total Paid</th>
                <th style={getColumnStyle('sellDue')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap text-right">Sell Due</th>
                <th style={getColumnStyle('sellReturnDue')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap text-right">Sell Return Due</th>
                <th style={getColumnStyle('shippingStatus')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap text-center">Shipping Status</th>
                <th style={getColumnStyle('totalItems')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap text-right">Total Items</th>
                <th style={getColumnStyle('addedBy')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">Added By</th>
                <th style={getColumnStyle('sellNote')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">Sell Note</th>
                <th style={getColumnStyle('staffNote')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">Staff Note</th>
                <th style={getColumnStyle('shippingDetails')} className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">Shipping Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedSales.length > 0 ? (
                  pagedSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td style={getColumnStyle('action')} className="px-2 py-2 sm:px-4 sm:py-3text-center">
                          <button 
                            onClick={(e) => toggleActions(e, sale.id)}
                            className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all ${
                                activeActionId === sale.id 
                                ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                                : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                            }`}
                          >
                              Actions <ChevronDown size={10} />
                          </button>
                      </td>
                      <td style={getColumnStyle('date')} className="px-2 py-2 sm:px-4 sm:py-3text-slate-600 font-medium whitespace-nowrap">{formatDateTimeDisplay(sale.date)}</td>
                      <td style={getColumnStyle('invoiceNo')} className="px-2 py-2 sm:px-4 sm:py-3text-slate-700 font-bold whitespace-nowrap">
                        <div className="flex flex-col items-start">
                          <span>{sale.invoiceNo}</span>
                          {settings.showInvoiceScheme && (
                            <span className="text-[9px] text-slate-400 mt-0.5">{sale.invoiceScheme || '--'}</span>
                          )}
                          {getDisplaySellReturnDue(sale) > 0 && (
                            <div className="mt-1.5 relative group/return cursor-help" title={`Sale Return: ${formatCurrency(getDisplaySellReturnDue(sale))}`}>
                              <div className="absolute inset-0 bg-rose-500 blur-[6px] opacity-40 rounded-full animate-pulse"></div>
                              <div className="relative w-4 h-4 rounded-full bg-rose-600 flex items-center justify-center text-white border border-rose-400/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] transition-transform group-hover/return:scale-110 duration-300">
                                <Undo2 size={8} strokeWidth={3} className="drop-shadow-sm" />
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={getColumnStyle('customerName')} className="px-2 py-2 sm:px-4 sm:py-3text-slate-800 font-bold whitespace-nowrap">{sale.customerName}</td>
                      <td style={getColumnStyle('contactNumber')} className="px-2 py-2 sm:px-4 sm:py-3text-slate-500 font-medium whitespace-nowrap">{sale.contactNumber}</td>
                      <td style={getColumnStyle('location')} className="px-2 py-2 sm:px-4 sm:py-3text-slate-500 whitespace-nowrap text-[10px]">{sale.location}</td>
                      <td style={getColumnStyle('status')} className="px-2 py-2 sm:px-4 sm:py-3text-center">
                           <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                               saleStatusLabel(sale) === 'Final' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                               saleStatusLabel(sale) === 'Suspend' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                               saleStatusLabel(sale) === 'Draft' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                               saleStatusLabel(sale) === 'Quotation' || saleStatusLabel(sale) === 'Proforma'
                                 ? 'bg-sky-50 text-sky-700 border-sky-200'
                                 : 'bg-slate-50 text-slate-700 border-slate-200'
                           }`}>
                               {saleStatusLabel(sale)}
                           </span>
                      </td>
                      <td style={getColumnStyle('paymentStatus')} className="px-2 py-2 sm:px-4 sm:py-3text-center">
                           {getDisplayPaymentStatus(sale) === 'N/A' ? (
                             <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border bg-slate-100 text-slate-500 border-slate-200">
                               N/A
                             </span>
                           ) : (
                           <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                               sale.paymentStatus === 'Paid' ? 'bg-emerald-500 text-white border-emerald-400' : 
                               sale.paymentStatus === 'Partial' ? 'bg-sky-500 text-white border-sky-400' :
                               'bg-amber-500 text-white border-amber-400'
                           }`}>
                               {getDisplayPaymentStatus(sale)}
                           </span>
                           )}
                      </td>
                      <td style={getColumnStyle('saleType')} className="px-2 py-2 sm:px-4 sm:py-3text-center">
                           <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border bg-indigo-50 text-indigo-700 border-indigo-200">
                               {sale.saleType || ((sale.paymentStatus === 'Due' && (sale.totalPaid || 0) === 0) ? 'Credit Sale' : 'Paid')}
                           </span>
                      </td>
                      <td style={getColumnStyle('commissionAgent')} className="px-2 py-2 sm:px-4 sm:py-3text-slate-600 whitespace-nowrap">{sale.commissionAgentName || '--'}</td>
                      <td style={getColumnStyle('commission')} className="px-2 py-2 sm:px-4 sm:py-3text-right text-slate-600 whitespace-nowrap">{formatCurrency(Number(sale.commissionAmount || 0))}</td>
                      <td style={getColumnStyle('paymentMethod')} className="px-2 py-2 sm:px-4 sm:py-3text-center text-slate-600 font-medium whitespace-nowrap">{sale.paymentMethod || '--'}</td>
                      <td style={getColumnStyle('totalAmount')} className="px-2 py-2 sm:px-4 sm:py-3text-right font-bold text-slate-800 whitespace-nowrap">{formatCurrency(sale.grandTotal || sale.totalAmount || 0)}</td>
                      <td style={getColumnStyle('totalPaid')} className="px-2 py-2 sm:px-4 sm:py-3text-right text-slate-600 whitespace-nowrap">{formatCurrency(sale.totalPaid || 0)}</td>
                      <td style={getColumnStyle('sellDue')} className="px-2 py-2 sm:px-4 sm:py-3text-right whitespace-nowrap">
                          <span className={`${getDisplaySellDue(sale) > 0 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>{formatCurrency(getDisplaySellDue(sale))}</span>
                      </td>
                      <td style={getColumnStyle('sellReturnDue')} className="px-2 py-2 sm:px-4 sm:py-3text-right whitespace-nowrap">
                          <span className={`${getDisplaySellReturnDue(sale) > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>{formatCurrency(getDisplaySellReturnDue(sale))}</span>
                      </td>
                      <td style={getColumnStyle('shippingStatus')} className="px-2 py-2 sm:px-4 sm:py-3text-center">
                           <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                               sale.shippingStatus === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                           }`}>
                               {sale.shippingStatus}
                           </span>
                      </td>
                      <td style={getColumnStyle('totalItems')} className="px-2 py-2 sm:px-4 sm:py-3text-right text-slate-600 font-medium whitespace-nowrap">{(sale.totalItems || 0).toFixed(3)}</td>
                      <td style={getColumnStyle('addedBy')} className="px-2 py-2 sm:px-4 sm:py-3text-slate-500 whitespace-nowrap">{sale.addedBy}</td>
                      <td style={getColumnStyle('sellNote')} className="px-2 py-2 sm:px-4 sm:py-3text-slate-500 whitespace-nowrap truncate max-w-[100px]">{sale.sellNote}</td>
                      <td style={getColumnStyle('staffNote')} className="px-2 py-2 sm:px-4 sm:py-3text-slate-500 whitespace-nowrap truncate max-w-[100px]">{sale.staffNote}</td>
                      <td style={getColumnStyle('shippingDetails')} className="px-2 py-2 sm:px-4 sm:py-3text-slate-500 whitespace-nowrap truncate max-w-[100px]">{sale.shippingDetails}</td>
                    </tr>
                  ))
              ) : (
                  <tr>
                      <td colSpan={visibleColumnCount} className="px-6 py-12 text-center text-slate-400 italic">
                          No sales found
                      </td>
                  </tr>
              )}
            </tbody>
            {/* Footer Totals — each value sits directly under its column */}
            <tfoot className="bg-slate-100 font-bold text-slate-800 text-[11px] border-t-2 border-slate-300 sticky bottom-0 z-20 shadow-inner">
              <tr>
                <td style={getColumnStyle('action')}          className="px-4 py-3" />
                <td style={getColumnStyle('date')}            className="px-4 py-3" />
                <td style={getColumnStyle('invoiceNo')}       className="px-4 py-3" />
                <td style={getColumnStyle('customerName')}    className="px-2 py-2 sm:px-4 sm:py-3text-slate-500 uppercase tracking-wide">Totals</td>
                <td style={getColumnStyle('contactNumber')}   className="px-4 py-3" />
                <td style={getColumnStyle('location')}        className="px-4 py-3" />
                <td style={getColumnStyle('status')}          className="px-4 py-3" />
                <td style={getColumnStyle('paymentStatus')}   className="px-4 py-3" />
                <td style={getColumnStyle('saleType')}        className="px-4 py-3" />
                <td style={getColumnStyle('commissionAgent')} className="px-4 py-3" />
                <td style={getColumnStyle('commission')}      className="px-4 py-3" />
                <td style={getColumnStyle('paymentMethod')}   className="px-4 py-3" />
                <td style={getColumnStyle('totalAmount')}     className="px-2 py-2 sm:px-4 sm:py-3text-right text-slate-900">{formatCurrency(totals.amount)}</td>
                <td style={getColumnStyle('totalPaid')}       className="px-2 py-2 sm:px-4 sm:py-3text-right text-emerald-700">{formatCurrency(totals.paid)}</td>
                <td style={getColumnStyle('sellDue')}         className="px-2 py-2 sm:px-4 sm:py-3text-right text-amber-700">{formatCurrency(totals.due)}</td>
                <td style={getColumnStyle('sellReturnDue')}   className="px-2 py-2 sm:px-4 sm:py-3text-right text-rose-700">{formatCurrency(totals.returnDue)}</td>
                <td style={getColumnStyle('shippingStatus')}  className="px-4 py-3" />
                <td style={getColumnStyle('totalItems')}      className="px-4 py-3" />
                <td style={getColumnStyle('addedBy')}         className="px-4 py-3" />
                <td style={getColumnStyle('sellNote')}        className="px-4 py-3" />
                <td style={getColumnStyle('staffNote')}       className="px-4 py-3" />
                <td style={getColumnStyle('shippingDetails')} className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-slate-50/50">
            <div>
              {sortedSales.length === 0
                ? 'Showing 0 to 0 of 0 entries'
                : `Showing ${pageStart + 1} to ${Math.min(pageEnd, sortedSales.length)} of ${sortedSales.length} entries`}
            </div>
            <div className="flex gap-1">
                 <button
                   className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
                   disabled={safeCurrentPage <= 1}
                   onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                 >
                   Previous
                 </button>
                 {paginationItems.map((item, index) => item === '...'
                   ? <span key={`page-ellipsis-${index}`} className="px-2 py-2 text-slate-400">...</span>
                   : (
                     <button
                       key={item}
                       onClick={() => setCurrentPage(item)}
                       className={`px-4 py-2 rounded-lg shadow-sm transition ${
                         item === safeCurrentPage
                           ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                           : 'bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700'
                       }`}
                     >
                       {item}
                     </button>
                   ))}
                 <button
                   className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
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
            className={`fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 w-64 max-w-[calc(100vw-2rem)] animate-in fade-in zoom-in-95 duration-200 overflow-y-auto ${dropdownPosition.transformOrigin}`}
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
                      {activeSaleDocumentLabel} #{sales.find(s => s.id === activeActionId)?.invoiceNo?.split('-').pop() || '--'}
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
                {activeSaleCanEdit && (
                  <button 
                       onClick={() => { if (activeActionId) handleEditSale(activeActionId); }}
                      className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-amber-50 text-slate-600 hover:text-amber-600 transition-colors group"
                      title={`Edit ${activeSaleDocumentLabel}`}
                  >
                      <Edit size={18} className="text-slate-400 group-hover:text-amber-600" />
                      <span className="text-[10px] font-medium">Edit</span>
                  </button>
                )}
                <button 
                     onClick={() => { if (activeActionId) handlePrintInvoice(activeActionId); }}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-800 transition-colors group"
                    title={`Print ${activeSaleDocumentLabel}`}
                >
                    <Printer size={18} className="text-slate-400 group-hover:text-slate-800" />
                    <span className="text-[10px] font-medium">Print</span>
                </button>
                {activeSaleCanDelete && (
                  <button 
                      className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors group"
                      title={`Delete ${activeSaleDocumentLabel}`}
                      onClick={() => { if (activeActionId) handleDeleteSale(activeActionId); }}
                  >
                      <Trash2 size={18} className="text-slate-400 group-hover:text-rose-600" />
                      <span className="text-[10px] font-medium">Delete</span>
                  </button>
                )}
            </div>

            {/* List Actions */}
            <div className="py-1">
                {activeSaleIsFinal && (
                  <>
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
                        className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                        onClick={() => { if (activeActionId) handleAddPayment(activeActionId); }}
                    >
                        <CreditCard size={14} className="text-emerald-500" /> Add Payment
                    </button>
                    <button 
                        className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                        onClick={() => { if (activeActionId) handleViewPayments(activeActionId); }}
                    >
                        <Banknote size={14} className="text-slate-400" /> View Payments
                    </button>

                    <div className="h-px bg-slate-100 my-1 mx-2"></div>

                    {activeSaleCanSellReturn && (
                      <button 
                          className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                          onClick={() => { if (activeActionId) handleSellReturn(activeActionId); }}
                      >
                          <Undo2 size={14} className="text-orange-500" /> Sell Return
                      </button>
                    )}
                  </>
                )}
                 <button 
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                    onClick={() => { if (activeActionId) handleInvoiceURL(activeActionId); }}
                >
                    <Link size={14} className="text-indigo-500" /> {activeSaleDocumentLabel} URL
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
            invoiceNo={selectedSaleId ? sales.find(s => s.id === selectedSaleId)?.invoiceNo : undefined}
            date={selectedSaleId ? sales.find(s => s.id === selectedSaleId)?.date : undefined}
            sale={selectedSaleId ? sales.find(s => s.id === selectedSaleId) : undefined}
          />
      )}

      {/* Delivery Note Modal */}
      {deliveryNoteModalOpen && (
          <DeliveryNote
            onClose={() => setDeliveryNoteModalOpen(false)} 
            invoiceNo={selectedSaleId ? sales.find(s => s.id === selectedSaleId)?.invoiceNo : undefined}
            date={selectedSaleId ? sales.find(s => s.id === selectedSaleId)?.date : undefined}
            sale={selectedSaleId ? sales.find(s => s.id === selectedSaleId) : undefined}
          />
      )}

      {/* Edit Shipping Modal */}
      {editShippingModalOpen && (
          <EditShippingModal 
            isOpen={editShippingModalOpen}
            onClose={() => setEditShippingModalOpen(false)}
            sale={selectedSaleId ? sales.find(s => s.id === selectedSaleId) : null}
            onSave={(updatedSale) => globalUpdateSale(updatedSale)}
          />
      )}

      {/* Add Payment Modal */}
      {addPaymentModalOpen && (
          <AddPaymentModal
            isOpen={addPaymentModalOpen}
            onClose={() => setAddPaymentModalOpen(false)}
            sale={selectedSaleId ? sales.find(s => s.id === selectedSaleId) : null}
            onSave={globalAddPayment}
          />
      )}

      {/* View Payments Modal */}
      {viewPaymentsModalOpen && (
          <ViewPaymentsModal
            isOpen={viewPaymentsModalOpen}
            onClose={() => setViewPaymentsModalOpen(false)}
            invoiceNo={selectedSaleId ? sales.find(s => s.id === selectedSaleId)?.invoiceNo : undefined}
          />
      )}

      {/* Invoice URL Modal */}
      {invoiceURLModalOpen && (
          <InvoiceURLModal
            isOpen={invoiceURLModalOpen}
            onClose={() => setInvoiceURLModalOpen(false)}
            invoiceNo={selectedSaleId ? sales.find(s => s.id === selectedSaleId)?.invoiceNo : undefined}
            saleId={selectedSaleId || undefined}
          />
      )}

      {/* Confirm Modal */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 rounded-full bg-rose-50 text-rose-500 mb-4"><Trash2 size={32} /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{confirmModal.title}</h3>
              <p className="text-slate-500 text-sm mb-6">{confirmModal.message}</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setConfirmModal(null)} className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={confirmModal.onConfirm} className="flex-1 px-4 py-2.5 rounded-lg text-white font-bold bg-rose-600 hover:bg-rose-700 transition-colors">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Sales;
