import React, { useState } from 'react';
import { 
  Plus, Search, FileText, FileSpreadsheet, Printer, 
  Columns, Download, Edit, Trash2, ChevronDown, 
  ArrowUpDown, AlertTriangle, Filter
} from 'lucide-react';

interface StockAdjustment {
  id: string;
  date: string;
  refNo: string;
  location: string;
  adjustmentType: 'Normal' | 'Abnormal';
  totalAmount: number;
  totalAmountRecovered: number;
  reason: string;
  addedBy: string;
}

const initialAdjustments: StockAdjustment[] = [
  { id: '1', date: '2023-11-20 10:00', refNo: 'SA-2023-001', location: 'CR:1450968', adjustmentType: 'Normal', totalAmount: 50.000, totalAmountRecovered: 0.000, reason: 'Damaged Goods', addedBy: 'Admin' },
  { id: '2', date: '2023-11-22 14:30', refNo: 'SA-2023-002', location: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', adjustmentType: 'Abnormal', totalAmount: 120.000, totalAmountRecovered: 50.000, reason: 'Theft', addedBy: 'Manager' },
];

const StockAdjustment: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>(initialAdjustments);

  const filteredAdjustments = adjustments.filter(a => 
    a.refNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <AlertTriangle className="text-amber-500" size={32} />
            Stock Adjustments
          </h2>
          <p className="text-slate-500 mt-1">Manage stock adjustments for damage, theft, or corrections.</p>
        </div>
        <button 
          className="bg-amber-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-600 transition shadow-lg shadow-amber-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
        >
          <Plus size={18} /> Add Stock Adjustment
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
        
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
            <div className="flex items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-1 xl:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search adjustments..." 
                  className="w-full pl-9 pr-4 py-2 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition shadow-sm">
                <Filter size={18} />
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto">
              {[
                { icon: FileText, label: 'CSV' },
                { icon: FileSpreadsheet, label: 'Excel' },
                { icon: Printer, label: 'Print' },
                { icon: Download, label: 'PDF' },
              ].map((action, i) => (
                <button key={i} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm">
                  <action.icon size={14} /> {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Reference No</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Adjustment Type</th>
                <th className="px-6 py-4 text-right">Total Amount</th>
                <th className="px-6 py-4 text-right">Total Amount Recovered</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Added By</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAdjustments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 text-slate-600">{a.date}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">{a.refNo}</td>
                  <td className="px-6 py-4 text-slate-600">{a.location}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      a.adjustmentType === 'Normal' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {a.adjustmentType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">{a.totalAmount.toFixed(3)}</td>
                  <td className="px-6 py-4 text-right text-emerald-600 font-medium">{a.totalAmountRecovered.toFixed(3)}</td>
                  <td className="px-6 py-4 text-slate-600 italic">{a.reason}</td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{a.addedBy}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                        <Edit size={14} />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StockAdjustment;
