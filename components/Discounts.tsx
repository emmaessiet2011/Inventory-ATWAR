import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, FileText, FileSpreadsheet, Printer, 
  Columns, Download, ChevronDown, ArrowUpDown,
  Edit, Trash2, Tag, MoreVertical, Ban, CheckCircle2, X
} from 'lucide-react';
import AddDiscountModal from './AddDiscountModal';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

interface Discount {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  discountAmount: string;
  priority: number;
  brand: string;
  category: string;
  products: string;
  location: string;
  isActive: boolean;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  transformOrigin: string;
}

// Initial Mock Data
const initialDiscounts: Discount[] = [
    {
        id: 'DISC-001',
        name: 'Summer Sale',
        startsAt: '2026-06-01 00:00',
        endsAt: '2026-08-31 23:59',
        discountAmount: '15%',
        priority: 1,
        brand: 'All',
        category: 'Pet Accessories',
        products: 'Selected Items',
        location: 'CR:1450968',
        isActive: true
    },
    {
        id: 'DISC-002',
        name: 'Clearance - Old Stock',
        startsAt: '2026-01-01 00:00',
        endsAt: '2026-12-31 23:59',
        discountAmount: '50%',
        priority: 5,
        brand: 'Danna',
        category: 'All',
        products: 'All',
        location: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649',
        isActive: false
    },
    {
        id: 'DISC-003',
        name: 'New Customer Welcome',
        startsAt: '2026-02-01 00:00',
        endsAt: '2026-02-28 23:59',
        discountAmount: '10 OMR',
        priority: 2,
        brand: 'All',
        category: 'All',
        products: 'All',
        location: 'All locations',
        isActive: true
    }
];

interface DiscountsProps {
    onNavigate: (page: string) => void;
}

const Discounts: React.FC<DiscountsProps> = ({
  onNavigate }) => {
  const { locations } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [discounts, setDiscounts] = useState<Discount[]>(initialDiscounts);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Actions State
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-right' });
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Filters State
  const [filters, setFilters] = useState({
      brand: [] as string[],
      category: [] as string[],
      location: [] as string[]
  });

  const toggleActions = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (activeActionId === id) {
      setActiveActionId(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const dropdownHeight = 160; 
      const spaceBelow = window.innerHeight - rect.bottom;
      const isDropUp = spaceBelow < dropdownHeight;
      
      setDropdownPosition({
        top: isDropUp ? undefined : rect.bottom + 4,
        bottom: isDropUp ? window.innerHeight - rect.top + 4 : undefined,
        left: rect.left - 120, 
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

  const handleToggleStatus = (id: string) => {
      const discount = discounts.find(d => d.id === id);
      if (!discount) return;

      const newStatus = !discount.isActive;
      const action = discount.isActive ? 'deactivate' : 'activate';

      if (confirm(`Are you sure you want to ${action} discount "${discount.name}"?`)) {
          setDiscounts(discounts.map(d => d.id === id ? { ...d, isActive: newStatus } : d));
          setActiveActionId(null);
      }
  };

  const handleDelete = (id: string) => {
      if (confirm('Are you sure you want to delete this discount?')) {
          setDiscounts(discounts.filter(d => d.id !== id));
          setActiveActionId(null);
      }
  };

  const handleSaveDiscount = (data: any) => {
      const newDiscount: Discount = {
          id: Date.now().toString(),
          name: data.name,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          discountAmount: data.discountAmount,
          priority: Number(data.priority) || 0,
          brand: data.brand,
          category: data.category,
          products: data.products,
          location: data.location,
          isActive: data.isActive
      };
      setDiscounts([...discounts, newDiscount]);
  };
  
  const filteredDiscounts = discounts.filter(d => 
      (d.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filters.brand.length === 0 || filters.brand.includes(d.brand)) &&
      (filters.category.length === 0 || filters.category.includes(d.category)) &&
      (filters.location.length === 0 || filters.location.includes(d.location))
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header */}
      <h2 className="text-2xl font-bold text-slate-900">Discount</h2>

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
               <button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-1"
               >
                   <Plus size={16} /> Add
               </button>
               <input 
                   type="text" 
                   placeholder="Search..." 
                   className="px-3 py-2 rounded border border-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
               />
           </div>
        </div>
        
        {/* Filters Row */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="group">
                  <MultiSelect 
                    label="Brand"
                    options={['Danna', 'Kennol', 'Cebican']}
                    selected={filters.brand}
                    onChange={(val) => setFilters({...filters, brand: val})}
                  />
             </div>
             <div className="group">
                  <MultiSelect 
                    label="Category"
                    options={['Pet Accessories', 'Pet Food', 'Engine Oil']}
                    selected={filters.category}
                    onChange={(val) => setFilters({...filters, category: val})}
                  />
             </div>
             <div className="group">
                  <MultiSelect 
                    label="Location"
                    options={locations.map(loc => loc.name)}
                    selected={filters.location}
                    onChange={(val) => setFilters({...filters, location: val})}
                  />
             </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-white text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap w-8">
                    <input type="checkbox" className="rounded border-slate-300" />
                </th>
                <th className="px-4 py-3 whitespace-nowrap">Name <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Starts At <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Ends At <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Discount Amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Priority <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Brand <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Category <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Products <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Location <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap w-24 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                <tr className="bg-amber-50">
                    <td colSpan={11} className="px-4 py-2">
                        <button className="bg-amber-400 text-amber-900 text-[10px] font-bold px-3 py-1 rounded shadow-sm hover:bg-amber-500 transition-colors">
                            Deactivate Selected
                        </button>
                    </td>
                </tr>
                {filteredDiscounts.length > 0 ? (
                    filteredDiscounts.map(d => (
                        <tr key={d.id} className={`hover:bg-slate-50 transition-colors ${!d.isActive ? 'opacity-50 bg-slate-50' : ''}`}>
                            <td className="px-4 py-3"><input type="checkbox" className="rounded border-slate-300" /></td>
                            <td className="px-4 py-3 font-bold text-slate-700">
                                {d.name} 
                                {!d.isActive && <span className="ml-2 text-[10px] text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded font-bold border border-rose-100">Inactive</span>}
                            </td>
                            <td className="px-4 py-3">{d.startsAt}</td>
                            <td className="px-4 py-3">{d.endsAt}</td>
                            <td className="px-4 py-3">{d.discountAmount}</td>
                            <td className="px-4 py-3">{d.priority}</td>
                            <td className="px-4 py-3">{d.brand}</td>
                            <td className="px-4 py-3">{d.category}</td>
                            <td className="px-4 py-3">{d.products}</td>
                            <td className="px-4 py-3">{d.location}</td>
                            <td className="px-4 py-3 text-center">
                                <button 
                                    onClick={(e) => toggleActions(e, d.id)}
                                    className={`p-2 rounded-lg transition-all duration-200 ${activeActionId === d.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                                >
                                    <MoreVertical size={16} />
                                </button>
                            </td>
                        </tr>
                    ))
                ) : (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-slate-500 bg-slate-50/50">
                          No data available in table
                      </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
            <div>Showing {filteredDiscounts.length > 0 ? 1 : 0} to {filteredDiscounts.length} of {filteredDiscounts.length} entries</div>
            <div className="flex gap-1">
                 <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
                <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Next</button>
            </div>
        </div>

      </div>

      <AddDiscountModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveDiscount}
      />

       {/* Action Menu Portal */}
       {activeActionId && createPortal(
        <div 
            ref={dropdownRef}
            className={`fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 py-2 w-48 animate-in fade-in zoom-in-95 duration-200 ${dropdownPosition.transformOrigin}`}
            style={{ top: dropdownPosition.top, left: dropdownPosition.left, bottom: dropdownPosition.bottom }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="px-4 py-2 border-b border-slate-50 mb-1">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Actions</span>
            </div>
            
            <button className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                <Edit size={16} className="text-amber-500" /> Edit
            </button>
            <button 
                onClick={() => handleDelete(activeActionId!)}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <Trash2 size={16} className="text-rose-500" /> Delete
            </button>
            
            <div className="h-px bg-slate-100 my-1 mx-2"></div>
            
            {(() => {
                const discount = discounts.find(d => d.id === activeActionId);
                if (!discount) return null;
                const isActive = discount.isActive;
                
                return (
                    <button 
                        onClick={() => handleToggleStatus(discount.id)}
                        className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center gap-3 transition-colors ${isActive ? 'text-red-500 hover:bg-red-50 hover:text-red-700' : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'}`}
                    >
                        {isActive ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                        {isActive ? 'Deactivate' : 'Activate'}
                    </button>
                )
            })()}
        </div>,
        document.body
      )}
    </div>
  );
};

export default Discounts;