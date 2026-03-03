import React, { useState } from 'react';
import { 
  Filter, FileText, FileSpreadsheet, Printer, 
  Columns, Search, ArrowUpDown, ChevronDown
} from 'lucide-react';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

interface StockExpiryItem {
  id: string;
  product: string;
  sku: string;
  location: string;
  stockLeft: number;
  unit: string;
  lotNumber: string;
  expDate: string;
  mfgDate: string;
  category: string;
  subCategory: string;
  brand: string;
  status: string; // 'Expiring', 'Expired', 'Good'
}

const ReportStockExpiry: React.FC = () => {
  const { locations } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
      location: [] as string[],
      category: [] as string[],
      subCategory: [] as string[],
      brand: [] as string[],
      unit: [] as string[],
      viewStocks: [] as string[]
  });

  // Mock Data matching the screenshot
  const reportData: StockExpiryItem[] = [
    { id: '1', product: 'Cebican (Cat) Tuna_3KG (8436611140187)', sku: '8436611140187', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', stockLeft: 317.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Dry Pet Food', subCategory: 'Cat Food', brand: 'Cebican', status: 'Good' },
    { id: '2', product: 'Danna Supreme Complet Dog_20kg (0118)', sku: '0118', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', stockLeft: 13.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Dry Pet Food', subCategory: 'Dog Food', brand: 'Danna', status: 'Good' },
    { id: '3', product: 'Danna Supreme Elite (Dog)_10kg (0114)', sku: '0114', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', stockLeft: 101.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Dry Pet Food', subCategory: 'Dog Food', brand: 'Danna', status: 'Good' },
    { id: '4', product: 'Kennol 5W-30 (5L) (0004)', sku: '0004', location: 'CR:1450968', stockLeft: 239.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Engine oil', subCategory: 'Synthetic', brand: 'Kennol', status: 'Good' },
    { id: '5', product: 'Dimas Oil 10W 40 (1L) (0108)', sku: '0108', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', stockLeft: 276.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Engine oil', subCategory: 'Semi-Synthetic', brand: 'Dimas Oil', status: 'Good' },
    { id: '6', product: 'Dimas Oil 5W 30 (1L) (0100)', sku: '0100', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', stockLeft: 322.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Engine oil', subCategory: 'Synthetic', brand: 'Dimas Oil', status: 'Good' },
    { id: '7', product: 'Wet food cat, Fish (adult) (0094)', sku: '0094', location: 'CR:1450968', stockLeft: 5.000, unit: 'Pc(s)', lotNumber: '', expDate: '2026-01-12', mfgDate: '', category: 'Wet Pet Food', subCategory: 'Cat Food', brand: 'Generic', status: 'Expiring' },
    { id: '8', product: 'Dousti Cat Sterilized 3kg (0149)', sku: '0149', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', stockLeft: 68.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Dry Pet Food', subCategory: 'Cat Food', brand: 'Dousti', status: 'Good' },
    { id: '9', product: 'Aloe Vera 10L (0141)', sku: '0141', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', stockLeft: 37.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Cat Litter', subCategory: 'Litter', brand: 'ClearCat Blanco', status: 'Good' },
    { id: '10', product: 'Cebican mini Adult 3kg (8436611140392)', sku: '8436611140392', location: 'CR:1450968', stockLeft: 308.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Dry Pet Food', subCategory: 'Dog Food', brand: 'Cebican', status: 'Good' },
    { id: '11', product: 'Kennol CVT Oil (1L) (0089)', sku: '0089', location: 'CR:1450968', stockLeft: 243.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Engine oil', subCategory: 'Transmission', brand: 'Kennol', status: 'Good' },
    { id: '12', product: 'Aloe Vera 20L (0142)', sku: '0142', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', stockLeft: 30.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Cat Litter', subCategory: 'Litter', brand: 'ClearCat Blanco', status: 'Good' },
    { id: '13', product: 'Kennol 5W 30 (20L) (0081)', sku: '0081', location: 'CR:1450968', stockLeft: 81.000, unit: 'Cartoon', lotNumber: '', expDate: '', mfgDate: '', category: 'Engine oil', subCategory: 'Synthetic', brand: 'Kennol', status: 'Good' },
    { id: '14', product: 'DU Juice (0067)', sku: '0067', location: 'CR:1450968', stockLeft: 5.000, unit: 'Cartoon', lotNumber: '', expDate: '2024-10-21', mfgDate: '', category: 'Beverages', subCategory: 'Juice', brand: 'DU', status: 'Expired' },
    { id: '15', product: 'Kennol 0W-20 (20L) (0120)', sku: '0120', location: 'CR:1450968', stockLeft: 26.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Engine oil', subCategory: 'Synthetic', brand: 'Kennol', status: 'Good' },
    { id: '16', product: 'Cebican (High Energy)_20kg (0014)', sku: '0014', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', stockLeft: 3.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Dry Pet Food', subCategory: 'Dog Food', brand: 'Cebican', status: 'Good' },
    { id: '17', product: 'Danna Premium Dog (Adult) Grain Free_10kg (0115)', sku: '0115', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', stockLeft: 1.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Dry Pet Food', subCategory: 'Dog Food', brand: 'Danna', status: 'Good' },
    { id: '18', product: 'Kennol Engine Flush (0119)', sku: '0119', location: 'CR:1450968', stockLeft: 37.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Engine oil', subCategory: 'Additives', brand: 'Kennol', status: 'Good' },
    { id: '19', product: 'Kennol 5W-40 (5L) (0006)', sku: '0006', location: 'CR:1450968', stockLeft: 360.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Engine oil', subCategory: 'Synthetic', brand: 'Kennol', status: 'Good' },
    { id: '20', product: 'Dimas Oil 10W 40 (1L)4T (0109)', sku: '0109', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', stockLeft: 38.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Engine oil', subCategory: 'Semi-Synthetic', brand: 'Dimas Oil', status: 'Good' },
    { id: '21', product: 'Dimas Oil 5W 40 (4L) (0101)', sku: '0101', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', stockLeft: 348.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Engine oil', subCategory: 'Synthetic', brand: 'Dimas Oil', status: 'Good' },
    { id: '22', product: 'X Pets Kitten (Chicken + Milk) Pate 400g (0158)', sku: '0158', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', stockLeft: 1932.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Wet Pet Food', subCategory: 'Cat Food', brand: 'X Pets', status: 'Good' },
    { id: '23', product: 'Wet food Dog, Vegetable & Lamb (puppy) (0095)', sku: '0095', location: 'CR:1450968', stockLeft: 109.000, unit: 'Pc(s)', lotNumber: '', expDate: '2026-01-12', mfgDate: '', category: 'Wet Pet Food', subCategory: 'Dog Food', brand: 'Generic', status: 'Expiring' },
    { id: '24', product: 'Dousti Cat Mix 3kg (0150)', sku: '0150', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', stockLeft: 150.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Dry Pet Food', subCategory: 'Cat Food', brand: 'Dousti', status: 'Good' },
    { id: '25', product: 'Dousti Cat Kitten 3kg (0151)', sku: '0151', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', stockLeft: 66.000, unit: 'Pc(s)', lotNumber: '', expDate: '', mfgDate: '', category: 'Dry Pet Food', subCategory: 'Cat Food', brand: 'Dousti', status: 'Good' },
  ];

  const filteredData = reportData.filter(item => 
    (item.product.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.location.length === 0 || filters.location.includes(item.location)) &&
    (filters.category.length === 0 || filters.category.includes(item.category)) &&
    (filters.subCategory.length === 0 || filters.subCategory.includes(item.subCategory)) &&
    (filters.brand.length === 0 || filters.brand.includes(item.brand)) &&
    (filters.unit.length === 0 || filters.unit.includes(item.unit)) &&
    (filters.viewStocks.length === 0 || filters.viewStocks.includes(item.status))
  );

  // Calculate totals by unit
  const totals = filteredData.reduce((acc, curr) => {
    if (!acc[curr.unit]) acc[curr.unit] = 0;
    acc[curr.unit] += curr.stockLeft;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header */}
      <div>
          <h2 className="text-xl font-bold text-slate-900">Stock Expiry Report</h2>
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
                        options={['Dry Pet Food', 'Engine oil', 'Wet Pet Food', 'Cat Litter', 'Beverages']}
                        selected={filters.category}
                        onChange={(val) => setFilters({...filters, category: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Sub category"
                        options={['Dog Food', 'Cat Food', 'Synthetic', 'Semi-Synthetic', 'Transmission', 'Litter', 'Juice', 'Additives']}
                        selected={filters.subCategory}
                        onChange={(val) => setFilters({...filters, subCategory: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Brand"
                        options={['Cebican', 'Danna', 'Kennol', 'Dimas Oil', 'Dousti', 'ClearCat Blanco', 'X Pets', 'DU', 'Generic']}
                        selected={filters.brand}
                        onChange={(val) => setFilters({...filters, brand: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Unit"
                        options={['Pc(s)', 'Cartoon']}
                        selected={filters.unit}
                        onChange={(val) => setFilters({...filters, unit: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="View Stocks"
                        options={['Expiring', 'Expired', 'Good']}
                        selected={filters.viewStocks}
                        onChange={(val) => setFilters({...filters, viewStocks: val})}
                    />
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

          <div className="overflow-x-auto min-h-[500px]">
              <table className="w-full text-[11px] text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                          <th className="px-4 py-3 whitespace-nowrap">Product <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">SKU <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Location <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-left">Stock Left <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Lot Number <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">EXP Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">MFG Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredData.map((item, idx) => (
                          <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                              <td className="px-4 py-3 text-slate-700 font-medium">{item.product}</td>
                              <td className="px-4 py-3 text-slate-500 font-mono">{item.sku}</td>
                              <td className="px-4 py-3 text-slate-600 text-[10px]">{item.location}</td>
                              <td className="px-4 py-3 text-left font-bold text-slate-800">{item.stockLeft.toFixed(3)} {item.unit}</td>
                              <td className="px-4 py-3 text-slate-500">{item.lotNumber}</td>
                              <td className="px-4 py-3 text-slate-600">{item.expDate}</td>
                              <td className="px-4 py-3 text-slate-500">{item.mfgDate}</td>
                          </tr>
                      ))}
                  </tbody>
                  <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                      <tr>
                          <td colSpan={3} className="px-4 py-3 text-right uppercase">Total:</td>
                          <td className="px-4 py-3 text-left">
                              {Object.entries(totals).map(([unit, count]) => (
                                  <div key={unit}>{count.toFixed(3)} {unit}</div>
                              ))}
                          </td>
                          <td colSpan={3}></td>
                      </tr>
                  </tfoot>
              </table>
          </div>

          <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <div>Showing 1 to {filteredData.length} of {filteredData.length} entries</div>
              <div className="flex gap-1">
                  <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
                  <button className="px-3 py-1 bg-blue-600 text-white border border-blue-600 rounded shadow-sm">1</button>
                  <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">2</button>
                  <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">3</button>
                  <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">4</button>
                  <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">Next</button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default ReportStockExpiry;