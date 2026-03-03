import React, { useState } from 'react';
import { 
  Search, Printer, Settings, Info, X, 
  ChevronDown
} from 'lucide-react';

// Types
interface LabelProduct {
  id: string;
  name: string;
  count: number;
  lotNumber?: string;
  expDate?: string;
  packingDate?: string;
  priceGroup?: string;
}

const PrintLabels: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<LabelProduct[]>([
    { id: '1', name: 'Activated Carbon 10L', count: 1, priceGroup: 'None' } 
  ]);

  // Config State
  const [config, setConfig] = useState({
    showProductName: true, productNameSize: 15,
    showVariation: true, variationSize: 17,
    showPrice: true, priceSize: 17,
    showBusinessName: true, businessNameSize: 20,
    showPackingDate: false, packingDateSize: 12,
    showLotNumber: false, lotNumberSize: 12,
    showExpDate: false, expDateSize: 12,
    priceType: 'Inc. tax'
  });
  
  const [barcodeSetting, setBarcodeSetting] = useState('20 Labels per Sheet, Sheet Size: 8.5" x 11", Label Size: 4" x 1", Labels per sheet: 20');

  const addProduct = () => {
     if (!searchTerm) return;
     const newId = Date.now().toString();
     setSelectedProducts([...selectedProducts, { 
       id: newId, 
       name: searchTerm, 
       count: 1, 
       priceGroup: 'None' 
     }]);
     setSearchTerm('');
  };
  
  const removeProduct = (id: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== id));
  };

  const updateProduct = (id: string, field: keyof LabelProduct, value: any) => {
    setSelectedProducts(selectedProducts.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const updateConfig = (field: string, value: any) => {
      setConfig({ ...config, [field]: value });
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20 max-w-[1800px] mx-auto">
        {/* Header */}
        <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Print Labels <Info size={18} className="text-blue-500" />
            </h2>
        </div>

        {/* Section 1: Add Products */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-6 relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-emerald-500"></div>
            <h3 className="text-sm font-semibold text-slate-600 mb-4">
                Add products to generate Labels
            </h3>
            
            <div className="mb-6 relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                    type="text" 
                    placeholder="Enter products name to print labels" 
                    className="w-full pl-10 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-800 shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addProduct()}
                 />
            </div>

            <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-white border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 font-bold text-slate-700 w-1/4">Products</th>
                            <th className="px-4 py-3 font-bold text-slate-700 w-32">No. of labels</th>
                            <th className="px-4 py-3 font-bold text-slate-700 w-48">Lot Number</th>
                            <th className="px-4 py-3 font-bold text-slate-700 w-48">EXP Date</th>
                            <th className="px-4 py-3 font-bold text-slate-700 w-48">Packing Date</th>
                            <th className="px-4 py-3 font-bold text-slate-700 w-48">Selling Price Group</th>
                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {selectedProducts.map((p) => (
                            <tr key={p.id}>
                                <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                                <td className="px-4 py-2">
                                    <input 
                                        type="number" 
                                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 outline-none text-xs"
                                        value={p.count}
                                        onChange={(e) => updateProduct(p.id, 'count', parseInt(e.target.value))}
                                    />
                                </td>
                                <td className="px-4 py-2">
                                    <input type="text" className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 outline-none text-xs" />
                                </td>
                                <td className="px-4 py-2">
                                    <input type="date" className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 outline-none text-xs text-slate-500" />
                                </td>
                                <td className="px-4 py-2">
                                    <input type="date" className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 outline-none text-xs text-slate-500" />
                                </td>
                                <td className="px-4 py-2">
                                    <select className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 outline-none text-xs cursor-pointer">
                                        <option>None</option>
                                        <option>Default Selling Price</option>
                                        <option>Wholesale</option>
                                    </select>
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <button onClick={() => removeProduct(p.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                        <X size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {selectedProducts.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-slate-400 italic text-sm">No products selected</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Section 2: Info to show */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-6 relative">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
             <h3 className="text-sm font-semibold text-slate-600 mb-6">
                 Information to show in Labels
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-6">
                {/* Row 1 */}
                
                {/* Product Name */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input type="checkbox" checked={config.showProductName} onChange={(e) => updateConfig('showProductName', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-xs font-bold text-slate-800">Product Name</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-slate-500">Size</span>
                        <input 
                            type="number" 
                            value={config.productNameSize} 
                            onChange={(e) => updateConfig('productNameSize', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" 
                        />
                    </div>
                </div>

                {/* Variation */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input type="checkbox" checked={config.showVariation} onChange={(e) => updateConfig('showVariation', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-xs font-bold text-slate-800">Product Variation (recommended)</span>
                    </label>
                     <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-slate-500">Size</span>
                        <input 
                            type="number" 
                            value={config.variationSize} 
                             onChange={(e) => updateConfig('variationSize', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" 
                        />
                    </div>
                </div>

                {/* Price */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input type="checkbox" checked={config.showPrice} onChange={(e) => updateConfig('showPrice', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-xs font-bold text-slate-800">Product Price</span>
                    </label>
                     <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-slate-500">Size</span>
                        <input 
                            type="number" 
                            value={config.priceSize} 
                             onChange={(e) => updateConfig('priceSize', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" 
                        />
                    </div>
                </div>
                
                 {/* Show Price Type */}
                 <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <span className="text-xs font-bold text-slate-800">Show Price:</span>
                    </label>
                     <div className="relative">
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
                             <Info size={12} />
                        </div>
                        <select 
                            className="w-full pl-7 pr-4 py-1.5 rounded border border-slate-300 text-xs font-medium focus:border-blue-500 outline-none appearance-none cursor-pointer"
                            value={config.priceType}
                            onChange={(e) => updateConfig('priceType', e.target.value)}
                        >
                            <option value="Inc. tax">Inc. tax</option>
                            <option value="Exc. tax">Exc. tax</option>
                        </select>
                         <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                            <ChevronDown size={12} className="text-slate-400" />
                         </div>
                    </div>
                </div>

                {/* Row 2 */}

                 {/* Business Name */}
                 <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input type="checkbox" checked={config.showBusinessName} onChange={(e) => updateConfig('showBusinessName', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-xs font-bold text-slate-800">Business name</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-slate-500">Size</span>
                        <input 
                            type="number" 
                            value={config.businessNameSize} 
                             onChange={(e) => updateConfig('businessNameSize', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" 
                        />
                    </div>
                </div>

                {/* Print Packing Date */}
                 <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input type="checkbox" checked={config.showPackingDate} onChange={(e) => updateConfig('showPackingDate', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-xs font-bold text-slate-800">Print packing date</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-slate-500">Size</span>
                        <input 
                            type="number" 
                            value={config.packingDateSize} 
                             onChange={(e) => updateConfig('packingDateSize', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" 
                        />
                    </div>
                </div>

                {/* Print Lot Number */}
                 <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input type="checkbox" checked={config.showLotNumber} onChange={(e) => updateConfig('showLotNumber', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-xs font-bold text-slate-800">Print lot number</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-slate-500">Size</span>
                        <input 
                            type="number" 
                            value={config.lotNumberSize} 
                             onChange={(e) => updateConfig('lotNumberSize', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" 
                        />
                    </div>
                </div>

                {/* Print Expiry Date */}
                 <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input type="checkbox" checked={config.showExpDate} onChange={(e) => updateConfig('showExpDate', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-xs font-bold text-slate-800">Print expiry date</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-slate-500">Size</span>
                        <input 
                            type="number" 
                            value={config.expDateSize} 
                             onChange={(e) => updateConfig('expDateSize', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" 
                        />
                    </div>
                </div>

            </div>

             <div className="h-px bg-slate-100 my-8"></div>
             
             {/* Barcode Setting */}
             <div className="space-y-4">
                 <h4 className="text-xs font-bold text-slate-800">Barcode setting:</h4>
                 <div className="relative max-w-xl">
                     <Settings size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                     <select 
                        className="w-full pl-9 pr-8 py-2 rounded border border-slate-300 focus:border-blue-500 transition-all font-medium text-xs text-slate-700 appearance-none cursor-pointer outline-none"
                        value={barcodeSetting}
                        onChange={(e) => setBarcodeSetting(e.target.value)}
                    >
                         <option value="20-per-sheet">20 Labels per Sheet, Sheet Size: 8.5" x 11", Label Size: 4" x 1", Labels per sheet: 20</option>
                         <option value="30-per-sheet">30 Labels per Sheet, Sheet Size: 8.5" x 11", Label Size: 2.625" x 1", Labels per sheet: 30</option>
                         <option value="32-per-sheet">32 Labels per Sheet, Sheet Size: 8.5" x 11", Label Size: 2" x 1.25", Labels per sheet: 32</option>
                         <option value="40-per-sheet">40 Labels per Sheet, Sheet Size: 8.5" x 11", Label Size: 2" x 1", Labels per sheet: 40</option>
                         <option value="50-per-sheet">50 Labels per Sheet, Sheet Size: 8.5" x 11", Label Size: 1.5" x 1", Labels per sheet: 50</option>
                         <option value="continuous">Continuous Rolls</option>
                     </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                         <ChevronDown size={12} className="text-slate-400" />
                     </div>
                 </div>
             </div>
             
             <div className="mt-8 flex justify-center border-t border-slate-100 pt-6">
                 <button className="px-6 py-2 bg-[#6200ea] text-white font-bold rounded shadow-sm hover:bg-[#5000ca] active:scale-95 transition-all flex items-center gap-2 text-sm">
                     Preview
                 </button>
             </div>
        </div>

    </div>
  );
};

export default PrintLabels;