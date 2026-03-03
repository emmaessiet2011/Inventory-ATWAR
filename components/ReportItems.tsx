import React, { useState } from 'react';
import { 
  Filter, FileText, FileSpreadsheet, Printer, 
  Columns, Search, ArrowUpDown, ChevronDown
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';

// Utility for currency formatting
const formatRiyal = (amount: number) => {
  return `${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ريال`;
};

const ReportItems: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  
  const [filters, setFilters] = useState({
      supplier: [] as string[],
      customer: [] as string[],
      location: [] as string[]
  });

  // Mock Data
  const reportData = [
    { id: '1', product: 'X Pets Cat (Chicken) Chunks 400g', sku: '0168', desc: '', pDate: '07/02/2026 04:24 PM', pType: '(Opening Stock)', lot: '', supplier: 'Global Pet Supplies', pPrice: 0.000, sDate: '07/02/2026 07:52 PM', sale: 'K2026-2471', customer: '02 Pet Shop (Mowaleh)', loc: 'KNWZ ARD ALKHALYJ', sellQty: 120.000, unit: 'Pc(s)', sPrice: 0.357, subtotal: 42.840 },
    { id: '2', product: 'X Pets Cat (Chicken) Chunks 400g', sku: '0168', desc: '', pDate: '07/02/2026 04:24 PM', pType: '(Opening Stock)', lot: '', supplier: 'Global Pet Supplies', pPrice: 0.000, sDate: '07/02/2026 09:01 PM', sale: 'K2026-2472', customer: 'Ruthuth Shopping Center', loc: 'KNWZ ARD ALKHALYJ', sellQty: 12.000, unit: 'Pc(s)', sPrice: 0.375, subtotal: 4.500 },
    { id: '3', product: 'X Pets Cat (Chicken) Chunks 400g', sku: '0168', desc: '', pDate: '07/02/2026 04:24 PM', pType: '(Opening Stock)', lot: '', supplier: 'Global Pet Supplies', pPrice: 0.000, sDate: '07/02/2026 09:06 PM', sale: 'K2026-2473', customer: 'Dolphin Pet Shop', loc: 'KNWZ ARD ALKHALYJ', sellQty: 12.000, unit: 'Pc(s)', sPrice: 0.375, subtotal: 4.500 },
    { id: '4', product: 'X Pets Cat (Chicken) Chunks 400g', sku: '0168', desc: '', pDate: '07/02/2026 04:24 PM', pType: '(Opening Stock)', lot: '', supplier: 'Global Pet Supplies', pPrice: 0.000, sDate: '08/02/2026 07:45 AM', sale: 'K2026-2477', customer: 'Royal Mart', loc: 'KNWZ ARD ALKHALYJ', sellQty: 12.000, unit: 'Pc(s)', sPrice: 0.357, subtotal: 4.284 },
    { id: '5', product: 'X Pets Cat (Chicken) Chunks 400g', sku: '0168', desc: '', pDate: '07/02/2026 04:24 PM', pType: '(Opening Stock)', lot: '', supplier: 'Global Pet Supplies', pPrice: 0.000, sDate: '08/02/2026 07:47 AM', sale: 'K2026-2478', customer: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', loc: 'KNWZ ARD ALKHALYJ', sellQty: 12.000, unit: 'Pc(s)', sPrice: 0.357, subtotal: 4.284 },
  ];

  const filteredData = reportData.filter(item => 
    (item.product.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.supplier.length === 0 || filters.supplier.includes(item.supplier)) &&
    (filters.customer.length === 0 || filters.customer.includes(item.customer)) &&
    (filters.location.length === 0 || filters.location.includes(item.loc))
  );

  const totalSellQty = filteredData.reduce((acc, curr) => acc + curr.sellQty, 0);
  const totalSubtotal = filteredData.reduce((acc, curr) => acc + curr.subtotal, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <h2 className="text-xl font-bold text-slate-900">Items Report</h2>

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
                        options={['Global Pet Supplies']}
                        selected={filters.supplier}
                        onChange={(val) => setFilters({...filters, supplier: val})}
                    />
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Purchase Date:</label>
                    <DateRangeFilter />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Customer"
                        options={['02 Pet Shop (Mowaleh)', 'Ruthuth Shopping Center', 'Dolphin Pet Shop', 'Royal Mart', 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649']}
                        selected={filters.customer}
                        onChange={(val) => setFilters({...filters, customer: val})}
                    />
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Sell Date:</label>
                    <DateRangeFilter />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Business Location"
                        options={['KNWZ ARD ALKHALYJ']}
                        selected={filters.location}
                        onChange={(val) => setFilters({...filters, location: val})}
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
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={10}/> Column visibility</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10}/> Export PDF</button>
              </div>
              <div className="flex items-center gap-2">
                  <Search className="text-slate-400" size={14} />
                  <input type="text" placeholder="Search..." className="pl-2 py-1 border border-slate-300 rounded text-xs outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-[10px] text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                          <th className="px-4 py-3 whitespace-nowrap">Product <ArrowUpDown size={8} className="inline ml-1" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">SKU <ArrowUpDown size={8} className="inline ml-1" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Description</th>
                          <th className="px-4 py-3 whitespace-nowrap">Purchase Date <ArrowUpDown size={8} className="inline ml-1" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Purchase <ArrowUpDown size={8} className="inline ml-1" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Lot Number <ArrowUpDown size={8} className="inline ml-1" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Supplier <ArrowUpDown size={8} className="inline ml-1" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Purchase Price <ArrowUpDown size={8} className="inline ml-1" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Sell Date <ArrowUpDown size={8} className="inline ml-1" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Sale <ArrowUpDown size={8} className="inline ml-1" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Customer <ArrowUpDown size={8} className="inline ml-1" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Location <ArrowUpDown size={8} className="inline ml-1" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Sell Quantity <ArrowUpDown size={8} className="inline ml-1" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Selling Price <ArrowUpDown size={8} className="inline ml-1" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Subtotal <ArrowUpDown size={8} className="inline ml-1" /></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredData.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2 font-medium text-slate-700">{item.product}</td>
                              <td className="px-4 py-2 text-slate-500 font-mono">{item.sku}</td>
                              <td className="px-4 py-2">{item.desc}</td>
                              <td className="px-4 py-2 text-slate-600">{item.pDate}</td>
                              <td className="px-4 py-2 text-slate-600">{item.pType}</td>
                              <td className="px-4 py-2">{item.lot}</td>
                              <td className="px-4 py-2">{item.supplier}</td>
                              <td className="px-4 py-2 text-right">{formatRiyal(item.pPrice)}</td>
                              <td className="px-4 py-2 text-slate-600">{item.sDate}</td>
                              <td className="px-4 py-2 text-slate-700 font-bold">{item.sale}</td>
                              <td className="px-4 py-2">{item.customer}</td>
                              <td className="px-4 py-2 text-[9px] text-slate-500 max-w-[100px] truncate">{item.loc}</td>
                              <td className="px-4 py-2 text-right font-medium">{item.sellQty.toFixed(3)} {item.unit}</td>
                              <td className="px-4 py-2 text-right">{formatRiyal(item.sPrice)}</td>
                              <td className="px-4 py-2 text-right font-bold text-slate-800">{formatRiyal(item.subtotal)}</td>
                          </tr>
                      ))}
                  </tbody>
                  <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                      <tr>
                          <td colSpan={7} className="px-4 py-2 text-right uppercase">Total:</td>
                          <td className="px-4 py-2 text-right">{formatRiyal(0)}</td>
                          <td colSpan={4}></td>
                          <td className="px-4 py-2 text-right">{totalSellQty.toFixed(3)}</td>
                          <td className="px-4 py-2 text-right">{formatRiyal(9.158)}</td>
                          <td className="px-4 py-2 text-right">{formatRiyal(totalSubtotal)}</td>
                      </tr>
                  </tfoot>
              </table>
          </div>
          <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <div>Showing 1 to {filteredData.length} of {filteredData.length} entries</div>
              <div className="flex gap-1">
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50" disabled>Previous</button>
                  <button className="px-2 py-1 bg-blue-600 text-white rounded shadow-sm">1</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50" disabled>Next</button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default ReportItems;