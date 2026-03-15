
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  User, MapPin, Phone, Mail, Plus, FileText, 
  ShoppingBag, StickyNote, CreditCard, Activity,
  Printer, ArrowLeft,
  ChevronDown, Edit, Trash2, Eye,
  Search, ArrowUpDown, Wallet, Receipt, X, DollarSign,
  Calendar as CalendarIcon, Banknote, Briefcase, Clock, Truck, Package, ScrollText, Link, Undo2, Users,
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import AddDiscountModal from './AddDiscountModal';
import ViewOrder from './ViewOrder';
import AddPaymentModal from './AddPaymentModal';
import ViewPaymentsModal from './ViewPaymentsModal';
import PackingSlip from './PackingSlip';
import DeliveryNote from './DeliveryNote';
import EditShippingModal from './EditShippingModal';
import InvoiceURLModal from './InvoiceURLModal';
import ViewPaymentModal from './ViewPaymentModal';
import EditPaymentModal from './EditPaymentModal';
import { ConfirmationModal } from './UserModals';
import { useGlobalContext } from '../src/context/GlobalContext';
import { useNotifications } from '../src/context/NotificationContext';
import { clampPrecision, normalizePrefix, toFixedPrecision } from '../src/utils/paymentUtils';
import { formatDateTimeBySettings } from '../src/utils/dateTime';
import { resolveDefaultAccountFromMethod } from '../src/utils/paymentAccounts';

interface ViewCustomerProps {
    onNavigate: (page: string) => void;
    contactId?: string;
    initialTab?: string;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  transformOrigin: string;
  maxHeight?: number;
}

// Data Interfaces
interface Customer {
  id: string;
  businessName: string;
  name: string;
  email: string;
  taxNumber: string;
  creditLimit: number;
  payTerm: string;
  openingBalance: number;
  advanceBalance: number;
  addedOn: string;
  customerGroup: string;
  address: string;
  mobile: string;
  totalSellDue: number;
  totalSellReturnDue: number;
  status: 'Active' | 'Inactive';
}

interface ProductItem {
    id: number;
    name: string;
    qty: number;
    unitPrice: number;
    discount: number;
    tax: number;
    priceIncTax: number;
    subtotal: number;
    unit: string;
}

interface Transaction {
    date: string;
    timestamp: number;
    ref: string;
    type: 'Sell' | 'Payment' | 'Opening Balance' | 'Sell Return';
    location: string;
    status: string;
    debit: number;
    credit: number;
    method: string;
    others: string;
    linkedInvoices?: string[];
    products?: ProductItem[];
}

const ViewCustomer: React.FC<ViewCustomerProps> = ({ onNavigate, contactId, initialTab }) => {
  const { addNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState(initialTab === 'add-payment' ? 'payments' : (initialTab || 'ledger'));
  const [ledgerFormat, setLedgerFormat] = useState('Format 1');
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for Dynamic Customer Data
  const [customer, setCustomer] = useState<Customer | null>(null);

  // Account Summary Date State — defaults to current year
  const currentYear = new Date().getFullYear();
  const [summaryStartDate, setSummaryStartDate] = useState(`${currentYear}-01-01`);
  const [summaryEndDate, setSummaryEndDate] = useState(`${currentYear}-12-31`);

  // General Customer Payment Modal State (The one from Profile Card)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 16));
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAccount, setPaymentAccount] = useState('Cash Account');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentFileName, setPaymentFileName] = useState('');

  // Ledger filters
  const [locationFilter, setLocationFilter] = useState('all');

  // Sales tab filters
  const [salePayStatusFilter, setSalePayStatusFilter] = useState('All');

  // Documents tab state
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<{ id: string; heading: string } | null>(null);
  const [newDocHeading, setNewDocHeading] = useState('');

  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);

  // Sales Action States (Within the Sales Tab table)
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-right' });
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Sales Modals
  const [viewOrderModalOpen, setViewOrderModalOpen] = useState(false);
  const [packingSlipModalOpen, setPackingSlipModalOpen] = useState(false);
  const [deliveryNoteModalOpen, setDeliveryNoteModalOpen] = useState(false);
  const [editShippingModalOpen, setEditShippingModalOpen] = useState(false);
  const [addPaymentForSaleModalOpen, setAddPaymentForSaleModalOpen] = useState(false);
  const [viewPaymentsModalOpen, setViewPaymentsModalOpen] = useState(false);
  const [invoiceURLModalOpen, setInvoiceURLModalOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  // Payment Modals
  const [viewPaymentModalOpen, setViewPaymentModalOpen] = useState(false);
  const [editPaymentModalOpen, setEditPaymentModalOpen] = useState(false);
  const [deletePaymentModalOpen, setDeletePaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  // Pull all data from GlobalContext — single source of truth
  const {
    customers: allCustomers,
    sales: globalSales,
    sellReturns: globalSellReturns,
    payments: globalPayments,
    addPayment: globalAddPayment,
    updateCustomer: globalUpdateCustomer,
    updateSale: globalUpdateSale,
    deleteSale: globalDeleteSale,
    deletePayment: globalDeletePayment,
    updatePayment: globalUpdatePayment,
    currentUser,
    formatCurrency,
    locations,
    addDiscount: globalAddDiscount,
    generateId,
    settings,
  } = useGlobalContext();
  const currencyPrecision = clampPrecision(Number(settings.currencyPrecision ?? 3));

  const formatOMR = (amount: number) => formatCurrency(amount || 0);
  const formatRiyal = (amount: number) => formatCurrency(amount || 0);
  const parseDateValue = (value?: string): number => {
    if (!value) return 0;
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) return direct.getTime();

    const raw = String(value).trim();
    const dmyWithTime = raw.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T\s]+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i
    );
    if (!dmyWithTime) return 0;
    const day = Number(dmyWithTime[1]);
    const month = Number(dmyWithTime[2]) - 1;
    const year = Number(dmyWithTime[3]);
    const rawHour = Number(dmyWithTime[4] || 0);
    const minute = Number(dmyWithTime[5] || 0);
    const meridiem = String(dmyWithTime[6] || '').toUpperCase();
    const hour24 = meridiem ? ((rawHour % 12) + (meridiem === 'PM' ? 12 : 0)) : rawHour;
    const parsed = new Date(year, month, day, hour24, minute, 0, 0);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  };
  const toStartOfDay = (dateStr: string): number => {
    const parsed = new Date(`${dateStr}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? Number.NEGATIVE_INFINITY : parsed.getTime();
  };
  const toEndOfDay = (dateStr: string): number => {
    const parsed = new Date(`${dateStr}T23:59:59.999`);
    return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
  };
  const formatLedgerDate = (value?: string): string =>
    formatDateTimeBySettings(value, settings.dateFormat, settings.timeFormat, settings.timeZone);

  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Handle Outside Click for Customer Dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCustomersList = allCustomers.filter(c => 
    c.businessName.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    c.id.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    c.mobile.includes(customerSearchTerm)
  );

  const extractInvoiceFromText = (text: string): string | null => {
    const match = text.match(/\b(?:INV|CN)[-A-Z0-9/]+\b/i);
    return match ? match[0] : null;
  };

  // Real sales/returns/payments filtered by current customer — derived from GlobalContext
  const salesData = useMemo(() => {
    if (!customer) return [];
    const customerId = String(customer.id || '').trim();
    const businessName = customer.businessName.toLowerCase();
    const contactName = customer.name.toLowerCase();
    return globalSales
      .filter(s => {
        const saleCustomerId = String(s.customerId || '').trim();
        const saleName = String(s.customerName || '').toLowerCase();
        const saleNameMatches = saleName
          ? (
            saleName === businessName ||
            saleName === contactName ||
            saleName.includes(businessName) ||
            businessName.includes(saleName)
          )
          : false;
        return (
          saleCustomerId === customerId ||
          saleNameMatches
        );
      })
      .sort((a, b) => {
        const aTime = parseDateValue(a.date);
        const bTime = parseDateValue(b.date);
        return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
      });
  }, [customer, globalSales]);
  const isFinalizedSale = (sale?: any | null): boolean =>
    !!sale && String(sale.status || sale.saleStatus || '').trim() === 'Final';
  const finalizedSalesData = useMemo(
    () => salesData.filter(isFinalizedSale),
    [salesData]
  );
  const customerSellReturnsData = useMemo(() => {
    if (!customer) return [];
    const customerIdRef = String(customer.id || '').trim();
    const businessName = customer.businessName.toLowerCase();
    const contactName = customer.name.toLowerCase();
    return globalSellReturns
      .filter(record => {
        const customerId = String(record.customerId || '').trim();
        const customerName = String(record.customerName || '').toLowerCase();
        const customerNameMatches = customerName
          ? (
            customerName === businessName ||
            customerName === contactName ||
            customerName.includes(businessName) ||
            businessName.includes(customerName)
          )
          : false;
        return (
          customerId === customerIdRef ||
          customerNameMatches
        );
      })
      .sort((a, b) => {
        const aTime = parseDateValue(a.date);
        const bTime = parseDateValue(b.date);
        return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
      });
  }, [customer, globalSellReturns]);
  const activeSale = activeActionId && !activeActionId.startsWith('pay-')
    ? salesData.find(s => s.id === activeActionId)
    : undefined;
  const activeSaleIsFinal = isFinalizedSale(activeSale);

  const paymentsData = useMemo(() => {
    if (!customer) return [];
    return globalPayments
      .filter(p => p.contactType === 'Customer' && (p.contactId === customer.id || p.contactName === customer.businessName))
      .map(p => {
        const linkedInvoices = Array.isArray(p.linkedInvoices) ? p.linkedInvoices.filter(Boolean) : [];
        const parsedInvoice = extractInvoiceFromText(`${p.referenceNo || ''} ${p.note || ''}`);
        const invoiceNoDisplay = linkedInvoices[0] || parsedInvoice || '--';
        const invoiceExtraCount = linkedInvoices.length > 1 ? linkedInvoices.length - 1 : 0;
        const paymentTimestamp = parseDateValue(p.date);

        return {
          ...p,
          paidOn: p.date,
          refNo: p.referenceNo,
          paymentFor: p.note,
          invoiceNoDisplay,
          invoiceExtraCount,
          paymentTimestamp: Number.isFinite(paymentTimestamp) ? paymentTimestamp : 0,
        };
      })
      .sort((a, b) => b.paymentTimestamp - a.paymentTimestamp);
  }, [customer, globalPayments]);

  // Activities derived from real sales + payments + sell returns data
  const activitiesData = customer ? [
      // Each sale created = one activity row
      ...salesData.map(s => ({
          date: formatLedgerDate(s.date),
          action: s.status === 'Draft' ? 'Draft Created' : 'Sale Created',
          by: s.addedBy || currentUser?.name || 'Admin',
          note: `Invoice ${s.invoiceNo} — ${formatRiyal(s.grandTotal || 0)}`
      })),
      // Each sell return = one activity row
      ...customerSellReturnsData.map(r => ({
          date: formatLedgerDate(r.date),
          action: 'Sell Return',
          by: r.addedBy || currentUser?.name || 'Admin',
          note: `${r.referenceNo} — ${formatRiyal(r.total || 0)}`
      })),
      // Each payment received = one activity row
      ...paymentsData.map(p => ({
          date: formatLedgerDate(p.paidOn || p.date),
          action: 'Payment Received',
          by: p.addedBy || currentUser?.name || 'Admin',
          note: `${p.refNo} — ${formatRiyal(p.amount)} via ${p.method}`
      })),
      // Customer creation
      { date: customer.addedOn, action: 'Contact Added', by: customer.assignedTo || 'Admin', note: `Customer ${customer.businessName} created` },
  ].sort((a, b) => {
      const aTime = parseDateValue(a.date);
      const bTime = parseDateValue(b.date);
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  }) : [];

  // Documents from real customer.documents array (stored in GlobalContext)
  const documentsData = customer?.documents || [];

  // Document handlers
  const handleSaveDoc = () => {
      if (!newDocHeading.trim() || !customer) return;
      const now = formatLedgerDate(new Date().toISOString());
      let updatedDocs;
      if (editingDoc) {
          updatedDocs = documentsData.map(d => d.id === editingDoc.id ? { ...d, heading: newDocHeading.trim(), updatedAt: now } : d);
      } else {
          updatedDocs = [...documentsData, { id: `DOC-${Date.now()}`, heading: newDocHeading.trim(), addedBy: currentUser?.name || 'Admin', createdAt: now, updatedAt: now }];
      }
      globalUpdateCustomer({ ...(customer as any), documents: updatedDocs });
      setIsDocModalOpen(false);
      setNewDocHeading('');
      setEditingDoc(null);
  };

  const handleDeleteDoc = (docId: string) => {
      if (!customer || !window.confirm('Delete this document?')) return;
      const updatedDocs = documentsData.filter(d => d.id !== docId);
      globalUpdateCustomer({ ...(customer as any), documents: updatedDocs });
  };

  // Load Data
  useEffect(() => {
    if (contactId) {
        const found = allCustomers.find(c => c.id === contactId);
        setCustomer(found || allCustomers[0]); 
    } else {
        setCustomer(allCustomers[0]);
    }
  }, [contactId, allCustomers]);

  // Update active tab when prop changes
  useEffect(() => {
      if (!initialTab) return;
      if (initialTab === 'add-payment') {
        setActiveTab('payments');
        setIsPaymentModalOpen(true);
        return;
      }
      setActiveTab(initialTab);
  }, [initialTab]);

  // Handle Outside Click for Action Menu
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
        if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
            return;
        }
        setActiveActionId(null);
    };

    const handleScroll = () => setActiveActionId(null);
    const handleResize = () => setActiveActionId(null);
    
    if (activeActionId) {
        window.addEventListener('mousedown', handleOutsideClick);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
    }
    return () => {
        window.removeEventListener('mousedown', handleOutsideClick);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
    };
  }, [activeActionId]);

  // Action Handlers
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

  const handleViewDetails = (saleId: string) => {
      setSelectedSaleId(saleId);
      setViewOrderModalOpen(true);
      setActiveActionId(null);
  };
  
  const handleEditSale = (saleId: string) => {
    if (onNavigate) {
      onNavigate(`edit-sale/${saleId}`);
    }
    setActiveActionId(null);
  };

  const handleDeleteSale = (saleId: string) => {
      if(confirm("Are you sure you want to delete this sale?")) {
         globalDeleteSale(saleId); // restores stock + updates customer balance via GlobalContext
      }
      setActiveActionId(null);
  }

  const handlePackingSlip = (saleId: string) => {
      const sale = salesData.find(s => s.id === saleId);
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
      const sale = salesData.find(s => s.id === saleId);
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
      const sale = salesData.find(s => s.id === saleId);
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
  
  const handleAddPaymentForSale = (saleId: string) => {
      const sale = salesData.find(s => s.id === saleId);
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
      setAddPaymentForSaleModalOpen(true);
      setActiveActionId(null);
  };

  const handleViewPayments = (saleId: string) => {
      const sale = salesData.find(s => s.id === saleId);
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

  const handleSellReturn = (saleId: string) => {
      const sale = salesData.find(s => s.id === saleId);
      if (!isFinalizedSale(sale)) {
        addNotification({
          title: 'Action blocked',
          message: 'Sell Return can only be created from Final sales.',
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

  const handleInvoiceURL = (saleId: string) => {
      setSelectedSaleId(saleId);
      setInvoiceURLModalOpen(true);
      setActiveActionId(null);
  };

  const handleViewPayment = (payment: any) => {
      setSelectedPayment(payment);
      setViewPaymentModalOpen(true);
      setActiveActionId(null);
  };

  const handleEditPayment = (payment: any) => {
      setSelectedPayment(payment);
      setEditPaymentModalOpen(true);
      setActiveActionId(null);
  };

  const handleDeletePaymentClick = (payment: any) => {
      setSelectedPayment(payment);
      setDeletePaymentModalOpen(true);
      setActiveActionId(null);
  };

  const handleDeletePaymentConfirm = () => {
      if (selectedPayment) {
          globalDeletePayment(selectedPayment.id); // removes payment from GlobalContext
      }
      setDeletePaymentModalOpen(false);
      setSelectedPayment(null);
  };

  const handleSaveEditedPayment = (updatedPayment: any) => {
      const normalized = {
          ...updatedPayment,
          referenceNo: updatedPayment.referenceNo || updatedPayment.refNo,
          date: String(updatedPayment.paidOn || updatedPayment.date || ''),
      };
      globalUpdatePayment(normalized);
  };

  const handlePayClick = () => {
    setPaymentAmount(customer?.totalSellDue.toString() || '0');
    setPaymentMethod('Cash');
    setPaymentAccount(resolveDefaultAccountFromMethod('Cash'));
    setPaymentDate(new Date().toISOString().slice(0, 16));
    setIsPaymentModalOpen(true);
  };

  useEffect(() => {
    const resolvedAccount = resolveDefaultAccountFromMethod(paymentMethod || 'Cash');
    if (paymentAccount !== resolvedAccount) {
      setPaymentAccount(resolvedAccount);
    }
  }, [paymentMethod]);

  const processPayment = () => {
    if (!customer) return;

    const amountPaid = parseFloat(paymentAmount || '0');
    if (isNaN(amountPaid) || amountPaid <= 0) return;
    const roundedAmount = Number(toFixedPrecision(amountPaid, currencyPrecision));
    const paymentPrefix = normalizePrefix(settings.sellPaymentPrefix || settings.paymentPrefix, 'PAY');

    let remaining = roundedAmount;
    const dueSales = finalizedSalesData
      .filter(sale => ['Due', 'Partial', 'Overdue'].includes(String(sale.paymentStatus || '')))
      .sort((a, b) => {
        const aTime = parseDateValue(a.date);
        const bTime = parseDateValue(b.date);
        return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
      });
    const linkedInvoices: string[] = [];
    dueSales.forEach(sale => {
      if (remaining <= 0) return;
      const due = typeof sale.sellDue === 'number'
        ? Math.max(0, sale.sellDue)
        : Math.max(0, (sale.grandTotal || sale.totalAmount || 0) - (sale.totalPaid || 0));
      if (due <= 0) return;
      const settled = Math.min(remaining, due);
      if (settled > 0 && sale.invoiceNo) linkedInvoices.push(String(sale.invoiceNo));
      remaining -= settled;
    });
    const uniqueLinkedInvoices = Array.from(new Set(linkedInvoices));
    const primaryLinkedSale = uniqueLinkedInvoices.length > 0
      ? salesData.find(sale => uniqueLinkedInvoices.includes(String(sale.invoiceNo || '').trim()))
      : undefined;
    const latestSale = [...finalizedSalesData].sort((a, b) => {
      const aTime = parseDateValue(a.date);
      const bTime = parseDateValue(b.date);
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    })[0];

    // GlobalContext addPayment handles: FIFO invoice distribution,
    // customer balance update, and localStorage persistence automatically
    globalAddPayment({
        id: `PAY-${Date.now()}`,
        date: paymentDate || new Date().toISOString().slice(0, 16),
        contactId: customer.id,
        contactName: customer.businessName,
        contactType: 'Customer',
        amount: roundedAmount,
        method: paymentMethod,
        account: String(paymentAccount || '').trim() || resolveDefaultAccountFromMethod(paymentMethod || 'Cash'),
        location: primaryLinkedSale?.location || latestSale?.location || '',
        referenceNo: `${paymentPrefix}-${Date.now().toString().slice(-6)}`,
        note: paymentNote,
        type: 'received',
        addedBy: currentUser?.name || 'Admin',
        attachmentName: paymentFileName || undefined,
        linkedInvoices: uniqueLinkedInvoices,
    });

    setIsPaymentModalOpen(false);
    setPaymentAmount('');
    setPaymentNote('');
    setPaymentFileName('');
  };

  const invoiceLocationByNo = useMemo(() => {
    const map = new Map<string, string>();
    finalizedSalesData.forEach(sale => {
      const invoiceNo = String(sale.invoiceNo || '').trim();
      if (!invoiceNo) return;
      map.set(invoiceNo, String(sale.location || '').trim());
    });
    return map;
  }, [finalizedSalesData]);

  // Build ledger transactions from real GlobalContext data (sales + sell returns + payments)
  const transactions = useMemo<Transaction[]>(() => {
    if (!customer) return [];
    const rows: Transaction[] = [];

    if (Number(customer.openingBalance || 0) !== 0) {
      const openingDate = String(customer.addedOn || `${currentYear}-01-01`).trim();
      const openingTimestamp = parseDateValue(openingDate);
      const openingAmount = Number(customer.openingBalance || 0);
      rows.push({
        date: openingDate,
        timestamp: Number.isFinite(openingTimestamp) ? openingTimestamp : 0,
        ref: 'OPENING',
        type: 'Opening Balance',
        location: 'All locations',
        status: '',
        debit: openingAmount > 0 ? openingAmount : 0,
        credit: openingAmount < 0 ? Math.abs(openingAmount) : 0,
        method: '',
        others: 'Opening balance',
      });
    }

    finalizedSalesData.forEach((sale) => {
      const ts = parseDateValue(sale.date);
      rows.push({
        date: sale.date,
        timestamp: Number.isFinite(ts) ? ts : 0,
        ref: sale.invoiceNo,
        type: 'Sell',
        location: String(sale.location || '').trim(),
        status: String(sale.paymentStatus || ''),
        debit: Number(sale.grandTotal || sale.totalAmount || 0),
        credit: 0,
        method: sale.paymentMethod || 'Credit',
        others: sale.sellNote || '',
        linkedInvoices: sale.invoiceNo ? [String(sale.invoiceNo)] : [],
        products: (sale.items || []).map((item: any, idx: number) => ({
          id: idx + 1,
          name: item.name,
          qty: item.qty,
          unit: item.unit || 'Pc(s)',
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          tax: item.tax || 0,
          priceIncTax: item.unitPrice,
          subtotal: item.subtotal || item.total || 0,
        })),
      });
    });

    customerSellReturnsData.forEach((record) => {
      const ts = parseDateValue(record.date);
      rows.push({
        date: record.date,
        timestamp: Number.isFinite(ts) ? ts : 0,
        ref: record.referenceNo,
        type: 'Sell Return',
        location: String(record.location || '').trim(),
        status: String(record.paymentStatus || ''),
        debit: 0,
        credit: Number(record.total || 0),
        method: record.settlementMode || '--',
        others: record.parentInvoiceNo
          ? `Return against ${record.parentInvoiceNo}`
          : (record.note || ''),
        linkedInvoices: record.parentInvoiceNo ? [String(record.parentInvoiceNo)] : [],
        products: (record.items || []).map((item: any, idx: number) => ({
          id: idx + 1,
          name: item.productName || item.name || '--',
          qty: item.qty || 0,
          unit: item.unit || 'Pc(s)',
          unitPrice: item.unitPrice || 0,
          discount: 0,
          tax: 0,
          priceIncTax: item.unitPrice || 0,
          subtotal: item.lineTotal || 0,
        })),
      });
    });

    paymentsData.forEach((payment) => {
      const linkedInvoices = Array.isArray(payment.linkedInvoices)
        ? payment.linkedInvoices.filter(Boolean).map((inv: string) => String(inv).trim())
        : [];
      const fallbackLocation = linkedInvoices
        .map((invoiceNo: string) => invoiceLocationByNo.get(invoiceNo))
        .find(Boolean);
      const ts = Number.isFinite(payment.paymentTimestamp)
        ? payment.paymentTimestamp
        : parseDateValue(payment.date);
      rows.push({
        date: payment.date,
        timestamp: Number.isFinite(ts) ? ts : 0,
        ref: payment.referenceNo,
        type: 'Payment',
        location: String(payment.location || fallbackLocation || '').trim(),
        status: 'Paid',
        debit: 0,
        credit: Number(payment.amount || 0),
        method: payment.method || '--',
        others: linkedInvoices.length > 0
          ? `Payment For: ${linkedInvoices.join(', ')}`
          : (payment.note || ''),
        linkedInvoices,
      });
    });

    const sortPriority: Record<Transaction['type'], number> = {
      'Opening Balance': 0,
      Sell: 1,
      'Sell Return': 2,
      Payment: 3,
    };
    return rows.sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return sortPriority[a.type] - sortPriority[b.type];
    });
  }, [customer, currentYear, finalizedSalesData, customerSellReturnsData, paymentsData, invoiceLocationByNo]);

  const fromTime = summaryStartDate ? toStartOfDay(summaryStartDate) : Number.NEGATIVE_INFINITY;
  const toTime = summaryEndDate ? toEndOfDay(summaryEndDate) : Number.POSITIVE_INFINITY;
  const locationMatches = (row: Transaction): boolean => {
    if (locationFilter === 'all') return true;
    if (row.type === 'Opening Balance') return true;
    if (String(row.location || '').trim() === locationFilter) return true;
    if (row.type === 'Payment' && Array.isArray(row.linkedInvoices) && row.linkedInvoices.length > 0) {
      return row.linkedInvoices.some(invoiceNo => invoiceLocationByNo.get(invoiceNo) === locationFilter);
    }
    return false;
  };

  const openingBalanceBf = transactions.reduce((acc, row) => {
    if (!locationMatches(row)) return acc;
    if (row.timestamp >= fromTime) return acc;
    return acc + (row.debit - row.credit);
  }, 0);

  const filteredTransactions = transactions.filter(row => {
    if (!locationMatches(row)) return false;
    return row.timestamp >= fromTime && row.timestamp <= toTime;
  });

  // Period totals
  const totalDebit = filteredTransactions.reduce((acc, row) => acc + row.debit, 0);
  const totalCredit = filteredTransactions.reduce((acc, row) => acc + row.credit, 0);
  const balanceDue = openingBalanceBf + totalDebit - totalCredit;
  const filteredInvoiceTotal = filteredTransactions
    .filter(row => row.type === 'Sell')
    .reduce((acc, row) => acc + row.debit, 0);
  const filteredPaidTotal = filteredTransactions
    .filter(row => row.type === 'Payment')
    .reduce((acc, row) => acc + row.credit, 0);
  const filteredReturnTotal = filteredTransactions
    .filter(row => row.type === 'Sell Return')
    .reduce((acc, row) => acc + row.credit, 0);
  const filteredNetInvoice = filteredInvoiceTotal - filteredReturnTotal;

  const overallOpeningTotal = transactions
    .filter(row => row.type === 'Opening Balance')
    .reduce((acc, row) => acc + (row.debit - row.credit), 0);
  const overallInvoiceTotal = transactions
    .filter(row => row.type === 'Sell')
    .reduce((acc, row) => acc + row.debit, 0);
  const overallPaidTotal = transactions
    .filter(row => row.type === 'Payment')
    .reduce((acc, row) => acc + row.credit, 0);
  const overallReturnTotal = transactions
    .filter(row => row.type === 'Sell Return')
    .reduce((acc, row) => acc + row.credit, 0);
  const overallNetInvoice = overallInvoiceTotal - overallReturnTotal;
  const overallBalanceRaw = overallOpeningTotal + overallNetInvoice - overallPaidTotal;
  const overallSafeBalanceDue = Math.max(0, Number(overallBalanceRaw || 0));

  // Running Balance (Receivable): Debit increases balance, Credit decreases balance
  let rolling = openingBalanceBf;
  const transactionsWithBalance = filteredTransactions.map(row => {
    rolling += (row.debit - row.credit);
    return { ...row, balance: rolling };
  });
  const runningBalance = transactionsWithBalance.length > 0
    ? transactionsWithBalance[transactionsWithBalance.length - 1].balance
    : openingBalanceBf;
  const safeBalanceDue = Math.max(0, Number(balanceDue || 0));
  const filteredCustomerCredit = Math.max(0, Number(balanceDue < 0 ? Math.abs(balanceDue) : 0));
  const availableCustomerCredit = Math.max(0, Number(customer?.advanceBalance || 0));
  const overallCarryForwardCredit = Math.max(
    0,
    availableCustomerCredit,
    Number(overallBalanceRaw < 0 ? Math.abs(overallBalanceRaw) : 0),
  );
  const ledgerEmailSubject = encodeURIComponent(`Account Statement - ${customer?.businessName || ''}`);
  const ledgerEmailBody = encodeURIComponent([
    `Dear ${customer?.name || ''},`,
    '',
    'Please find your account overall summary below.',
    '',
    `Total invoice: ${formatRiyal(overallInvoiceTotal)}`,
    `Total return: ${formatRiyal(overallReturnTotal)}`,
    `Total paid: ${formatRiyal(overallPaidTotal)}`,
    `Balance due: ${formatRiyal(overallSafeBalanceDue)}`,
    `Customer credit: ${formatRiyal(overallCarryForwardCredit)}`,
    '',
    'Regards,',
    'ATWAR AL MUSTAQBAL',
  ].join('\n'));

  // Helper to adapt sale object for AddPaymentModal
  const getSelectedSaleForPayment = () => {
      const sale = salesData.find(s => s.id === selectedSaleId);
      if (!sale) return null;
      return {
          customerId: customer?.id || sale.customerId?.toString() || '',
          customerName: customer?.businessName,
          businessName: customer?.businessName,
          invoiceNo: sale.invoiceNo,
          location: sale.location || '',
          grandTotal: sale.grandTotal || sale.totalAmount || 0,
          totalAmount: sale.grandTotal,
          sellDue: sale.sellDue ?? sale.grandTotal,
          sellNote: sale.sellNote || ''
      };
  };

  if (!customer) return <div className="p-10 text-center">Loading customer data...</div>;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
                <button onClick={() => onNavigate('customers')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-2xl shadow-md">
                    <Users size={20} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">View Customer</h2>
                </div>
            </div>
            
            <div className="relative" ref={customerDropdownRef}>
                <button 
                  onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                  className="flex items-center justify-between pl-4 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-sm font-bold text-slate-700 min-w-[300px] hover:bg-slate-50 transition-colors"
                >
                    <span className="truncate max-w-[250px]">{customer.businessName} ({customer.id})</span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isCustomerDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCustomerDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-full min-w-[300px] bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 border-b border-slate-100">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                          type="text" 
                          placeholder="Search customers..." 
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border-transparent rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                          value={customerSearchTerm}
                          onChange={(e) => setCustomerSearchTerm(e.target.value)}
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                      {filteredCustomersList.length > 0 ? (
                        filteredCustomersList.map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              onNavigate(`view-customer/${c.id}`);
                              setIsCustomerDropdownOpen(false);
                              setCustomerSearchTerm('');
                            }}
                            className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 flex flex-col ${c.id === customer.id ? 'bg-blue-50/50' : ''}`}
                          >
                            <span className={`font-bold ${c.id === customer.id ? 'text-blue-700' : 'text-slate-800'}`}>
                              {c.businessName}
                            </span>
                            <span className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                              <span className="font-mono">{c.id}</span>
                              {c.mobile && <span>• {c.mobile}</span>}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-slate-500 italic">
                          No customers found
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                        <User size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900">{customer.businessName}</h3>
                        <p className="text-sm text-slate-500 flex items-center gap-2">
                             <Briefcase size={12} /> {customer.customerGroup}
                             <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${customer.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                {customer.status}
                             </span>
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handlePayClick}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition shadow-sm flex items-center gap-2"
                    >
                        <CreditCard size={16} /> Pay
                    </button>
                    <button 
                        onClick={() => setIsDiscountModalOpen(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm flex items-center gap-2"
                    >
                        Add Discount
                    </button>
                </div>
            </div>

            {/* Detailed Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-8 pt-6 border-t border-slate-100">
                <div className="space-y-3">
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Contact Person</span>
                        <div className="text-sm font-bold text-slate-800">{customer.name}</div>
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Email</span>
                        <div className="text-sm font-medium text-slate-700 flex items-center gap-1">
                             <Mail size={12} className="text-slate-400" /> {customer.email || '--'}
                        </div>
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Mobile</span>
                        <div className="text-sm font-medium text-slate-700 flex items-center gap-1">
                             <Phone size={12} className="text-slate-400" /> {customer.mobile}
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Tax Number</span>
                        <div className="text-sm font-bold text-slate-800 font-mono">{customer.taxNumber || '--'}</div>
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Pay Term</span>
                        <div className="text-sm font-medium text-slate-700 flex items-center gap-1">
                             <Clock size={12} className="text-slate-400" /> {customer.payTerm}
                        </div>
                    </div>
                     <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Added On</span>
                        <div className="text-sm font-medium text-slate-700">{customer.addedOn}</div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Credit Limit</span>
                        <div className="text-sm font-bold text-slate-800">{customer.creditLimit ? formatOMR(customer.creditLimit) : 'No Limit'}</div>
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Opening Balance</span>
                        <div className="text-sm font-bold text-slate-600">{formatOMR(customer.openingBalance)}</div>
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Advance Balance</span>
                        <div className="text-sm font-bold text-emerald-600">{formatOMR(customer.advanceBalance)}</div>
                    </div>
                </div>

                <div className="space-y-3">
                     <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Total Sell Due</span>
                        <div className="text-sm font-black text-red-600">{formatOMR(customer.totalSellDue)}</div>
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Total Return Due</span>
                        <div className="text-sm font-black text-amber-600">{formatOMR(customer.totalSellReturnDue)}</div>
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Address</span>
                        <div className="text-xs font-medium text-slate-700 flex items-start gap-1">
                             <MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" /> 
                             {customer.address || '--'}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-slate-200 bg-white rounded-t-xl overflow-hidden">
            {[
                { id: 'ledger', label: 'Ledger', icon: FileText },
                { id: 'sales', label: 'Sales', icon: ShoppingBag },
                { id: 'docs', label: 'Documents & Note', icon: StickyNote },
                { id: 'payments', label: 'Payments', icon: CreditCard },
                { id: 'activities', label: 'Activities', icon: Activity },
            ].map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
                        activeTab === tab.id 
                        ? 'border-blue-600 text-blue-600 bg-blue-50/50' 
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                    <tab.icon size={16} />
                    {tab.label}
                </button>
            ))}
        </div>

        {/* Tab Content: Ledger */}
        {activeTab === 'ledger' && (
            <div id="customer-ledger-print" className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm overflow-hidden animate-in fade-in print:rounded-none print:border-0 print:shadow-none print:animate-none">
                <style>{`
                  @media print {
                    @page { size: A4; margin: 8mm; }
                    body * { visibility: hidden !important; }
                    #customer-ledger-print, #customer-ledger-print * { visibility: visible !important; }
                    #customer-ledger-print {
                      position: absolute !important;
                      left: 0 !important;
                      top: 0 !important;
                      width: 100% !important;
                      border: 0 !important;
                      box-shadow: none !important;
                    }
                  }
                `}</style>
                
                {/* Ledger Toolbar */}
                <div className="p-6 border-b border-slate-100 flex flex-col xl:flex-row justify-between gap-6 print:hidden">
                    <div className="flex flex-col gap-4 flex-1">
                        <DateRangeFilter onRangeSelect={(range) => {
                            if (range.startDate) setSummaryStartDate(range.startDate.toISOString().split('T')[0]);
                            if (range.endDate) setSummaryEndDate(range.endDate.toISOString().split('T')[0]);
                        }} />
                        
                        <div className="flex items-center gap-4 text-sm">
                            <span className="font-bold text-slate-700">Ledger format:</span>
                            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                {['Format 1', 'Format 2', 'Format 3'].map(fmt => (
                                    <button
                                        key={fmt}
                                        onClick={() => setLedgerFormat(fmt)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                            ledgerFormat === fmt ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        {fmt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 flex-1">
                         <div className="group">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Business Location:</label>
                            <select
                                className="w-full px-3 py-2 rounded border border-slate-300 text-sm outline-none bg-white"
                                value={locationFilter}
                                onChange={(e) => setLocationFilter(e.target.value)}
                            >
                                <option value="all">All locations</option>
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col items-end justify-start gap-2">
                         <div className="flex gap-2">
                             <button
                                 onClick={() => window.print()}
                                 className="p-2 border border-slate-300 rounded hover:bg-slate-50 text-slate-600"
                                 title="Print / Save as PDF"
                             >
                                 <FileText size={16} />
                             </button>
                             <button
                                 onClick={() => customer && window.open(`mailto:${customer.email}?subject=${ledgerEmailSubject}&body=${ledgerEmailBody}`)}
                                 className="p-2 border border-slate-300 rounded hover:bg-slate-50 text-slate-600"
                                 title="Email ledger to customer"
                             >
                                 <Mail size={16} />
                             </button>
                         </div>
                    </div>
                </div>
                
                 {/* Summary Section */}
                <div className="p-6 bg-slate-50 border-b border-slate-200 print:hidden">
                    <div className="flex flex-col xl:flex-row gap-8">
                        <div className="flex-1">
                            <h4 className="font-bold text-slate-900 bg-[#0f4c75] text-white px-3 py-1.5 text-sm inline-block w-full mb-4">
                                To:
                            </h4>
                            <div className="text-sm font-bold text-slate-800">{customer.businessName}</div>
                            <div className="text-xs text-slate-600">Mobile: {customer.mobile}</div>
                        </div>

                        <div className="flex-1 text-right">
                             <div className="text-sm font-bold text-slate-800">{settings?.businessName || 'ATWAR AL MUSTAQBAL'}</div>
                             {(settings?.businessAddress || settings?.address) && <div className="text-xs text-slate-600">{settings.businessAddress || settings.address}</div>}
                             {settings?.businessCity && <div className="text-xs text-slate-600">{settings.businessCity}, Oman</div>}
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="border border-slate-300 bg-white">
                            <div className="bg-[#0f4c75] text-white px-4 py-2 font-bold text-sm">
                                By Filter
                            </div>
                            <div className="px-4 py-2 text-[11px] text-slate-500 border-b border-slate-200">
                                Date: {summaryStartDate} - {summaryEndDate} | Location: {locationFilter === 'all' ? 'All locations' : locationFilter}
                            </div>
                            <div className="p-4 text-xs space-y-2">
                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                    <span className="font-medium text-slate-600">Total invoice</span>
                                    <span className="font-bold text-slate-800">{formatOMR(filteredInvoiceTotal)}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                    <span className="font-medium text-slate-600">Total return</span>
                                    <span className="font-bold text-amber-700">{formatOMR(filteredReturnTotal)}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                    <span className="font-medium text-slate-600">Total paid</span>
                                    <span className="font-bold text-emerald-700">{formatOMR(filteredPaidTotal)}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                    <span className="font-medium text-slate-600">Net invoice</span>
                                    <span className="font-bold text-slate-800">{formatOMR(filteredNetInvoice)}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                    <span className="font-medium text-slate-600">Balance due</span>
                                    <span className={`font-bold ${safeBalanceDue > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatOMR(safeBalanceDue)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium text-slate-600">Customer credit</span>
                                    <span className="font-bold text-blue-700">{formatOMR(filteredCustomerCredit)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="border border-slate-300 bg-white">
                            <div className="bg-slate-100 text-slate-700 px-4 py-2 font-bold text-sm border-b border-slate-300">
                                Overall Summary
                            </div>
                            <div className="px-4 py-2 text-[11px] text-slate-500 border-b border-slate-200">
                                From onboarding ({customer.addedOn}) until now | All locations
                            </div>
                            <div className="p-4 text-xs space-y-2">
                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                    <span className="font-medium text-slate-600">Total invoice</span>
                                    <span className="font-bold text-slate-800">{formatOMR(overallInvoiceTotal)}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                    <span className="font-medium text-slate-600">Total return</span>
                                    <span className="font-bold text-amber-700">{formatOMR(overallReturnTotal)}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                    <span className="font-medium text-slate-600">Total paid</span>
                                    <span className="font-bold text-emerald-700">{formatOMR(overallPaidTotal)}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                    <span className="font-medium text-slate-600">Net invoice</span>
                                    <span className="font-bold text-slate-800">{formatOMR(overallNetInvoice)}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                    <span className="font-medium text-slate-600">Balance due</span>
                                    <span className={`font-bold ${overallSafeBalanceDue > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatOMR(overallSafeBalanceDue)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium text-slate-600">Customer credit</span>
                                    <span className="font-bold text-blue-700">{formatOMR(overallCarryForwardCredit)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Print Statement (A4) */}
                <div className="hidden print:block border-b border-slate-300 px-2 pb-2">
                    <div className="text-center py-1">
                        <h3 className="text-[14px] font-black tracking-wide text-slate-900">Customer Ledger Statement</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[10px] text-slate-700 border-t border-slate-200 pt-2">
                        <div><span className="font-bold">Business:</span> {settings?.businessName || 'ATWAR AL MUSTAQBAL'}</div>
                        <div><span className="font-bold">Date Range:</span> {summaryStartDate} - {summaryEndDate}</div>
                        <div><span className="font-bold">Customer:</span> {customer.businessName}</div>
                        <div><span className="font-bold">Location:</span> {locationFilter === 'all' ? 'All locations' : locationFilter}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                        <div className="border border-slate-300 p-2">
                            <div className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-1">By Filter</div>
                            <div className="text-slate-500 pb-1 mb-1 border-b border-slate-100">Date: {summaryStartDate} - {summaryEndDate} | Location: {locationFilter === 'all' ? 'All locations' : locationFilter}</div>
                            <div className="flex justify-between"><span>Total invoice</span><span className="font-bold">{formatOMR(filteredInvoiceTotal)}</span></div>
                            <div className="flex justify-between"><span>Total return</span><span className="font-bold">{formatOMR(filteredReturnTotal)}</span></div>
                            <div className="flex justify-between"><span>Total paid</span><span className="font-bold">{formatOMR(filteredPaidTotal)}</span></div>
                            <div className="flex justify-between"><span>Net invoice</span><span className="font-bold">{formatOMR(filteredNetInvoice)}</span></div>
                            <div className="flex justify-between"><span>Balance due</span><span className="font-bold">{formatOMR(safeBalanceDue)}</span></div>
                            <div className="flex justify-between"><span>Customer credit</span><span className="font-bold">{formatOMR(filteredCustomerCredit)}</span></div>
                        </div>
                        <div className="border border-slate-300 p-2">
                            <div className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-1">Overall Summary</div>
                            <div className="flex justify-between"><span>Total invoice</span><span className="font-bold">{formatOMR(overallInvoiceTotal)}</span></div>
                            <div className="flex justify-between"><span>Total return</span><span className="font-bold">{formatOMR(overallReturnTotal)}</span></div>
                            <div className="flex justify-between"><span>Total paid</span><span className="font-bold">{formatOMR(overallPaidTotal)}</span></div>
                            <div className="flex justify-between"><span>Net invoice</span><span className="font-bold">{formatOMR(overallNetInvoice)}</span></div>
                            <div className="flex justify-between"><span>Balance due</span><span className="font-bold">{formatOMR(overallSafeBalanceDue)}</span></div>
                            <div className="flex justify-between"><span>Customer credit</span><span className="font-bold">{formatOMR(overallCarryForwardCredit)}</span></div>
                        </div>
                    </div>
                </div>

                <div className="hidden print:block">
                    <table className="w-full text-[9px] text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-700">
                            <tr>
                                <th className="px-2 py-1.5 border-b border-slate-300">Date</th>
                                <th className="px-2 py-1.5 border-b border-slate-300">Ref</th>
                                <th className="px-2 py-1.5 border-b border-slate-300">Type</th>
                                <th className="px-2 py-1.5 border-b border-slate-300">Description</th>
                                <th className="px-2 py-1.5 border-b border-slate-300 text-right">Debit</th>
                                <th className="px-2 py-1.5 border-b border-slate-300 text-right">Credit</th>
                                <th className="px-2 py-1.5 border-b border-slate-300 text-right">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactionsWithBalance.map((txn, idx) => (
                                <tr key={`print-${idx}`}>
                                    <td className="px-2 py-1 border-b border-slate-200 whitespace-nowrap">{formatLedgerDate(txn.date)}</td>
                                    <td className="px-2 py-1 border-b border-slate-200 whitespace-nowrap">{txn.ref || '--'}</td>
                                    <td className="px-2 py-1 border-b border-slate-200 whitespace-nowrap">{txn.type}</td>
                                    <td className="px-2 py-1 border-b border-slate-200">{txn.others || '--'}</td>
                                    <td className="px-2 py-1 border-b border-slate-200 text-right">{txn.debit > 0 ? formatRiyal(txn.debit) : ''}</td>
                                    <td className="px-2 py-1 border-b border-slate-200 text-right">{txn.credit > 0 ? formatRiyal(txn.credit) : ''}</td>
                                    <td className="px-2 py-1 border-b border-slate-200 text-right font-bold">
                                        {formatRiyal(Math.abs(txn.balance))} {txn.balance >= 0 ? 'DR' : 'CR'}
                                    </td>
                                </tr>
                            ))}
                            {transactionsWithBalance.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-2 py-6 text-center text-slate-400 italic">No ledger data for the selected period.</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-100 font-bold">
                                <td colSpan={4} className="px-2 py-1.5 text-right">Totals</td>
                                <td className="px-2 py-1.5 text-right">{formatRiyal(totalDebit)}</td>
                                <td className="px-2 py-1.5 text-right">{formatRiyal(totalCredit)}</td>
                                <td className="px-2 py-1.5 text-right">{formatRiyal(Math.abs(runningBalance))} {runningBalance >= 0 ? 'DR' : 'CR'}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Ledger Table - Format 1 */}
                {ledgerFormat === 'Format 1' && (
                    <div className="overflow-x-auto print:hidden">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-[#0f4c75] text-white font-bold">
                                <tr>
                                    <th className="px-4 py-3 whitespace-nowrap">Date</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Reference No</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Type</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Location</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Payment Status</th>
                                    <th className="px-4 py-3 whitespace-nowrap text-right">Debit</th>
                                    <th className="px-4 py-3 whitespace-nowrap text-right">Credit</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Payment Method</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Others</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {transactionsWithBalance.map((txn, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatLedgerDate(txn.date)}</td>
                                        <td className="px-4 py-3 text-blue-600 font-medium whitespace-nowrap cursor-pointer hover:underline">{txn.ref}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{txn.type}</td>
                                        <td className="px-4 py-3 text-[10px] text-slate-500 whitespace-nowrap">{txn.location}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {txn.status ? (
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white ${
                                                    txn.status === 'Paid' ? 'bg-emerald-500' :
                                                    txn.status === 'Partial' ? 'bg-sky-500' :
                                                    txn.status === 'Overdue' ? 'bg-red-500' :
                                                    txn.status === 'Due' ? 'bg-amber-500' : 'bg-slate-400'
                                                }`}>{txn.status}</span>
                                            ) : ''}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                                            {txn.debit > 0 ? formatRiyal(txn.debit) : ''}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                                            {txn.credit > 0 ? formatRiyal(txn.credit) : ''}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">{txn.method}</td>
                                        <td className="px-4 py-3 text-[10px] text-slate-500 whitespace-nowrap">{txn.others}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                                <tr>
                                    <td colSpan={5} className="px-4 py-3 text-right text-slate-600">Balance:</td>
                                    <td className="px-4 py-3 text-right text-slate-800">{formatRiyal(totalDebit)}</td>
                                    <td className="px-4 py-3 text-right text-slate-800">{formatRiyal(totalCredit)}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                {/* Ledger Table - Format 2 */}
                {ledgerFormat === 'Format 2' && (
                    <div className="overflow-x-auto print:hidden">
                        <table className="w-full text-[11px] text-left border-collapse">
                            <thead className="bg-[#0f4c75] text-white font-bold">
                                <tr>
                                    <th className="px-4 py-2 whitespace-nowrap">Date</th>
                                    <th className="px-4 py-2 whitespace-nowrap">Reference No</th>
                                    <th className="px-4 py-2 whitespace-nowrap">Type</th>
                                    <th className="px-4 py-2 whitespace-nowrap">Location</th>
                                    <th className="px-4 py-2 whitespace-nowrap">Payment Status</th>
                                    <th className="px-4 py-2 whitespace-nowrap text-right">Debit</th>
                                    <th className="px-4 py-2 whitespace-nowrap text-right">Credit</th>
                                    <th className="px-4 py-2 whitespace-nowrap text-right bg-slate-900/30">Balance</th>
                                    <th className="px-4 py-2 whitespace-nowrap">Payment Method</th>
                                    <th className="px-4 py-2 whitespace-nowrap">Others</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {transactionsWithBalance.map((txn, idx) => (
                                    <React.Fragment key={idx}>
                                        <tr className="bg-white hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatLedgerDate(txn.date)}</td>
                                            <td className="px-4 py-3 text-blue-600 font-bold whitespace-nowrap">{txn.ref}</td>
                                            <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">{txn.type}</td>
                                            <td className="px-4 py-3 text-[10px] text-slate-500 whitespace-nowrap">{txn.location}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                            {txn.status ? (
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white ${
                                                    txn.status === 'Paid' ? 'bg-emerald-500' :
                                                    txn.status === 'Partial' ? 'bg-sky-500' :
                                                    txn.status === 'Overdue' ? 'bg-red-500' :
                                                    txn.status === 'Due' ? 'bg-amber-500' : 'bg-slate-400'
                                                }`}>{txn.status}</span>
                                            ) : ''}
                                        </td>
                                            <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-slate-800">
                                                {txn.debit > 0 ? formatRiyal(txn.debit) : ''}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-slate-800">
                                                {txn.credit > 0 ? formatRiyal(txn.credit) : ''}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-900 bg-slate-50 whitespace-nowrap border-l border-slate-200">
                                                {formatRiyal(Math.abs(txn.balance))} <span className="text-[9px] text-slate-400">{txn.balance >= 0 ? 'DR' : 'CR'}</span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">{txn.method}</td>
                                            <td className="px-4 py-3 text-[10px] text-slate-500 whitespace-nowrap">{txn.others}</td>
                                        </tr>
                                        {/* Product Details Row - Only for Sell */}
                                        {txn.type === 'Sell' && txn.products && (
                                            <tr className="bg-white">
                                                <td colSpan={10} className="px-4 pb-4 pt-0 border-b border-slate-200">
                                                    <div className="pl-4 border-l-4 border-slate-200 ml-4 mt-2">
                                                        <table className="w-full text-[10px]">
                                                            <thead>
                                                                <tr className="text-slate-500 border-b border-slate-100">
                                                                    <th className="py-1 text-left w-8">#</th>
                                                                    <th className="py-1 text-left">Product</th>
                                                                    <th className="py-1 text-right">Quantity</th>
                                                                    <th className="py-1 text-right">Unit Price</th>
                                                                    <th className="py-1 text-right">Discount</th>
                                                                    <th className="py-1 text-right">Tax</th>
                                                                    <th className="py-1 text-right">Subtotal</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {txn.products.map((prod, pIdx) => (
                                                                    <tr key={pIdx} className="hover:bg-slate-50 text-slate-600">
                                                                        <td className="py-1 font-bold">{prod.id}</td>
                                                                        <td className="py-1 font-medium">{prod.name}</td>
                                                                        <td className="py-1 text-right">{prod.qty} {prod.unit || ''}</td>
                                                                        <td className="py-1 text-right">{prod.unitPrice.toFixed(3)}</td>
                                                                        <td className="py-1 text-right">{prod.discount.toFixed(3)}</td>
                                                                        <td className="py-1 text-right">{prod.tax.toFixed(3)}</td>
                                                                        <td className="py-1 text-right font-bold text-slate-800">{prod.subtotal.toFixed(3)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-100 font-bold border-t border-slate-300 text-slate-800">
                                <tr>
                                    <td colSpan={5} className="px-4 py-3 text-right text-slate-600 uppercase text-[10px]">Grand Total:</td>
                                    <td className="px-4 py-3 text-right">{formatRiyal(totalDebit)}</td>
                                    <td className="px-4 py-3 text-right">{formatRiyal(totalCredit)}</td>
                                    <td className="px-4 py-3 text-right bg-slate-200">{formatRiyal(Math.abs(runningBalance))} {runningBalance >= 0 ? 'DR' : 'CR'}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                {/* Ledger Table - Format 3 */}
                {ledgerFormat === 'Format 3' && (
                    <div className="overflow-x-auto print:hidden">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-800 text-white font-bold uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-4 rounded-tl-lg">Date</th>
                                    <th className="px-6 py-4 w-1/2">Description</th>
                                    <th className="px-6 py-4 text-right">Debit</th>
                                    <th className="px-6 py-4 text-right">Credit</th>
                                    <th className="px-6 py-4 text-right rounded-tr-lg">Running Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {transactionsWithBalance.map((txn, idx) => (
                                    <tr 
                                        key={idx} 
                                        className={`hover:bg-slate-50 transition-colors group ${
                                            txn.type === 'Payment' ? 'bg-emerald-50/40' : 
                                            txn.type === 'Sell Return' ? 'bg-amber-50/40' :
                                            txn.type === 'Sell' ? 'bg-white' : 'bg-slate-50/20'
                                        }`}
                                    >
                                        <td className={`px-6 py-4 text-slate-600 align-top whitespace-nowrap font-medium border-l-4 ${
                                            txn.type === 'Payment' ? 'border-emerald-500' : 
                                            txn.type === 'Sell' ? 'border-blue-500' : 'border-slate-300'
                                        }`}>
                                            {formatLedgerDate(txn.date)}
                                        </td>
                                        <td className="px-6 py-4 align-top">
                                            <div className="flex flex-col gap-1">
                                                <div className={`font-bold text-base flex items-center gap-2 ${
                                                    txn.type === 'Payment' ? 'text-emerald-700' : 
                                                    txn.type === 'Sell Return' ? 'text-amber-700' :
                                                    txn.type === 'Sell' ? 'text-blue-700' : 'text-slate-700'
                                                }`}>
                                                    {txn.type === 'Payment' && <CreditCard size={16} />}
                                                    {txn.type === 'Sell Return' && <Undo2 size={16} />}
                                                    {txn.type === 'Sell' && <ShoppingBag size={16} />}
                                                    {txn.type === 'Opening Balance' && <Wallet size={16} />}
                                                    
                                                    {txn.type} 
                                                    <span className="text-slate-300 font-normal text-xs mx-1">|</span> 
                                                    <span className={
                                                      txn.type === 'Payment'
                                                        ? 'text-emerald-600'
                                                        : txn.type === 'Sell Return'
                                                          ? 'text-amber-600'
                                                          : 'text-blue-600'
                                                    }>
                                                        {txn.ref || 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    <span className="font-semibold text-slate-600">Location:</span> {txn.location || 'N/A'}
                                                </div>
                                                {txn.method && (
                                                    <div className="text-xs text-slate-500">
                                                        <span className="font-semibold text-slate-600">Method:</span> {txn.method}
                                                    </div>
                                                )}
                                                {txn.others && (
                                                    <div className="text-xs text-slate-500 italic bg-white/50 px-2 py-1 rounded w-fit mt-1 border border-slate-200">
                                                        {txn.others}
                                                    </div>
                                                )}
                                                {txn.products && (
                                                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                        <Receipt size={10} /> Includes {txn.products.length} items
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right align-top">
                                            {txn.debit > 0 ? (
                                                <span className="font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                                    {formatRiyal(txn.debit)}
                                                </span>
                                            ) : <span className="text-slate-300">-</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right align-top">
                                            {txn.credit > 0 ? (
                                                <span className="font-bold text-emerald-700 bg-emerald-100/50 px-2 py-1 rounded border border-emerald-200">
                                                    {formatRiyal(txn.credit)}
                                                </span>
                                            ) : <span className="text-slate-300">-</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right align-top">
                                            <span className={`font-black ${txn.balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                                                {formatRiyal(Math.abs(txn.balance))}
                                            </span>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                                                {txn.balance >= 0 ? 'DR' : 'CR'}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-800 text-white font-bold border-t border-slate-700">
                                <tr>
                                    <td colSpan={2} className="px-6 py-4 text-right uppercase text-xs tracking-wider opacity-80">Totals</td>
                                    <td className="px-6 py-4 text-right text-blue-300">{formatRiyal(totalDebit)}</td>
                                    <td className="px-6 py-4 text-right text-emerald-400">{formatRiyal(totalCredit)}</td>
                                    <td className="px-6 py-4 text-right bg-slate-900">{formatRiyal(Math.abs(runningBalance))} {runningBalance >= 0 ? 'DR' : 'CR'}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        )}

        {/* Tab Content: Sales */}
        {activeTab === 'sales' && (
            <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
                
                {/* Controls */}
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
                    <div className="flex flex-col gap-4 flex-1">
                        <div className="flex flex-col md:flex-row gap-4">
                             <div className="group">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Payment Status</label>
                                <select
                                    className="px-3 py-1.5 rounded border border-slate-300 text-xs focus:outline-none w-full md:w-40 bg-white"
                                    value={salePayStatusFilter}
                                    onChange={(e) => setSalePayStatusFilter(e.target.value)}
                                >
                                    <option value="All">All</option>
                                    <option value="Paid">Paid</option>
                                    <option value="Due">Due</option>
                                </select>
                             </div>
                             <div className="group">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date Range</label>
                                <DateRangeFilter onRangeSelect={(range) => {
                            if (range.startDate) setSummaryStartDate(range.startDate.toISOString().split('T')[0]);
                            if (range.endDate) setSummaryEndDate(range.endDate.toISOString().split('T')[0]);
                        }} />
                             </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 items-end justify-end">
                        <div className="flex gap-1">
                            {/* Exports */}
                             <button
                                 onClick={() => {
                                     const headers = ['Date', 'Invoice No', 'Location', 'Payment Status', 'Payment Method', 'Total Amount', 'Total Paid', 'Sell Due'];
                                     const rows = salesData
                                         .filter(s => salePayStatusFilter === 'All' || (isFinalizedSale(s) ? s.paymentStatus : '--') === salePayStatusFilter)
                                         .map(s => [
                                           s.date,
                                           s.invoiceNo,
                                           s.location || '',
                                           isFinalizedSale(s) ? s.paymentStatus : '--',
                                           isFinalizedSale(s) ? (s.paymentMethod || '') : '',
                                           (s.grandTotal || 0).toFixed(3),
                                           (s.totalPaid || 0).toFixed(3),
                                           (isFinalizedSale(s) ? (s.sellDue || 0) : 0).toFixed(3),
                                         ].join(','));
                                     const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
                                     const link = document.createElement('a'); link.setAttribute('href', encodeURI(csv)); link.setAttribute('download', `sales_${customer?.id || 'customer'}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
                                 }}
                                 className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"
                             ><FileText size={10}/> Export CSV</button>
                        </div>
                        <div className="flex items-center gap-2">
                             <input 
                                type="text" 
                                placeholder="Search..." 
                                className="px-3 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[500px]">
                    <table className="w-full text-[10px] text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 whitespace-nowrap">Action</th>
                                <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Invoice No. <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Customer Name <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Contact Number</th>
                                <th className="px-4 py-3 whitespace-nowrap">Location <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Payment Status <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Payment Method</th>
                                <th className="px-4 py-3 whitespace-nowrap text-right">Total Amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap text-right">Total Paid <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap text-right">Sell Due <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap text-right">Sell Return Due</th>
                                <th className="px-4 py-3 whitespace-nowrap">Shipping Status <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap text-right">Total Items <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Added By <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Sell Note</th>
                                <th className="px-4 py-3 whitespace-nowrap">Staff Note</th>
                                <th className="px-4 py-3 whitespace-nowrap">Shipping Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {salesData
                                .filter(s => (s.invoiceNo || '').toLowerCase().includes(searchTerm.toLowerCase()))
                                .filter(s => salePayStatusFilter === 'All' || (isFinalizedSale(s) ? s.paymentStatus : '--') === salePayStatusFilter)
                                .map((sale) => (
                                <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 text-center">
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
                                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{sale.date}</td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{sale.invoiceNo}</td>
                                    <td className="px-4 py-3 text-slate-700 font-bold">{customer.businessName}</td>
                                    <td className="px-4 py-3 text-slate-600">{customer.mobile}</td>
                                    <td className="px-4 py-3 text-[10px] text-slate-500 whitespace-nowrap truncate max-w-[100px]">{sale.location}</td>
                                    <td className="px-4 py-3">
                                        {isFinalizedSale(sale) ? (
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white ${
                                              sale.paymentStatus === 'Paid' ? 'bg-emerald-500' :
                                              sale.paymentStatus === 'Partial' ? 'bg-sky-500' :
                                              sale.paymentStatus === 'Overdue' ? 'bg-red-500' :
                                              'bg-amber-500'
                                          }`}>
                                              {sale.paymentStatus}
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                                            --
                                          </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-600">{isFinalizedSale(sale) ? (sale.paymentMethod || '--') : '--'}</td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(sale.grandTotal ?? sale.totalAmount ?? 0)}</td>
                                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(sale.totalPaid ?? 0)}</td>
                                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(isFinalizedSale(sale) ? (sale.sellDue ?? 0) : 0)}</td>
                                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(isFinalizedSale(sale) ? (sale.sellReturnDue ?? 0) : 0)}</td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">
                                            {sale.shippingStatus || '--'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-slate-600">{(sale.totalItems ?? sale.items?.length ?? 0).toFixed(3)}</td>
                                    <td className="px-4 py-3 text-slate-500">{sale.addedBy}</td>
                                    <td className="px-4 py-3 text-slate-500 italic">{sale.sellNote}</td>
                                    <td className="px-4 py-3 text-center text-slate-300">--</td>
                                    <td className="px-4 py-3 text-center text-slate-300">--</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 uppercase">
                            <tr>
                                <td colSpan={8} className="px-4 py-3 text-right">Total:</td>
                                <td className="px-4 py-3 text-right bg-slate-300">{formatCurrency(salesData.reduce((acc, s) => acc + (s.grandTotal ?? s.totalAmount ?? 0), 0))}</td>
                                <td className="px-4 py-3 text-right bg-slate-300">{formatCurrency(salesData.reduce((acc, s) => acc + (s.totalPaid ?? 0), 0))}</td>
                                <td className="px-4 py-3 text-right bg-slate-300">{formatCurrency(salesData.reduce((acc, s) => acc + (isFinalizedSale(s) ? (s.sellDue ?? 0) : 0), 0))}</td>
                                <td className="px-4 py-3 text-right bg-slate-300">{formatCurrency(salesData.reduce((acc, s) => acc + (isFinalizedSale(s) ? (s.sellReturnDue ?? 0) : 0), 0))}</td>
                                <td colSpan={6}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        )}
        
        {/* Tab Content: Documents & Note */}
        {activeTab === 'docs' && (
             <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                       <h3 className="text-sm font-bold text-slate-700">Documents</h3>
                       <button
                           onClick={() => { setEditingDoc(null); setNewDocHeading(''); setIsDocModalOpen(true); }}
                           className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                       >
                           <Plus size={12}/> Add Document
                       </button>
                  </div>
                  <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Action</th>
                                    <th className="px-6 py-4">Heading</th>
                                    <th className="px-6 py-4">Added By</th>
                                    <th className="px-6 py-4">Created At</th>
                                    <th className="px-6 py-4">Updated At</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {documentsData.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">No documents added yet. Click "Add Document" to get started.</td></tr>
                                ) : (
                                    documentsData.map(doc => (
                                        <tr key={doc.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 flex gap-2">
                                                <button onClick={() => { setEditingDoc({ id: doc.id, heading: doc.heading }); setNewDocHeading(doc.heading); setIsDocModalOpen(true); }} className="text-blue-600 hover:text-blue-800" title="Edit"><Edit size={14}/></button>
                                                <button onClick={() => handleDeleteDoc(doc.id)} className="text-red-600 hover:text-red-800" title="Delete"><Trash2 size={14}/></button>
                                            </td>
                                            <td className="px-6 py-4 font-bold">{doc.heading}</td>
                                            <td className="px-6 py-4">{doc.addedBy}</td>
                                            <td className="px-6 py-4">{doc.createdAt}</td>
                                            <td className="px-6 py-4">{doc.updatedAt}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                  </div>
             </div>
        )}

        {/* Document Add/Edit Modal */}
        {isDocModalOpen && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-800">{editingDoc ? 'Edit Document' : 'Add Document'}</h3>
                        <button onClick={() => setIsDocModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                    </div>
                    <div className="p-6">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Document Heading *</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Trade License, VAT Certificate"
                            value={newDocHeading}
                            onChange={(e) => setNewDocHeading(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveDoc()}
                        />
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
                        <button onClick={() => setIsDocModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
                        <button onClick={handleSaveDoc} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">{editingDoc ? 'Update' : 'Save'}</button>
                    </div>
                </div>
            </div>
        )}

        {/* Tab Content: Payments */}
        {activeTab === 'payments' && (
             <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
                  <div className="overflow-x-auto min-h-[300px]">
                      <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                              <tr>
                                  <th className="px-6 py-4">Date</th>
                                  <th className="px-6 py-4">Ref No</th>
                                  <th className="px-6 py-4">Invoice No.</th>
                                  <th className="px-6 py-4 text-right">Amount</th>
                                  <th className="px-6 py-4">Method</th>
                                  <th className="px-6 py-4">Note</th>
                                  <th className="px-6 py-4 text-center">Action</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {paymentsData.map(pay => (
                                  <tr key={pay.id} className="hover:bg-slate-50">
                                      <td className="px-6 py-4">{pay.paidOn}</td>
                                      <td className="px-6 py-4 font-bold text-blue-600">{pay.refNo}</td>
                                      <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded border border-cyan-200 bg-cyan-50 text-cyan-700 font-bold text-[10px]">
                                          {pay.invoiceNoDisplay}
                                        </span>
                                        {pay.invoiceExtraCount > 0 && (
                                          <span className="ml-2 text-[10px] font-bold text-slate-400">+{pay.invoiceExtraCount} more</span>
                                        )}
                                      </td>
                                      <td className="px-6 py-4 text-right font-bold">{formatRiyal(pay.amount)}</td>
                                      <td className="px-6 py-4">{pay.method}</td>
                                      <td className="px-6 py-4 italic text-slate-500">{pay.paymentFor}</td>
                                      <td className="px-6 py-4 text-center relative">
                                          <button 
                                              onClick={(e) => toggleActions(e, `pay-${pay.id}`)}
                                              className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all mx-auto ${
                                                  activeActionId === `pay-${pay.id}` 
                                                  ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                                                  : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                                              }`}
                                          >
                                              Action <ChevronDown size={10} />
                                          </button>
                                          
                                          {activeActionId === `pay-${pay.id}` && createPortal(
                                              <div 
                                                  ref={dropdownRef}
                                                  className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 py-2 w-48 animate-in fade-in zoom-in-95"
                                                  style={{ 
                                                      top: dropdownPosition.top, 
                                                      bottom: dropdownPosition.bottom,
                                                      left: dropdownPosition.left,
                                                      transformOrigin: dropdownPosition.transformOrigin,
                                                      maxHeight: dropdownPosition.maxHeight ? `${dropdownPosition.maxHeight}px` : 'auto',
                                                      overflowY: 'auto'
                                                  }}
                                                  onClick={(e) => e.stopPropagation()}
                                              >
                                                  <button onClick={() => handleViewPayment(pay)} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3">
                                                      <Eye size={14} className="text-blue-500" /> View
                                                  </button>
                                                  <button onClick={() => handleEditPayment(pay)} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3">
                                                      <Edit size={14} className="text-amber-500" /> Edit
                                                  </button>
                                                  <div className="h-px bg-slate-100 my-1"></div>
                                                  <button onClick={() => handleDeletePaymentClick(pay)} className="w-full text-left px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-3">
                                                      <Trash2 size={14} /> Delete
                                                  </button>
                                              </div>,
                                              document.body
                                          )}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
             </div>
        )}

        {/* Tab Content: Activities */}
        {activeTab === 'activities' && (
            <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
                 <div className="overflow-x-auto min-h-[300px]">
                      <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                              <tr>
                                  <th className="px-6 py-4">Date</th>
                                  <th className="px-6 py-4">Action</th>
                                  <th className="px-6 py-4">By</th>
                                  <th className="px-6 py-4">Note</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {activitiesData.map((act, i) => (
                                  <tr key={i} className="hover:bg-slate-50">
                                      <td className="px-6 py-4">{act.date}</td>
                                      <td className="px-6 py-4 font-bold">{act.action}</td>
                                      <td className="px-6 py-4">{act.by}</td>
                                      <td className="px-6 py-4 italic text-slate-500">{act.note}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
            </div>
        )}

        {/* HIGH-FIDELITY ADD PAYMENT MODAL (Linked to Customer Profile Card Pay Button) */}
        {isPaymentModalOpen && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-slate-800">Add payment</h3>
                        <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                    
                    {/* Content */}
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            {/* Customer Info */}
                            <div className="bg-slate-50 p-4 rounded border border-slate-200">
                                <p className="text-sm font-bold text-slate-700">
                                    Customer name: <span className="font-normal text-slate-600">{customer.businessName} ({customer.name})</span>
                                </p>
                            </div>
                            
                            {/* Financial Summary */}
                            <div className="bg-slate-50 p-4 rounded border border-slate-200 text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-700">Total Sale Due:</span>
                                    <span className="font-medium text-slate-600">{formatRiyal(customer.totalSellDue)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-700">Opening Balance:</span>
                                    <span className="font-medium text-slate-600">{formatRiyal(customer.openingBalance)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            <div className="group">
                                <label className="block text-sm font-bold text-slate-800 mb-1">Payment Method:*</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                        <Banknote size={16} />
                                    </div>
                                    <select 
                                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white"
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                    >
                                        <option>Cash</option>
                                        <option>Card</option>
                                        <option>Cheque</option>
                                        <option>Bank Transfer</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-sm font-bold text-slate-800 mb-1">Paid on:*</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                        <CalendarIcon size={16} />
                                    </div>
                                    <input 
                                        type="datetime-local" 
                                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        value={paymentDate}
                                        onChange={(e) => setPaymentDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-sm font-bold text-slate-800 mb-1">Amount:*</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                        <DollarSign size={16} />
                                    </div>
                                    <input 
                                        type="number" 
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="group">
                                <label className="block text-sm font-bold text-slate-800 mb-1">Attach Document:</label>
                                <div className="flex items-center">
                                    <label className="cursor-pointer bg-slate-100 border border-slate-300 text-slate-700 px-3 py-2 rounded-l text-sm hover:bg-slate-200 transition-colors whitespace-nowrap">
                                        Choose File
                                        <input type="file" accept=".pdf,.csv,.zip,.doc,.docx,.jpeg,.jpg,.png" className="hidden" onChange={(e) => setPaymentFileName(e.target.files?.[0]?.name || '')} />
                                    </label>
                                    <span className="px-3 py-2 border border-l-0 border-slate-300 rounded-r w-full text-sm text-slate-500 bg-white truncate">{paymentFileName || 'No file chosen'}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">Allowed File: .pdf, .csv, .zip, .doc, .docx, .jpeg, .jpg, .png</p>
                            </div>

                            <div className="group">
                                <label className="block text-sm font-bold text-slate-800 mb-1">Payment Account:</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                        <Banknote size={16} />
                                    </div>
                                    <select 
                                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded text-sm appearance-none bg-slate-100 cursor-not-allowed"
                                        value={paymentAccount}
                                        onChange={(e) => setPaymentAccount(e.target.value)}
                                        disabled
                                    >
                                        <option value={resolveDefaultAccountFromMethod(paymentMethod || 'Cash')}>
                                          {resolveDefaultAccountFromMethod(paymentMethod || 'Cash')}
                                        </option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            </div>
                        </div>

                        <div className="group mb-6">
                            <label className="block text-sm font-bold text-slate-800 mb-1">Payment Note:</label>
                            <textarea 
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 h-24 resize-none"
                                value={paymentNote}
                                onChange={(e) => setPaymentNote(e.target.value)}
                            ></textarea>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
                        <button 
                            onClick={processPayment}
                            className="px-6 py-2 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700 transition-colors"
                        >
                            Save
                        </button>
                        <button 
                            onClick={() => setIsPaymentModalOpen(false)}
                            className="px-6 py-2 bg-slate-800 text-white rounded font-bold text-sm hover:bg-slate-900 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Add Discount Modal */}
        {isDiscountModalOpen && (
             <AddDiscountModal
                isOpen={isDiscountModalOpen}
                onClose={() => setIsDiscountModalOpen(false)}
                onSave={(formData) => globalAddDiscount({ ...formData, id: generateId('DISC') })}
            />
        )}

       {/* Action Menu Portal for Sales Tab Table Rows */}
       {activeActionId && !activeActionId.startsWith('pay-') && createPortal(
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
                     Invoice #{salesData.find(s => s.id === activeActionId)?.invoiceNo?.split('-').pop() || '--'}
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
                     onClick={() => { if (activeActionId) handleViewDetails(activeActionId); }}
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
                      onClick={() => { if (activeActionId) handleAddPaymentForSale(activeActionId); }}
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
                    
                    <button 
                      className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                      onClick={() => { if (activeActionId) handleSellReturn(activeActionId); }}
                    >
                      <Undo2 size={14} className="text-orange-500" /> Sell Return
                    </button>
                  </>
                )}
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
          <ViewOrder 
            onClose={() => setViewOrderModalOpen(false)} 
            invoiceNo={selectedSaleId ? salesData.find(s => s.id === selectedSaleId)?.invoiceNo : undefined}
          />
      )}

      {/* Packing Slip Modal */}
      {packingSlipModalOpen && (
          <PackingSlip 
            onClose={() => setPackingSlipModalOpen(false)} 
            invoiceNo={selectedSaleId ? salesData.find(s => s.id === selectedSaleId)?.invoiceNo : undefined}
            date={selectedSaleId ? salesData.find(s => s.id === selectedSaleId)?.date : undefined}
            sale={selectedSaleId ? salesData.find(s => s.id === selectedSaleId) : undefined}
          />
      )}

      {/* Delivery Note Modal */}
      {deliveryNoteModalOpen && (
          <DeliveryNote
            onClose={() => setDeliveryNoteModalOpen(false)} 
            invoiceNo={selectedSaleId ? salesData.find(s => s.id === selectedSaleId)?.invoiceNo : undefined}
            date={selectedSaleId ? salesData.find(s => s.id === selectedSaleId)?.date : undefined}
            sale={selectedSaleId ? salesData.find(s => s.id === selectedSaleId) : undefined}
          />
      )}

      {/* Edit Shipping Modal */}
      {editShippingModalOpen && (
          <EditShippingModal
            isOpen={editShippingModalOpen}
            onClose={() => setEditShippingModalOpen(false)}
            sale={selectedSaleId ? salesData.find(s => s.id === selectedSaleId) : null}
            onSave={(updatedSale) => globalUpdateSale(updatedSale)}
          />
      )}

      {/* Add Payment Modal (For Sales Tab Row) */}
      {addPaymentForSaleModalOpen && (
          <AddPaymentModal
            isOpen={addPaymentForSaleModalOpen}
            onClose={() => setAddPaymentForSaleModalOpen(false)}
            sale={selectedSaleId ? getSelectedSaleForPayment() : null}
            onSave={globalAddPayment}
          />
      )}

      {/* View Payments Modal */}
      {viewPaymentsModalOpen && (
          <ViewPaymentsModal
            isOpen={viewPaymentsModalOpen}
            onClose={() => setViewPaymentsModalOpen(false)}
            invoiceNo={selectedSaleId ? salesData.find(s => s.id === selectedSaleId)?.invoiceNo : undefined}
          />
      )}

      {/* Invoice URL Modal */}
      {invoiceURLModalOpen && (
          <InvoiceURLModal
            isOpen={invoiceURLModalOpen}
            onClose={() => setInvoiceURLModalOpen(false)}
            invoiceNo={selectedSaleId ? salesData.find(s => s.id === selectedSaleId)?.invoiceNo : undefined}
            saleId={selectedSaleId || undefined}
          />
      )}

      {/* Payment Modals */}
      <ViewPaymentModal 
          isOpen={viewPaymentModalOpen}
          onClose={() => setViewPaymentModalOpen(false)}
          payment={selectedPayment}
          customer={customer}
      />

      <EditPaymentModal 
          isOpen={editPaymentModalOpen}
          onClose={() => setEditPaymentModalOpen(false)}
          payment={selectedPayment}
          customer={customer}
          onSave={handleSaveEditedPayment}
      />

      <ConfirmationModal 
          isOpen={deletePaymentModalOpen}
          onClose={() => setDeletePaymentModalOpen(false)}
          onConfirm={handleDeletePaymentConfirm}
          title="Delete Payment"
          message={`Are you sure you want to delete payment ${selectedPayment?.refNo || selectedPayment?.referenceNo || '--'}? This action cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          icon={<Trash2 size={32} />}
      />

    </div>
  );
};

export default ViewCustomer;
