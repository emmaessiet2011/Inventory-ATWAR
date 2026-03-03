import React, { useState } from 'react';
import { 
  Filter, Calendar, ChevronDown, FileText, 
  FileSpreadsheet, Printer, Columns, Download, 
  Search, Info, ArrowUpDown
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';

// Utility for currency formatting
const formatRiyal = (amount: number) => {
  return `${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ريال`;
};

interface ReportData {
  id: string;
  contact: string;
  location: string; // implied by filter, sometimes shown in name
  totalPurchase: number;
  totalPurchaseReturn: number;
  totalSale: number;
  totalSellReturn: number;
  openingBalanceDue: number;
  due: number;
  customerGroup?: string; // Added
  type?: string; // Added
}

const ReportSupplierCustomer: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
      customerGroup: [] as string[],
      type: [] as string[],
      location: [] as string[],
      contact: [] as string[]
  });

  // Mock Data
  const reportData: ReportData[] = [
    { id: '1', contact: 'ATMED Fix (Mabailah)', location: 'Mabailah', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 862.575, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 20.000, customerGroup: 'Retail', type: 'Customer' },
    { id: '2', contact: 'ABNA Nadeem (Sharadi)', location: 'Sharadi', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 39.060, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 39.060, customerGroup: 'Retail', type: 'Customer' },
    { id: '3', contact: 'Abraj Cold Store (Wadi Kabir)', location: 'Wadi Kabir', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 26.989, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 26.989, customerGroup: 'Supermarket', type: 'Customer' },
    { id: '4', contact: 'Ajyal Veterinary Center (Mobailah)', location: 'Mobailah', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 329.125, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 0.000 },
    { id: '5', contact: 'Al Maya(AL Khuwair)', location: 'Al Khuwair', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 38.304, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 38.304 },
    { id: '6', contact: 'AL Maya(AL Qurum)', location: 'Al Qurum', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 19.152, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 19.152 },
    { id: '7', contact: 'Aquatic World Trd LLC', location: '', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 28.350, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 28.350 },
    { id: '8', contact: 'Blue Zone Auto Center (Al Khoud)', location: 'Al Khoud', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 0.000, totalSellReturn: 104.948, openingBalanceDue: 0.000, due: 104.948 },
    { id: '9', contact: 'Careem & Nawaf Trading LLC', location: '', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 38.650, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 38.650 },
    { id: '10', contact: 'Company Car Service', location: '', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 10.250, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 0.000 },
    { id: '11', contact: 'Day By Day Shopping Center (Mobailah)', location: 'Mobailah', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 27.720, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 27.720 },
    { id: '12', contact: 'Direct Customer', location: '', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 1159.264, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 14.264 },
    { id: '13', contact: 'Dolphin Pet Shop (Ghubra)', location: 'Ghubra', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 18.585, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 0.000 },
    { id: '14', contact: 'Dr. Amani (Manooma)', location: 'Manooma', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 155.005, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 155.005 },
    { id: '15', contact: 'Dr. Awael Veterinary Clinic (Al Hail)', location: 'Al Hail', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 141.225, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 141.225 },
    { id: '16', contact: 'DR. Omsalama(Barka)', location: 'Barka', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 226.275, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 226.275 },
    { id: '17', contact: 'Dubai Hypermarket Intl LLC (Al Hail)', location: 'Al Hail', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 43.779, totalSellReturn: 3.938, openingBalanceDue: 0.000, due: 39.842 },
    { id: '18', contact: 'Dubai Hypermarket Intl LLC (Lawami)', location: 'Lawami', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 33.702, totalSellReturn: 3.938, openingBalanceDue: 0.000, due: 29.765 },
    { id: '19', contact: 'Fix It ( Mobailah)', location: 'Mobailah', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 240.450, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 240.450 },
    { id: '20', contact: 'Fluffy Vetenary (Mobeela)', location: 'Mobeela', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 35.000, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 0.000 },
    { id: '21', contact: 'GOLDEN RAIN EST', location: '', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 85.239, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 85.239 },
    { id: '22', contact: 'Hala Point International LLC', location: '', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 87.784, totalSellReturn: 0.375, openingBalanceDue: 0.000, due: 87.409 },
    { id: '23', contact: 'Ibrahim Namani', location: '', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 11.000, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 0.000 },
    { id: '24', contact: 'Kennol Workshop (Sandan)', location: 'Sandan', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 1086.990, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 1086.990 },
    { id: '25', contact: 'LOULAT AL AJYAL', location: '', totalPurchase: 0.000, totalPurchaseReturn: 0.000, totalSale: 19.572, totalSellReturn: 0.000, openingBalanceDue: 0.000, due: 19.572 },
  ];

  const filteredData = reportData.filter(d => 
    d.contact.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filters.customerGroup.length === 0 || (d.customerGroup && filters.customerGroup.includes(d.customerGroup))) &&
    (filters.type.length === 0 || (d.type && filters.type.includes(d.type))) &&
    (filters.location.length === 0 || filters.location.includes(d.location)) &&
    (filters.contact.length === 0 || filters.contact.includes(d.contact))
  );

  // Totals
  const totals = filteredData.reduce((acc, curr) => ({
    purchase: acc.purchase + curr.totalPurchase,
    purchaseReturn: acc.purchaseReturn + curr.totalPurchaseReturn,
    sale: acc.sale + curr.totalSale,
    sellReturn: acc.sellReturn + curr.totalSellReturn,
    opening: acc.opening + curr.openingBalanceDue,
    due: acc.due + curr.due,
  }), { purchase: 0, purchaseReturn: 0, sale: 0, sellReturn: 0, opening: 0, due: 0 });

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header */}
      <div>
          <h2 className="text-xl font-bold text-slate-900">Customers & Suppliers Reports</h2>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-blue-600 font-bold text-sm cursor-pointer">
              <Filter size={16} /> Filters
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="group">
                  <MultiSelect 
                        label="Customer Group Name"
                        options={['Retail', 'Supermarket']}
                        selected={filters.customerGroup}
                        onChange={(val) => setFilters({...filters, customerGroup: val})}
                  />
              </div>

              <div className="group">
                  <MultiSelect 
                        label="Type"
                        options={['Customer', 'Supplier']}
                        selected={filters.type}
                        onChange={(val) => setFilters({...filters, type: val})}
                  />
              </div>

              <div className="group">
                  <MultiSelect 
                        label="Location"
                        options={['Mabailah', 'Sharadi', 'Wadi Kabir', 'Al Khuwair', 'Al Qurum', 'Al Khoud', 'Ghubra', 'Manooma', 'Al Hail', 'Barka', 'Lawami', 'Mobeela', 'Sandan']}
                        selected={filters.location}
                        onChange={(val) => setFilters({...filters, location: val})}
                  />
              </div>

              <div className="group">
                  <MultiSelect 
                        label="Contact"
                        options={['ATMED Fix (Mabailah)', 'ABNA Nadeem (Sharadi)', 'Abraj Cold Store (Wadi Kabir)']}
                        selected={filters.contact}
                        onChange={(val) => setFilters({...filters, contact: val})}
                  />
              </div>

              <div className="group">
                  <DateRangeFilter />
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
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10}/> Excel</button>
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
              <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                          <th className="px-4 py-3 whitespace-nowrap">Contact <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Total Purchase <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Total Purchase Return <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Total Sale <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Total Sell Return <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Opening Balance Due <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">Due <Info size={10} className="inline ml-1 text-blue-500" /> <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredData.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-slate-700 font-bold whitespace-nowrap">{item.contact}</td>
                              <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatRiyal(item.totalPurchase)}</td>
                              <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatRiyal(item.totalPurchaseReturn)}</td>
                              <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatRiyal(item.totalSale)}</td>
                              <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatRiyal(item.totalSellReturn)}</td>
                              <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatRiyal(item.openingBalanceDue)}</td>
                              <td className="px-4 py-3 text-right text-slate-800 font-bold whitespace-nowrap">{formatRiyal(item.due)}</td>
                          </tr>
                      ))}
                  </tbody>
                  <tfoot className="bg-slate-200 font-bold text-slate-800 text-xs border-t border-slate-300 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                      <tr>
                          <td className="px-4 py-3 text-right uppercase">Total:</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(totals.purchase)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(totals.purchaseReturn)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(totals.sale)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(totals.sellReturn)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(totals.opening)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(totals.due)}</td>
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
                  <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">Next</button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default ReportSupplierCustomer;