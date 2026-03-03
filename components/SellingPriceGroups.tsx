import React, { useState } from 'react';
import { 
  Plus, Search, Download, Printer, FileText, FileSpreadsheet, 
  Edit, Trash2, X, Tag, Settings, Percent, CalendarClock, 
  CreditCard, CheckCircle2, AlertCircle, Info, DollarSign, Users, Package
} from 'lucide-react';

// Utility for currency
const formatOMR = (amount: number) => {
  return `OMR ${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
};

interface PriceGroup {
  id: number;
  name: string;
  description: string;
  payTerm: string;
  taxRate: number;
  discount: number;
  priceCalcPercentage: number;
  linkedCustomerGroups: number; // New field for connection
  status: 'Active' | 'Inactive';
}

const SellingPriceGroups: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([
    { id: 1, name: 'Premium Dog Food 5kg', sku: 'PDF-5KG-01', price: 12.500, discount: 5 },
    { id: 2, name: 'Cat Litter 10L', sku: 'CL-10L-02', price: 4.200, discount: 3 }
  ]);

  const handleProductDiscountChange = (id: number, newDiscount: number) => {
    setSelectedProducts(prev => prev.map(p => p.id === id ? { ...p, discount: newDiscount } : p));
  };

  const removeProduct = (id: number) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== id));
  };

  // Mock Data
  const groups: PriceGroup[] = [
    { 
        id: 1, 
        name: 'Default Selling Price', 
        description: 'Standard retail price for walk-in customers', 
        payTerm: 'Immediate', 
        taxRate: 5, 
        discount: 0, 
        priceCalcPercentage: 0,
        linkedCustomerGroups: 2, // Walk-in, Defaulters
        status: 'Active'
    },
    { 
        id: 2, 
        name: 'Wholesale Tier A', 
        description: 'Bulk buyers ordering > 500 OMR / month', 
        payTerm: '30 Days', 
        taxRate: 5, 
        discount: 10, 
        priceCalcPercentage: -5, 
        linkedCustomerGroups: 1, // Gold Wholesalers
        status: 'Active'
    },
    { 
        id: 3, 
        name: 'Distributor VIP', 
        description: 'Key partners and regional distributors', 
        payTerm: '60 Days', 
        taxRate: 0, 
        discount: 15, 
        priceCalcPercentage: -12, 
        linkedCustomerGroups: 1, // Regional Distributors
        status: 'Active'
    },
    { 
        id: 4, 
        name: 'Online Sales', 
        description: 'E-commerce platform pricing', 
        payTerm: 'Prepaid', 
        taxRate: 5, 
        discount: 0, 
        priceCalcPercentage: 0, 
        linkedCustomerGroups: 1, // E-Commerce Users
        status: 'Active'
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-10">
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Selling Price Groups</h2>
          <p className="text-slate-500 mt-2 text-lg font-light">
            Manage pricing tiers, payment terms, and tax rules for different sales channels.
          </p>
        </div>
        <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
        >
            <Plus size={18} /> Add Price Group
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-500"></div>
        
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
                <div className="flex items-center gap-3 w-full xl:w-auto">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show</span>
                    <select className="border-0 bg-white shadow-sm ring-1 ring-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer">
                        <option>25</option>
                        <option>50</option>
                        <option>100</option>
                    </select>
                </div>

                <div className="relative w-full xl:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Search price groups..." 
                        className="w-full xl:w-64 pl-9 pr-4 py-2 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm placeholder:text-slate-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-4 w-1/4">Name</th>
                        <th className="px-6 py-4 text-center">Linked Groups</th>
                        <th className="px-6 py-4">Payment Term</th>
                        <th className="px-6 py-4 text-center">Tax (%)</th>
                        <th className="px-6 py-4 text-center">Discount (%)</th>
                        <th className="px-6 py-4 text-center">Price Adj. (%)</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {groups.map((group) => (
                        <tr key={group.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                                        <Tag size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-900">{group.name}</span>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">ID: {group.id}</span>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                                    <Users size={12} /> {group.linkedCustomerGroups}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-1.5 text-slate-700 font-medium bg-slate-100 px-2 py-1 rounded w-fit text-xs">
                                    <CalendarClock size={12} className="text-slate-500" />
                                    {group.payTerm}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className="font-mono text-slate-600 text-xs">{group.taxRate}%</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                {group.discount > 0 ? (
                                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-xs">
                                        {group.discount}%
                                    </span>
                                ) : <span className="text-slate-300">-</span>}
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`font-bold text-xs px-2 py-0.5 rounded ${
                                    group.priceCalcPercentage < 0 ? 'bg-green-50 text-green-700' : 
                                    group.priceCalcPercentage > 0 ? 'bg-amber-50 text-amber-700' : 'text-slate-400'
                                }`}>
                                    {group.priceCalcPercentage > 0 ? '+' : ''}{group.priceCalcPercentage}%
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                    group.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                    {group.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                        <Edit size={16} />
                                    </button>
                                    <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

       {/* Add Modal */}
       {isAddModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] shadow-2xl max-w-4xl w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
                
                {/* Modal Header */}
                <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <Tag className="text-blue-600" size={24} />
                            Add Selling Price Group
                        </h3>
                        <p className="text-slate-500 text-sm mt-1">Configure a new pricing tier and its rules.</p>
                    </div>
                    <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-8 overflow-y-auto custom-scrollbar bg-slate-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        
                        {/* Section 1: Basic Info */}
                        <div className="space-y-6">
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
                                <Info size={16} /> General Details
                            </h4>
                            
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Name <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm" 
                                    placeholder="e.g. Retail, Wholesale, VIP"
                                />
                            </div>
                            
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Description</label>
                                <textarea 
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 shadow-sm resize-none" 
                                    placeholder="Who is this price group for?"
                                />
                            </div>

                             <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Status</label>
                                <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="status" defaultChecked className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300" />
                                        <span className="text-sm font-bold text-slate-700">Active</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="status" className="w-4 h-4 text-slate-600 focus:ring-slate-500 border-slate-300" />
                                        <span className="text-sm font-medium text-slate-500">Inactive</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Financial Rules */}
                        <div className="space-y-6">
                             <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
                                <CreditCard size={16} /> Payment & Tax Rules
                            </h4>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Payment Term</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="number" 
                                        placeholder="0" 
                                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm" 
                                    />
                                    <select className="px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium shadow-sm cursor-pointer w-40">
                                        <option value="days">Days</option>
                                        <option value="months">Months</option>
                                    </select>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Default payment period for invoices.</p>
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Default VAT/Tax (%)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm" 
                                        placeholder="5"
                                        defaultValue={5}
                                    />
                                    <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Global Discount (%)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm" 
                                        placeholder="0"
                                    />
                                    <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Applied to total invoice amount.</p>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Applicable Products */}
                    <div className="mt-8 pt-6 border-t border-slate-200">
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Package size={16} /> Applicable Products
                        </h4>
                        <p className="text-xs text-slate-500 mb-6">Select the specific products this price group applies to. If left empty, it applies to all products.</p>
                        
                        <div className="group mb-4">
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Search & Add Products</label>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    type="text" 
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800 shadow-sm" 
                                    placeholder="Type product name or SKU..."
                                />
                            </div>
                        </div>
                        
                        {/* Selected Products List (Mock) */}
                        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Product Name</th>
                                        <th className="px-4 py-3 w-32">SKU</th>
                                        <th className="px-4 py-3 w-32 text-right">Current Price</th>
                                        <th className="px-4 py-3 w-32 text-center">Discount (%)</th>
                                        <th className="px-4 py-3 w-32 text-right">Final Price</th>
                                        <th className="px-4 py-3 w-20 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {selectedProducts.map(product => {
                                        const finalPrice = product.price * (1 - product.discount / 100);
                                        return (
                                            <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 text-slate-800 font-medium">{product.name}</td>
                                                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{product.sku}</td>
                                                <td className="px-4 py-3 text-right text-slate-600">{formatOMR(product.price)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="relative">
                                                        <input 
                                                            type="number" 
                                                            className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-xs font-bold text-slate-800 text-center" 
                                                            placeholder="0"
                                                            value={product.discount}
                                                            onChange={(e) => handleProductDiscountChange(product.id, parseFloat(e.target.value) || 0)}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatOMR(finalPrice)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <button 
                                                        onClick={() => removeProduct(product.id)}
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {selectedProducts.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">
                                                No products selected. This price group will apply to all products.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

                {/* Modal Footer */}
                <div className="px-8 py-6 border-t border-slate-100 flex justify-end gap-3 bg-white z-10">
                    <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all text-sm shadow-sm">
                        Cancel
                    </button>
                    <button className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 text-sm flex items-center gap-2">
                        <CheckCircle2 size={16} /> Save Selling Price Group
                    </button>
                </div>
            </div>
        </div>
       )}
    </div>
  );
};

export default SellingPriceGroups;