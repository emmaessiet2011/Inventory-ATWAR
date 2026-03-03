import React, { useState } from 'react';
import { Calendar, Search, Trash2, Info, ChevronDown } from 'lucide-react';
import { useGlobalContext } from '../src/context/GlobalContext';

const AddStockTransfer: React.FC = () => {
  const { locations } = useGlobalContext();
  const [date, setDate] = useState('2026-02-11T10:42'); // Default based on screenshot
  const [refNo, setRefNo] = useState('');
  const [status, setStatus] = useState('Please Select');
  const [locationFrom, setLocationFrom] = useState('Please Select');
  const [locationTo, setLocationTo] = useState('Please Select');
  const [shippingCharges, setShippingCharges] = useState('0');
  const [notes, setNotes] = useState('');
  
  // Product Search State
  const [productSearch, setProductSearch] = useState('');
  
  // Product List State
  const [products, setProducts] = useState<any[]>([]);

  const handleAddProduct = () => {
      // Mock adding product
      if (productSearch.trim()) {
          setProducts([...products, { id: Date.now(), name: productSearch, qty: 1 }]);
          setProductSearch('');
      }
  };

  const handleRemoveProduct = (id: number) => {
      setProducts(products.filter(p => p.id !== id));
  };

  const handleUpdateQty = (id: number, qty: number) => {
      setProducts(products.map(p => p.id === id ? { ...p, qty } : p));
  };

  return (
    <div className="space-y-6 animate-fade-in pb-32">
        <h2 className="text-2xl font-bold text-slate-900">Add Stock Transfer</h2>

        <div className="bg-white rounded shadow-sm border border-slate-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Date:*</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="datetime-local" 
                            className="w-full pl-9 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Reference No:</label>
                    <input 
                        type="text" 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                        value={refNo}
                        onChange={(e) => setRefNo(e.target.value)}
                    />
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">Status:* <Info size={12} className="text-blue-500" /></label>
                    <div className="relative">
                        <select 
                            className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white appearance-none cursor-pointer"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            <option>Please Select</option>
                            <option>Pending</option>
                            <option>In Transit</option>
                            <option>Completed</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Location (From):*</label>
                    <div className="relative">
                        <select 
                            className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white appearance-none cursor-pointer"
                            value={locationFrom}
                            onChange={(e) => setLocationFrom(e.target.value)}
                        >
                            <option>Please Select</option>
                            {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Location (To):*</label>
                    <div className="relative">
                        <select 
                            className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white appearance-none cursor-pointer"
                            value={locationTo}
                            onChange={(e) => setLocationTo(e.target.value)}
                        >
                            <option>Please Select</option>
                            <option>CR:1450968</option>
                            <option>Showroom B</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                </div>
            </div>
        </div>

        <div className="bg-white rounded shadow-sm border border-slate-200 p-6">
            <div className="flex justify-center mb-6">
                 <div className="relative w-full">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={16} className="text-slate-400" />
                    </div>
                    <input 
                        type="text" 
                        className="block w-full pl-10 pr-4 py-3 rounded bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm" 
                        placeholder="Search products for stock adjustment"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()}
                    />
                </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded mb-6">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-slate-700 text-xs font-bold border-b border-slate-200">
                            <th className="p-3 text-left w-3/4">Product</th>
                            <th className="p-3 text-center w-1/4">Quantity</th>
                            <th className="p-3 text-center w-16"><Trash2 size={14} /></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {products.length > 0 ? (
                            products.map((p) => (
                                <tr key={p.id}>
                                    <td className="p-3 font-medium text-slate-800">{p.name}</td>
                                    <td className="p-3">
                                        <input 
                                            type="number" 
                                            className="w-full px-2 py-1 border border-slate-300 rounded text-center text-sm"
                                            value={p.qty}
                                            onChange={(e) => handleUpdateQty(p.id, parseInt(e.target.value))}
                                        />
                                    </td>
                                    <td className="p-3 text-center">
                                        <button onClick={() => handleRemoveProduct(p.id)} className="text-red-500 hover:text-red-700">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={3} className="p-8 text-center text-slate-400 italic bg-white">
                                    {/* Empty space as per screenshot if no products added yet */}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Shipping Charges:</label>
                    <input 
                        type="number" 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                        value={shippingCharges}
                        onChange={(e) => setShippingCharges(e.target.value)}
                    />
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Additional Notes</label>
                    <textarea 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm resize-none"
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    ></textarea>
                </div>
            </div>

            <div className="flex justify-center">
                <button className="bg-[#6200ea] hover:bg-[#5000ca] text-white font-bold py-2 px-8 rounded shadow-md transition-colors text-sm">
                    Save
                </button>
            </div>
        </div>
    </div>
  );
};

export default AddStockTransfer;