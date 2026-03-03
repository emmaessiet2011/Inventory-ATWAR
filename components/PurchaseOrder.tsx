import React, { useState } from 'react';
import { 
  Plus, Search, FileText, FileSpreadsheet, Printer, 
  Columns, Download, Edit, Trash2, ChevronDown, 
  ArrowUpDown, ShoppingCart, Filter, Truck
} from 'lucide-react';

interface PurchaseOrder {
  id: number;
  date: string;
  referenceNo: string;
  location: string;
  supplier: string;
  status: 'Draft' | 'Sent' | 'Received' | 'Partial';
  totalAmount: number;
  addedBy: string;
}

const PurchaseOrder: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const [orders] = useState<PurchaseOrder[]>([
    {
      id: 1,
      date: '2023-11-24 14:30',
      referenceNo: 'PO2023/0001',
      location: 'CR:1450968',
      supplier: 'Global Supplies Co.',
      status: 'Sent',
      totalAmount: 1250.000,
      addedBy: 'Admin User'
    },
    {
      id: 2,
      date: '2023-11-25 10:15',
      referenceNo: 'PO2023/0002',
      location: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649',
      supplier: 'Tech Distributors',
      status: 'Draft',
      totalAmount: 450.500,
      addedBy: 'Sales Manager'
    }
  ]);

  const filteredOrders = orders.filter(o => 
    o.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Truck className="text-indigo-600" size={32} />
            Purchase Orders
          </h2>
          <p className="text-slate-500 mt-1">Manage and track your purchase orders sent to suppliers.</p>
        </div>
        <button 
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
        >
          <Plus size={18} /> Add Purchase Order
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
        
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
            <div className="flex items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-1 xl:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search orders..." 
                  className="w-full pl-9 pr-4 py-2 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
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
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Total Amount</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 text-slate-600">{o.date}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">{o.referenceNo}</td>
                  <td className="px-6 py-4 text-slate-600">{o.location}</td>
                  <td className="px-6 py-4 text-slate-600 font-medium">{o.supplier}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      o.status === 'Draft' ? 'bg-slate-100 text-slate-700' : 
                      o.status === 'Sent' ? 'bg-blue-100 text-blue-700' : 
                      o.status === 'Received' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">{o.totalAmount.toFixed(3)} OMR</td>
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

export default PurchaseOrder;
