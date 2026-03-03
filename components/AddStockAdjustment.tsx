import React, { useState } from 'react';
import { useGlobalContext } from '../src/context/GlobalContext';
import { 
  Save, X, Plus, Search, Trash2, 
  Sliders, Calendar, MapPin, Info, AlertCircle
} from 'lucide-react';

const AddStockAdjustment: React.FC = () => {
  const { locations } = useGlobalContext();
  const [formData, setFormData] = useState({
    location: '',
    referenceNo: '',
    date: new Date().toISOString().split('T')[0],
    adjustmentType: 'Normal',
    reason: '',
  });

  const [items, setItems] = useState<any[]>([]);

  const handleSave = () => {
    alert("Stock adjustment saved successfully!");
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Plus className="text-red-600" size={32} />
            Add Stock Adjustment
          </h2>
          <p className="text-slate-500 mt-1">Create a new stock adjustment record.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="bg-red-600 text-white px-8 py-2.5 rounded-xl text-sm font-bold hover:bg-red-700 transition shadow-lg shadow-red-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
          >
            <Save size={18} /> Save Adjustment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Form */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Business Location *</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <select 
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-red-500 transition-all text-sm font-bold text-slate-800 appearance-none cursor-pointer"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                  >
                    <option value="">Select Location</option>
                    {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    <option value="2">Zan Supermarket</option>
                  </select>
                </div>
              </div>

              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Reference No</label>
                <input 
                  type="text" 
                  placeholder="Keep blank to auto-generate"
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-red-500 transition-all text-sm font-bold text-slate-800"
                  value={formData.referenceNo}
                  onChange={(e) => setFormData({...formData, referenceNo: e.target.value})}
                />
              </div>

              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Date *</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="date" 
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-red-500 transition-all text-sm font-bold text-slate-800"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                  />
                </div>
              </div>

              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Adjustment Type *</label>
                <select 
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-red-500 transition-all text-sm font-bold text-slate-800 appearance-none cursor-pointer"
                  value={formData.adjustmentType}
                  onChange={(e) => setFormData({...formData, adjustmentType: e.target.value})}
                >
                  <option value="Normal">Normal</option>
                  <option value="Abnormal">Abnormal</option>
                </select>
              </div>
            </div>
          </div>

          {/* Product Search & Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" size={20} />
                <input 
                  type="text" 
                  placeholder="Search products to adjust..." 
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border-2 border-slate-200 focus:outline-none focus:border-red-500 transition-all font-bold text-sm"
                />
              </div>
            </div>
            
            <div className="p-0">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Current Stock</th>
                    <th className="px-6 py-4">Quantity</th>
                    <th className="px-6 py-4">Unit Price</th>
                    <th className="px-6 py-4">Subtotal</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                      Please search and select products to adjust stock.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Info size={20} className="text-blue-500" />
              Adjustment Details
            </h3>
            <div className="space-y-4">
              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Reason for adjustment</label>
                <textarea 
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-red-500 transition-all text-sm font-medium text-slate-700 min-h-[120px]"
                  placeholder="Enter reason..."
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                />
              </div>
              
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">Total Items</span>
                  <span className="text-sm font-black text-slate-900">0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">Total Amount</span>
                  <span className="text-lg font-black text-red-600">0.000 OMR</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 flex gap-4">
            <AlertCircle className="text-amber-600 shrink-0" size={24} />
            <div>
              <h4 className="text-sm font-bold text-amber-900 mb-1">Important Note</h4>
              <p className="text-xs text-amber-700 leading-relaxed">
                Stock adjustments directly impact your inventory levels. Normal adjustments are for standard discrepancies, while Abnormal are for theft, fire, or major damage.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddStockAdjustment;
