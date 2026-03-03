import React, { useState } from 'react';
import { 
  Filter, FileText, FileSpreadsheet, Printer, 
  Columns, Search, ArrowUpDown, ChevronDown
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

const ReportProductPurchase: React.FC = () => {
  const { locations } = useGlobalContext();
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
      supplier: [] as string[],
      location: [] as string[]
  });

  // Mock Data
  const reportData = [
    { id: '1', product: 'Engine Oil 5W30', sku: 'EO-5W30', supplier: 'Kennol Performance Oil', ref: 'PO2026/001', date: '12/02/2026', qty: 50, unitAdjusted: 0, unitPrice: 24.000, subtotal: 1200.000, location: 'CR:1450968' },
    { id: '2', product: 'Cat Food 400g', sku: 'CF-400G', supplier: 'Global Pet Supplies', ref: 'PO2026/002', date: '10/02/2026', qty: 100, unitAdjusted: 0, unitPrice: 4.500, subtotal: 450.000, location: 'CR:1450968' },
  ];

  const filteredData = reportData.filter(item => 
    (item.product.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.ref.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.supplier.length === 0 || filters.supplier.includes(item.supplier)) &&
    (filters.location.length === 0 || filters.location.includes(item.location))
  );

  const totalSubtotal = filteredData.reduce((acc, curr) => acc + curr.subtotal, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <h2 className="text-xl font-bold text-slate-900">Product Purchase Report</h2>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div 
            className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-sm cursor-pointer w-fit"
            onClick={() => setShowFilters(!showFilters)}
          >
              <Filter size={16} /> Filters
          </div>
          
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2 animate-in slide-in-from-top-2">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Search Product:</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Enter Product name / SKU / Scan bar code" 
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs font-medium outline-none" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Supplier"
                        options={['Kennol Performance Oil', 'Global Pet Supplies']}
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
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Date Range:</label>
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

              <div className="flex items-center gap-2">
                  <Search className="text-slate-400" size={14} />
                  <input type="text" placeholder="Search..." className="pl-2 py-1 border border-slate-300 rounded text-xs outline-none" />
              </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-[11px] text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                          <th className="px-4 py-3 whitespace-nowrap">Product <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">SKU <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Supplier <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Reference No <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Quantity <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Total Unit Adjusted <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Unit Purchase Price <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Subtotal <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredData.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-slate-700 font-medium">{item.product}</td>
                              <td className="px-4 py-3 text-slate-600">{item.sku}</td>
                              <td className="px-4 py-3 text-slate-600">{item.supplier}</td>
                              <td className="px-4 py-3 text-slate-600">{item.ref}</td>
                              <td className="px-4 py-3 text-slate-600">{item.date}</td>
                              <td className="px-4 py-3 text-slate-600">{item.qty}</td>
                              <td className="px-4 py-3 text-slate-600">{item.unitAdjusted}</td>
                              <td className="px-4 py-3 text-slate-600">{item.unitPrice.toFixed(3)} ريال</td>
                              <td className="px-4 py-3 text-slate-800 font-bold">{item.subtotal.toFixed(3)} ريال</td>
                          </tr>
                      ))}
                      {filteredData.length === 0 && (
                          <tr>
                              <td colSpan={9} className="px-4 py-8 text-center text-slate-400 italic">No data available in table</td>
                          </tr>
                      )}
                  </tbody>
                  <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                      <tr>
                          <td colSpan={5} className="px-4 py-3 text-right uppercase">Total:</td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3 text-right">{totalSubtotal.toFixed(3)} ريال</td>
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

export default ReportProductPurchase;