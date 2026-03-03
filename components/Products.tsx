import React, { useState } from 'react';
import { 
  Plus, Search, FileText, FileSpreadsheet, Printer, 
  Columns, Download, Edit, Trash2, Eye, Filter, 
  MoreHorizontal, ChevronDown, ArrowUpDown, X,
  Image as ImageIcon, Upload, Save, Info
} from 'lucide-react';
import { useGlobalContext, Product } from '../src/context/GlobalContext';
import ViewProduct from './ViewProduct';

const Products: React.FC = () => {
  const { products, addProduct } = useGlobalContext();
  const [view, setView] = useState<'list' | 'add' | 'view'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcodeType: 'Code 128',
    unit: '',
    brand: '',
    category: '',
    subCategory: '',
    businessLocations: [] as string[],
    alertQuantity: '',
    description: '',
    weight: '',
    tax: '',
    taxType: 'Exclusive',
    type: 'Single',
    purchasePrice: '',
    profitMargin: '',
    sellingPrice: ''
  });

  const handleSave = () => {
    // Basic validation
    if (!formData.name || !formData.sku) {
        alert('Please fill required fields');
        return;
    }

    const newProduct: any = {
      id: Date.now().toString(),
      name: formData.name,
      sku: formData.sku,
      type: formData.type as any,
      category: formData.category || 'Uncategorized',
      brand: formData.brand || 'Generic',
      businessLocation: 'Main Branch', // Default for now
      unit: formData.unit || 'Pc(s)',
      alertQuantity: Number(formData.alertQuantity) || 0,
      unitPurchasePrice: Number(formData.purchasePrice) || 0,
      sellingPrice: Number(formData.sellingPrice) || 0,
      stock: 0, // Initial stock usually handled via opening stock or purchase
      tax: formData.tax || 'None',
      image: ''
    };

    addProduct(newProduct);
    setView('list');
    // Reset form
    setFormData({
        name: '', sku: '', barcodeType: 'Code 128', unit: '', brand: '', category: '', subCategory: '',
        businessLocations: [], alertQuantity: '', description: '', weight: '', tax: '', taxType: 'Exclusive',
        type: 'Single', purchasePrice: '', profitMargin: '', sellingPrice: ''
    });
  };

  const calculateSellingPrice = (purchase: number, margin: number) => {
      return purchase + (purchase * (margin / 100));
  };

  const handlePriceChange = (field: 'purchase' | 'margin' | 'selling', value: string) => {
      let newData = { ...formData };
      
      if (field === 'purchase') {
          newData.purchasePrice = value;
          if (newData.profitMargin) {
              const purchase = parseFloat(value) || 0;
              const margin = parseFloat(newData.profitMargin) || 0;
              newData.sellingPrice = calculateSellingPrice(purchase, margin).toFixed(3);
          }
      } else if (field === 'margin') {
          newData.profitMargin = value;
          if (newData.purchasePrice) {
              const purchase = parseFloat(newData.purchasePrice) || 0;
              const margin = parseFloat(value) || 0;
              newData.sellingPrice = calculateSellingPrice(purchase, margin).toFixed(3);
          }
      } else if (field === 'selling') {
          newData.sellingPrice = value;
          if (newData.purchasePrice) {
              const purchase = parseFloat(newData.purchasePrice) || 0;
              const selling = parseFloat(value) || 0;
              if (purchase > 0) {
                  newData.profitMargin = (((selling - purchase) / purchase) * 100).toFixed(2);
              }
          }
      }
      setFormData(newData);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {view === 'list' ? (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Products</h2>
              <p className="text-slate-500 mt-2 text-lg font-light">
                Manage your product inventory
              </p>
            </div>
            <div className="flex gap-3">
                <button 
                onClick={() => setView('add')}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
                >
                <Plus size={18} /> Add Product
                </button>
            </div>
          </div>

          {/* Filters (Collapsed by default or simple) */}
          <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm">
              <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Product Type</label>
                      <select className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                          <option value="">All</option>
                          <option value="Single">Single</option>
                          <option value="Variable">Variable</option>
                          <option value="Combo">Combo</option>
                      </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Category</label>
                      <select className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                          <option value="">All</option>
                          <option value="Dry Pet Food">Dry Pet Food</option>
                          <option value="Sand">Sand</option>
                      </select>
                  </div>
                   <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Unit</label>
                      <select className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                          <option value="">All</option>
                          <option value="Pc(s)">Pc(s)</option>
                          <option value="Bag">Bag</option>
                      </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Tax</label>
                      <select className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                          <option value="">All</option>
                          <option value="VAT 5%">VAT 5%</option>
                          <option value="None">None</option>
                      </select>
                  </div>
                   <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Brand</label>
                      <select className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                          <option value="">All</option>
                          <option value="Pedigree">Pedigree</option>
                          <option value="Clear Cat">Clear Cat</option>
                      </select>
                  </div>
              </div>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
            
            {/* Controls Bar */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
                {/* Show Entries */}
                <div className="flex items-center gap-3 w-full xl:w-auto">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show</span>
                    <div className="relative">
                        <select className="border-0 bg-white shadow-sm ring-1 ring-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer appearance-none">
                            <option>25</option>
                            <option>50</option>
                            <option>100</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">entries</span>
                </div>

                {/* Export Buttons */}
                <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto">
                    {[
                        { icon: FileText, label: 'CSV' },
                        { icon: FileSpreadsheet, label: 'Excel' },
                        { icon: Printer, label: 'Print' },
                        { icon: Columns, label: 'Column visibility' },
                        { icon: Download, label: 'PDF' },
                    ].map((action, i) => (
                        <button key={i} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                            <action.icon size={14} /> {action.label}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative w-full xl:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Search products..." 
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
                    <th className="px-6 py-4"><input type="checkbox" className="rounded border-slate-300" /></th>
                    <th className="px-6 py-4">Product Image</th>
                    <th className="px-6 py-4 text-center">Action</th>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Business Location</th>
                    <th className="px-6 py-4">Unit Purchase Price</th>
                    <th className="px-6 py-4">Selling Price</th>
                    <th className="px-6 py-4">Current Stock</th>
                    <th className="px-6 py-4">Product Type</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Brand</th>
                    <th className="px-6 py-4">Tax</th>
                    <th className="px-6 py-4">SKU</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4"><input type="checkbox" className="rounded border-slate-300" /></td>
                        <td className="px-6 py-4">
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                {product.image ? (
                                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon size={20} className="text-slate-400" />
                                )}
                            </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                    <Edit size={16} />
                                </button>
                                <button 
                                    onClick={() => {
                                        setSelectedProduct(product);
                                        setView('view');
                                    }}
                                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                >
                                    <Eye size={16} />
                                </button>
                                <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">{product.name}</td>
                        <td className="px-6 py-4 text-slate-600">{product.businessLocation}</td>
                        <td className="px-6 py-4 font-medium">OMR {(product.unitPurchasePrice || 0).toFixed(3)}</td>
                        <td className="px-6 py-4 font-medium">OMR {product.sellingPrice.toFixed(3)}</td>
                        <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${product.stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                {product.stock.toFixed(3)} {product.unit}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">
                                {product.type}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{product.category}</td>
                        <td className="px-6 py-4 text-slate-600">{product.brand}</td>
                        <td className="px-6 py-4 text-slate-600">{product.tax}</td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{product.sku}</td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
          </div>
        </>
      ) : view === 'add' ? (
        /* Add Product View */
        <div className="animate-in slide-in-from-right-10 duration-300">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Add new product</h2>
                <button 
                    onClick={() => setView('list')}
                    className="text-slate-500 hover:text-slate-700 font-bold flex items-center gap-2"
                >
                    <X size={20} /> Cancel
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Main Info */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* General Information */}
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <Info className="text-blue-600" size={20} /> General Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="group md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Product Name <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                                    placeholder="Product Name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">SKU <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                                        placeholder="SKU"
                                        value={formData.sku}
                                        onChange={(e) => setFormData({...formData, sku: e.target.value})}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">Auto</span>
                                </div>
                            </div>
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Barcode Type</label>
                                <select 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                    value={formData.barcodeType}
                                    onChange={(e) => setFormData({...formData, barcodeType: e.target.value})}
                                >
                                    <option value="Code 128">Code 128 (C128)</option>
                                    <option value="Code 39">Code 39 (C39)</option>
                                    <option value="EAN-13">EAN-13</option>
                                    <option value="UPC-A">UPC-A</option>
                                </select>
                            </div>
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Unit <span className="text-red-500">*</span></label>
                                <select 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                    value={formData.unit}
                                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                                >
                                    <option value="">Select Unit</option>
                                    <option value="Pc(s)">Pc(s)</option>
                                    <option value="Bag">Bag</option>
                                    <option value="Kg">Kg</option>
                                </select>
                            </div>
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Brand</label>
                                <select 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                    value={formData.brand}
                                    onChange={(e) => setFormData({...formData, brand: e.target.value})}
                                >
                                    <option value="">Select Brand</option>
                                    <option value="Pedigree">Pedigree</option>
                                    <option value="Clear Cat">Clear Cat</option>
                                </select>
                            </div>
                             <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Category</label>
                                <select 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                    value={formData.category}
                                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                                >
                                    <option value="">Select Category</option>
                                    <option value="Dry Pet Food">Dry Pet Food</option>
                                    <option value="Sand">Sand</option>
                                </select>
                            </div>
                             <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Sub Category</label>
                                <select 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                    value={formData.subCategory}
                                    onChange={(e) => setFormData({...formData, subCategory: e.target.value})}
                                >
                                    <option value="">Select Sub Category</option>
                                    <option value="None">None</option>
                                </select>
                            </div>
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Business Locations</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Main Branch', 'Warehouse A', 'City Store'].map(loc => (
                                        <label key={loc} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:bg-white hover:border-blue-300 transition-all">
                                            <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 border-slate-300" />
                                            <span className="text-sm font-medium text-slate-700">{loc}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="group md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Description</label>
                                <textarea 
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 shadow-sm resize-none"
                                    placeholder="Product Description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Pricing & Tax */}
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <span className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg"><FileSpreadsheet size={18} /></span> Pricing & Tax
                        </h3>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Applicable Tax</label>
                                <select 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                    value={formData.tax}
                                    onChange={(e) => setFormData({...formData, tax: e.target.value})}
                                >
                                    <option value="">None</option>
                                    <option value="VAT 5%">VAT 5%</option>
                                    <option value="VAT 10%">VAT 10%</option>
                                </select>
                            </div>
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Selling Price Tax Type</label>
                                <select 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                    value={formData.taxType}
                                    onChange={(e) => setFormData({...formData, taxType: e.target.value})}
                                >
                                    <option value="Inclusive">Inclusive</option>
                                    <option value="Exclusive">Exclusive</option>
                                </select>
                            </div>
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Product Type</label>
                                <select 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                    value={formData.type}
                                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                                >
                                    <option value="Single">Single</option>
                                    <option value="Variable">Variable</option>
                                    <option value="Combo">Combo</option>
                                </select>
                            </div>
                         </div>

                         {/* Price Table */}
                         <div className="mt-6 overflow-x-auto">
                             <table className="w-full text-sm text-left border-collapse border border-slate-200 rounded-xl">
                                 <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
                                     <tr>
                                         <th className="px-4 py-3 border-b border-slate-200">Default Purchase Price</th>
                                         <th className="px-4 py-3 border-b border-slate-200">x Margin (%)</th>
                                         <th className="px-4 py-3 border-b border-slate-200">Default Selling Price</th>
                                     </tr>
                                 </thead>
                                 <tbody>
                                     <tr>
                                         <td className="p-3 border-b border-slate-200">
                                             <div className="flex items-center gap-2">
                                                 <span className="text-slate-400 font-medium">Exc. Tax</span>
                                                 <input 
                                                    type="number" 
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-bold"
                                                    placeholder="0.000"
                                                    value={formData.purchasePrice}
                                                    onChange={(e) => handlePriceChange('purchase', e.target.value)}
                                                 />
                                             </div>
                                             <div className="flex items-center gap-2 mt-2">
                                                 <span className="text-slate-400 font-medium">Inc. Tax</span>
                                                 <input 
                                                    type="number" 
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium"
                                                    placeholder="0.000"
                                                    readOnly
                                                    value={formData.purchasePrice} // Simplified for mock
                                                 />
                                             </div>
                                         </td>
                                         <td className="p-3 border-b border-slate-200 align-top">
                                             <input 
                                                type="number" 
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-bold"
                                                placeholder="25.00"
                                                value={formData.profitMargin}
                                                onChange={(e) => handlePriceChange('margin', e.target.value)}
                                             />
                                         </td>
                                         <td className="p-3 border-b border-slate-200">
                                            <div className="flex items-center gap-2">
                                                 <span className="text-slate-400 font-medium">Exc. Tax</span>
                                                 <input 
                                                    type="number" 
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-bold"
                                                    placeholder="0.000"
                                                    value={formData.sellingPrice}
                                                    onChange={(e) => handlePriceChange('selling', e.target.value)}
                                                 />
                                             </div>
                                             <div className="flex items-center gap-2 mt-2">
                                                 <span className="text-slate-400 font-medium">Inc. Tax</span>
                                                 <input 
                                                    type="number" 
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium"
                                                    placeholder="0.000"
                                                    readOnly
                                                    value={formData.sellingPrice} // Simplified
                                                 />
                                             </div>
                                         </td>
                                     </tr>
                                 </tbody>
                             </table>
                         </div>
                    </div>
                </div>

                {/* Right Column - Extra Info */}
                <div className="space-y-8">
                     <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-8 hover:bg-slate-50 transition-colors cursor-pointer group">
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Upload size={24} />
                            </div>
                            <p className="text-sm font-bold text-slate-700">Upload Product Image</p>
                            <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB</p>
                        </div>
                     </div>

                     <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Alert Quantity</label>
                            <input 
                                type="number" 
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                                placeholder="Alert Quantity"
                                value={formData.alertQuantity}
                                onChange={(e) => setFormData({...formData, alertQuantity: e.target.value})}
                            />
                        </div>
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Weight</label>
                            <input 
                                type="text" 
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                                placeholder="Weight"
                                value={formData.weight}
                                onChange={(e) => setFormData({...formData, weight: e.target.value})}
                            />
                        </div>
                     </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="mt-8 flex justify-end gap-4">
                <button 
                    onClick={() => setView('list')}
                    className="px-8 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all text-sm shadow-sm"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSave}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 text-sm flex items-center gap-2"
                >
                    <Save size={18} /> Save Product
                </button>
            </div>
        </div>
      ) : (
        /* View Product Details */
        <ViewProduct 
            onBack={() => setView('list')} 
            product={selectedProduct} 
        />
      )}
    </div>
  );
};

export default Products;
