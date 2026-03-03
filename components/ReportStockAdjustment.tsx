import React, { useState } from 'react';
import { 
  Filter, FileText, FileSpreadsheet, Printer, 
  Columns, Search, ArrowUpDown
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

const ReportStockAdjustment: React.FC = () => {
  const { locations } = useGlobalContext();
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
      location: [] as string[]
  });

  // Mock Data
  const reportData = [
    { id: '1', date: '14/02/2026', ref: 'SA2026/001', location: 'CR:1450968', type: 'Normal', amount: 150.000, recovered: 0.000, reason: 'Damaged Goods', addedBy: 'Admin' },
    { id: '2', date: '10/02/2026', ref: 'SA2026/002', location: 'CR:1450968', type: 'Abnormal', amount: 500.000, recovered: 200.000, reason: 'Theft', addedBy: 'Manager' },
  ];

  const filteredData = reportData.filter(item => 
    (item.ref.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.reason.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.location.length === 0 || filters.location.includes(item.location))
  );

  const totalNormal = filteredData.filter(i => i.type === 'Normal').reduce((acc, curr) => acc + curr.amount, 0);
  const totalAbnormal = filteredData.filter(i => i.type === 'Abnormal').reduce((acc, curr) => acc + curr.amount, 0);
  const totalAdjustment = totalNormal + totalAbnormal;
  const totalRecovered = filteredData.reduce((acc, curr) => acc + curr.recovered, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <h2 className="text-xl font-bold text-slate-900">Stock Adjustment Report</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-xl border border-slate-200">
          <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700 border-b border-slate-200 pb-2">
                  <span>Total Normal:</span>
                  <span>{totalNormal.toFixed(3)} ريال</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-700 border-b border-slate-200 pb-2">
                  <span>Total Abnormal:</span>
                  <span>{totalAbnormal.toFixed(3)} ريال</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-700 pb-2">
                  <span>Total Stock Adjustment:</span>
                  <span>{totalAdjustment.toFixed(3)} ريال</span>
              </div>
          </div>
          <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700 border-b border-slate-200 pb-2">
                  <span>Total Amount Recovered:</span>
                  <span>{totalRecovered.toFixed(3)} ريال</span>
              </div>
          </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-end gap-4 items-end">
          <div className="w-full md:w-64">
             <MultiSelect 
                label="Business Location"
                options={locations.map(loc => loc.name)}
                selected={filters.location}
                onChange={(val) => setFilters({...filters, location: val})}
             />
          </div>
          <div className="w-full md:w-auto">
             <label className="block text-xs font-bold text-slate-700 mb-1.5">Date Range:</label>
             <DateRangeFilter />
          </div>
          <button className="bg-[#6200ea] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-[#5000ca] h-[38px]">
              Filter
          </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-700">Stock Adjustments</h3>
                  <div className="flex items-center gap-1 ml-4">
                      <span className="text-xs text-slate-600 font-bold">Show</span>
                      <select className="border border-slate-300 rounded px-2 py-1 text-xs outline-none"><option>25</option></select>
                      <span className="text-xs text-slate-600 font-bold">entries</span>
                  </div>
              </div>
              <div className="flex gap-1">
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10}/> Export CSV</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10}/> Export Excel</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={10}/> Print</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={10}/> Visibility</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10}/> PDF</button>
              </div>
              <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    className="pl-2 py-1 border border-slate-300 rounded text-xs outline-none" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-[11px] text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                          <th className="px-4 py-3 whitespace-nowrap">Action</th>
                          <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Reference No <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Location <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Adjustment type <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Total Amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Total amount recovered <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Reason <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Added By <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredData.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-blue-600 cursor-pointer hover:underline">View</td>
                              <td className="px-4 py-3 text-slate-600">{item.date}</td>
                              <td className="px-4 py-3 text-slate-600 font-medium">{item.ref}</td>
                              <td className="px-4 py-3 text-slate-600">{item.location}</td>
                              <td className="px-4 py-3 text-slate-600">{item.type}</td>
                              <td className="px-4 py-3 text-slate-800 font-bold">{item.amount.toFixed(3)} ريال</td>
                              <td className="px-4 py-3 text-slate-600">{item.recovered.toFixed(3)} ريال</td>
                              <td className="px-4 py-3 text-slate-600">{item.reason}</td>
                              <td className="px-4 py-3 text-slate-600">{item.addedBy}</td>
                          </tr>
                      ))}
                      {filteredData.length === 0 && (
                          <tr>
                              <td colSpan={9} className="px-4 py-8 text-center text-slate-400 italic">No data available in table</td>
                          </tr>
                      )}
                  </tbody>
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

export default ReportStockAdjustment;