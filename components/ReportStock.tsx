import React, { useState } from 'react';
import { 
  Filter, FileText, FileSpreadsheet, Printer, 
  Columns, Search, ArrowUpDown, History, Info, ChevronDown
} from 'lucide-react';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

// Utility for currency formatting
const formatRiyal = (amount: number) => {
  return `${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ريال`;
};

interface StockReportItem {
  id: string;
  sku: string;
  product: string;
  variation: string;
  category: string;
  location: string;
  unitSellingPrice: number;
  currentStock: number;
  stockValuePurchase: number;
  stockValueSale: number;
  potentialProfit: number;
  totalUnitSold: number;
  totalUnitTransferred: number;
  totalUnitAdjusted: number;
  brand?: string; // Added for filtering
  unit?: string; // Added for filtering
}

const ReportStock: React.FC = () => {
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

  // Mock Data matching the screenshot
  const stockData: StockReportItem[] = [
    { id: '1', sku: '0004', product: 'Kennol 5W-30 (5L)', variation: '', category: 'Engine oil', location: 'CR:1450968', unitSellingPrice: 13.000, currentStock: 239.000, stockValuePurchase: 0.000, stockValueSale: 3107.000, potentialProfit: 3107.000, totalUnitSold: 673.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Kennol', unit: 'Pc(s)' },
    { id: '2', sku: '0006', product: 'Kennol 5W-40 (5L)', variation: '', category: 'Engine oil', location: 'CR:1450968', unitSellingPrice: 13.000, currentStock: 360.000, stockValuePurchase: 0.000, stockValueSale: 4680.000, potentialProfit: 4680.000, totalUnitSold: 790.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Kennol', unit: 'Pc(s)' },
    { id: '3', sku: '0008', product: 'Kennol 0W-20 (5L)', variation: '', category: 'Engine oil', location: 'CR:1450968', unitSellingPrice: 15.000, currentStock: 73.000, stockValuePurchase: 0.000, stockValueSale: 1095.000, potentialProfit: 1095.000, totalUnitSold: 175.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Kennol', unit: 'Pc(s)' },
    { id: '4', sku: '0009', product: 'Kennol 5W-30 (1L)', variation: '', category: 'Engine oil', location: 'CR:1450968', unitSellingPrice: 3.500, currentStock: 728.000, stockValuePurchase: 0.000, stockValueSale: 2548.000, potentialProfit: 2548.000, totalUnitSold: 576.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Kennol', unit: 'Pc(s)' },
    { id: '5', sku: '0010', product: 'Kennol 5W-40 (1L)', variation: '', category: 'Engine oil', location: 'CR:1450968', unitSellingPrice: 3.500, currentStock: 315.000, stockValuePurchase: 0.000, stockValueSale: 1102.500, potentialProfit: 1102.500, totalUnitSold: 730.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Kennol', unit: 'Pc(s)' },
    { id: '6', sku: '0011', product: 'Kennol 0W-20 (1L)', variation: '', category: 'Engine oil', location: 'CR:1450968', unitSellingPrice: 4.000, currentStock: 63.000, stockValuePurchase: 0.000, stockValueSale: 252.000, potentialProfit: 252.000, totalUnitSold: 173.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Kennol', unit: 'Pc(s)' },
    { id: '7', sku: '0012', product: 'Cebican (Daily Care)_20kg', variation: '', category: 'Dry Pet Food', location: 'CR:1450968', unitSellingPrice: 11.000, currentStock: 0.000, stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 939.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 7.000, brand: 'Cebican', unit: 'Pc(s)' },
    { id: '8', sku: '0012', product: 'Cebican (Daily Care)_20kg', variation: '', category: 'Dry Pet Food', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', unitSellingPrice: 11.000, currentStock: 0.000, stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 995.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 1.000, brand: 'Cebican', unit: 'Pc(s)' },
    { id: '9', sku: '0013', product: 'Garpidog (Adult)', variation: '', category: 'Dry Pet Food', location: 'CR:1450968', unitSellingPrice: 10.000, currentStock: 0.000, stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 74.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Garpidog', unit: 'Pc(s)' },
    { id: '10', sku: '0014', product: 'Cebican (High Energy)_20kg', variation: '', category: 'Dry Pet Food', location: 'CR:1450968', unitSellingPrice: 15.000, currentStock: 0.000, stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 144.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Cebican', unit: 'Pc(s)' },
    { id: '11', sku: '0014', product: 'Cebican (High Energy)_20kg', variation: '', category: 'Dry Pet Food', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', unitSellingPrice: 15.000, currentStock: 1.000, stockValuePurchase: 33.000, stockValueSale: 15.000, potentialProfit: -18.000, totalUnitSold: 136.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Cebican', unit: 'Pc(s)' },
    { id: '12', sku: '0015', product: 'Cebican (Cat) Mix_20KG', variation: '', category: 'Dry Pet Food', location: 'CR:1450968', unitSellingPrice: 15.000, currentStock: 1.000, stockValuePurchase: 0.000, stockValueSale: 15.000, potentialProfit: 15.000, totalUnitSold: 88.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Cebican', unit: 'Pc(s)' },
    { id: '13', sku: '0015', product: 'Cebican (Cat) Mix_20KG', variation: '', category: 'Dry Pet Food', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', unitSellingPrice: 15.000, currentStock: 0.000, stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 72.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Cebican', unit: 'Pc(s)' },
    { id: '14', sku: '0016', product: 'Cebican (Puppy)_20kg', variation: '', category: 'Dry Pet Food', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', unitSellingPrice: 15.000, currentStock: 1.000, stockValuePurchase: 11.200, stockValueSale: 15.000, potentialProfit: 3.800, totalUnitSold: 37.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Cebican', unit: 'Pc(s)' },
    { id: '15', sku: '0016', product: 'Cebican (Puppy)_20kg', variation: '', category: 'Dry Pet Food', location: 'CR:1450968', unitSellingPrice: 15.000, currentStock: 0.000, stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 75.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 1.000, brand: 'Cebican', unit: 'Pc(s)' },
    { id: '16', sku: '0017', product: 'Migos (Puppy)_20KG', variation: '', category: 'Dry Pet Food', location: 'CR:1450968', unitSellingPrice: 14.000, currentStock: 0.000, stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 14.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Migos', unit: 'Pc(s)' },
    { id: '17', sku: '0018', product: 'Migos (Cat Supreme) _10kg', variation: '', category: 'Dry Pet Food', location: 'CR:1450968', unitSellingPrice: 8.500, currentStock: 0.000, stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 39.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Migos', unit: 'Pc(s)' },
    { id: '18', sku: '0020', product: 'Cebican (Puppy)_3KG', variation: '', category: 'Dry Pet Food', location: 'CR:1450968', unitSellingPrice: 8.000, currentStock: 0.000, stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 81.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Cebican', unit: 'Pc(s)' },
    { id: '19', sku: '0022', product: 'Indomie (Vegetable)', variation: '', category: 'Food product', location: 'CR:1450968', unitSellingPrice: 5.450, currentStock: 0.000, stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 61.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Indomie', unit: 'Pc(s)' },
    { id: '20', sku: '0023', product: 'Indomie (Curry)', variation: '', category: 'Food product', location: 'CR:1450968', unitSellingPrice: 5.450, currentStock: 0.000, stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 59.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Indomie', unit: 'Pc(s)' },
    { id: '21', sku: '0024', product: 'Merinda', variation: '', category: 'Food product', location: 'CR:1450968', unitSellingPrice: 6.000, currentStock: 0.000, stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 28.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Merinda', unit: 'Pc(s)' },
    { id: '22', sku: '0025', product: 'Zomoroda', variation: '', category: 'Food product', location: 'CR:1450968', unitSellingPrice: 1.900, currentStock: 0.000, stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 198.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Zomoroda', unit: 'Pc(s)' },
    { id: '23', sku: '0026', product: 'Redbull', variation: '', category: 'Food product', location: 'CR:1450968', unitSellingPrice: 11.000, currentStock: 0.000, stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 147.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Redbull', unit: 'Pc(s)' },
    { id: '24', sku: '0027', product: 'Code Red', variation: '', category: 'Food product', location: 'CR:1450968', unitSellingPrice: 10.700, currentStock: 0.000, stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 310.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Code Red', unit: 'Pc(s)' },
    { id: '25', sku: '0028', product: 'Fanta', variation: '', category: 'Food product', location: 'CR:1450968', unitSellingPrice: 5.500, currentStock: 0.000, stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 5.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000, brand: 'Fanta', unit: 'Pc(s)' },
  ];

  const filteredData = stockData.filter(item => 
    (item.product.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.location.length === 0 || filters.location.includes(item.location)) &&
    (filters.category.length === 0 || filters.category.includes(item.category)) &&
    (filters.brand.length === 0 || (item.brand && filters.brand.includes(item.brand))) &&
    (filters.unit.length === 0 || (item.unit && filters.unit.includes(item.unit)))
  );

  // Totals Calculation based on filtered data to mimic screenshot row aggregation logic
  const totals = filteredData.reduce((acc, curr) => ({
    currentStock: acc.currentStock + curr.currentStock,
    stockValuePurchase: acc.stockValuePurchase + curr.stockValuePurchase,
    stockValueSale: acc.stockValueSale + curr.stockValueSale,
    potentialProfit: acc.potentialProfit + curr.potentialProfit,
    totalUnitSold: acc.totalUnitSold + curr.totalUnitSold,
    totalUnitTransferred: acc.totalUnitTransferred + curr.totalUnitTransferred,
    totalUnitAdjusted: acc.totalUnitAdjusted + curr.totalUnitAdjusted
  }), { 
    currentStock: 0, stockValuePurchase: 0, stockValueSale: 0, 
    potentialProfit: 0, totalUnitSold: 0, totalUnitTransferred: 0, totalUnitAdjusted: 0 
  });

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header */}
      <div>
          <h2 className="text-xl font-bold text-slate-900">Stock Report</h2>
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
                        options={['Engine oil', 'Dry Pet Food', 'Food product']}
                        selected={filters.category}
                        onChange={(val) => setFilters({...filters, category: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Sub Category"
                        options={['Option 1', 'Option 2']}
                        selected={filters.subCategory}
                        onChange={(val) => setFilters({...filters, subCategory: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Brand"
                        options={['Kennol', 'Cebican', 'Garpidog', 'Migos', 'Indomie', 'Merinda', 'Zomoroda', 'Redbull', 'Code Red', 'Fanta']}
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
            </div>
          )}
      </div>

      {/* Summary Metrics */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
              <div className="flex flex-col gap-1 border-r border-slate-100 last:border-0 pr-4">
                  <span className="font-medium text-slate-500 text-xs">Closing Stock <span className="font-normal">(By purchase price)</span></span>
                  <span className="font-bold text-slate-800 text-lg">{formatRiyal(2642.107)}</span>
              </div>
              <div className="flex flex-col gap-1 border-r border-slate-100 last:border-0 pr-4">
                  <span className="font-medium text-slate-500 text-xs">Closing Stock <span className="font-normal">(By sale price)</span></span>
                  <span className="font-bold text-slate-800 text-lg">{formatRiyal(60640.574)}</span>
              </div>
              <div className="flex flex-col gap-1 border-r border-slate-100 last:border-0 pr-4">
                  <span className="font-medium text-slate-500 text-xs">Potential profit</span>
                  <span className="font-bold text-emerald-600 text-lg">{formatRiyal(57998.467)}</span>
              </div>
              <div className="flex flex-col gap-1">
                  <span className="font-medium text-slate-500 text-xs">Profit Margin %</span>
                  <span className="font-bold text-slate-800 text-lg">95.643</span>
              </div>
          </div>
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
                          <th className="px-4 py-3 whitespace-nowrap">Action</th>
                          <th className="px-4 py-3 whitespace-nowrap">SKU <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Product <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Variation <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Category <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Location <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Unit Selling Price <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Current stock <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Current Stock Value <br/><span className="text-[9px] text-slate-500 font-normal">(By purchase price)</span> <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Current Stock Value <br/><span className="text-[9px] text-slate-500 font-normal">(By sale price)</span> <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Potential profit <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Total unit sold <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Total Unit Transferred <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Total Unit Adjusted <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-center">Custom Field1</th>
                          <th className="px-4 py-3 whitespace-nowrap text-center">Custom Field2</th>
                          <th className="px-4 py-3 whitespace-nowrap text-center">Custom Field3</th>
                          <th className="px-4 py-3 whitespace-nowrap text-center">Custom Field4</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredData.map((item, idx) => (
                          <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                              <td className="px-4 py-3 text-center">
                                  <button className="flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 text-blue-600 rounded text-[10px] font-bold hover:bg-blue-50 transition-colors whitespace-nowrap">
                                      <History size={10} /> Product stock history
                                  </button>
                              </td>
                              <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono">{item.sku}</td>
                              <td className="px-4 py-3 text-slate-700 font-bold whitespace-nowrap">{item.product}</td>
                              <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{item.variation}</td>
                              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{item.category}</td>
                              <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[10px]">{item.location}</td>
                              <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">{formatRiyal(item.unitSellingPrice)}</td>
                              <td className="px-4 py-3 text-right text-slate-700 font-bold whitespace-nowrap">{item.currentStock.toFixed(3)} Pc(s)</td>
                              <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatRiyal(item.stockValuePurchase)}</td>
                              <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatRiyal(item.stockValueSale)}</td>
                              <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatRiyal(item.potentialProfit)}</td>
                              <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{item.totalUnitSold.toFixed(3)} Pc(s)</td>
                              <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{item.totalUnitTransferred.toFixed(3)} Pc(s)</td>
                              <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{item.totalUnitAdjusted.toFixed(3)} Pc(s)</td>
                              <td className="px-4 py-3 text-center text-slate-300">--</td>
                              <td className="px-4 py-3 text-center text-slate-300">--</td>
                              <td className="px-4 py-3 text-center text-slate-300">--</td>
                              <td className="px-4 py-3 text-center text-slate-300">--</td>
                          </tr>
                      ))}
                  </tbody>
                  <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                      <tr>
                          <td colSpan={6} className="px-4 py-3 text-right uppercase">Total:</td>
                          <td className="px-4 py-3 text-right"></td>
                          <td className="px-4 py-3 text-right text-slate-800">{totals.currentStock.toFixed(3)}</td>
                          <td className="px-4 py-3 text-right text-slate-800">{formatRiyal(totals.stockValuePurchase)}</td>
                          <td className="px-4 py-3 text-right text-slate-800">{formatRiyal(totals.stockValueSale)}</td>
                          <td className="px-4 py-3 text-right text-slate-800">{formatRiyal(totals.potentialProfit)}</td>
                          <td className="px-4 py-3 text-right text-slate-800">{totals.totalUnitSold.toFixed(3)}</td>
                          <td className="px-4 py-3 text-right text-slate-800">{totals.totalUnitTransferred.toFixed(3)}</td>
                          <td className="px-4 py-3 text-right text-slate-800">{totals.totalUnitAdjusted.toFixed(3)}</td>
                          <td colSpan={4}></td>
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
                  <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">5</button>
                  <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">Next</button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default ReportStock;