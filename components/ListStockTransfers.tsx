import React, { useState } from 'react';
import { 
  Plus, Search, FileText, FileSpreadsheet, Printer, 
  Columns, Edit, Trash2, ChevronDown, 
  Filter, ArrowUpDown
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

interface StockTransfer {
  id: string;
  date: string;
  refNo: string;
  locationFrom: string;
  locationTo: string;
  status: 'Pending' | 'In Transit' | 'Completed';
  shippingCharges: number;
  totalAmount: number;
  notes: string;
}

// Initial empty state as per screenshot
const initialTransfers: StockTransfer[] = [
  { id: '1', date: '2023-11-20', refNo: 'TR-2023-001', locationFrom: 'CR:1450968', locationTo: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', status: 'Completed', shippingCharges: 10.000, totalAmount: 150.000, notes: 'Urgent transfer' },
  { id: '2', date: '2023-11-21', refNo: 'TR-2023-002', locationFrom: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', locationTo: 'CR:1450968', status: 'Pending', shippingCharges: 5.000, totalAmount: 80.000, notes: '' },
];

interface ListStockTransfersProps {
    onNavigate: (page: string) => void;
}

const ListStockTransfers: React.FC<ListStockTransfersProps> = ({
  onNavigate }) => {
  const { locations } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [transfers, setTransfers] = useState<StockTransfer[]>(initialTransfers);
  const [showFilters, setShowFilters] = useState(true);
  
  const [filters, setFilters] = useState({
      locationFrom: [] as string[],
      locationTo: [] as string[],
      status: [] as string[]
  });

  const filteredTransfers = transfers.filter(t => 
    (t.refNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.notes.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.locationFrom.length === 0 || filters.locationFrom.includes(t.locationFrom)) &&
    (filters.locationTo.length === 0 || filters.locationTo.includes(t.locationTo)) &&
    (filters.status.length === 0 || filters.status.includes(t.status))
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Stock Transfers</h2>
        <button 
            onClick={() => onNavigate('add-stock-transfer')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-1 shadow-sm transition-all"
        >
            <Plus size={16} /> Add
        </button>
      </div>

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
                            label="Business Location (From)"
                            options={locations.map(loc => loc.name)}
                            selected={filters.locationFrom}
                            onChange={(val) => setFilters({...filters, locationFrom: val})}
                        />
                  </div>
                  <div className="group">
                        <MultiSelect 
                            label="Business Location (To)"
                            options={locations.map(loc => loc.name)}
                            selected={filters.locationTo}
                            onChange={(val) => setFilters({...filters, locationTo: val})}
                        />
                  </div>
                  <div className="group">
                       <MultiSelect 
                            label="Status"
                            options={['Pending', 'In Transit', 'Completed']}
                            selected={filters.status}
                            onChange={(val) => setFilters({...filters, status: val})}
                        />
                  </div>
                  <div className="group">
                      <DateRangeFilter />
                  </div>
              </div>
          )}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
        
        <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-700">All Stock Transfers</h3>
        </div>

        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
           <div className="flex items-center gap-2">
               <span className="text-sm text-slate-600">Show</span>
               <select className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500">
                   <option>25</option>
                   <option>50</option>
                   <option>100</option>
               </select>
               <span className="text-sm text-slate-600">entries</span>
           </div>

           <div className="flex gap-1">
                <button className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={12}/> Export CSV</button>
                <button className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={12}/> Export Excel</button>
                <button className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={12}/> Print</button>
                <button className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={12}/> Column visibility</button>
                <button className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={12}/> Export PDF</button>
           </div>

           <div className="flex items-center gap-2">
               <label className="text-sm text-slate-600">Search:</label>
               <input 
                   type="text" 
                   className="px-3 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
               />
           </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Reference No <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Location (From) <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Location (To) <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Status <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Shipping Charges <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total Amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Additional Notes <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransfers.length > 0 ? (
                  filteredTransfers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">{t.date}</td>
                      <td className="px-4 py-3">{t.refNo}</td>
                      <td className="px-4 py-3">{t.locationFrom}</td>
                      <td className="px-4 py-3">{t.locationTo}</td>
                      <td className="px-4 py-3">{t.status}</td>
                      <td className="px-4 py-3 text-right">{t.shippingCharges.toFixed(3)}</td>
                      <td className="px-4 py-3 text-right">{t.totalAmount.toFixed(3)}</td>
                      <td className="px-4 py-3">{t.notes}</td>
                      <td className="px-4 py-3">
                          <button className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
                              Action <ChevronDown size={10} />
                          </button>
                      </td>
                    </tr>
                  ))
              ) : (
                  <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-slate-500 bg-slate-50/50 italic">
                          No data available in table
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 bg-slate-50/30">
            <div>Showing {filteredTransfers.length > 0 ? 1 : 0} to {filteredTransfers.length} of {filteredTransfers.length} entries</div>
            <div className="flex gap-1">
                 <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 text-slate-600" disabled>Previous</button>
                <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 text-slate-600" disabled>Next</button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default ListStockTransfers;