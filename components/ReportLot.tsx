import React, { useState } from 'react';
import { 
  Filter, FileText, FileSpreadsheet, Printer, 
  Columns, Search, ArrowUpDown
} from 'lucide-react';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

const ReportLot: React.FC = () => {
  const { locations } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
      location: [] as string[],
      category: [] as string[],
      subCategory: [] as string[],
      brand: [] as string[],
      unit: [] as string[]
  });

  // Mock Data
  const reportData = [
    { 
      id: '1', 
      sku: '0012', 
      product: 'Cebican (Daily Care)_20kg', 
      lotNumber: 'Damage', 
      expDate: '--', 
      currentStock: 3.000, 
      unit: 'Pc(s)',
      totalSold: 0.000, 
      totalAdjusted: 0.000,
      location: 'CR:1450968',
      category: 'Dry Pet Food',
      subCategory: 'Dog Food',
      brand: 'Cebican'
    },
    { 
      id: '2', 
      sku: '0161', 
      product: 'X Pets Dog (Veal) Chunks 400g', 
      lotNumber: 'L-2025-001', 
      expDate: '12/2027', 
      currentStock: 150.000, 
      unit: 'Pc(s)',
      totalSold: 36.000, 
      totalAdjusted: 0.000,
      location: 'CR:1450968',
      category: 'Wet Pet Food',
      subCategory: 'Dog Food',
      brand: 'X Pets'
    }
  ];

  const filteredData = reportData.filter(item => 
    (item.product.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.lotNumber.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.location.length === 0 || filters.location.includes(item.location)) &&
    (filters.category.length === 0 || filters.category.includes(item.category)) &&
    (filters.subCategory.length === 0 || filters.subCategory.includes(item.subCategory)) &&
    (filters.brand.length === 0 || filters.brand.includes(item.brand)) &&
    (filters.unit.length === 0 || filters.unit.includes(item.unit))
  );

  const totalStock = filteredData.reduce((acc, curr) => acc + curr.currentStock, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <h2 className="text-xl font-bold text-slate-900">Lot Report</h2>

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
                        options={['Dry Pet Food', 'Wet Pet Food']}
                        selected={filters.category}
                        onChange={(val) => setFilters({...filters, category: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Sub category"
                        options={['Dog Food', 'Cat Food']}
                        selected={filters.subCategory}
                        onChange={(val) => setFilters({...filters, subCategory: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Brand"
                        options={['Cebican', 'X Pets']}
                        selected={filters.brand}
                        onChange={(val) => setFilters({...filters, brand: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Unit"
                        options={['Pc(s)', 'Kg']}
                        selected={filters.unit}
                        onChange={(val) => setFilters({...filters, unit: val})}
                    />
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
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10}/> PDF</button>
              </div>
              <div className="flex items-center gap-2">
                  <Search className="text-slate-400" size={14} />
                  <input type="text" placeholder="Search..." className="pl-2 py-1 border-b border-slate-300 text-xs outline-none focus:border-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-[11px] text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                          <th className="px-4 py-3 whitespace-nowrap">SKU <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Product <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Lot Number <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">EXP Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Current stock <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Total unit sold <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Total Unit Adjusted <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredData.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-slate-600 font-mono">{item.sku}</td>
                              <td className="px-4 py-3 text-slate-700 font-medium">{item.product}</td>
                              <td className="px-4 py-3 text-slate-600">{item.lotNumber}</td>
                              <td className="px-4 py-3 text-slate-500">{item.expDate}</td>
                              <td className="px-4 py-3 text-slate-700 font-bold">{item.currentStock.toFixed(3)} {item.unit}</td>
                              <td className="px-4 py-3 text-slate-600">{item.totalSold.toFixed(3)} {item.unit}</td>
                              <td className="px-4 py-3 text-slate-600">{item.totalAdjusted.toFixed(3)} {item.unit}</td>
                          </tr>
                      ))}
                      {filteredData.length === 0 && (
                          <tr>
                              <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">No data available in table</td>
                          </tr>
                      )}
                  </tbody>
                  <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                      <tr>
                          <td colSpan={4} className="px-4 py-3 text-right uppercase">Total:</td>
                          <td className="px-4 py-3">{totalStock.toFixed(3)} Pc(s)</td>
                          <td colSpan={2}></td>
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

export default ReportLot;