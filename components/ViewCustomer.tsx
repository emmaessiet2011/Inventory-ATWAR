
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  User, MapPin, Phone, Mail, Plus, FileText, 
  ShoppingBag, StickyNote, CreditCard, Activity,
  Printer, Filter, Download, ArrowLeft,
  ChevronDown, FileSpreadsheet, Columns, Edit, Trash2, Eye,
  Search, ArrowUpDown, CheckCircle2, Wallet, Receipt, X, DollarSign,
  Calendar as CalendarIcon, Banknote, Briefcase, Clock, Truck, Package, ScrollText, Link, Undo2,
  Info
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
import MultiSelect from './MultiSelect';
import ViewPaymentModal from './ViewPaymentModal';
import EditPaymentModal from './EditPaymentModal';
import { ConfirmationModal } from './UserModals';
import { useGlobalContext } from '../src/context/GlobalContext';

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
    ref: string;
    type: 'Sell' | 'Payment' | 'Opening Balance';
    location: string;
    status: string;
    debit: number;
    credit: number;
    method: string;
    others: string;
    products?: ProductItem[];
}

const ViewCustomer: React.FC<ViewCustomerProps> = ({ onNavigate, contactId, initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'ledger');
  const [ledgerFormat, setLedgerFormat] = useState('Format 1');
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for Dynamic Customer Data
  const [customer, setCustomer] = useState<Customer | null>(null);

  // Account Summary Date State
  const [summaryStartDate, setSummaryStartDate] = useState('2026-01-01');
  const [summaryEndDate, setSummaryEndDate] = useState('2026-12-31');

  // General Customer Payment Modal State (The one from Profile Card)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 16));
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAccount, setPaymentAccount] = useState('None');
  const [paymentNote, setPaymentNote] = useState('');

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
    payments: globalPayments,
    addPayment: globalAddPayment,
    deleteSale: globalDeleteSale,
    deletePayment: globalDeletePayment,
    currentUser,
    formatCurrency,
  } = useGlobalContext();

  const formatOMR = (amount: number) => formatCurrency(amount || 0);
  const formatRiyal = (amount: number) => formatCurrency(amount || 0);

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

  // Real sales and payments filtered by current customer — derived from GlobalContext
  const salesData = customer
    ? globalSales.filter(s => {
        const saleCustomerId = String(s.customerId || '');
        const saleName = (s.customerName || '').toLowerCase();
        return (
          saleCustomerId === customer.id ||
          saleName === customer.businessName.toLowerCase() ||
          saleName === customer.name.toLowerCase()
        );
      })
    : [];

  const paymentsData = customer
    ? globalPayments
        .filter(p => p.contactType === 'Customer' && (p.contactId === customer.id || p.contactName === customer.businessName))
        .map(p => {
          const linkedInvoices = Array.isArray(p.linkedInvoices) ? p.linkedInvoices.filter(Boolean) : [];
          const parsedInvoice = extractInvoiceFromText(`${p.referenceNo || ''} ${p.note || ''}`);
          const invoiceNoDisplay = linkedInvoices[0] || parsedInvoice || '--';
          const invoiceExtraCount = linkedInvoices.length > 1 ? linkedInvoices.length - 1 : 0;

          return {
            ...p,
            paidOn: p.date,
            refNo: p.referenceNo,
            paymentFor: p.note,
            invoiceNoDisplay,
            invoiceExtraCount,
          };
        })
    : [];

  const activitiesData = [
      { date: '06/04/2025 09:48 AM', action: 'Edited', by: 'Shafikul Islam', note: 'Updated credit limit' },
      { date: '02/04/2025 08:44 PM', action: 'Edited', by: 'Shafikul Islam', note: 'Changed contact number' },
      { date: '17/02/2025 08:50 AM', action: 'Edited', by: 'Shafikul Islam', note: 'Added to Customer Group: Supermarkets' },
      { date: '26/10/2024 04:50 PM', action: 'Added', by: 'Shafikul Islam', note: 'Initial creation' },
  ];
  
  const documentsData = [
      { id: '1', heading: 'Trade License', addedBy: 'Admin', createdAt: '10/01/2025', updatedAt: '10/01/2025' },
      { id: '2', heading: 'VAT Registration', addedBy: 'Admin', createdAt: '15/01/2025', updatedAt: '15/01/2025' },
  ];

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
      if(initialTab) {
          setActiveTab(initialTab);
      }
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
  
  const handleAddPaymentForSale = (saleId: string) => {
      setSelectedSaleId(saleId);
      setAddPaymentForSaleModalOpen(true);
      setActiveActionId(null);
  };

  const handleViewPayments = (saleId: string) => {
      setSelectedSaleId(saleId);
      setViewPaymentsModalOpen(true);
      setActiveActionId(null);
  };

  const handleSellReturn = (saleId: string) => {
      if (onNavigate) {
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

  const handleSaveEditedPayment = (_updatedPayment: any) => {
      // Payment edits are managed through GlobalContext; local state updates automatically
  };

  const handlePayClick = () => {
    setPaymentAmount(customer?.totalSellDue.toString() || '0');
    setIsPaymentModalOpen(true);
  };

  const processPayment = () => {
    if (!customer) return;

    const amountPaid = parseFloat(paymentAmount || '0');
    if (isNaN(amountPaid) || amountPaid <= 0) return;

    // GlobalContext addPayment handles: FIFO invoice distribution,
    // customer balance update, and localStorage persistence automatically
    globalAddPayment({
        id: `PAY-${Date.now()}`,
        date: paymentDate || new Date().toISOString().split('T')[0],
        contactId: customer.id,
        contactName: customer.businessName,
        contactType: 'Customer',
        amount: amountPaid,
        method: paymentMethod,
        account: paymentAccount,
        referenceNo: `PAY-${Date.now().toString().slice(-6)}`,
        note: paymentNote,
        type: 'received',
        addedBy: currentUser?.name || 'Admin',
    });

    setIsPaymentModalOpen(false);
    setPaymentAmount('');
    setPaymentNote('');
  };

  // Build ledger transactions from real GlobalContext data (sales + payments for this customer)
  const transactions: Transaction[] = customer ? [
      // Opening balance entry (if non-zero)
      ...(customer.openingBalance !== 0 ? [{
          date: customer.addedOn + ' 12:00 AM',
          ref: 'OPENING',
          type: 'Opening Balance' as const,
          location: '',
          status: '',
          debit: customer.openingBalance > 0 ? customer.openingBalance : 0,
          credit: customer.openingBalance < 0 ? Math.abs(customer.openingBalance) : 0,
          method: '',
          others: ''
      }] : []),
      // Sales entries
      ...salesData.map(s => ({
          date: s.date,
          ref: s.invoiceNo,
          type: 'Sell' as const,
          location: s.location || '',
          status: s.paymentStatus,
          debit: s.grandTotal,
          credit: 0,
          method: s.paymentMethod || 'Credit',
          others: s.sellNote || '',
          products: (s.items || []).map((item: any, idx: number) => ({
              id: idx + 1,
              name: item.name,
              qty: item.qty,
              unit: item.unit || 'Pc(s)',
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              tax: item.tax || 0,
              priceIncTax: item.unitPrice,
              subtotal: item.subtotal
          }))
      })),
      // Payment entries
      ...paymentsData.map(p => ({
          date: p.date,
          ref: p.referenceNo,
          type: 'Payment' as const,
          location: '',
          status: 'Paid',
          debit: 0,
          credit: p.amount,
          method: p.method,
          others: p.note || ''
      })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : [];

  // Calculate Ledger Totals
  const totalDebit = transactions.reduce((acc, t) => acc + t.debit, 0);
  const totalCredit = transactions.reduce((acc, t) => acc + t.credit, 0);
  const balanceDue = totalDebit - totalCredit;

  // Calculate Running Balance for Customer (Receivable: Debit increases balance, Credit decreases)
  let runningBalance = 0;
  const transactionsWithBalance = transactions.map(t => {
      const change = t.debit - t.credit;
      runningBalance += change;
      return { ...t, balance: runningBalance };
  });

  const formatDateDisplay = (dateStr: string) => {
    if(!dateStr) return '';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

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

  const getSelectedSale = () => {
     return salesData.find(s => s.id === selectedSaleId);
  }

  if (!customer) return <div className="p-10 text-center">Loading customer data...</div>;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
                <button onClick={() => onNavigate('customers')} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-bold text-slate-900">View Customer</h2>
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
                        className="bg-[#6200ea] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#5000ca] transition shadow-sm flex items-center gap-2"
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
            <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
                
                {/* Ledger Toolbar */}
                <div className="p-6 border-b border-slate-100 flex flex-col xl:flex-row justify-between gap-6">
                    <div className="flex flex-col gap-4 flex-1">
                        <DateRangeFilter />
                        
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
                            <select className="w-full px-3 py-2 rounded border border-slate-300 text-sm outline-none bg-white">
                                <option>All locations</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col items-end justify-start gap-2">
                         <div className="flex gap-2">
                             <button className="p-2 border border-slate-300 rounded hover:bg-slate-50 text-slate-600" title="PDF">
                                 <FileText size={16} />
                             </button>
                             <button className="p-2 border border-slate-300 rounded hover:bg-slate-50 text-slate-600" title="Email">
                                 <Mail size={16} />
                             </button>
                         </div>
                    </div>
                </div>
                
                 {/* Summary Section */}
                <div className="p-6 bg-slate-50 border-b border-slate-200">
                    <div className="flex flex-col xl:flex-row gap-8">
                        <div className="flex-1">
                            <h4 className="font-bold text-slate-900 bg-[#0f4c75] text-white px-3 py-1.5 text-sm inline-block w-full mb-4">
                                To:
                            </h4>
                            <div className="text-sm font-bold text-slate-800">{customer.businessName}</div>
                            <div className="text-xs text-slate-600">Mobile: {customer.mobile}</div>
                        </div>

                        <div className="flex-1 text-right">
                             <div className="text-sm font-bold text-slate-800">Atwar Al Mustaqbal</div>
                             <div className="text-xs text-slate-600">Atwar, Muscat, Muscat</div>
                             <div className="text-xs text-slate-600">Oman, 112</div>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-0 border border-slate-300 bg-white">
                        {/* Account Summary */}
                        <div className="border-r border-slate-300">
                            <div className="bg-[#0f4c75] text-white px-4 py-2 font-bold text-sm text-right">
                                Account Summary
                            </div>
                            <div className="p-4 text-xs space-y-2">
                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                    <span className="font-medium text-slate-600">Total Invoice</span>
                                    <span className="font-bold text-slate-800">{formatOMR(totalDebit)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium text-slate-600">Total Paid</span>
                                    <span className="font-bold text-slate-800">{formatOMR(totalCredit)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Overall Summary */}
                        <div>
                            <div className="bg-slate-100 text-slate-700 px-4 py-2 font-bold text-sm text-right border-b border-slate-300">
                                Overall Summary
                            </div>
                            <div className="p-4 text-xs space-y-2">
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-800">Balance due</span>
                                    <span className="font-bold text-red-600">{formatOMR(balanceDue)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ledger Table - Format 1 */}
                {ledgerFormat === 'Format 1' && (
                    <div className="overflow-x-auto">
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
                                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{txn.date}</td>
                                        <td className="px-4 py-3 text-blue-600 font-medium whitespace-nowrap cursor-pointer hover:underline">{txn.ref}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{txn.type}</td>
                                        <td className="px-4 py-3 text-[10px] text-slate-500 whitespace-nowrap">{txn.location}</td>
                                        <td className="px-4 py-3 font-bold whitespace-nowrap">{txn.status}</td>
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
                    <div className="overflow-x-auto">
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
                                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{txn.date}</td>
                                            <td className="px-4 py-3 text-blue-600 font-bold whitespace-nowrap">{txn.ref}</td>
                                            <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">{txn.type}</td>
                                            <td className="px-4 py-3 text-[10px] text-slate-500 whitespace-nowrap">{txn.location}</td>
                                            <td className="px-4 py-3 font-bold whitespace-nowrap">{txn.status}</td>
                                            <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-slate-800">
                                                {txn.debit > 0 ? formatRiyal(txn.debit) : ''}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-slate-800">
                                                {txn.credit > 0 ? formatRiyal(txn.credit) : ''}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-900 bg-slate-50 whitespace-nowrap border-l border-slate-200">
                                                {formatRiyal(txn.balance)} <span className="text-[9px] text-slate-400">DR</span>
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
                                    <td className="px-4 py-3 text-right bg-slate-200">{formatRiyal(runningBalance)}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                {/* Ledger Table - Format 3 */}
                {ledgerFormat === 'Format 3' && (
                    <div className="overflow-x-auto">
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
                                            txn.type === 'Sell' ? 'bg-white' : 'bg-slate-50/20'
                                        }`}
                                    >
                                        <td className={`px-6 py-4 text-slate-600 align-top whitespace-nowrap font-medium border-l-4 ${
                                            txn.type === 'Payment' ? 'border-emerald-500' : 
                                            txn.type === 'Sell' ? 'border-blue-500' : 'border-slate-300'
                                        }`}>
                                            {txn.date.split(' ')[0]} <br/>
                                            <span className="text-[10px] text-slate-400 font-normal">{txn.date.split(' ').slice(1).join(' ')}</span>
                                        </td>
                                        <td className="px-6 py-4 align-top">
                                            <div className="flex flex-col gap-1">
                                                <div className={`font-bold text-base flex items-center gap-2 ${
                                                    txn.type === 'Payment' ? 'text-emerald-700' : 
                                                    txn.type === 'Sell' ? 'text-blue-700' : 'text-slate-700'
                                                }`}>
                                                    {txn.type === 'Payment' && <CreditCard size={16} />}
                                                    {txn.type === 'Sell' && <ShoppingBag size={16} />}
                                                    {txn.type === 'Opening Balance' && <Wallet size={16} />}
                                                    
                                                    {txn.type} 
                                                    <span className="text-slate-300 font-normal text-xs mx-1">|</span> 
                                                    <span className={txn.type === 'Payment' ? 'text-emerald-600' : 'text-blue-600'}>
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
                                                {formatRiyal(txn.balance)}
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
                                    <td className="px-6 py-4 text-right bg-slate-900">{formatRiyal(runningBalance)}</td>
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
                                <select className="px-3 py-1.5 rounded border border-slate-300 text-xs focus:outline-none w-full md:w-40 bg-white">
                                    <option>All</option>
                                    <option>Paid</option>
                                    <option>Due</option>
                                </select>
                             </div>
                             <div className="group">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date Range</label>
                                <DateRangeFilter />
                             </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 items-end justify-end">
                        <div className="flex gap-1">
                            {/* Exports */}
                             <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10}/> Export CSV</button>
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
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white ${sale.paymentStatus === 'Paid' ? 'bg-[#74c365]' : 'bg-amber-400'}`}>
                                            {sale.paymentStatus}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-600">{sale.paymentMethod || '--'}</td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(sale.grandTotal ?? sale.totalAmount ?? 0)}</td>
                                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(sale.totalPaid ?? 0)}</td>
                                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(sale.sellDue ?? 0)}</td>
                                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(sale.sellReturnDue ?? 0)}</td>
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
                                <td className="px-4 py-3 text-right bg-slate-300">{formatCurrency(salesData.reduce((acc, s) => acc + (s.sellDue ?? 0), 0))}</td>
                                <td className="px-4 py-3 text-right bg-slate-300">{formatRiyal(0.000)}</td>
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
                                    <tr><td colSpan={5} className="px-6 py-4 text-center text-slate-400 italic">No data available in table</td></tr>
                                ) : (
                                    documentsData.map(doc => (
                                        <tr key={doc.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 flex gap-2">
                                                <button className="text-blue-600"><Edit size={14}/></button>
                                                <button className="text-red-600"><Trash2 size={14}/></button>
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
                                        <input type="file" className="hidden" />
                                    </label>
                                    <span className="px-3 py-2 border border-l-0 border-slate-300 rounded-r w-full text-sm text-slate-500 bg-white">No file chosen</span>
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
                                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white"
                                        value={paymentAccount}
                                        onChange={(e) => setPaymentAccount(e.target.value)}
                                    >
                                        <option value="None">None</option>
                                        <option value="Cash Account">Cash Account</option>
                                        <option value="Bank Account">Bank Account</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            </div>
                        </div>

                        <div className="group mb-6">
                            <label className="block text-sm font-bold text-slate-800 mb-1">Payment Note:</label>
                            <textarea 
                                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm h-24 resize-none"
                                value={paymentNote}
                                onChange={(e) => setPaymentNote(e.target.value)}
                            ></textarea>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
                        <button 
                            onClick={processPayment}
                            className="px-6 py-2 bg-[#6200ea] text-white rounded font-bold text-sm hover:bg-[#5000ca] transition-colors"
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
          />
      )}

      {/* Delivery Note Modal */}
      {deliveryNoteModalOpen && (
          <DeliveryNote
            onClose={() => setDeliveryNoteModalOpen(false)} 
            invoiceNo={selectedSaleId ? salesData.find(s => s.id === selectedSaleId)?.invoiceNo : undefined}
            date={selectedSaleId ? salesData.find(s => s.id === selectedSaleId)?.date : undefined}
          />
      )}

      {/* Edit Shipping Modal */}
      {editShippingModalOpen && (
          <EditShippingModal 
            isOpen={editShippingModalOpen}
            onClose={() => setEditShippingModalOpen(false)}
            sale={selectedSaleId ? salesData.find(s => s.id === selectedSaleId) : null}
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
          message={`Are you sure you want to delete payment ${selectedPayment?.refNo}? This action cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          icon={<Trash2 size={32} />}
      />

    </div>
  );
};

export default ViewCustomer;


