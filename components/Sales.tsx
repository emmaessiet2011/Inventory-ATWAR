import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, FileText, FileSpreadsheet, Printer, 
  Columns, Edit, Trash2, X, ChevronDown, 
  ArrowUpDown, Filter, Eye,
  CreditCard, Truck, 
  Undo2, Package, ScrollText, Banknote, Link, Paperclip, MapPin
} from 'lucide-react';
import { useNotifications } from '../src/context/NotificationContext';
import ViewOrder from './ViewOrder'; 
import PackingSlip from './PackingSlip'; 
import DeliveryNote from './DeliveryNote'; 
import EditShippingModal from './EditShippingModal'; 
import AddPaymentModal from './AddPaymentModal'; 
import ViewPaymentsModal from './ViewPaymentsModal'; 
import InvoiceURLModal from './InvoiceURLModal';
import MultiSelect from './MultiSelect';
import DateRangeFilter from './DateRangeFilter';
import { useGlobalContext, Sale as GlobalSale } from '../src/context/GlobalContext';

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
    locations,
    deleteSale: globalDeleteSale,
    users,
    customers: globalCustomers,
    addPayment: globalAddPayment,
    formatCurrency
  } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-right' });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showFilters, setShowFilters] = useState(false);

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
  
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const sales = globalSales;

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
      const sale = sales.find(s => s.id === saleId);
      setSelectedSaleId(saleId);
      setInvoiceURLModalOpen(true);
      setActiveActionId(null);
      addNotification({
        title: 'Invoice URL Generated',
        message: `Public link for invoice ${sale?.invoiceNo} has been generated.`,
        type: 'info'
      });
  };

  const handleDeleteSale = (saleId: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (window.confirm(`Are you sure you want to delete invoice ${sale?.invoiceNo}? This will restore stock.`)) {
        globalDeleteSale(saleId); // Deletes from GlobalContext + restores stock
        addNotification({
            title: 'Sale Deleted',
            message: `Invoice ${sale?.invoiceNo} has been removed and stock restored.`,
            type: 'success'
        });
    }
    setActiveActionId(null);
  };

  const handleSellReturn = (saleId: string) => {
      if (onNavigate) {
          onNavigate('add-sell-return');
      }
      setActiveActionId(null);
  };

  const handleEditSale = (saleId: string) => {
    if (onNavigate) {
      onNavigate(`edit-sale/${saleId}`);
    }
    setActiveActionId(null);
  };

  const scopedSales = sales.filter(s => !statusFilter || (s.status || s.saleStatus) === statusFilter);

  const filteredSales = scopedSales.filter(s => 
    ((s.invoiceNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.location || '').toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.location.length === 0 || filters.location.includes(s.location || '')) &&
    (filters.customer.length === 0 || filters.customer.includes(s.customerName || '')) &&
    (filters.paymentStatus.length === 0 || filters.paymentStatus.includes(s.paymentStatus || '')) &&
    (filters.shippingStatus.length === 0 || filters.shippingStatus.includes(s.shippingStatus || '')) &&
    (filters.user.length === 0 || filters.user.includes(s.addedBy || ''))
  );

  const totals = filteredSales.reduce((acc, curr) => ({
      amount: acc.amount + (curr.grandTotal || curr.totalAmount || 0),
      paid: acc.paid + (curr.totalPaid || 0),
      due: acc.due + (curr.sellDue || 0),
      returnDue: acc.returnDue + (curr.sellReturnDue || 0)
  }), { amount: 0, paid: 0, due: 0, returnDue: 0 });

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">{title || (statusFilter === 'Draft' ? 'Drafts' : statusFilter === 'Quotation' ? 'Quotations' : 'Sales')}</h2>
          <p className="text-slate-500 mt-2 text-lg font-light">
            Manage your sales transactions, invoices, and shipping.
          </p>
        </div>
        <button 
          onClick={() => onNavigate && onNavigate(addPage || (statusFilter === 'Draft' ? 'add-draft' : statusFilter === 'Quotation' ? 'add-quotation' : 'add-sale'))}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
        >
          <Plus size={18} /> {addButtonLabel || (statusFilter === 'Draft' ? 'Add Draft' : statusFilter === 'Quotation' ? 'Add Quotation' : 'Add Sale')}
        </button>
      </div>

      {/* Filter Section */}
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
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
                      <MultiSelect 
                          label="Payment Status"
                          options={['Paid', 'Due', 'Partial', 'Overdue']}
                          selected={filters.paymentStatus}
                          onChange={(val) => setFilters({...filters, paymentStatus: val})}
                      />
                      <MultiSelect 
                          label="Shipping Status"
                          options={['Delivered', 'Pending', 'Shipped', 'Ordered', 'Packed']}
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
                          <DateRangeFilter />
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
                      <select className="border-0 bg-white shadow-sm ring-1 ring-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer appearance-none">
                          <option>25</option>
                          <option>50</option>
                          <option>100</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto">
                 {[
                    { icon: FileText, label: 'Export CSV' },
                    { icon: FileSpreadsheet, label: 'Export Excel' },
                    { icon: Printer, label: 'Print' },
                    { icon: Columns, label: 'Column visibility' },
                    { icon: FileText, label: 'Export PDF' },
                 ].map((action, i) => (
                      <button key={i} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                          <action.icon size={14} /> {action.label}
                      </button>
                 ))}
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
          <table className="w-full text-[10px] text-left border-collapse">
            <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 text-slate-500 font-semibold border-b border-slate-200 z-10">
              <tr>
                <th className="px-4 py-4 whitespace-nowrap">Action</th>
                <th className="px-4 py-4 whitespace-nowrap">Date <ArrowUpDown size={12} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-4 whitespace-nowrap">Invoice No. <ArrowUpDown size={12} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-4 whitespace-nowrap">Customer Name <ArrowUpDown size={12} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-4 whitespace-nowrap">Contact Number</th>
                <th className="px-4 py-4 whitespace-nowrap">Location</th>
                <th className="px-4 py-4 whitespace-nowrap text-center">Payment Status</th>
                <th className="px-4 py-4 whitespace-nowrap text-center">Payment Method</th>
                <th className="px-4 py-4 whitespace-nowrap text-right">Total Amount</th>
                <th className="px-4 py-4 whitespace-nowrap text-right">Total Paid</th>
                <th className="px-4 py-4 whitespace-nowrap text-right">Sell Due</th>
                <th className="px-4 py-4 whitespace-nowrap text-right">Sell Return Due</th>
                <th className="px-4 py-4 whitespace-nowrap text-center">Shipping Status</th>
                <th className="px-4 py-4 whitespace-nowrap text-right">Total Items</th>
                <th className="px-4 py-4 whitespace-nowrap">Added By</th>
                <th className="px-4 py-4 whitespace-nowrap">Sell Note</th>
                <th className="px-4 py-4 whitespace-nowrap">Staff Note</th>
                <th className="px-4 py-4 whitespace-nowrap">Shipping Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.length > 0 ? (
                  filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors group">
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
                      <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">{sale.date}</td>
                      <td className="px-4 py-3 text-slate-700 font-bold whitespace-nowrap">
                        <div className="flex flex-col items-start">
                          <span>{sale.invoiceNo}</span>
                          {sale.sellReturnDue > 0 && (
                            <div className="mt-1.5 relative group/return cursor-help" title={`Sale Return: ${formatCurrency(sale.sellReturnDue || 0)}`}>
                              <div className="absolute inset-0 bg-rose-500 blur-[6px] opacity-40 rounded-full animate-pulse"></div>
                              <div className="relative w-4 h-4 rounded-full bg-rose-600 flex items-center justify-center text-white border border-rose-400/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] transition-transform group-hover/return:scale-110 duration-300">
                                <Undo2 size={8} strokeWidth={3} className="drop-shadow-sm" />
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-800 font-bold whitespace-nowrap">{sale.customerName}</td>
                      <td className="px-4 py-3 text-slate-500 font-medium whitespace-nowrap">{sale.contactNumber}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[10px]">{sale.location}</td>
                      <td className="px-4 py-3 text-center">
                           <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shadow-sm border ${
                               sale.paymentStatus === 'Paid' ? 'bg-emerald-500 text-white border-emerald-400' : 
                               sale.paymentStatus === 'Partial' ? 'bg-sky-500 text-white border-sky-400' :
                               'bg-amber-500 text-white border-amber-400'
                           }`}>
                               {sale.paymentStatus}
                           </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 font-medium whitespace-nowrap">{sale.paymentMethod}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">{formatCurrency(sale.grandTotal || sale.totalAmount || 0)}</td>
                      <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatCurrency(sale.totalPaid || 0)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`${(sale.sellDue || 0) > 0 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>{formatCurrency(sale.sellDue || 0)}</span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`${(sale.sellReturnDue || 0) > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>{formatCurrency(sale.sellReturnDue || 0)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                           <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                               sale.shippingStatus === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                           }`}>
                               {sale.shippingStatus}
                           </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 font-medium whitespace-nowrap">{(sale.totalItems || 0).toFixed(3)}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{sale.addedBy}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap truncate max-w-[100px]">{sale.sellNote}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap truncate max-w-[100px]">{sale.staffNote}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap truncate max-w-[100px]">{sale.shippingDetails}</td>
                    </tr>
                  ))
              ) : (
                  <tr>
                      <td colSpan={18} className="px-6 py-12 text-center text-slate-400 italic">
                          No sales found
                      </td>
                  </tr>
              )}
            </tbody>
            {/* Footer Totals */}
            <tfoot className="bg-slate-200 font-bold text-slate-800 text-[11px] uppercase border-t border-slate-300 sticky bottom-0 z-20 shadow-inner">
                <tr>
                    <td colSpan={8} className="px-4 py-4 text-right">Total:</td>
                    <td className="px-4 py-4 text-right bg-slate-300/50">{formatCurrency(totals.amount)}</td>
                    <td className="px-4 py-4 text-right bg-slate-300/50">{formatCurrency(totals.paid)}</td>
                    <td className="px-4 py-4 text-right bg-slate-300/50">{formatCurrency(totals.due)}</td>
                    <td className="px-4 py-4 text-right bg-slate-300/50">{formatCurrency(totals.returnDue)}</td>
                    <td colSpan={6}></td>
                </tr>
            </tfoot>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-slate-50/50">
            <div>Showing 1 to {filteredSales.length} of {filteredSales.length} entries</div>
            <div className="flex gap-1">
                 <button className="px-3 py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm" disabled>Previous</button>
                 <button className="px-3 py-1.5 bg-blue-600 text-white rounded shadow-md shadow-blue-900/10">1</button>
                 <button className="px-3 py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm">2</button>
                 <button className="px-3 py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm">3</button>
                 <button className="px-3 py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm">4</button>
                 <button className="px-3 py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm">5</button>
                <button className="px-3 py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm">Next</button>
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
            invoiceNo={selectedSaleId ? sales.find(s => s.id === selectedSaleId)?.invoiceNo : undefined}
          />
      )}

      {/* Packing Slip Modal */}
      {packingSlipModalOpen && (
          <PackingSlip 
            onClose={() => setPackingSlipModalOpen(false)} 
            invoiceNo={selectedSaleId ? sales.find(s => s.id === selectedSaleId)?.invoiceNo : undefined}
            date={selectedSaleId ? sales.find(s => s.id === selectedSaleId)?.date : undefined}
          />
      )}

      {/* Delivery Note Modal */}
      {deliveryNoteModalOpen && (
          <DeliveryNote
            onClose={() => setDeliveryNoteModalOpen(false)} 
            invoiceNo={selectedSaleId ? sales.find(s => s.id === selectedSaleId)?.invoiceNo : undefined}
            date={selectedSaleId ? sales.find(s => s.id === selectedSaleId)?.date : undefined}
          />
      )}

      {/* Edit Shipping Modal */}
      {editShippingModalOpen && (
          <EditShippingModal 
            isOpen={editShippingModalOpen}
            onClose={() => setEditShippingModalOpen(false)}
            sale={selectedSaleId ? sales.find(s => s.id === selectedSaleId) : null}
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

    </div>
  );
};

export default Sales;
