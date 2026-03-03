
import React, { useState } from 'react';
import { 
  X, FileText, FileSpreadsheet, Printer, Columns, 
  ChevronDown, Search, ArrowUpDown, History,
  Plus, Minus, User, MapPin, Package, Download, Info
} from 'lucide-react';
import { useGlobalContext } from '../src/context/GlobalContext';

interface ProductStockHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
}

const ProductStockHistory: React.FC<ProductStockHistoryProps> = ({ isOpen, onClose, product }) => {
  const { locations } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  // Mock Data mimicking the screenshot's specific record set
  const historyData = [
    { type: 'Sell', change: -8.000, newQty: 231.000, date: '16/02/2026 04:19 PM', ref: '2026-1616', party: 'Kennol Workshop (Sandan)' },
    { type: 'Sell Return', change: 0.000, newQty: 239.000, date: '06/01/2026 04:20 PM', ref: 'CN2026/0139', party: 'Modern Auto New Spare Parts (Mobailah)' },
    { type: 'Sell Return', change: 1.000, newQty: 239.000, date: '05/01/2026 04:19 PM', ref: 'CN2026/0137', party: 'Blue Zone Auto Center (Al Khoud)' },
    { type: 'Sell', change: -8.000, newQty: 238.000, date: '04/01/2026 04:24 PM', ref: '2026-1600', party: 'Fix It (Mobailah)' },
    { type: 'Sell', change: -8.000, newQty: 246.000, date: '04/01/2026 04:22 PM', ref: '2026-1599', party: 'Kennol Workshop (Sandan)' },
    { type: 'Sell', change: -8.000, newQty: 254.000, date: '15/12/2025 08:18 AM', ref: '2025-1591', party: 'Kennol Workshop (Sandan)' },
    { type: 'Sell', change: -4.000, newQty: 262.000, date: '04/12/2025 07:47 PM', ref: '2025-1588', party: 'Kennol Workshop (Sandan)' },
    { type: 'Sell', change: -4.000, newQty: 266.000, date: '23/11/2025 01:09 PM', ref: '2025-1585', party: 'Kennol Workshop (Sandan)' },
    { type: 'Sell', change: -8.000, newQty: 270.000, date: '20/11/2025 07:50 AM', ref: '2025-1583', party: 'Auto Lab (Mobailah)' },
    { type: 'Sell', change: -1.000, newQty: 278.000, date: '13/11/2025 04:37 PM', ref: '2025-1580', party: 'Modern Auto New Spare Parts (Mobailah)' },
    { type: 'Sell', change: -4.000, newQty: 279.000, date: '12/11/2025 08:37 AM', ref: '2025-1578', party: 'Kennol Workshop (Sandan)' },
    { type: 'Sell', change: -1.000, newQty: 283.000, date: '11/11/2025 08:12 AM', ref: '2025-1575', party: 'Blue Zone Auto Center (Al Khoud)' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-[98%] rounded-2xl shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
         
         {/* 1. Header with Glow */}
         <div className="flex justify-between items-center px-8 py-5 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-20 rounded-t-2xl">
             <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                    <History size={20} />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Product Stock History</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{product?.name || 'Kennol 5W-30 (5L)'}</p>
                 </div>
             </div>
             <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all">
                 <X size={24} />
             </button>
         </div>

         <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
             
             {/* 2. Top Navigation/Filters Panel */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[1.5rem] border border-slate-200 shadow-sm">
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Active Product Intelligence</label>
                      <div className="relative group">
                          <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={18} />
                          <input 
                              type="text" 
                              value={`${product?.name || 'Kennol 5W-30 (5L)'} - ${product?.sku || '0004'}`} 
                              readOnly 
                              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 shadow-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          />
                      </div>
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Business Analytics Location</label>
                      <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500" size={18} />
                          <select className="w-full pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none appearance-none shadow-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer">
                              {locations.map(loc => (
                                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                              ))}
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                      </div>
                  </div>
             </div>

             {/* 3. Metrics Summary Cloud */}
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Quantities In */}
                 <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden group">
                     <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                     <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Plus size={14} className="text-emerald-500" /> Quantities In
                     </h4>
                     <div className="space-y-3">
                         {[
                             { label: 'Total Purchase', val: '0.000 Pc(s)' },
                             { label: 'Opening Stock', val: '912.000 Pc(s)' },
                             { label: 'Total Sell Return', val: '15.000 Pc(s)' },
                             { label: 'Stock Transfers (In)', val: '0.000 Pc(s)' }
                         ].map((item, i) => (
                             <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                 <span className="text-sm font-bold text-slate-600">{item.label}</span>
                                 <span className="font-mono text-sm font-bold text-slate-900">{item.val}</span>
                             </div>
                         ))}
                     </div>
                 </div>

                 {/* Quantities Out */}
                 <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden group">
                     <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                     <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Minus size={14} className="text-rose-500" /> Quantities Out
                     </h4>
                     <div className="space-y-3">
                         {[
                             { label: 'Total Sold', val: '696.000 Pc(s)' },
                             { label: 'Total Stock Adjustment', val: '0.000 Pc(s)' },
                             { label: 'Total Purchase Return', val: '0.000 Pc(s)' },
                             { label: 'Stock Transfers (Out)', val: '0.000 Pc(s)' }
                         ].map((item, i) => (
                             <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                 <span className="text-sm font-bold text-slate-600">{item.label}</span>
                                 <span className="font-mono text-sm font-bold text-slate-900">{item.val}</span>
                             </div>
                         ))}
                     </div>
                 </div>

                 {/* Totals Summary */}
                 <div className="bg-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden group flex flex-col justify-center">
                     <div className="absolute -right-4 -bottom-4 opacity-10 text-white transform rotate-12 group-hover:scale-110 transition-transform duration-700">
                         <Package size={140} />
                     </div>
                     <h4 className="text-[11px] font-black text-indigo-300 uppercase tracking-widest mb-2">Live Inventory Total</h4>
                     <div className="space-y-1">
                         <div className="text-5xl font-black text-white tracking-tighter">
                             231.000
                         </div>
                         <div className="text-sm font-bold text-indigo-400 flex items-center gap-2 uppercase">
                             Pieces <span className="w-1 h-1 rounded-full bg-indigo-500"></span> Current Stock
                         </div>
                     </div>
                     <div className="mt-6 flex items-center gap-2 text-xs font-bold text-indigo-200 bg-white/10 w-fit px-3 py-1.5 rounded-lg backdrop-blur-sm">
                         <Info size={14} /> Synced 1m ago
                     </div>
                 </div>
             </div>

             {/* 4. Table Controls Bar */}
             <div className="flex flex-col xl:flex-row justify-between items-center gap-6 pt-4">
                  <div className="flex items-center gap-4 w-full xl:w-auto">
                      <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Display</span>
                          <select className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm cursor-pointer">
                              <option>25</option>
                              <option>50</option>
                              <option>100</option>
                          </select>
                      </div>
                      <div className="h-4 w-px bg-slate-200 mx-2"></div>
                      <div className="relative group">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
                          <input 
                            type="text" 
                            placeholder="Filter records..." 
                            className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none min-w-[240px]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                      </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 justify-center">
                      {[
                        { icon: FileText, label: 'Export CSV' },
                        { icon: FileSpreadsheet, label: 'Export Excel' },
                        { icon: Printer, label: 'Print History' },
                        { icon: Columns, label: 'Manage Columns' },
                        { icon: Download, label: 'Export PDF' }
                      ].map((action, i) => (
                          <button key={i} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 hover:text-indigo-600 hover:bg-slate-50 hover:border-indigo-200 transition-all shadow-sm active:scale-95 uppercase tracking-widest whitespace-nowrap">
                              <action.icon size={12} /> {action.label}
                          </button>
                      ))}
                  </div>
             </div>

             {/* 5. Detailed Ledger Table */}
             <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200 shadow-sm">
                 <table className="w-full text-left border-collapse min-w-[1000px]">
                     <thead>
                         <tr className="bg-slate-50 border-b border-slate-200">
                             <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                 <div className="flex items-center gap-2">Type <ArrowUpDown size={12}/></div>
                             </th>
                             <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                 <div className="flex items-center gap-2">Quantity Change <ArrowUpDown size={12}/></div>
                             </th>
                             <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                 <div className="flex items-center gap-2">New Net Qty <ArrowUpDown size={12}/></div>
                             </th>
                             <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                 <div className="flex items-center gap-2">Date <ArrowUpDown size={12}/></div>
                             </th>
                             <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference No</th>
                             <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Stakeholder Intelligence</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {historyData.map((row, index) => (
                            <tr key={index} className="hover:bg-slate-50/80 transition-all group">
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                                        row.type.includes('Return') 
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                        : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                    }`}>
                                        {row.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className={`text-sm font-black flex items-center gap-1 ${row.change < 0 ? 'text-rose-600' : row.change > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {row.change > 0 ? '+' : ''}{row.change.toFixed(3)}
                                        {row.change !== 0 && (row.change < 0 ? <Minus size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />)}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg w-fit group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                                        {row.newQty.toFixed(3)}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-xs font-bold text-slate-500 whitespace-nowrap">{row.date}</div>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs font-black text-indigo-600">
                                    {row.ref}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                            <User size={14} />
                                        </div>
                                        <div className="text-sm font-bold text-slate-700 leading-tight">
                                            {row.party}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                     </tbody>
                 </table>
             </div>
             
             {/* 6. Footer / Pagination */}
             <div className="flex flex-col sm:flex-row justify-between items-center py-4 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                 <div>Showing 1 to 25 of 169 velocity events</div>
                 <div className="flex gap-2 mt-4 sm:mt-0">
                     <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all font-bold" disabled>Prev</button>
                     {[1, 2, 3, 4, 5].map(p => (
                         <button key={p} className={`w-8 h-8 rounded-xl font-bold transition-all ${p === 1 ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'}`}>
                             {p}
                         </button>
                     ))}
                     <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold">Next</button>
                 </div>
             </div>
         </div>
      </div>
    </div>
  );
};

export default ProductStockHistory;
