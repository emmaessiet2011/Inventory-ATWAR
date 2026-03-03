import React, { useState } from 'react';
import { 
  Filter, FileText, FileSpreadsheet, Printer, 
  Columns, Search, ArrowUpDown, ChevronDown, Eye
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';

// Utility for currency formatting
const formatRiyal = (amount: number) => {
  return `${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ريال`;
};

const ReportRegister: React.FC = () => {
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
      user: [] as string[],
      status: [] as string[]
  });

  // Mock Data
  const reportData = [
    { id: '1', openTime: '14/10/2025 01:06 PM', closeTime: '', location: 'CR:1450968', user: 'Shafikul Islam', email: 'jaifar9115@gmail.com', totalCard: 0, totalCheque: 0, totalCash: 9.000, totalBank: 0, totalAdvance: 0, credit: 0, yahya: 0, emad: 0, jaifar: 0, khalil: 0, custom6: 0, custom7: 0, other: 0, total: 9.000, status: 'Open' },
    { id: '2', openTime: '26/01/2025 08:08 PM', closeTime: '', location: 'KNWZ ARD ALKHALYJ ALMTHDAH', user: 'Mr ADMIN', email: 'atr.almustaqbal@gmail.com', totalCard: 0, totalCheque: 0, totalCash: 0, totalBank: 0, totalAdvance: 0, credit: 0, yahya: 0, emad: 0, jaifar: 0, khalil: 0, custom6: 0, custom7: 0, other: 0, total: 0.000, status: 'Open' },
    { id: '3', openTime: '26/01/2025 10:51 PM', closeTime: '', location: 'CR:1282649', user: 'Mr Emad', email: 'wmad@atwarbss.com', totalCard: 0, totalCheque: 0, totalCash: 0, totalBank: 0, totalAdvance: 0, credit: 0, yahya: 0, emad: 0, jaifar: 0, khalil: 0, custom6: 0, custom7: 0, other: 0, total: 0.000, status: 'Open' },
    { id: '4', openTime: '26/01/2025 11:00 PM', closeTime: '', location: 'CR:1282649', user: 'Mr Emad', email: 'emad@atwarbss.com', totalCard: 0, totalCheque: 0, totalCash: 0, totalBank: 0, totalAdvance: 0, credit: 0, yahya: 0, emad: 0, jaifar: 0, khalil: 0, custom6: 0, custom7: 0, other: 0, total: 0.000, status: 'Open' },
    { id: '5', openTime: '10/03/2025 09:11 AM', closeTime: '', location: 'KNWZ ARD ALKHALYJ ALMTHDH', user: 'Mr Usman', email: 'Usman@atwarbss.com', totalCard: 0, totalCheque: 0, totalCash: 0, totalBank: 0, totalAdvance: 0, credit: 0, yahya: 0, emad: 0, jaifar: 0, khalil: 0, custom6: 0, custom7: 0, other: 0, total: 0.000, status: 'Open' },
    { id: '6', openTime: '12/05/2025 12:28 PM', closeTime: '', location: 'CR:1450968', user: 'Ahmed', email: 'Ahmed@atwarbss.com', totalCard: 0, totalCheque: 0, totalCash: 1.900, totalBank: 0, totalAdvance: 0, credit: 0, yahya: 0, emad: 0, jaifar: 0, khalil: 0, custom6: 0, custom7: 0, other: 0, total: 1.900, status: 'Open' },
  ];

  const filteredData = reportData.filter(item => 
    (item.user.toLowerCase().includes(searchTerm.toLowerCase()) || item.location.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.user.length === 0 || filters.user.includes(item.user)) &&
    (filters.status.length === 0 || filters.status.includes(item.status))
  );

  const totalCash = filteredData.reduce((acc, curr) => acc + curr.totalCash, 0);
  const totalTotal = filteredData.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <h2 className="text-xl font-bold text-slate-900">Register Report</h2>

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
                        label="User"
                        options={['Shafikul Islam', 'Mr ADMIN', 'Mr Emad', 'Mr Usman', 'Ahmed']}
                        selected={filters.user}
                        onChange={(val) => setFilters({...filters, user: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Status"
                        options={['Open', 'Close']}
                        selected={filters.status}
                        onChange={(val) => setFilters({...filters, status: val})}
                    />
                </div>
                <div className="group">
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
              <table className="w-full text-[10px] text-left border-collapse whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                          <th className="px-4 py-3">Open Time</th>
                          <th className="px-4 py-3">Close Time</th>
                          <th className="px-4 py-3">Location</th>
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3 text-right">Total Card Slips</th>
                          <th className="px-4 py-3 text-right">Total cheques</th>
                          <th className="px-4 py-3 text-right">Total Cash</th>
                          <th className="px-4 py-3 text-right">Total bank transfer</th>
                          <th className="px-4 py-3 text-right">Total advance payment</th>
                          <th className="px-4 py-3 text-right">Credit</th>
                          <th className="px-4 py-3 text-right">Yahya</th>
                          <th className="px-4 py-3 text-right">Emad</th>
                          <th className="px-4 py-3 text-right">Jaifar</th>
                          <th className="px-4 py-3 text-right">Khalil</th>
                          <th className="px-4 py-3 text-right">Custom Payment 6</th>
                          <th className="px-4 py-3 text-right">Custom Payment 7</th>
                          <th className="px-4 py-3 text-right">Other Payments</th>
                          <th className="px-4 py-3 text-right">Total</th>
                          <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredData.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3">{item.openTime}</td>
                              <td className="px-4 py-3">{item.closeTime}</td>
                              <td className="px-4 py-3 truncate max-w-[150px]">{item.location}</td>
                              <td className="px-4 py-3">
                                  <div>{item.user}</div>
                                  <div className="text-[9px] text-slate-400">{item.email}</div>
                              </td>
                              <td className="px-4 py-3 text-right">{formatRiyal(item.totalCard)}</td>
                              <td className="px-4 py-3 text-right">{formatRiyal(item.totalCheque)}</td>
                              <td className="px-4 py-3 text-right">{formatRiyal(item.totalCash)}</td>
                              <td className="px-4 py-3 text-right">{formatRiyal(item.totalBank)}</td>
                              <td className="px-4 py-3 text-right">{formatRiyal(item.totalAdvance)}</td>
                              <td className="px-4 py-3 text-right">{formatRiyal(item.credit)}</td>
                              <td className="px-4 py-3 text-right">{formatRiyal(item.yahya)}</td>
                              <td className="px-4 py-3 text-right">{formatRiyal(item.emad)}</td>
                              <td className="px-4 py-3 text-right">{formatRiyal(item.jaifar)}</td>
                              <td className="px-4 py-3 text-right">{formatRiyal(item.khalil)}</td>
                              <td className="px-4 py-3 text-right">{formatRiyal(item.custom6)}</td>
                              <td className="px-4 py-3 text-right">{formatRiyal(item.custom7)}</td>
                              <td className="px-4 py-3 text-right">{formatRiyal(item.other)}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-800">{formatRiyal(item.total)}</td>
                              <td className="px-4 py-3 text-center">
                                  <button className="flex items-center justify-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-[10px] font-bold border border-blue-100 hover:bg-blue-100">
                                      <Eye size={10} /> View
                                  </button>
                              </td>
                          </tr>
                      ))}
                      {filteredData.length === 0 && (
                          <tr>
                              <td colSpan={19} className="px-4 py-8 text-center text-slate-400 italic">No data available in table</td>
                          </tr>
                      )}
                  </tbody>
                  <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                      <tr>
                          <td colSpan={4} className="px-4 py-3 text-right uppercase">Total:</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(0)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(0)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(totalCash)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(0)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(0)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(0)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(0)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(0)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(0)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(0)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(0)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(0)}</td>
                          <td className="px-4 py-3 text-right">{formatRiyal(0)}</td>
                          <td className="px-4 py-3 text-right font-black">{formatRiyal(totalTotal)}</td>
                          <td></td>
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

export default ReportRegister;
