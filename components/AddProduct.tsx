
import React, { useState, useEffect } from 'react';
import { 
  Save, Plus, Image as ImageIcon, Upload, 
  Info, X, ChevronDown, Barcode, DollarSign,
  Layers, MapPin, FileText, Box, Tag, AlertCircle,
  CheckCircle2, Calculator, Percent, Clock,
  Type, Bold, Italic, Underline, List, ListOrdered,
  Search, Trash2, Split, PackageCheck, AlertTriangle,
  ArrowLeft
} from 'lucide-react';
import { useGlobalContext, Product } from '../src/context/GlobalContext';
import { useNotifications } from '../src/context/NotificationContext';

interface AddProductProps {
    isEdit?: boolean;
    productId?: string;
    onNavigate?: (page: string) => void;
}

const AddProduct: React.FC<AddProductProps> = ({ isEdit, productId, onNavigate }) => {
  const { products, addProduct, updateProduct, locations } = useGlobalContext();
  const { addNotification } = useNotifications();
  const [productType, setProductType] = useState<'Single' | 'Variable' | 'Combo'>('Single');
  const [manageStock, setManageStock] = useState(false);
  
  // Single Product State
  const [productName, setProductName] = useState('');
  const [sku, setSku] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number | ''>('');
  const [margin, setMargin] = useState<number>(25);
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');
  const [businessLocation, setBusinessLocation] = useState<string>('');

  // Handle Edit Pre-fill
  useEffect(() => {
    if (isEdit && productId) {
        const productToEdit = products.find(p => p.id === productId);
        if (productToEdit) {
            setProductName(productToEdit.name);
            setSku(productToEdit.sku);
            setProductType(productToEdit.type);
            setSellingPrice(productToEdit.sellingPrice);
            setBusinessLocation(productToEdit.businessLocation || '');
            setManageStock(true);
            setPurchasePrice(productToEdit.sellingPrice / 1.25); // Mock purchase price
        }
    }
  }, [isEdit, productId, products]);

  // Variable Product State
  const [variationSkuFormat, setVariationSkuFormat] = useState<'number' | 'variation'>('number');
  const [variations, setVariations] = useState<any[]>([
      { id: 1, value: 'Red - Large', sku: 'SKU-1001-RL', purchasePrice: 10.000, margin: 25, sellingPrice: 12.500, image: null },
      { id: 2, value: 'Blue - Small', sku: 'SKU-1001-BS', purchasePrice: 10.000, margin: 25, sellingPrice: 12.500, image: null }
  ]);
  const [newVariationName, setNewVariationName] = useState('');

  // Combo Product State
  const [comboItems, setComboItems] = useState<{id: number, name: string, qty: number, price: number}[]>([
      { id: 1, name: 'Kennol 5W-30 (1L)', qty: 4, price: 3.500 },
      { id: 2, name: 'Oil Filter Type A', qty: 1, price: 1.200 }
  ]);

  // Calculations
  const calculateSellingPrice = (cost: number, marginPercent: number) => {
      return cost + (cost * (marginPercent / 100));
  };

  const handlePurchasePriceChange = (val: string) => {
      const price = parseFloat(val);
      setPurchasePrice(val === '' ? '' : price);
      if (!isNaN(price)) {
          setSellingPrice(calculateSellingPrice(price, margin));
      }
  };

  const handleMarginChange = (val: string) => {
      const newMargin = parseFloat(val);
      setMargin(isNaN(newMargin) ? 0 : newMargin);
      if (typeof purchasePrice === 'number') {
          setSellingPrice(calculateSellingPrice(purchasePrice, isNaN(newMargin) ? 0 : newMargin));
      }
  };

  const handleBack = () => {
      if(onNavigate) onNavigate('products');
  };

  const handleSave = () => {
      if (!productName) {
          addNotification({ title: 'Error', message: 'Product name is required.', type: 'error' });
          return;
      }

      const newProduct: Product = {
          id: isEdit && productId ? productId : `PROD-${Date.now()}`,
          name: productName,
          sku: sku || `SKU-${Date.now().toString().slice(-6)}`,
          type: productType,
          category: 'Uncategorized', // From form in a real app
          brand: '--',
          tax: '--',
          businessLocation: businessLocation || (locations.length > 0 ? locations[0].name : 'CR:1450968'),
          unitPurchasePrice: typeof purchasePrice === 'number' ? purchasePrice : 0,
          sellingPrice: Number(sellingPrice) || 0,
          stock: manageStock ? 0 : 999, // Default stock
          unit: 'Pieces',
          image: 'https://images.unsplash.com/photo-1584305574647-0cc949a2bb9f?w=200&h=200&fit=crop&q=80'
      };

      if (isEdit && productId) {
          updateProduct(newProduct);
          addNotification({ title: 'Success', message: 'Product updated successfully!', type: 'success' });
      } else {
          addProduct(newProduct);
          addNotification({ title: 'Success', message: 'Product saved successfully!', type: 'success' });
      }
      
      if(onNavigate) onNavigate('products');
  };

  return (
    <div className="space-y-8 pb-32 animate-fade-in max-w-[1800px] mx-auto">
       
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
                <button 
                    onClick={handleBack}
                    className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Box className="text-blue-600" size={32} />
                        {isEdit ? `Edit Product: ${productName}` : 'Add New Product'}
                    </h2>
                    <p className="text-slate-500 mt-1 text-lg">
                        {isEdit ? 'Update product specifications and pricing.' : 'Create a new item in your inventory catalog.'}
                    </p>
                </div>
            </div>
       </div>

       <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            
            {/* LEFT COLUMN - MAIN INFO */}
            <div className="xl:col-span-2 space-y-8">
                
                {/* 1. Basic Information Card */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
                        <Info size={20} className="text-blue-500" /> Basic Information
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2 group">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Product Name <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                placeholder="Product Name" 
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-800" 
                                value={productName}
                                onChange={(e) => setProductName(e.target.value)}
                            />
                        </div>

                        <div className="group">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">SKU <Info size={12} className="text-blue-500" /></label>
                            <div className="relative">
                                <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="SKU" 
                                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono text-sm text-slate-700" 
                                    value={sku}
                                    onChange={(e) => setSku(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="group">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Barcode Type <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer">
                                    <option>Code 128 (C128)</option>
                                    <option>Code 39 (C39)</option>
                                    <option>EAN-13</option>
                                    <option>UPC-A</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <div className="group">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Unit <span className="text-red-500">*</span></label>
                             <div className="flex gap-2">
                                <div className="relative w-full">
                                    <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer">
                                        <option>Please Select</option>
                                        <option value="Pieces">Pieces (Pc)</option>
                                        <option value="Box">Box</option>
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                </div>
                                <button className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md"><Plus size={20} /></button>
                             </div>
                        </div>

                        <div className="group">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Brand</label>
                             <div className="flex gap-2">
                                <div className="relative w-full">
                                    <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer">
                                        <option>Please Select</option>
                                        <option>Brand A</option>
                                        <option>Brand B</option>
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                </div>
                                <button className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md"><Plus size={20} /></button>
                             </div>
                        </div>

                        <div className="md:col-span-2 group">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">Business Locations <Info size={12} className="text-blue-500" /></label>
                            <div className="relative">
                                <select 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium appearance-none cursor-pointer"
                                    value={businessLocation}
                                    onChange={(e) => setBusinessLocation(e.target.value)}
                                >
                                    <option value="">Select Location</option>
                                    {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Stock & Inventory Card */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500"></div>
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Layers size={20} className="text-emerald-500" /> Inventory & Logistics
                        </h3>
                        <div className="flex items-center gap-3">
                             <input 
                                type="checkbox" 
                                id="manageStock" 
                                checked={manageStock} 
                                onChange={() => setManageStock(!manageStock)}
                                className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" 
                             />
                             <label htmlFor="manageStock" className="text-sm font-bold text-slate-700 cursor-pointer flex items-center gap-1">
                                Manage Stock? <Info size={14} className="text-emerald-500" />
                             </label>
                        </div>
                     </div>
                     <p className="text-xs text-slate-400 italic mb-6 -mt-4">Enable stock management at product level</p>

                     <div className="space-y-6">
                        {manageStock && (
                            <div className="group animate-in fade-in slide-in-from-top-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">Alert Quantity <Info size={12} className="text-emerald-500" /></label>
                                <div className="relative">
                                    <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
                                    <input type="number" placeholder="Alert quantity" className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-bold text-slate-700" />
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-slate-100">
                             <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <MapPin size={14} className="text-emerald-500" /> Rack / Row / Position Details
                             </h4>
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                 {locations.map(loc => (
                                     <div key={loc.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                         <h5 className="text-[10px] font-bold text-slate-700 mb-2 uppercase">{loc.name} ({loc.id}):</h5>
                                         <div className="grid grid-cols-2 gap-2">
                                             <input type="text" placeholder="Rack" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500/20" />
                                             <input type="text" placeholder="Row" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500/20" />
                                         </div>
                                     </div>
                                 ))}
                             </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Weight</label>
                                <input type="text" placeholder="Weight" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium" />
                            </div>
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Service Staff Timer (Minutes)</label>
                                <div className="relative">
                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input type="number" placeholder="Service staff timer" className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium" />
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-6 pt-4">
                             <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 hover:border-blue-300 transition-all">
                                 <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                 <span className="text-xs font-bold text-slate-700 flex items-center gap-1">Enable Product description, IMEI or Serial Number <Info size={12} className="text-blue-500" /></span>
                             </label>
                             <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 hover:border-blue-300 transition-all">
                                 <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                 <span className="text-xs font-bold text-slate-700 flex items-center gap-1">Not for selling <Info size={12} className="text-blue-500" /></span>
                             </label>
                        </div>
                     </div>
                </div>

                {/* 3. Description */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
                     <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <FileText size={20} className="text-slate-500" /> Product Description
                    </h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                        <div className="bg-slate-50 border-b border-slate-200 p-2 flex items-center gap-2 flex-wrap">
                            <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><Bold size={14} /></button>
                            <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><Italic size={14} /></button>
                            <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><Underline size={14} /></button>
                            <div className="w-px h-4 bg-slate-300 mx-1"></div>
                            <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><List size={14} /></button>
                            <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><ListOrdered size={14} /></button>
                        </div>
                        <textarea 
                            rows={6} 
                            className="w-full p-4 text-sm text-slate-700 focus:outline-none resize-y"
                            placeholder="Enter detailed product description here..."
                        ></textarea>
                        <div className="bg-slate-50 border-t border-slate-200 p-2 text-[10px] text-right text-slate-400 font-bold uppercase">
                            0 Words Powered by Tiny
                        </div>
                    </div>

                    <div className="group">
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Product Brochure</label>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl border-dashed">
                            <FileText size={20} className="text-slate-400" />
                            <div className="flex-1">
                                <p className="text-xs font-bold text-slate-600">No file chosen</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">Max size: 5MB. Formats: .pdf, .docx, .jpg</p>
                            </div>
                            <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors">Choose File</button>
                        </div>
                     </div>
                </div>

                {/* 4. Pricing & Type - Smart Calculator */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
                     <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <DollarSign size={20} className="text-amber-500" /> Pricing & Variations
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                         <div className="group">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Applicable Tax</label>
                            <div className="relative">
                                <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer">
                                    <option>None</option>
                                    <option>VAT</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                            </div>
                        </div>
                         <div className="group">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Selling Price Tax Type <span className="text-red-500">*</span></label>
                             <div className="relative">
                                <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer">
                                    <option>Exclusive</option>
                                    <option>Inclusive</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                            </div>
                        </div>
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">Product Type <Info size={12} className="text-amber-500" /> <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <select 
                                    value={productType}
                                    onChange={(e) => setProductType(e.target.value as any)}
                                    className="w-full px-4 py-3 rounded-xl bg-amber-50 border-amber-100 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-sm font-bold text-amber-900 appearance-none cursor-pointer"
                                >
                                    <option value="Single">Single</option>
                                    <option value="Variable">Variable</option>
                                    <option value="Combo">Combo</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" size={16} />
                            </div>
                        </div>
                    </div>

                    {/* --- DYNAMIC TABLES SECTION --- */}
                    
                    {/* 1. SINGLE PRODUCT PRICING */}
                    {productType === 'Single' && (
                        <div className="animate-in fade-in rounded-xl overflow-hidden border border-slate-200">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-[#5cb85c] text-white text-xs">
                                        <th className="p-3 text-left w-1/4 border-r border-[#4cae4c]">Default Purchase Price</th>
                                        <th className="p-3 text-left w-1/4 border-r border-[#4cae4c]">x Margin(%) <Info size={12} className="inline" /></th>
                                        <th className="p-3 text-left w-1/4 border-r border-[#4cae4c]">Default Selling Price</th>
                                        <th className="p-3 text-left w-1/4">Product Image</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    <tr>
                                        <td className="p-4 border-r border-slate-100 align-top">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Exc. tax*</label>
                                                    <input 
                                                        type="number" 
                                                        placeholder="Exc. tax" 
                                                        value={purchasePrice}
                                                        onChange={(e) => handlePurchasePriceChange(e.target.value)}
                                                        className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#5cb85c]/20" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Inc. tax*</label>
                                                    <input type="number" placeholder="Inc. tax" className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#5cb85c]/20" />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 border-r border-slate-100 align-top pt-9">
                                            <input 
                                                type="number" 
                                                value={margin}
                                                onChange={(e) => handleMarginChange(e.target.value)}
                                                className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#5cb85c]/20" 
                                            />
                                        </td>
                                        <td className="p-4 border-r border-slate-100 align-top">
                                             <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Exc. tax</label>
                                                    <input type="number" value={sellingPrice} readOnly placeholder="Exc. tax" className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 font-bold text-slate-700" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Inc. tax</label>
                                                    <input type="number" placeholder="Inc. tax" className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#5cb85c]/20" />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 align-top">
                                            <div className="space-y-2">
                                                 <label className="text-[10px] font-bold text-slate-500 block uppercase">Product Image</label>
                                                 <div className="flex items-center gap-2">
                                                     <button className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 font-bold text-xs hover:bg-white transition-colors">Choose File</button>
                                                     <span className="text-[10px] text-slate-400">No file chosen</span>
                                                 </div>
                                                 <p className="text-[9px] text-slate-400">
                                                    Max File size: 5MB<br/>
                                                    Aspect ratio should be 1:1
                                                 </p>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* 2. VARIABLE PRODUCT */}
                    {productType === 'Variable' && (
                        <div className="mt-6 space-y-6 animate-in fade-in">
                            
                            {/* Variation Options */}
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                <div className="group mb-4">
                                     <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center gap-1 uppercase">Variation SKU Format <Info size={12} className="text-blue-500" /></label>
                                     <div className="flex items-center gap-6">
                                         <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                                             <input type="radio" checked={variationSkuFormat === 'number'} onChange={() => setVariationSkuFormat('number')} className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300" />
                                             SKU-Number (Example -&gt; ABC-1, ABC-2)
                                         </label>
                                         <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                                             <input type="radio" checked={variationSkuFormat === 'variation'} onChange={() => setVariationSkuFormat('variation')} className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300" />
                                             SKU-Variation (Example -&gt; ABCS, ABCM)
                                         </label>
                                     </div>
                                </div>

                                <div className="group">
                                     <div className="flex items-end gap-2">
                                        <div className="flex-1 max-w-md">
                                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Add Variation <span className="text-red-500">*</span></label>
                                            <input 
                                                type="text" 
                                                placeholder="Variation Name"
                                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                                                value={newVariationName}
                                                onChange={(e) => setNewVariationName(e.target.value)}
                                            />
                                        </div>
                                        <button className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 mb-0.5 shadow-md">
                                            <Plus size={20} />
                                        </button>
                                     </div>
                                </div>
                            </div>

                            {/* Green Variation Table */}
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-[#5cb85c] text-white text-xs">
                                            <th className="p-3 border-r border-[#4cae4c] w-10"></th>
                                            <th className="p-3 border-r border-[#4cae4c] text-left">Variation</th>
                                            <th className="p-3 border-r border-[#4cae4c] text-left">Variation Values</th>
                                            <th className="p-3 border-r border-[#4cae4c] text-left w-48">Default Purchase Price <br/><span className="font-normal text-[10px] opacity-80">Exc. tax | Inc. tax</span></th>
                                            <th className="p-3 border-r border-[#4cae4c] text-left w-24">x Margin(%)</th>
                                            <th className="p-3 border-r border-[#4cae4c] text-left w-48">Default Selling Price <br/><span className="font-normal text-[10px] opacity-80">Exc. tax | Inc. tax</span></th>
                                            <th className="p-3 border-r border-[#4cae4c] text-left">Variation Images</th>
                                            <th className="p-3 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        <tr>
                                            <td className="p-3 border-r border-slate-100 text-center border-b border-slate-100"><Trash2 size={16} className="text-red-400 hover:text-red-600 cursor-pointer mx-auto" /></td>
                                            <td className="p-3 border-r border-slate-100 border-b border-slate-100">
                                                <div className="relative">
                                                    <input type="text" placeholder="SKU" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                                                    <Info size={12} className="text-blue-500 absolute right-2 top-1/2 -translate-y-1/2" />
                                                </div>
                                            </td>
                                            <td className="p-3 border-r border-slate-100 border-b border-slate-100">
                                                <input type="text" placeholder="Value" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                                            </td>
                                            <td className="p-3 border-r border-slate-100 border-b border-slate-100">
                                                <div className="grid grid-cols-2 gap-1">
                                                    <input type="text" className="w-full px-1 py-1.5 border border-slate-200 rounded-lg text-xs" placeholder="Exc" />
                                                    <input type="text" className="w-full px-1 py-1.5 border border-slate-200 rounded-lg text-xs" placeholder="Inc" />
                                                </div>
                                            </td>
                                            <td className="p-3 border-r border-slate-100 border-b border-slate-100">
                                                <input type="text" defaultValue="25" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                                            </td>
                                            <td className="p-3 border-r border-slate-100 border-b border-slate-100">
                                                 <div className="grid grid-cols-2 gap-1">
                                                    <input type="text" className="w-full px-1 py-1.5 border border-slate-200 rounded-lg text-xs" placeholder="Exc" />
                                                    <input type="text" className="w-full px-1 py-1.5 border border-slate-200 rounded-lg text-xs" placeholder="Inc" />
                                                </div>
                                            </td>
                                            <td className="p-3 border-r border-slate-100 border-b border-slate-100">
                                                <div className="flex items-center gap-1">
                                                    <button className="px-2 py-1 border border-slate-200 rounded bg-slate-50 text-slate-600 text-[10px] font-bold">Files</button>
                                                    <span className="text-[10px] text-slate-400">None</span>
                                                </div>
                                            </td>
                                            <td className="p-3 border-b border-slate-100 text-center">
                                                <div className="w-6 h-6 bg-teal-500 hover:bg-teal-600 rounded-full flex items-center justify-center text-white cursor-pointer mx-auto shadow-sm"><Plus size={14} /></div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                        </div>
                    )}

                    {/* 3. COMBO PRODUCT */}
                    {productType === 'Combo' && (
                         <div className="mt-6 space-y-6 animate-in fade-in">
                             
                             <div className="flex justify-center">
                                 <div className="relative w-full">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search size={16} className="text-slate-400" />
                                    </div>
                                    <input 
                                        type="text" 
                                        className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm" 
                                        placeholder="Enter Product name / SKU / Scan bar code" 
                                    />
                                </div>
                             </div>

                             <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-[#5cb85c] text-white text-xs font-bold text-center">
                                            <th className="p-3 border-r border-[#4cae4c] text-left w-1/3">Product Name</th>
                                            <th className="p-3 border-r border-[#4cae4c] w-32">Quantity</th>
                                            <th className="p-3 border-r border-[#4cae4c] w-48">Purchase Price (Excluding Tax)</th>
                                            <th className="p-3 border-r border-[#4cae4c] w-48">Total Amount (Exc. Tax)</th>
                                            <th className="p-3 w-12"><Trash2 size={14} /></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {/* Example filled row for demo */}
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                                                <div className="flex flex-col items-center gap-2">
                                                    <PackageCheck size={32} className="opacity-20" />
                                                    <span>Search and add products to create a combo</span>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t border-slate-200">
                                        <tr>
                                            <td colSpan={3} className="p-3 text-right font-bold text-slate-700 uppercase text-xs">Net Total Amount :</td>
                                            <td className="p-3 text-center font-bold text-slate-800">OMR 0.000</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                                <div className="group">
                                     <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">x Margin(%)</label>
                                     <input type="text" defaultValue="25.000" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                                <div className="group">
                                     <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Default Selling Price:</label>
                                     <input type="text" defaultValue="0.000" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                             </div>

                         </div>
                    )}
                </div>

            </div>

            {/* RIGHT COLUMN - SIDEBAR */}
            <div className="space-y-8">
                
                {/* 1. Image Upload */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 flex flex-col items-center text-center">
                    <h3 className="text-sm font-bold text-slate-900 w-full text-left mb-4 uppercase tracking-wider">Product Image</h3>
                    <div className="w-full aspect-square bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-blue-400 transition-all group">
                        <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <ImageIcon className="text-slate-400 group-hover:text-blue-500" size={24} />
                        </div>
                        <p className="text-xs font-bold text-slate-600">Drag image here</p>
                        <p className="text-[10px] text-slate-400 mt-1">or click to upload</p>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-4 text-left w-full">Max size: 5MB. Formats: JPG, PNG, WEBP.</p>
                </div>

                 {/* 2. Category & Sub-Cat (Organization) */}
                 <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 w-full text-left mb-2 uppercase tracking-wider">Organization</h3>
                    
                    <div className="group">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Category</label>
                        <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer">
                            <option>Select Category</option>
                            <option>Electronics</option>
                            <option>Hardware</option>
                        </select>
                    </div>

                    <div className="group">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sub Category</label>
                        <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer">
                            <option>None</option>
                            <option>Phone</option>
                            <option>Laptop</option>
                        </select>
                    </div>
                </div>

            </div>
       </div>

       {/* Sticky Bottom Actions Bar */}
       <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-md text-white px-2 py-2 rounded-full shadow-2xl flex items-center gap-2 border border-white/10 hover:scale-105 transition-transform duration-300">
             {!isEdit && (
                <>
                <button className="px-6 py-2.5 rounded-full font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-900 transition flex items-center gap-2">
                    <DollarSign size={14} /> Save & Add Selling-Price-Group Prices
                </button>
                <button className="px-6 py-2.5 rounded-full font-bold text-xs bg-red-600 hover:bg-red-500 transition flex items-center gap-2">
                    <Plus size={14} /> Save And Add Another
                </button>
                </>
             )}
            <button 
                onClick={handleSave}
                className={`px-8 py-2.5 rounded-full font-bold text-xs shadow-lg transition flex items-center gap-2 ${isEdit ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/50' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/50'}`}
            >
                <Save size={14} /> {isEdit ? 'Update' : 'Save'}
            </button>
       </div>
    </div>
  );
};

export default AddProduct;
