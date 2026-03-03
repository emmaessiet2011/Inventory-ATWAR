import React, { useState } from 'react';
import { 
  Filter, FileText, FileSpreadsheet, Printer, 
  Columns, Search, ArrowUpDown, ChevronDown
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

// Utility for currency formatting
const formatRiyal = (amount: number) => {
  return `${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ريال`;
};

const ReportExpense: React.FC = () => {
  const { locations } = useGlobalContext();
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
      location: [] as string[],
      category: [] as string[]
  });

  // Mock Data for Table
  const tableData = [
      { id: 1, category: 'Delivery charge & Others', total: 6.000, location: 'CR:1450968' },
      { id: 2, category: 'Petrol', total: 50.000, location: 'CR:1450968' },
  ];

  const filteredData = tableData.filter(item => 
    item.category.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filters.location.length === 0 || filters.location.includes(item.location)) &&
    (filters.category.length === 0 || filters.category.includes(item.category))
  );

  // Recalculate chart data based on filtered data
  const chartData = filteredData.map(item => ({
      name: item.category,
      expense: item.total
  }));

  const totalExpense = filteredData.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <h2 className="text-xl font-bold text-slate-900">Expense Report</h2>

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
                        label="Business Location"
                        options={locations.map(loc => loc.name)}
                        selected={filters.location}
                        onChange={(val) => setFilters({...filters, location: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Category"
                        options={['Delivery charge & Others', 'Petrol']}
                        selected={filters.category}
                        onChange={(val) => setFilters({...filters, category: val})}
                    />
                </div>
                <div className="group">
                    <DateRangeFilter />
                </div>
            </div>
          )}
          <div className="flex justify-end mt-4">
              <button className="bg-[#6200ea] text-white px-6 py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-[#5000ca]">Apply Filters</button>
          </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-hidden">
          <h3 className="font-bold text-slate-800 text-sm mb-4 text-center">Expense Report</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                    <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0'}} />
                    <Bar dataKey="expense" fill="#7cb5ec" name="Total Expense" barSize={50} />
                </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center items-center gap-2 mt-4 text-xs text-slate-600">
              <div className="w-3 h-3 bg-[#7cb5ec] rounded-full"></div> Total Expense
          </div>
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
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={10}/> Column visibility</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10}/> Export PDF</button>
              </div>

              <div className="flex items-center gap-2">
                  <Search className="text-slate-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    className="pl-2 py-1 border border-slate-300 rounded text-xs outline-none" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>

          <div className="overflow-x-auto min-h-[200px]">
              <table className="w-full text-[11px] text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                          <th className="px-4 py-3 whitespace-nowrap">Expense Categories</th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Total Expense <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredData.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-slate-700 font-medium">{item.category}</td>
                              <td className="px-4 py-3 text-right text-slate-800 font-bold">{formatRiyal(item.total)}</td>
                          </tr>
                      ))}
                      {filteredData.length === 0 && (
                          <tr>
                              <td colSpan={2} className="px-4 py-8 text-center text-slate-400 italic">No data available in table</td>
                          </tr>
                      )}
                  </tbody>
                  <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                      <tr>
                          <td className="px-4 py-3 text-right uppercase">Total:</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(totalExpense)}</td>
                      </tr>
                  </tfoot>
              </table>
          </div>
          <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <div>Showing {filteredData.length} entries</div>
              <div className="flex gap-1">
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50" disabled>Previous</button>
                  <button className="px-2 py-1 bg-blue-600 text-white rounded shadow-sm">1</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50" disabled>Next</button>
              </div>
          </div>
      </div>
      <div className="mt-8 pt-6 border-t border-slate-200 text-[10px] text-slate-400 font-medium text-center sm:text-left">
          Wingital - V6.4 | Copyright © 2026 All rights reserved.
      </div>
    </div>
  );
};

export default ReportExpense;
