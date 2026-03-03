import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, FileText, FileSpreadsheet, Printer, 
  Columns, Download, Edit, Trash2, ChevronDown, 
  Filter, Eye, MoreVertical, CreditCard, 
  CheckCircle2, Clock, AlertTriangle, ArrowUpDown, 
  RefreshCcw, Undo2, ScrollText, Banknote, Link, Bell, Truck, Calendar as CalendarIcon, Package,
  X
} from 'lucide-react';
import ViewOrder from './ViewOrder'; 
import PackingSlip from './PackingSlip'; 
import DeliveryNote from './DeliveryNote'; 
import EditShippingModal from './EditShippingModal'; 
import AddPaymentModal from './AddPaymentModal'; 
import ViewPaymentsModal from './ViewPaymentsModal'; 
import InvoiceURLModal from './InvoiceURLModal';
import MultiSelect from './MultiSelect';
import DateRangeFilter from './DateRangeFilter';
import { useGlobalContext } from '../src/context/GlobalContext';

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

const ListPOS: React.FC<ListPOSProps> = ({
  onNavigate }) => {
  const {
    locations,
    customers,
    users,
    sales: globalSales,
    addPayment: globalAddPayment,
    deleteSale: globalDeleteSale,
    formatCurrency,
  } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-right' });
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // State for View Details Modal
  const [viewOrderModalOpen, setViewOrderModalOpen] = useState(false);
  const [packingSlipModalOpen, setPackingSlipModalOpen] = useState(false);
  const [deliveryNoteModalOpen, setDeliveryNoteModalOpen] = useState(false);
  const [editShippingModalOpen, setEditShippingModalOpen] = useState(false);
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false);
  const [viewPaymentsModalOpen, setViewPaymentsModalOpen] = useState(false);
  const [invoiceURLModalOpen, setInvoiceURLModalOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  
  // Filter States
  const [filters, setFilters] = useState({
      location: [] as string[],
      customer: [] as string[],
      paymentStatus: [] as string[],
      user: [] as string[],
      shippingStatus: [] as string[]
  });

  const sales = useMemo<POSSale[]>(() => {
    return globalSales
      .filter(s => (s.status || s.saleStatus) === 'Final')
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
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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


  // Filtering Logic
  const filteredSales = sales.filter(s => 
    (s.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.location.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.location.length === 0 || filters.location.includes(s.location)) &&
    (filters.customer.length === 0 || filters.customer.includes(s.customerName)) &&
    (filters.paymentStatus.length === 0 || filters.paymentStatus.includes(s.paymentStatus)) &&
    (filters.user.length === 0 || filters.user.includes(s.addedBy)) &&
    (filters.shippingStatus.length === 0 || filters.shippingStatus.includes(s.shippingStatus))
  );

  // Totals Calculation
  const totals = filteredSales.reduce((acc, curr) => ({
      amount: acc.amount + curr.totalAmount,
      paid: acc.paid + curr.totalPaid,
      due: acc.due + curr.sellDue,
      returnDue: acc.returnDue + curr.sellReturnDue
  }), { amount: 0, paid: 0, due: 0, returnDue: 0 });

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

  const handleViewDetails = (saleId: string) => {
      setSelectedSaleId(saleId);
      setViewOrderModalOpen(true);
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
      if (onNavigate) {
          onNavigate('add-sell-return');
      }
      setActiveActionId(null);
  };

  const handleDeleteSale = (saleId: string) => {
      const invoiceNo = sales.find(s => s.id === saleId)?.invoiceNo || 'this sale';
      if (confirm(`Delete ${invoiceNo}?`)) {
          globalDeleteSale(saleId);
      }
      setActiveActionId(null);
  };

  const selectedSale = selectedSaleId ? (sales.find(s => s.id === selectedSaleId) || null) : null;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">POS</h2>
        </div>
        <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition shadow-sm flex items-center gap-2">
            <CalendarIcon size={16} /> Calendar
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
                            options={['Paid', 'Due', 'Partial']}
                            selected={filters.paymentStatus}
                            onChange={(val) => setFilters({...filters, paymentStatus: val})}
                          />
                      </div>
                      {/* Date Range */}
                      <div className="group">
                          <DateRangeFilter />
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
                              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
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
                      <select className="border border-slate-300 bg-white rounded px-2 py-1 text-xs font-medium focus:outline-none cursor-pointer appearance-none pr-6">
                          <option>25</option>
                          <option>50</option>
                          <option>100</option>
                      </select>
                      <ChevronDown size={12} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <span className="text-xs font-medium text-slate-500">entries</span>
              </div>

              <div className="flex flex-wrap justify-center gap-1 w-full xl:w-auto">
                 {[
                    { icon: FileText, label: 'Export CSV' },
                    { icon: FileSpreadsheet, label: 'Export Excel' },
                    { icon: Printer, label: 'Print' },
                    { icon: Columns, label: 'Column visibility' },
                    { icon: FileText, label: 'Export PDF' },
                 ].map((action, i) => (
                      <button key={i} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm whitespace-nowrap">
                          <action.icon size={12} /> {action.label}
                      </button>
                 ))}
              </div>

              <div className="flex items-center gap-2 w-full xl:w-auto">
                  <div className="relative flex-1 xl:w-64">
                      <input 
                          type="text" 
                          placeholder="Search..." 
                          className="w-full px-3 py-1.5 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-xs placeholder:text-slate-400"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                      />
                  </div>
                  <button 
                    onClick={() => onNavigate('open-register')}
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
                <th className="px-4 py-3 whitespace-nowrap">Action</th>
                <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Invoice No. <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Customer Name <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Contact Number <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Location <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Payment Status <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Payment Method</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total paid <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Sell Due <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Sell Return Due</th>
                <th className="px-4 py-3 whitespace-nowrap">Shipping Status <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total Items <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Added By <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Sell note <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Staff note <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Shipping Details <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.length > 0 ? (
                  filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors group text-xs text-slate-700">
                      <td className="px-4 py-3 text-center">
                          <button 
                            onClick={(e) => toggleActions(e, sale.id)}
                            className={`px-3 py-1 rounded bg-blue-600 text-white font-bold flex items-center gap-1 transition-all hover:bg-blue-700 text-[10px]`}
                          >
                              Actions <ChevronDown size={10} />
                          </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                          {sale.date}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                           {sale.invoiceNo}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                           {sale.customerName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                           {sale.contactNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                           {sale.location}
                      </td>
                      <td className="px-4 py-3">
                           <span className={`inline-block px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                               sale.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 
                               sale.paymentStatus === 'Partial' ? 'bg-blue-100 text-blue-700' :
                               'bg-yellow-100 text-yellow-700'
                           }`}>
                               {sale.paymentStatus}
                           </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                           {sale.paymentMethod}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                          {formatCurrency(sale.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                          {formatCurrency(sale.totalPaid)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`${sale.sellDue > 0 ? '' : ''}`}>
                              {formatCurrency(sale.sellDue)}
                          </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`${sale.sellReturnDue > 0 ? '' : ''}`}>
                              {formatCurrency(sale.sellReturnDue)}
                          </span>
                      </td>
                      <td className="px-4 py-3">
                           <span className={`inline-block px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                               sale.shippingStatus === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                           }`}>
                               {sale.shippingStatus}
                           </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                          {sale.totalItems.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                          {sale.addedBy}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                          {sale.sellNote}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                          {sale.staffNote}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                          {sale.shippingDetails}
                      </td>
                    </tr>
                  ))
              ) : (
                  <tr>
                      <td colSpan={18} className="px-6 py-12 text-center text-slate-400 italic">
                          No data available in table
                      </td>
                  </tr>
              )}
            </tbody>
            {/* Footer Totals */}
            <tfoot className="bg-slate-200 font-bold text-slate-800 text-[11px] border-t border-slate-300 sticky bottom-0 z-20">
                <tr>
                    <td colSpan={8} className="px-4 py-3 text-center">Total:</td>
                    <td className="px-4 py-3 text-right bg-slate-300/50">{formatCurrency(totals.amount)}</td>
                    <td className="px-4 py-3 text-right bg-slate-300/50">{formatCurrency(totals.paid)}</td>
                    <td className="px-4 py-3 text-right bg-slate-300/50">{formatCurrency(totals.due)}</td>
                    <td className="px-4 py-3 text-right bg-slate-300/50">{formatCurrency(totals.returnDue)}</td>
                    <td colSpan={6}></td>
                </tr>
            </tfoot>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-white">
            <div>Showing 1 to {filteredSales.length} of {filteredSales.length} entries</div>
            <div className="flex gap-1">
                 <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
                <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Next</button>
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
                     Invoice #{sales.find(s => s.id === activeActionId)?.invoiceNo.split('-').pop()}
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
                     onClick={() => {
                         if (activeActionId && onNavigate) onNavigate(`edit-sale/${activeActionId}`);
                         setActiveActionId(null);
                     }}
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
            invoiceNo={selectedSale?.invoiceNo}
          />
      )}

      {/* Packing Slip Modal */}
      {packingSlipModalOpen && (
          <PackingSlip 
            onClose={() => setPackingSlipModalOpen(false)} 
            invoiceNo={selectedSale?.invoiceNo}
            date={selectedSale?.date}
          />
      )}

      {/* Delivery Note Modal */}
      {deliveryNoteModalOpen && (
          <DeliveryNote
            onClose={() => setDeliveryNoteModalOpen(false)} 
            invoiceNo={selectedSale?.invoiceNo}
            date={selectedSale?.date}
          />
      )}

      {/* Edit Shipping Modal */}
      {editShippingModalOpen && (
          <EditShippingModal 
            isOpen={editShippingModalOpen}
            onClose={() => setEditShippingModalOpen(false)}
            sale={selectedSale}
          />
      )}

      {/* Add Payment Modal */}
      {addPaymentModalOpen && (
          <AddPaymentModal
            isOpen={addPaymentModalOpen}
            onClose={() => setAddPaymentModalOpen(false)}
            sale={selectedSale}
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
