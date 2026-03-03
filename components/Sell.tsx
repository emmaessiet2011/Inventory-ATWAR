import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, FileText, FileSpreadsheet, Printer, 
  Columns, Download, Edit, Trash2, X, ChevronDown, 
  ArrowUpDown, Filter, Eye, MoreVertical, Calendar,
  CreditCard, Truck, CheckCircle2, Clock, AlertTriangle, RefreshCcw,
  Gift, ShoppingBag, User
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

// Utility for currency
const formatOMR = (amount: number) => {
  return `OMR ${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
};

interface Sale {
  id: string;
  date: string;
  invoiceNo: string;
  customer: string;
  contactNumber: string;
  location: string;
  status: 'Final' | 'Draft' | 'Quotation' | 'Proforma';
  paymentStatus: 'Paid' | 'Due' | 'Partial' | 'Overdue';
  grandTotal: number;
  paymentDue: number;
  addedBy: string;
  shippingStatus?: 'Ordered' | 'Packed' | 'Shipped' | 'Delivered' | 'Cancelled';
  totalItems: number;
}

const initialSales: Sale[] = [
  { id: '1', date: '2023-11-25 14:30', invoiceNo: 'INV-2023-001', customer: 'Walk-in Customer', contactNumber: '', location: 'CR:1450968', status: 'Final', paymentStatus: 'Paid', grandTotal: 120.500, paymentDue: 0.000, addedBy: 'Admin', totalItems: 3, shippingStatus: 'Delivered' },
  { id: '2', date: '2023-11-26 09:15', invoiceNo: 'INV-2023-002', customer: 'Al Maha Hypermarket', contactNumber: '99887766', location: 'CR:1450968', status: 'Final', paymentStatus: 'Due', grandTotal: 450.000, paymentDue: 450.000, addedBy: 'Sales Staff', totalItems: 12, shippingStatus: 'Ordered' },
  { id: '3', date: '2023-11-26 11:00', invoiceNo: 'INV-2023-003', customer: 'Happy Pets Shop', contactNumber: '91234567', location: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', status: 'Draft', paymentStatus: 'Due', grandTotal: 85.250, paymentDue: 85.250, addedBy: 'Admin', totalItems: 5 },
  { id: '4', date: '2023-11-27 16:45', invoiceNo: 'INV-2023-004', customer: 'Ahmed Al-Balushi', contactNumber: '99112233', location: 'CR:1450968', status: 'Final', paymentStatus: 'Partial', grandTotal: 1200.000, paymentDue: 600.000, addedBy: 'Manager', totalItems: 1, shippingStatus: 'Shipped' },
];

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  transformOrigin: string;
}

interface SellProps {
    onNavigate?: (page: string) => void;
}

const Sell: React.FC<SellProps> = ({
  onNavigate }) => {
  const { locations } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [showFilters, setShowFilters] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-right' });
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Filter States
  const [filters, setFilters] = useState({
      location: [] as string[],
      customer: [] as string[],
      paymentStatus: [] as string[],
      user: [] as string[]
  });

  const toggleActions = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (activeActionId === id) {
      setActiveActionId(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const dropdownHeight = 320; 
      const spaceBelow = window.innerHeight - rect.bottom;
      const isDropUp = spaceBelow < dropdownHeight;
      
      setDropdownPosition({
        top: isDropUp ? undefined : rect.bottom + 8,
        bottom: isDropUp ? window.innerHeight - rect.top + 8 : undefined,
        left: rect.left - 180,
        transformOrigin: isDropUp ? 'origin-bottom-right' : 'origin-top-right'
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

  const getPaymentStatusColor = (status: string) => {
      switch(status) {
          case 'Paid': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
          case 'Due': return 'bg-rose-100 text-rose-700 border-rose-200';
          case 'Partial': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'Overdue': return 'bg-red-100 text-red-700 border-red-200';
          default: return 'bg-slate-100 text-slate-600';
      }
  };

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'Final': return 'bg-emerald-100 text-emerald-700';
          case 'Draft': return 'bg-slate-100 text-slate-600';
          case 'Quotation': return 'bg-cyan-100 text-cyan-700';
          case 'Proforma': return 'bg-indigo-100 text-indigo-700';
          default: return 'bg-slate-100 text-slate-600';
      }
  };

  const filteredSales = sales.filter(s => 
    (s.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contactNumber.includes(searchTerm)) &&
    (filters.location.length === 0 || filters.location.includes(s.location)) &&
    (filters.customer.length === 0 || filters.customer.includes(s.customer)) &&
    (filters.paymentStatus.length === 0 || filters.paymentStatus.includes(s.paymentStatus)) &&
    (filters.user.length === 0 || filters.user.includes(s.addedBy))
  );

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">All Sales</h2>
          <p className="text-slate-500 mt-2 text-lg font-light">
            Manage your invoices, sales, and customer transactions.
          </p>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={() => onNavigate && onNavigate('pos')}
                className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
            >
                <ShoppingBag size={18} /> POS
            </button>
            <button 
                onClick={() => onNavigate && onNavigate('add-sale')}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
            >
                <Plus size={18} /> Add Sale
            </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500"></div>
        
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
                 <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm border ${showFilters ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                 >
                     <Filter size={14} /> Filters
                 </button>
                 <div className="w-px h-8 bg-slate-300 mx-2 hidden xl:block"></div>
                 {[
                    { icon: FileSpreadsheet, label: 'Excel' },
                    { icon: Printer, label: 'Print' },
                    { icon: Download, label: 'PDF' },
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

           {/* Filters */}
           {showFilters && (
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200 animate-in slide-in-from-top-2 fade-in">
                   <MultiSelect 
                       label="Business Location"
                       options={locations.map(loc => loc.name)}
                       selected={filters.location}
                       onChange={(val) => setFilters({...filters, location: val})}
                   />
                   <MultiSelect 
                       label="Customer"
                       options={['Walk-in Customer', 'Al Maha Hypermarket', 'Happy Pets Shop']}
                       selected={filters.customer}
                       onChange={(val) => setFilters({...filters, customer: val})}
                   />
                   <MultiSelect 
                       label="Payment Status"
                       options={['Paid', 'Due', 'Partial', 'Overdue']}
                       selected={filters.paymentStatus}
                       onChange={(val) => setFilters({...filters, paymentStatus: val})}
                   />
                   <div className="group">
                        <DateRangeFilter />
                   </div>
               </div>
           )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 text-slate-500 font-semibold border-b border-slate-200 z-10">
              <tr>
                <th className="px-6 py-4 w-40">Date <ArrowUpDown size={12} className="inline ml-1" /></th>
                <th className="px-6 py-4 w-32">Invoice No</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Payment</th>
                <th className="px-6 py-4 text-right">Total</th>
                <th className="px-6 py-4 text-right">Due</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.length > 0 ? (
                  filteredSales.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 text-slate-500 text-xs font-medium whitespace-nowrap">
                          {s.date}
                      </td>
                      <td className="px-6 py-4">
                           <span className="font-bold text-slate-700 text-xs bg-slate-100 px-2 py-1 rounded border border-slate-200">{s.invoiceNo}</span>
                           <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><Truck size={10} /> {s.location}</div>
                      </td>
                      <td className="px-6 py-4">
                           <div className="font-bold text-slate-800">{s.customer}</div>
                           {s.contactNumber && <div className="text-[10px] text-slate-400 flex items-center gap-1"><User size={10} /> {s.contactNumber}</div>}
                      </td>
                      <td className="px-6 py-4 text-center">
                           <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${getStatusColor(s.status)}`}>
                               {s.status}
                           </span>
                           {s.shippingStatus && (
                               <div className="mt-1 text-[10px] font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 inline-block">
                                   {s.shippingStatus}
                               </div>
                           )}
                      </td>
                      <td className="px-6 py-4 text-center">
                           <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getPaymentStatusColor(s.paymentStatus)}`}>
                               {s.paymentStatus === 'Paid' && <CheckCircle2 size={10} />}
                               {s.paymentStatus === 'Due' && <AlertTriangle size={10} />}
                               {s.paymentStatus === 'Partial' && <Clock size={10} />}
                               {s.paymentStatus}
                           </span>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-slate-800">
                          {formatOMR(s.grandTotal)}
                      </td>
                      <td className="px-6 py-4 text-right">
                          <span className={`font-bold ${s.paymentDue > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                              {formatOMR(s.paymentDue)}
                          </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                          <button 
                            onClick={(e) => toggleActions(e, s.id)}
                            className={`p-2 rounded-xl transition-all ${activeActionId === s.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-50 hover:text-slate-600'}`}
                          >
                              <MoreVertical size={16} />
                          </button>
                      </td>
                    </tr>
                  ))
              ) : (
                  <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic">
                          No sales found
                      </td>
                  </tr>
              )}
            </tbody>
            {/* Totals Footer */}
            <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-700 text-xs sticky bottom-0 z-10 shadow-inner">
                <tr>
                    <td colSpan={5} className="px-6 py-4 text-right uppercase tracking-wider text-slate-500">Total:</td>
                    <td className="px-6 py-4 text-right font-mono text-base">{formatOMR(filteredSales.reduce((acc, curr) => acc + curr.grandTotal, 0))}</td>
                    <td className="px-6 py-4 text-right font-mono text-base text-red-600">{formatOMR(filteredSales.reduce((acc, curr) => acc + curr.paymentDue, 0))}</td>
                    <td></td>
                </tr>
            </tfoot>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-slate-50/50">
            <div>Showing {filteredSales.length > 0 ? 1 : 0} to {filteredSales.length} of {filteredSales.length} entries</div>
            <div className="flex gap-2">
                 <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm" disabled>Previous</button>
                 <button className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md shadow-blue-900/10">1</button>
                <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm" disabled>Next</button>
            </div>
        </div>

      </div>

      {/* Action Menu Portal */}
      {activeActionId && createPortal(
        <div 
            ref={dropdownRef}
            className={`fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 py-2 w-56 animate-in fade-in zoom-in-95 duration-200 ${dropdownPosition.transformOrigin}`}
            style={{ top: dropdownPosition.top, left: dropdownPosition.left, bottom: dropdownPosition.bottom }}
        >
            <div className="px-4 py-2 border-b border-slate-50 mb-1">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Actions</span>
            </div>
            <button className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                <Eye size={16} /> View Details
            </button>
            <button className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                <Edit size={16} /> Edit Sale
            </button>
            <button className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                <Printer size={16} /> Print Invoice
            </button>
            <button className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                <CreditCard size={16} /> Add Payment
            </button>
            <button className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                <Truck size={16} /> Edit Shipping
            </button>
            <button className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                <RefreshCcw size={16} /> Sell Return
            </button>
            <div className="h-px bg-slate-100 my-1 mx-2"></div>
            <button className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-3 transition-colors">
                <Trash2 size={16} /> Delete
            </button>
        </div>,
        document.body
      )}

    </div>
  );
};

export default Sell;
