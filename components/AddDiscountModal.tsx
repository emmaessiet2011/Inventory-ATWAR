import React, { useState } from 'react';
import { X, Info, Check, Save } from 'lucide-react';
import { useGlobalContext } from '../src/context/GlobalContext';

interface AddDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: any) => void;
}

const AddDiscountModal: React.FC<AddDiscountModalProps> = ({
  isOpen, onClose, onSave }) => {
  const { locations } = useGlobalContext();

  const [formData, setFormData] = useState({
    name: '',
    products: '',
    brand: '',
    category: '',
    location: '',
    priority: '',
    discountType: '',
    discountAmount: '',
    startsAt: '',
    endsAt: '',
    sellingPriceGroup: '',
    isActive: true,
    applyInCustomerGroups: false
  });

  if (!isOpen) return null;

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (onSave) {
        onSave(formData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-sm shadow-2xl border border-slate-200 relative mt-10 mb-10 animate-in slide-in-from-top-4 duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <h3 className="text-xl font-normal text-slate-800">Add Discount</h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
            
            <div className="group">
                <label className="block text-sm font-bold text-slate-800 mb-2">Name:*</label>
                <input 
                    type="text" 
                    placeholder="Name"
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                />
            </div>

            <div className="group">
                <label className="block text-sm font-bold text-slate-800 mb-2">Products:</label>
                <input 
                    type="text" 
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                    value={formData.products}
                    onChange={(e) => handleChange('products', e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group">
                    <label className="block text-sm font-bold text-slate-800 mb-2">Brand:</label>
                    <select 
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={formData.brand}
                        onChange={(e) => handleChange('brand', e.target.value)}
                    >
                        <option value="">Please Select</option>
                        <option value="Kennol">Kennol</option>
                        <option value="Cebican">Cebican</option>
                    </select>
                </div>
                <div className="group">
                    <label className="block text-sm font-bold text-slate-800 mb-2">Category:</label>
                    <select 
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={formData.category}
                        onChange={(e) => handleChange('category', e.target.value)}
                    >
                        <option value="">Please Select</option>
                        <option value="Engine Oil">Engine Oil</option>
                        <option value="Pet Food">Pet Food</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group">
                    <label className="block text-sm font-bold text-slate-800 mb-2">Location:*</label>
                    <select 
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={formData.location}
                        onChange={(e) => handleChange('location', e.target.value)}
                    >
                        <option value="">Please Select</option>
                        {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                    </select>
                </div>
                <div className="group">
                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-1">
                        Priority: <Info size={14} className="text-blue-500" />
                    </label>
                    <input 
                        type="text" 
                        placeholder="Priority"
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                        value={formData.priority}
                        onChange={(e) => handleChange('priority', e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group">
                    <label className="block text-sm font-bold text-slate-800 mb-2">Discount Type:*</label>
                    <select 
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={formData.discountType}
                        onChange={(e) => handleChange('discountType', e.target.value)}
                    >
                        <option value="">Please Select</option>
                        <option value="Fixed">Fixed</option>
                        <option value="Percentage">Percentage</option>
                    </select>
                </div>
                <div className="group">
                    <label className="block text-sm font-bold text-slate-800 mb-2">Discount Amount:*</label>
                    <input 
                        type="number" 
                        placeholder="Discount Amount"
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                        value={formData.discountAmount}
                        onChange={(e) => handleChange('discountAmount', e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group">
                    <label className="block text-sm font-bold text-slate-800 mb-2">Starts At:</label>
                    <input 
                        type="datetime-local" 
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm bg-slate-100 text-slate-500"
                        placeholder="Starts At"
                        value={formData.startsAt}
                        onChange={(e) => handleChange('startsAt', e.target.value)}
                    />
                </div>
                <div className="group">
                    <label className="block text-sm font-bold text-slate-800 mb-2">Ends At:</label>
                    <input 
                        type="datetime-local" 
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm bg-slate-100 text-slate-500"
                        placeholder="Ends At"
                        value={formData.endsAt}
                        onChange={(e) => handleChange('endsAt', e.target.value)}
                    />
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div className="group">
                    <label className="block text-sm font-bold text-slate-800 mb-2">Selling Price Group:</label>
                    <select 
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={formData.sellingPriceGroup}
                        onChange={(e) => handleChange('sellingPriceGroup', e.target.value)}
                    >
                        <option value="">All</option>
                        <option value="Default Selling Price">Default Selling Price</option>
                        <option value="Wholesale">Wholesale</option>
                    </select>
                </div>
                
                <div className="flex items-center gap-2 mb-2">
                     <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                            type="checkbox" 
                            className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            checked={formData.isActive}
                            onChange={(e) => handleChange('isActive', e.target.checked)}
                        />
                        <span className="text-sm font-bold text-slate-800">Is active</span>
                    </label>
                </div>
            </div>

            <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                        type="checkbox" 
                        className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        checked={formData.applyInCustomerGroups}
                        onChange={(e) => handleChange('applyInCustomerGroups', e.target.checked)}
                    />
                    <span className="text-sm font-bold text-slate-800">Apply in customer groups</span>
                </label>
                {formData.applyInCustomerGroups && (
                    <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-600">
                        <p>Select customer groups (Mock list):</p>
                        <div className="mt-2 space-y-1">
                            <label className="flex items-center gap-2"><input type="checkbox"/> Retail</label>
                            <label className="flex items-center gap-2"><input type="checkbox"/> Wholesale</label>
                        </div>
                    </div>
                )}
            </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
            <button 
                onClick={handleSave}
                className="px-6 py-2 bg-[#6200ea] text-white font-bold text-sm rounded hover:bg-[#5000ca] transition-colors shadow-sm"
            >
                Save
            </button>
            <button 
                onClick={onClose}
                className="px-6 py-2 bg-slate-700 text-white font-bold text-sm rounded hover:bg-slate-800 transition-colors shadow-sm"
            >
                Close
            </button>
        </div>

      </div>
    </div>
  );
};

export default AddDiscountModal;