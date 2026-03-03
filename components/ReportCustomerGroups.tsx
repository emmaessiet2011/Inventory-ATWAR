import React, { useState } from 'react';
import { 
  Filter, FileText, FileSpreadsheet, Printer, 
  Columns, Search, ArrowUpDown, Download, ChevronDown
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

// Utility for currency formatting
const formatRiyal = (amount: number) => {
  return `${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ريال`;
};

interface CustomerGroupReportData {
  id: number;
  groupName: string;
  totalSale: number;
  location: string;
}

const ReportCustomerGroups: React.FC = () => {
  const { locations } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true); // Default to true to show filters initially
  const [filters, setFilters] = useState({
      location: [] as string[],
      customerGroup: [] as string[]
  });

  // Mock Data matching the screenshot
  const reportData: CustomerGroupReportData[] = [
    { id: 1, groupName: 'Engine Oil Customers', totalSale: 1511.744, location: 'CR:1450968' },
    { id: 2, groupName: 'Pet food customer', totalSale: 2285.015, location: 'CR:1450968' },
    { id: 3, groupName: 'Retail', totalSale: 1621.347, location: 'CR:1450968' },
    { id: 4, groupName: 'Supermarkets Customers', totalSale: 927.952, location: 'CR:1450968' },
  ];

  const filteredData = reportData.filter(item => 
    item.groupName.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filters.location.length === 0 || filters.location.includes(item.location)) &&
    (filters.customerGroup.length === 0 || filters.customerGroup.includes(item.groupName))
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header */}
      <div>
          <h2 className="text-xl font-bold text-slate-900">Customer Groups Report</h2>
      </div>

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
                        label="Customer Group"
                        options={['Engine Oil Customers', 'Pet food customer', 'Retail', 'Supermarkets Customers']}
                        selected={filters.customerGroup}
                        onChange={(val) => setFilters({...filters, customerGroup: val})}
                    />
                </div>
                <div className="group">
                    <DateRangeFilter />
                </div>
            </div>
          )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          
          {/* Controls */}
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
              <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-bold">Show</span>
                  <select className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none">
                      <option>25</option>
                      <option>50</option>
                  </select>
                  <span className="text-xs text-slate-600 font-bold">entries</span>
              </div>
              
              <div className="flex gap-1">
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10}/> Export CSV</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10}/> Export Excel</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={10}/> Print</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={10}/> Column visibility</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10}/> Export PDF</button>
              </div>

              <div className="flex items-center gap-2 relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                      type="text" 
                      placeholder="Search..." 
                      className="pl-8 pr-3 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                          <th className="px-4 py-3 whitespace-nowrap">Customer Group <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Total Sale <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredData.length > 0 ? (
                          filteredData.map((item, idx) => (
                              <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                  <td className="px-4 py-3 text-slate-700 font-medium">{item.groupName}</td>
                                  <td className="px-4 py-3 text-right text-slate-800 font-bold whitespace-nowrap">{formatRiyal(item.totalSale)}</td>
                              </tr>
                          ))
                      ) : (
                          <tr>
                              <td colSpan={2} className="px-4 py-12 text-center text-slate-400 italic">No records found</td>
                          </tr>
                      )}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold text-slate-800 text-[10px] border-t border-slate-300 uppercase">
                      <tr>
                          <td className="px-4 py-3 text-right">Total:</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(filteredData.reduce((acc, curr) => acc + curr.totalSale, 0))}</td>
                      </tr>
                  </tfoot>
              </table>
          </div>

          <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <div>Showing 1 to {filteredData.length} of {filteredData.length} entries</div>
              <div className="flex gap-1">
                  <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
                  <button className="px-3 py-1 bg-blue-600 text-white border border-blue-600 rounded shadow-sm">1</button>
                  <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50" disabled>Next</button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default ReportCustomerGroups;