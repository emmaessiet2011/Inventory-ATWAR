import React, { useState } from 'react';
import { X, Plus, Trash2, Save, MapPin, Calendar, Package, DollarSign, FileText, Hash } from 'lucide-react';
import { Product } from '../src/context/GlobalContext';

interface AddOpeningStockProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

interface StockEntry {
  id: string;
  quantity: number;
  unitCost: number;
  expDate: string;
  lotNumber: string;
  date: string;
  note: string;
}

const AddOpeningStock: React.FC<AddOpeningStockProps> = ({ isOpen, onClose, product }) => {
  if (!isOpen || !product) return null;

  const [entries, setEntries] = useState<StockEntry[]>([
    { id: '1', quantity: 401.000, unitCost: 0.857, expDate: '', lotNumber: '', date: '2025-01-18T12:42', note: '' },
    { id: '2', quantity: 24.000, unitCost: 0.857, expDate: '', lotNumber: '', date: '2025-07-05T20:46', note: 'Latest Stock Quantity' }
  ]);

  const handleAddRow = () => {
    setEntries([...entries, {
      id: Date.now().toString(),
      quantity: 0,
      unitCost: 0,
      expDate: '',
      lotNumber: '',
      date: new Date().toISOString().slice(0, 16),
      note: ''
    }]);
  };

  const handleRemoveRow = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
  };

  const handleChange = (id: string, field: keyof StockEntry, value: any) => {
    setEntries(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const totalAmount = entries.reduce((sum, entry) => sum + (entry.quantity * entry.unitCost), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[95rem] rounded-[2rem] shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden relative">
        
        {/* Decorative Header Background */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 z-20"></div>

        {/* Header */}
        <div className="flex justify-between items-start px-4 md:px-8 py-6 border-b border-slate-100 bg-white z-10">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                <Package size={24} />
              </div>
              Add Opening Stock
            </h3>
            <p className="text-slate-500 font-medium pl-[3.25rem]">Manage initial inventory levels for <span className="text-indigo-600 font-bold">{product.name}</span></p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all duration-200"
          >
            <X size={28} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-8 overflow-y-auto bg-slate-50/50 flex-1">
            
            {/* Location Card */}
            <div className="mb-8 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm inline-flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                    <MapPin size={20} />
                </div>
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Location</p>
                    <p className="text-sm font-bold text-slate-900">KNWZ ARD ALKHLYJ ALMTHDH CR:1282649 (BL0002)</p>
                </div>
            </div>

            <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-64">Product Details</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-48">Quantity</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-40">Unit Cost</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-40">Expiry / Lot</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-40 text-right">Subtotal</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-56">Date Entry</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]">Notes</th>
                                <th className="px-6 py-5 w-16 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {entries.map((entry, index) => (
                                <tr key={entry.id} className="group hover:bg-slate-50/80 transition-colors">
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold text-slate-800 text-sm">{product.name}</span>
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded w-fit">{product.sku}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex items-center shadow-sm rounded-xl overflow-hidden border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all bg-white">
                                            <input 
                                                type="number" 
                                                className="w-full px-4 py-2.5 outline-none text-sm font-bold text-slate-700 placeholder:text-slate-300"
                                                value={entry.quantity}
                                                onChange={(e) => handleChange(entry.id, 'quantity', parseFloat(e.target.value))}
                                                placeholder="0.00"
                                            />
                                            <div className="px-3 py-2.5 bg-slate-50 border-l border-slate-200 text-xs font-bold text-slate-500 min-w-[3rem] text-center">
                                                {product.unit}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="relative group/input">
                                            <DollarSign size={14} className="absolute left-3 top-3 text-slate-400 group-focus-within/input:text-indigo-500 transition-colors" />
                                            <input 
                                                type="number" 
                                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-bold text-slate-700 shadow-sm transition-all"
                                                value={entry.unitCost}
                                                onChange={(e) => handleChange(entry.id, 'unitCost', parseFloat(e.target.value))}
                                                placeholder="0.000"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top space-y-2">
                                        <div className="relative group/input">
                                            <Calendar size={14} className="absolute left-3 top-3 text-slate-400 group-focus-within/input:text-indigo-500 transition-colors" />
                                            <input 
                                                type="date" 
                                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs font-medium text-slate-600 shadow-sm transition-all"
                                                value={entry.expDate}
                                                onChange={(e) => handleChange(entry.id, 'expDate', e.target.value)}
                                            />
                                        </div>
                                        <div className="relative group/input">
                                            <Hash size={14} className="absolute left-3 top-2.5 text-slate-400 group-focus-within/input:text-indigo-500 transition-colors" />
                                            <input 
                                                type="text" 
                                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs font-medium text-slate-600 shadow-sm transition-all placeholder:text-slate-300"
                                                value={entry.lotNumber}
                                                onChange={(e) => handleChange(entry.id, 'lotNumber', e.target.value)}
                                                placeholder="Lot Number"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top text-right">
                                        <span className="text-sm font-black text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg">
                                            {(entry.quantity * entry.unitCost).toFixed(3)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <input 
                                            type="datetime-local" 
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs font-medium text-slate-600 transition-all"
                                            value={entry.date}
                                            onChange={(e) => handleChange(entry.id, 'date', e.target.value)}
                                        />
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="relative">
                                            <FileText size={14} className="absolute left-3 top-3 text-slate-400" />
                                            <textarea 
                                                rows={3}
                                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm text-slate-600 resize-none shadow-sm transition-all placeholder:text-slate-300"
                                                value={entry.note}
                                                onChange={(e) => handleChange(entry.id, 'note', e.target.value)}
                                                placeholder="Add optional notes here..."
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top text-center pt-6">
                                        {index === 0 ? (
                                            <button 
                                                onClick={handleAddRow} 
                                                className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                                                title="Add New Row"
                                            >
                                                <Plus size={18} />
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleRemoveRow(entry.id)} 
                                                className="p-2 bg-rose-50 text-rose-500 border border-rose-100 rounded-xl hover:bg-rose-100 hover:border-rose-200 transition-all active:scale-95"
                                                title="Remove Row"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50/50 border-t border-slate-200">
                            <tr>
                                <td colSpan={4} className="px-6 py-5 text-right font-bold text-slate-500 text-xs uppercase tracking-wider">Total Amount (Exc. Tax):</td>
                                <td className="px-6 py-5 text-right">
                                    <span className="text-xl font-black text-indigo-600">{(totalAmount).toFixed(3)}</span>
                                </td>
                                <td colSpan={3}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="px-4 md:px-8 py-6 border-t border-slate-100 bg-white flex flex-col-reverse md:flex-row justify-end gap-4 z-10">
            <button 
                onClick={onClose} 
                className="px-8 py-3 bg-white border-2 border-slate-200 text-slate-600 font-bold rounded-2xl text-sm hover:bg-slate-50 hover:border-slate-300 transition-all w-full md:w-auto"
            >
                Cancel
            </button>
            <button 
                onClick={onClose} 
                className="group relative px-10 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2 overflow-hidden w-full md:w-auto"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                <Save size={18} className="relative z-10" />
                <span className="relative z-10">Save Stock Entry</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default AddOpeningStock;
