import React, { useState } from 'react';
import { 
  Plus, Search, FileText, FileSpreadsheet, Printer, 
  Columns, Download, Edit, Trash2, ChevronDown, 
  ArrowUpDown, ArrowRightLeft, Filter
} from 'lucide-react';

interface StockTransfer {
  id: string;
  date: string;
  refNo: string;
  locationFrom: string;
  locationTo: string;
  status: 'Pending' | 'Completed' | 'Sent';
  shippingCharges: number;
  totalAmount: number;
  addedBy: string;
}

const initialTransfers: StockTransfer[] = [
  { id: '1', date: '2023-11-20 10:00', refNo: 'ST-2023-001', locationFrom: 'CR:1450968', locationTo: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', status: 'Completed', shippingCharges: 5.000, totalAmount: 150.000, addedBy: 'Admin' },
  { id: '2', date: '2023-11-22 14:30', refNo: 'ST-2023-002', locationFrom: 'CR:1450968', locationTo: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', status: 'Pending', shippingCharges: 0.000, totalAmount: 75.500, addedBy: 'Manager' },
];

const StockTransfer: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [transfers, setTransfers] = useState<StockTransfer[]>(initialTransfers);

  const filteredTransfers = transfers.filter(t => 
    t.refNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.locationFrom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.locationTo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ArrowRightLeft className="text-blue-600" size={32} />
            Stock Transfers
          </h2>
          <p className="text-slate-500 mt-1">Manage stock movements between locations.</p>
        </div>
        <button 
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
        >
          <Plus size={18} /> Add Stock Transfer
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
            <div className="flex items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-1 xl:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search transfers..." 
                  className="w-full pl-9 pr-4 py-2 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
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
                <th className="px-6 py-4">Location (From)</th>
                <th className="px-6 py-4">Location (To)</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Shipping Charges</th>
                <th className="px-6 py-4 text-right">Total Amount</th>
                <th className="px-6 py-4">Added By</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransfers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 text-slate-600">{t.date}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">{t.refNo}</td>
                  <td className="px-6 py-4 text-slate-600">{t.locationFrom}</td>
                  <td className="px-6 py-4 text-slate-600">{t.locationTo}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      t.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 
                      t.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">{t.shippingCharges.toFixed(3)}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">{t.totalAmount.toFixed(3)}</td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{t.addedBy}</td>
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

export default StockTransfer;
