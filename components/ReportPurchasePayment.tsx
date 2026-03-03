import React, { useState } from 'react';
import { 
  Filter, FileText, FileSpreadsheet, Printer, 
  Columns, Search, ArrowUpDown, ChevronDown
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

// Utility for currency formatting
const formatRiyal = (amount: number) => {
  return `${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ريال`;
};

const ReportPurchasePayment: React.FC = () => {
  const { locations } = useGlobalContext();
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [filters, setFilters] = useState({
      supplier: [] as string[],
      location: [] as string[]
  });

  // Mock Data
  const reportData = [
    { id: '1', date: '12/02/2026 10:00 AM', ref: 'PP2026/001', supplier: 'Kennol Performance Oil', amount: 1200.000, method: 'Bank Transfer', location: 'CR:1450968' },
    { id: '2', date: '10/02/2026 09:30 AM', ref: 'PP2026/002', supplier: 'Global Pet Supplies', amount: 450.000, method: 'Cheque', location: 'CR:1450968' },
    { id: '3', date: '08/02/2026 02:15 PM', ref: 'PP2026/003', supplier: 'Oman Oil Marketing Co.', amount: 2500.000, method: 'Bank Transfer', location: 'CR:1450968' },
  ];

  const filteredData = reportData.filter(item => 
    (item.supplier.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.ref.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.supplier.length === 0 || filters.supplier.includes(item.supplier)) &&
    (filters.location.length === 0 || filters.location.includes(item.location))
  );

  const totalAmount = filteredData.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <h2 className="text-xl font-bold text-slate-900">Purchase Payment Report</h2>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div 
            className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-sm cursor-pointer w-fit"
            onClick={() => setShowFilters(!showFilters)}
          >
              <Filter size={16} /> Filters
          </div>
          
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 animate-in slide-in-from-top-2">
                <div className="group">
                    <MultiSelect 
                        label="Supplier"
                        options={['Kennol Performance Oil', 'Global Pet Supplies', 'Oman Oil Marketing Co.']}
                        selected={filters.supplier}
                        onChange={(val) => setFilters({...filters, supplier: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Business Location"
                        options={locations.map(loc => loc.name)}
                        selected={filters.location}
                        onChange={(val) => setFilters({...filters, location: val})}
                    />
                </div>
                <div className="group">
                    <DateRangeFilter />
                </div>
            </div>
          )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
              <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-bold">Show</span>
                  <select className="border border-slate-300 rounded px-2 py-1 text-xs outline-none"><option>25</option></select>
                  <span className="text-xs text-slate-600 font-bold">entries</span>
              </div>
              
              <div className="flex gap-1">
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10}/> Export CSV</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10}/> Export Excel</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={10}/> Print</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={10}/> Visibility</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10}/> Export PDF</button>
              </div>

              <div className="flex items-center gap-2 relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    className="pl-8 pr-3 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                          <th className="px-4 py-3 whitespace-nowrap">Paid on <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Reference No <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Supplier <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Payment Method <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredData.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-slate-600 font-medium">{item.date}</td>
                              <td className="px-4 py-3 text-slate-600 font-medium">{item.ref}</td>
                              <td className="px-4 py-3 text-slate-700 font-bold">{item.supplier}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-800">{formatRiyal(item.amount)}</td>
                              <td className="px-4 py-3 text-slate-600">{item.method}</td>
                          </tr>
                      ))}
                      {filteredData.length === 0 && (
                          <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No records found</td>
                          </tr>
                      )}
                  </tbody>
                  <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                      <tr>
                          <td colSpan={3} className="px-4 py-3 text-right uppercase">Total:</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(totalAmount)}</td>
                          <td></td>
                      </tr>
                  </tfoot>
              </table>
          </div>
          <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <div>Showing {filteredData.length} entries</div>
              <div className="flex gap-1">
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50" disabled>Previous</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50" disabled>Next</button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default ReportPurchasePayment;