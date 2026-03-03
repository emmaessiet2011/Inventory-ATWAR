import React, { useState } from 'react';
import { 
  Filter, FileText, FileSpreadsheet, Printer, 
  Columns, Search, ArrowUpDown, ChevronDown, Download, Eye
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

// Utility for currency formatting
const formatRiyal = (amount: number) => {
  return `${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ريال`;
};

const ReportSellPayment: React.FC = () => {
  const { locations } = useGlobalContext();
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [filters, setFilters] = useState({
      customer: [] as string[],
      customerGroup: [] as string[],
      location: [] as string[],
      paymentMethod: [] as string[]
  });

  // Mock Data
  const reportData = [
    { id: '1', ref: 'SP2026/3198', date: '14/02/2026 07:33 AM', amount: 33.000, customer: 'Direct Customer', group: '', method: 'Emad', methodDetail: '(Transaction No.:)', sell: 'K2026-2505', location: 'CR:1450968' },
    { id: '2', ref: 'SP2026/3196', date: '12/02/2026 04:14 PM', amount: 35.285, customer: 'Hala Point International LLC', group: 'Supermarkets Customers', method: 'Cash', methodDetail: '', sell: '20241058', location: 'CR:1450968' },
    { id: '3', ref: 'SP2026/3194', date: '12/02/2026 10:45 AM', amount: 23.100, customer: 'ATMED Fix (Mabailah)', group: 'Engine Oil Customers', method: 'Khalil', methodDetail: '', sell: '2026-1614', location: 'CR:1450968' },
    { id: '4', ref: 'SP2026/3195', date: '12/02/2026 10:45 AM', amount: 89.200, customer: 'ATMED Fix (Mabailah)', group: 'Engine Oil Customers', method: 'Khalil', methodDetail: '', sell: '2026-1615', location: 'CR:1450968' },
    { id: '5', ref: 'SP2026/3193', date: '12/02/2026 10:44 AM', amount: 40.000, customer: 'ATMED Fix (Mabailah)', group: 'Engine Oil Customers', method: 'Khalil', methodDetail: '', sell: '2026-1613', location: 'CR:1450968' },
    { id: '6', ref: 'SP2026/3186', date: '12/02/2026 09:14 AM', amount: 13.000, customer: 'Direct Customer', group: '', method: 'Emad', methodDetail: '(Transaction No.:)', sell: 'K2026-2501', location: 'CR:1450968' },
    { id: '7', ref: 'SP2026/3185', date: '12/02/2026 07:44 AM', amount: 18.000, customer: 'Direct Customer', group: '', method: 'Emad', methodDetail: '(Transaction No.:)', sell: 'K2026-2500', location: 'CR:1450968' },
    { id: '8', ref: 'SP2026/3184', date: '11/02/2026 08:56 PM', amount: 60.000, customer: 'Direct Customer', group: '', method: 'Emad', methodDetail: '(Transaction No.:)', sell: 'K2026-2497', location: 'CR:1450968' },
    { id: '9', ref: 'SP2026/3190', date: '11/02/2026 10:23 AM', amount: 20.000, customer: 'Rashid (Barka)', group: 'Pet food customer', method: 'Cash', methodDetail: '', sell: '20241064', location: 'CR:1450968' },
    { id: '10', ref: 'SP2026/3188', date: '11/02/2026 10:22 AM', amount: 73.735, customer: 'DR. Omsalama(Barka)', group: 'Pet food customer', method: 'Cash', methodDetail: '', sell: '20241018', location: 'CR:1450968' },
    { id: '11', ref: 'SP2026/3189', date: '11/02/2026 10:22 AM', amount: 26.265, customer: 'DR. Omsalama(Barka)', group: 'Pet food customer', method: 'Cash', methodDetail: '', sell: '20241140', location: 'CR:1450968' },
    { id: '12', ref: 'SP2026/3183', date: '10/02/2026 09:31 PM', amount: 0.026, customer: 'Midrar 2 (Mobailah)', group: 'Supermarkets Customers', method: 'Cash', methodDetail: '', sell: 'K2026-2483', location: 'CR:1450968' },
    { id: '13', ref: 'SP2026/3182', date: '10/02/2026 09:30 PM', amount: 11.274, customer: 'Midrar 2 (Mobailah)', group: 'Supermarkets Customers', method: 'Cash', methodDetail: '', sell: '20241223', location: 'CR:1450968' },
    { id: '14', ref: 'SP2026/3180', date: '10/02/2026 09:24 PM', amount: 10.000, customer: 'Aquatic World Trd LLC', group: 'Pet food customer', method: 'Cash', methodDetail: '', sell: '20241095', location: 'CR:1450968' },
    { id: '15', ref: 'SP2026/3174', date: '10/02/2026 03:54 PM', amount: 17.000, customer: 'Direct Customer', group: '', method: 'Emad', methodDetail: '(Transaction No.:)', sell: 'K2026-2491', location: 'CR:1450968' },
    { id: '16', ref: 'SP2026/3173', date: '10/02/2026 03:47 PM', amount: 40.000, customer: 'Direct Customer', group: '', method: 'Emad', methodDetail: '(Transaction No.:)', sell: 'K2026-2490', location: 'CR:1450968' },
    { id: '17', ref: 'SP2026/3192', date: '10/02/2026 10:39 AM', amount: 82.592, customer: 'Macro Mart (AL Khoud)', group: 'Supermarkets Customers', method: 'Cheque', methodDetail: '(Cheque No.: knwz ard alkhlyj almthdh)', sell: '20241086', location: 'CR:1450968' },
    { id: '18', ref: 'SP2026/3191', date: '10/02/2026 10:38 AM', amount: 19.252, customer: 'Macro Mart (AL Khoud)', group: 'Supermarkets Customers', method: 'Cheque', methodDetail: '(Cheque No.: knwz ard alkhlyj almthdh)', sell: '20240884', location: 'CR:1450968' },
    { id: '19', ref: 'SP2026/3187', date: '10/02/2026 10:09 AM', amount: 89.200, customer: 'Ajyal Veterinary Center (Mobailah)', group: 'Pet food customer', method: 'Cash', methodDetail: '', sell: 'K2026-2502', location: 'CR:1450968' },
    { id: '20', ref: 'SP2026/3172', date: '09/02/2026 09:52 AM', amount: 33.590, customer: 'Dr. Amani (Manooma)', group: '', method: 'Khalil', methodDetail: '', sell: '20241089', location: 'CR:1450968' },
    { id: '21', ref: 'SP2026/3171', date: '09/02/2026 09:51 AM', amount: 26.410, customer: 'Dr. Amani (Manooma)', group: '', method: 'Khalil', methodDetail: '', sell: '20241054', location: 'CR:1450968' },
    { id: '22', ref: 'SP2026/3170', date: '08/02/2026 10:08 AM', amount: 4.293, customer: 'Royal Mart', group: 'Supermarkets Customers', method: 'Cash', methodDetail: '', sell: 'K2026-2477', location: 'CR:1450968' },
    { id: '23', ref: 'SP2026/3169', date: '08/02/2026 10:06 AM', amount: 15.642, customer: 'Royal Mart', group: 'Supermarkets Customers', method: 'Cash', methodDetail: '', sell: 'K2026-2461', location: 'CR:1450968' },
    { id: '24', ref: 'SP2026/3167', date: '07/02/2026 09:11 PM', amount: 0.000, customer: 'ATMED Fix (Mabailah)', group: 'Engine Oil Customers', method: 'Khalil', methodDetail: '', sell: '2026-1613', location: 'CR:1450968' },
    { id: '25', ref: 'SP2026/3164', date: '07/02/2026 09:06 PM', amount: 4.725, customer: 'Dolphin Pet Shop (Ghubra)', group: 'Supermarkets Customers', method: 'Cash', methodDetail: '', sell: 'K2026-2473', location: 'CR:1450968' },
  ];

  const filteredData = reportData.filter(item => 
    (item.customer.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sell.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.customer.length === 0 || filters.customer.includes(item.customer)) &&
    (filters.customerGroup.length === 0 || filters.customerGroup.includes(item.group)) &&
    (filters.location.length === 0 || filters.location.includes(item.location)) &&
    (filters.paymentMethod.length === 0 || filters.paymentMethod.includes(item.method))
  );

  const totalAmount = filteredData.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <h2 className="text-xl font-bold text-slate-900">Sell Payment Report</h2>

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
                        label="Customer"
                        options={['Direct Customer', 'Hala Point International LLC', 'ATMED Fix (Mabailah)', 'Rashid (Barka)', 'DR. Omsalama(Barka)', 'Midrar 2 (Mobailah)', 'Aquatic World Trd LLC', 'Macro Mart (AL Khoud)', 'Ajyal Veterinary Center (Mobailah)', 'Dr. Amani (Manooma)', 'Royal Mart', 'Dolphin Pet Shop (Ghubra)']}
                        selected={filters.customer}
                        onChange={(val) => setFilters({...filters, customer: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Customer Group"
                        options={['Supermarkets Customers', 'Engine Oil Customers', 'Pet food customer']}
                        selected={filters.customerGroup}
                        onChange={(val) => setFilters({...filters, customerGroup: val})}
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
                    <MultiSelect 
                        label="Payment Method"
                        options={['Cash', 'Cheque', 'Emad', 'Khalil']}
                        selected={filters.paymentMethod}
                        onChange={(val) => setFilters({...filters, paymentMethod: val})}
                    />
                </div>
                <div className="group md:col-span-2">
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

          <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-[11px] text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                          <th className="px-4 py-3 whitespace-nowrap">Reference No <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Paid on <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Customer <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Customer Group <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Payment Method <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Sell <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                          <th className="px-4 py-3 whitespace-nowrap">Action <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredData.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-slate-600 font-medium">{item.ref}</td>
                              <td className="px-4 py-3 text-slate-600">{item.date}</td>
                              <td className="px-4 py-3 text-slate-800 font-bold">{formatRiyal(item.amount)}</td>
                              <td className="px-4 py-3 text-slate-700">{item.customer}</td>
                              <td className="px-4 py-3 text-slate-600">{item.group}</td>
                              <td className="px-4 py-3 text-slate-600">
                                  {item.method} <br/>
                                  <span className="text-[9px] text-slate-400">{item.methodDetail}</span>
                              </td>
                              <td className="px-4 py-3 text-blue-600 hover:underline cursor-pointer">{item.sell}</td>
                              <td className="px-4 py-3 text-center">
                                  <button className="flex items-center gap-1 px-2 py-1 bg-white border border-blue-500 text-blue-600 rounded text-[10px] font-bold hover:bg-blue-50 transition-colors">
                                      <Eye size={10} /> View
                                  </button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
                  <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                      <tr>
                          <td colSpan={2} className="px-4 py-3 text-right uppercase">Total:</td>
                          <td className="px-4 py-3 text-left">{formatRiyal(totalAmount)}</td>
                          <td colSpan={5} className="px-4 py-3 text-right text-slate-500">735.589 ريال</td>
                      </tr>
                  </tfoot>
              </table>
          </div>
          <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <div>Showing 1 to {filteredData.length} of {filteredData.length} entries</div>
              <div className="flex gap-1">
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50" disabled>Previous</button>
                  <button className="px-2 py-1 bg-blue-600 text-white rounded shadow-sm">1</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50">2</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50">3</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50">4</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50">5</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50">Next</button>
              </div>
          </div>
      </div>
      <div className="mt-8 pt-6 border-t border-slate-200 text-[10px] text-slate-400 font-medium text-center sm:text-left">
          Wingital - V6.4 | Copyright © 2026 All rights reserved.
      </div>
    </div>
  );
};

export default ReportSellPayment;
