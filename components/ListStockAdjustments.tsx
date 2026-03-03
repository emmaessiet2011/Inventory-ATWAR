import React, { useState } from 'react';
import { 
  Plus, Search, FileText, FileSpreadsheet, Printer, 
  Download, Edit, Trash2, 
  Sliders, Filter
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

interface StockAdjustment {
  id: number;
  date: string;
  referenceNo: string;
  location: string;
  adjustmentType: 'Normal' | 'Abnormal';
  totalAmount: number;
  reason: string;
  addedBy: string;
}

interface ListStockAdjustmentsProps {
  onNavigate: (page: string) => void;
}

const ListStockAdjustments: React.FC<ListStockAdjustmentsProps> = ({ onNavigate }) => {
  const { locations } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  
  const [filters, setFilters] = useState({
      location: [] as string[],
      adjustmentType: [] as string[],
      user: [] as string[]
  });
  
  const [adjustments] = useState<StockAdjustment[]>([
    {
      id: 1,
      date: '2023-11-24 14:30',
      referenceNo: 'SA2023/0001',
      location: 'CR:1450968',
      adjustmentType: 'Normal',
      totalAmount: 150.000,
      reason: 'Stock count discrepancy',
      addedBy: 'Admin User'
    },
    {
      id: 2,
      date: '2023-11-25 10:15',
      referenceNo: 'SA2023/0002',
      location: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649',
      adjustmentType: 'Abnormal',
      totalAmount: 45.500,
      reason: 'Damaged items',
      addedBy: 'Sales Manager'
    }
  ]);

  const filteredAdjustments = adjustments.filter(a => 
    (a.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.location.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.location.length === 0 || filters.location.includes(a.location)) &&
    (filters.adjustmentType.length === 0 || filters.adjustmentType.includes(a.adjustmentType)) &&
    (filters.user.length === 0 || filters.user.includes(a.addedBy))
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Sliders className="text-red-600" size={32} />
            Stock Adjustments
          </h2>
          <p className="text-slate-500 mt-1">Manage and track stock adjustments across locations.</p>
        </div>
        <button 
          onClick={() => onNavigate('add-stock-adjustment')}
          className="bg-red-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-red-700 transition shadow-lg shadow-red-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
        >
          <Plus size={18} /> Add Stock Adjustment
        </button>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded shadow-sm border border-slate-200 p-4">
          <div 
            className="flex items-center gap-2 cursor-pointer text-red-600 mb-4"
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
                            label="Adjustment Type"
                            options={['Normal', 'Abnormal']}
                            selected={filters.adjustmentType}
                            onChange={(val) => setFilters({...filters, adjustmentType: val})}
                        />
                  </div>
                  <div className="group">
                      <DateRangeFilter />
                  </div>
                  <div className="group">
                       <MultiSelect 
                            label="User"
                            options={['Admin User', 'Sales Manager']}
                            selected={filters.user}
                            onChange={(val) => setFilters({...filters, user: val})}
                        />
                  </div>
              </div>
          )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
        
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
            <div className="flex items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-1 xl:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search adjustments..." 
                  className="w-full pl-9 pr-4 py-2 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                className={`p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition shadow-sm ${showFilters ? 'bg-slate-100' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter size={18} />
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto">
              {[
                { icon: FileText, label: 'CSV' },
                { icon: FileSpreadsheet, label: 'Excel' },
                { icon: Printer, label: 'Print' },
                { icon: Download, label: 'PDF' },
              ].map((action, i) => (
                <button key={i} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm">
                  <action.icon size={14} /> {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Reference No</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Adjustment Type</th>
                <th className="px-6 py-4">Total Amount</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Added By</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAdjustments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 text-slate-600">{a.date}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">{a.referenceNo}</td>
                  <td className="px-6 py-4 text-slate-600">{a.location}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      a.adjustmentType === 'Normal' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {a.adjustmentType}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">{a.totalAmount.toFixed(3)} OMR</td>
                  <td className="px-6 py-4 text-slate-500 italic">{a.reason}</td>
                  <td className="px-6 py-4 text-slate-600">{a.addedBy}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                        <Edit size={14} />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ListStockAdjustments;
