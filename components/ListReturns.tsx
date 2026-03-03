import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, FileText, FileSpreadsheet, Printer, 
  Columns, Download, ChevronDown, Filter, 
  ArrowUpDown, Eye, Edit, Trash2, MoreVertical,
  CreditCard, Banknote, X
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import ViewOrder from './ViewOrder';
import AddPaymentModal from './AddPaymentModal';
import ViewPaymentsModal from './ViewPaymentsModal';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

interface ReturnSale {
  id: string;
  customerId: string;
  date: string;
  invoiceNo: string;
  parentSale: string;
  customerName: string;
  location: string;
  paymentStatus: 'Paid' | 'Due' | 'Partial';
  totalAmount: number;
  paymentDue: number;
  addedBy?: string; // Added for filtering
}

interface ListReturnsProps {
    onNavigate: (page: string) => void;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  transformOrigin: string;
}

const ListReturns: React.FC<ListReturnsProps> = ({ onNavigate }) => {
  const {
    locations,
    users,
    customers,
    sales,
    updateSale: globalUpdateSale,
    addPayment: globalAddPayment,
    formatCurrency,
  } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  
  const [filters, setFilters] = useState({
      location: [] as string[],
      customer: [] as string[],
      user: [] as string[]
  });
  
  // Actions State
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-right' });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Modal State
  const [viewOrderModalOpen, setViewOrderModalOpen] = useState(false);
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false);
  const [viewPaymentsModalOpen, setViewPaymentsModalOpen] = useState(false);
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);

  const returns = useMemo<ReturnSale[]>(() => {
    return sales
      .filter(s => (s.sellReturnDue || 0) > 0 || (s.invoiceNo || '').toUpperCase().startsWith('CN'))
      .map(s => {
        const matchedCustomer = customers.find(c => c.id === String(s.customerId));
        const returnAmount = Math.max(0, s.sellReturnDue || 0);
        const grandTotal = s.grandTotal || s.totalAmount || 0;
        return {
          id: s.id,
          customerId: String(s.customerId || ''),
          date: s.date,
          invoiceNo: s.invoiceNo,
          parentSale: s.invoiceNo,
          customerName: s.customerName || matchedCustomer?.businessName || 'Walk-in Customer',
          location: s.location || '--',
          paymentStatus: s.paymentStatus === 'Overdue' ? 'Due' : (s.paymentStatus as ReturnSale['paymentStatus']),
          totalAmount: returnAmount > 0 ? returnAmount : grandTotal,
          paymentDue: returnAmount,
          addedBy: s.addedBy || '--',
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, customers]);

  const customerFilterOptions = useMemo(
    () => Array.from(new Set(returns.map(r => r.customerName))).sort(),
    [returns]
  );
  const userFilterOptions = useMemo(
    () => Array.from(new Set(users.map(u => u.name))).sort(),
    [users]
  );

  // Filter Logic
  const filteredReturns = returns.filter(r => 
    (r.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.customerName.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.location.length === 0 || filters.location.includes(r.location)) &&
    (filters.customer.length === 0 || filters.customer.includes(r.customerName)) &&
    (filters.user.length === 0 || (r.addedBy && filters.user.includes(r.addedBy)))
  );

  // Totals Calculation
  const totalAmount = filteredReturns.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const totalDue = filteredReturns.reduce((acc, curr) => acc + curr.paymentDue, 0);

  const toggleActions = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (activeActionId === id) {
      setActiveActionId(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const dropdownHeight = 280; 
      const spaceBelow = window.innerHeight - rect.bottom;
      const isDropUp = spaceBelow < dropdownHeight;
      
      setDropdownPosition({
        top: isDropUp ? undefined : rect.bottom + 8,
        bottom: isDropUp ? window.innerHeight - rect.top + 8 : undefined,
        left: rect.left - 140, // Adjust left to align nicely
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

  // Action Handlers
  const handleView = (id: string) => {
      setSelectedReturnId(id);
      setViewOrderModalOpen(true);
      setActiveActionId(null);
  };

  const handleEdit = () => {
      onNavigate('add-sell-return'); // Reuse the add page for editing simulation
      setActiveActionId(null);
  };

  const handleDelete = (id: string) => {
      if(confirm('Are you sure you want to delete this return?')) {
          const saleToUpdate = sales.find(s => s.id === id);
          if (saleToUpdate) {
              globalUpdateSale({
                  ...saleToUpdate,
                  sellReturnDue: 0,
              });
          }
      }
      setActiveActionId(null);
  };

  const handlePrint = (id: string) => {
      setSelectedReturnId(id);
      setViewOrderModalOpen(true); // Open view modal to print for now
      setActiveActionId(null);
  };

  const handleAddPayment = (id: string) => {
      setSelectedReturnId(id);
      setAddPaymentModalOpen(true);
      setActiveActionId(null);
  };

  const handleViewPayments = (id: string) => {
      setSelectedReturnId(id);
      setViewPaymentsModalOpen(true);
      setActiveActionId(null);
  };

  // Helper to adapt return object for AddPaymentModal
  const getSelectedReturnForPayment = () => {
      const ret = returns.find(r => r.id === selectedReturnId);
      if (!ret) return null;
      return {
          customerId: ret.customerId,
          customerName: ret.customerName,
          invoiceNo: ret.invoiceNo,
          location: ret.location,
          totalAmount: ret.totalAmount,
          sellDue: ret.paymentDue,
          sellNote: 'Sell Return Payment'
      };
  };

  const selectedReturn = selectedReturnId ? (returns.find(r => r.id === selectedReturnId) || null) : null;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header */}
      <h2 className="text-2xl font-bold text-slate-900">Sell Return</h2>

      {/* Filter Section */}
      <div className="bg-white rounded shadow-sm border border-slate-200 p-4">
          <div 
            className="flex items-center gap-2 cursor-pointer text-blue-600 mb-4"
            onClick={() => setShowFilters(!showFilters)}
          >
              <Filter size={16} />
              <span className="text-sm font-medium">Filters</span>
          </div>
          
          {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                  <div className="group">
                       <MultiSelect 
                            label="Business Location"
                            options={locations.map(loc => loc.name)}
                            selected={filters.location}
                            onChange={(val) => setFilters({...filters, location: val})}
                        />
                  </div>
                  <div className="group">
                        <MultiSelect 
                            label="Customer"
                            options={customerFilterOptions}
                            selected={filters.customer}
                            onChange={(val) => setFilters({...filters, customer: val})}
                        />
                  </div>
                  <div className="group">
                      <DateRangeFilter />
                  </div>
                  <div className="group">
                        <MultiSelect 
                            label="User"
                            options={userFilterOptions}
                            selected={filters.user}
                            onChange={(val) => setFilters({...filters, user: val})}
                        />
                  </div>
              </div>
          )}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-2">
               <span className="text-sm text-slate-600">Show</span>
               <select className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none">
                   <option>25</option>
                   <option>50</option>
                   <option>100</option>
               </select>
               <span className="text-sm text-slate-600">entries</span>
           </div>

           <div className="flex gap-1">
                <button className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><FileText size={12}/> Export CSV</button>
                <button className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><FileSpreadsheet size={12}/> Export Excel</button>
                <button className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><Printer size={12}/> Print</button>
                <button className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><Columns size={12}/> Column visibility</button>
                <button className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><FileText size={12}/> Export PDF</button>
           </div>

           <div className="flex items-center gap-2">
               <input 
                   type="text" 
                   placeholder="Search..." 
                   className="px-3 py-2 rounded border border-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
               />
           </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-white text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Invoice No. <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Parent Sale <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Customer name <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Location <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap text-center">Payment Status <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Payment due <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReturns.map((ret) => (
                <tr key={ret.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">{ret.date}</td>
                  <td className="px-4 py-3">{ret.invoiceNo}</td>
                  <td className="px-4 py-3">
                      <button className="text-blue-600 hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {ret.parentSale}
                      </button>
                  </td>
                  <td className="px-4 py-3">{ret.customerName}</td>
                  <td className="px-4 py-3">{ret.location}</td>
                  <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          ret.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                          {ret.paymentStatus}
                      </span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(ret.totalAmount)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(ret.paymentDue)}</td>
                  <td className="px-4 py-3 text-center">
                      <button 
                        onClick={(e) => toggleActions(e, ret.id)}
                        className={`px-3 py-1 rounded bg-blue-600 text-white font-bold flex items-center gap-1 transition-all hover:bg-blue-700 text-[10px] mx-auto`}
                      >
                          Actions <ChevronDown size={10} />
                      </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-200/60 font-bold text-slate-800 border-t border-slate-300">
                <tr>
                    <td colSpan={6} className="px-4 py-3 text-right">Total:</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(totalAmount)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(totalDue)}</td>
                    <td></td>
                </tr>
            </tfoot>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
            <div>Showing 1 to {filteredReturns.length} of {filteredReturns.length} entries</div>
            <div className="flex gap-1">
                 <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
                 <button className="px-3 py-1 bg-blue-600 text-white rounded shadow-sm">1</button>
                <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50">Next</button>
            </div>
        </div>

      </div>

      {/* Action Menu Portal */}
      {activeActionId && createPortal(
        <div 
            ref={dropdownRef}
            className={`fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 w-48 animate-in fade-in zoom-in-95 duration-200 overflow-y-auto ${dropdownPosition.transformOrigin}`}
            style={{ 
                top: dropdownPosition.top, 
                left: dropdownPosition.left, 
                bottom: dropdownPosition.bottom
            }}
            onClick={(e) => e.stopPropagation()} 
        >
            <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</span>
                 <button onClick={() => setActiveActionId(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                     <X size={14} />
                 </button>
            </div>
            
            <div className="py-1">
                <button 
                    onClick={() => handleView(activeActionId)}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                >
                    <Eye size={14} className="text-blue-500" /> View
                </button>
                <button 
                    onClick={handleEdit}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                >
                    <Edit size={14} className="text-amber-500" /> Edit
                </button>
                <button 
                    onClick={() => handleDelete(activeActionId)}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                >
                    <Trash2 size={14} className="text-rose-500" /> Delete
                </button>
                <button 
                    onClick={() => handlePrint(activeActionId)}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                >
                    <Printer size={14} className="text-slate-500" /> Print
                </button>
                
                <div className="h-px bg-slate-100 my-1 mx-2"></div>
                
                <button 
                    onClick={() => handleAddPayment(activeActionId)}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                >
                    <CreditCard size={14} className="text-emerald-500" /> Add payment
                </button>
                <button 
                    onClick={() => handleViewPayments(activeActionId)}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                >
                    <Banknote size={14} className="text-indigo-500" /> View Payments
                </button>
            </div>
        </div>,
        document.body
      )}

      {/* View Details Modal */}
      {viewOrderModalOpen && (
          <ViewOrder 
            onClose={() => setViewOrderModalOpen(false)} 
            invoiceNo={selectedReturn?.invoiceNo}
          />
      )}

      {/* Add Payment Modal */}
      {addPaymentModalOpen && (
          <AddPaymentModal
            isOpen={addPaymentModalOpen}
            onClose={() => setAddPaymentModalOpen(false)}
            sale={getSelectedReturnForPayment()}
            onSave={globalAddPayment}
          />
      )}

      {/* View Payments Modal */}
      {viewPaymentsModalOpen && (
          <ViewPaymentsModal
            isOpen={viewPaymentsModalOpen}
            onClose={() => setViewPaymentsModalOpen(false)}
            invoiceNo={selectedReturn?.invoiceNo}
          />
      )}

    </div>
  );
};

export default ListReturns;
