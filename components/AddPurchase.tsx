import React, { useState, useEffect } from 'react';
import { 
  Save, Plus, Calendar, Search, Trash2, 
  ChevronDown, FileText, Truck, CreditCard, 
  DollarSign, Info, Upload, User, MapPin, 
  PackageCheck, Calculator, AlertCircle
} from 'lucide-react';
import { useNotifications } from '../src/context/NotificationContext';
import { useGlobalContext } from '../src/context/GlobalContext';

const AddPurchase: React.FC = () => {
  const { locations, suppliers, products, addPurchase, currentUser, formatCurrency, taxRates } = useGlobalContext();
  const { addNotification } = useNotifications();
  // --- State ---
  const [supplierId, setSupplierId] = useState('');
  const [supplier, setSupplier] = useState('');

  // Per-row product search state
  const [rowProductSearches, setRowProductSearches] = useState<Record<number, string>>({});
  const [rowProductDropdownOpen, setRowProductDropdownOpen] = useState<Record<number, boolean>>({});
  const [purchaseStatus, setPurchaseStatus] = useState('Received');
  const [rows, setRows] = useState<any[]>([
    { id: 1, name: '', qty: 1, unitCost: 0, discount: 0, costBeforeTax: 0, lineTotal: 0, margin: 0, sellingPrice: 0, lot: '' }
  ]);
  
  // Footer State
  const [discountType, setDiscountType] = useState('None');
  const [discountAmount, setDiscountAmount] = useState<number | ''>('');
  const [purchaseTax, setPurchaseTax] = useState('None');
  const [shippingCharges, setShippingCharges] = useState<number | ''>('');
  
  // Payment State
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  // --- Draft State ---
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftData, setDraftData] = useState<any>(null);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  // Load Draft Logic
  useEffect(() => {
    const savedDraft = localStorage.getItem('addPurchaseDraft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.supplier || (parsed.rows && parsed.rows.length > 0 && parsed.rows[0].name !== 'New Item (Search to fill)')) {
           setDraftData(parsed);
           setShowDraftPrompt(true);
        } else {
           setIsDraftLoaded(true);
        }
      } catch (e) {
           setIsDraftLoaded(true);
      }
    } else {
       setIsDraftLoaded(true);
    }
  }, []);

  // Save Draft Logic
  useEffect(() => {
    if (isDraftLoaded && !showDraftPrompt) {
      const draft = {
        supplier, purchaseStatus, rows, discountType, discountAmount, purchaseTax, shippingCharges, paymentAmount, paymentMethod
      };
      localStorage.setItem('addPurchaseDraft', JSON.stringify(draft));
    }
  }, [isDraftLoaded, showDraftPrompt, supplier, purchaseStatus, rows, discountType, discountAmount, purchaseTax, shippingCharges, paymentAmount, paymentMethod]);

  const restoreDraft = () => {
     if (draftData) {
         setSupplier(draftData.supplier || '');
         setPurchaseStatus(draftData.purchaseStatus || 'Received');
         setRows(draftData.rows || []);
         setDiscountType(draftData.discountType || 'None');
         setDiscountAmount(draftData.discountAmount || '');
         setPurchaseTax(draftData.purchaseTax || 'None');
         setShippingCharges(draftData.shippingCharges || '');
         setPaymentAmount(draftData.paymentAmount || '');
         setPaymentMethod(draftData.paymentMethod || 'Cash');
     }
     setShowDraftPrompt(false);
     setIsDraftLoaded(true);
  };

  const discardDraft = () => {
     localStorage.removeItem('addPurchaseDraft');
     setShowDraftPrompt(false);
     setIsDraftLoaded(true);
  };

  // --- Calculations ---
  const subTotal = rows.reduce((acc, row) => acc + row.lineTotal, 0);
  
  const calculateTotal = () => {
      let total = subTotal;
      // Apply Discount
      if (discountType === 'Fixed' && typeof discountAmount === 'number') {
          total -= discountAmount;
      } else if (discountType === 'Percentage' && typeof discountAmount === 'number') {
          total -= (total * (discountAmount / 100));
      }
      
      // Apply Tax (dynamic from taxRates)
      if (purchaseTax !== 'None') {
          const taxRateObj = taxRates.find(r => r.name === purchaseTax);
          if (taxRateObj) total += total * (taxRateObj.rate / 100);
      }

      // Add Shipping
      if (typeof shippingCharges === 'number') {
          total += shippingCharges;
      }

      return total;
  };

  const netTotal = calculateTotal();
  const paymentDue = typeof paymentAmount === 'number' ? netTotal - paymentAmount : netTotal;

  // --- Handlers ---
  const handleAddRow = () => {
      // Mock adding a product
      const newRow = { 
          id: Date.now(), 
          name: 'New Item (Search to fill)', 
          qty: 1, 
          unitCost: 0, 
          discount: 0, 
          costBeforeTax: 0, 
          lineTotal: 0, 
          margin: 0, 
          sellingPrice: 0, 
          lot: '' 
      };
      setRows([...rows, newRow]);
  };

  const handleRemoveRow = (id: number) => {
      setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: number, field: string, value: any) => {
      setRows(rows.map(row => {
          if (row.id === id) {
              const updated = { ...row, [field]: value };
              // Simple recalc logic for demo
              if (field === 'qty' || field === 'unitCost') {
                  updated.lineTotal = updated.qty * updated.unitCost;
              }
              return updated;
          }
          return row;
      }));
  };

  // Product search helpers for rows
  const getFilteredProducts = (search: string) => {
    const lowerSearch = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(lowerSearch) ||
      p.sku.toLowerCase().includes(lowerSearch)
    ).slice(0, 8);
  };

  const handleProductSelectForRow = (rowId: number, product: typeof products[0]) => {
    setRows(rows.map(row => {
      if (row.id === rowId) {
        const lineTotal = row.qty * product.unitPurchasePrice;
        return { ...row, name: product.name, unitCost: product.unitPurchasePrice, costBeforeTax: product.unitPurchasePrice, lineTotal, sellingPrice: product.sellingPrice };
      }
      return row;
    }));
    setRowProductSearches(prev => ({ ...prev, [rowId]: product.name }));
    setRowProductDropdownOpen(prev => ({ ...prev, [rowId]: false }));
  };

  const handleSave = () => {
    const selectedSupplier = suppliers.find(s => s.id === supplierId);
    const newPurchase = {
      id: `PO-${Date.now()}`,
      refNo: `PO-${Date.now()}`,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      location: locations.length > 0 ? locations[0].name : 'Main Location',
      supplier: selectedSupplier?.businessName || supplier || 'Unknown Supplier',
      supplierId: supplierId || undefined,
      status: purchaseStatus as 'Received' | 'Pending' | 'Ordered',
      paymentStatus: paymentDue <= 0 ? 'Paid' : (paymentAmount && paymentAmount > 0 ? 'Partial' : 'Due') as 'Paid' | 'Due' | 'Partial',
      grandTotal: netTotal,
      paymentDue: paymentDue,
      addedBy: currentUser?.name || 'Admin',
      items: rows.map(r => ({
        id: String(r.id),
        name: r.name,
        qty: r.qty,
        unitCost: r.unitCost,
        discount: r.discount || 0,
        tax: 0,
        lineTotal: r.lineTotal,
        lot: r.lot || '',
        sellingPrice: r.sellingPrice || 0,
        margin: r.margin || 0,
      })),
    };

    addPurchase(newPurchase);

    localStorage.removeItem('addPurchaseDraft');
    addNotification({
      title: 'Purchase Saved',
      message: 'The purchase transaction has been successfully recorded.',
      type: 'success'
    });
    
    // Reset form
    setSupplierId('');
    setSupplier('');
    setPurchaseStatus('Received');
    setRows([]);
    setDiscountType('None');
    setDiscountAmount('');
    setPurchaseTax('None');
    setShippingCharges('');
    setPaymentAmount('');
    setPaymentMethod('Cash');
  };

  return (
    <div className="space-y-8 animate-fade-in pb-32 max-w-[1800px] mx-auto">
        
        {/* Draft Prompt */}
        {showDraftPrompt && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl shadow-sm flex items-center justify-between animate-in slide-in-from-top-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                        <AlertCircle size={24} className="text-amber-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Unsaved Draft Found</h3>
                        <p className="text-amber-700 text-sm">You have an unsaved purchase draft. Would you like to restore it?</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={discardDraft} className="text-sm bg-white border border-amber-200 hover:bg-amber-100 px-4 py-2 rounded-lg transition-colors font-medium">
                        Discard
                    </button>
                    <button onClick={restoreDraft} className="text-sm bg-amber-500 text-white hover:bg-amber-600 px-4 py-2 rounded-lg transition-colors font-medium">
                        Restore Draft
                    </button>
                </div>
            </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <PackageCheck className="text-emerald-600" size={32} />
                    Add Purchase
                </h2>
                <p className="text-slate-500 mt-1 text-lg">Create a new purchase order to replenish stock.</p>
            </div>
        </div>

        {/* 1. General Information */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                
                {/* Supplier */}
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Supplier <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                        <div className="relative w-full">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <select
                                className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                                value={supplierId}
                                onChange={(e) => {
                                    setSupplierId(e.target.value);
                                    const sel = suppliers.find(s => s.id === e.target.value);
                                    setSupplier(sel?.businessName || '');
                                }}
                            >
                                <option value="">Select Supplier</option>
                                {suppliers.filter(s => s.status === 'Active').map(s => (
                                    <option key={s.id} value={s.id}>{s.businessName}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                        <button className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-md transition-transform active:scale-95"><Plus size={20} /></button>
                    </div>
                </div>

                {/* Reference No */}
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">Reference No <Info size={12} className="text-emerald-500" /></label>
                    <input type="text" placeholder="Leave blank to auto-generate" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-bold text-slate-700 placeholder:text-slate-400" />
                </div>

                {/* Purchase Date */}
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Purchase Date <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="datetime-local" className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-bold text-slate-700" />
                    </div>
                </div>

                {/* Purchase Status */}
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Purchase Status <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <select 
                            value={purchaseStatus}
                            onChange={(e) => setPurchaseStatus(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                        >
                            <option value="Received">Received</option>
                            <option value="Pending">Pending</option>
                            <option value="Ordered">Ordered</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>

                {/* Business Location */}
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Business Location <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-100 border-transparent text-sm font-bold text-slate-500 appearance-none cursor-pointer">
                            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>

                {/* Attach Document */}
                <div className="group md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Attach Document</label>
                    <div className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 hover:border-emerald-400 transition-colors cursor-pointer group-hover:bg-white">
                        <Upload size={18} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-500">Click to upload invoice or receipt...</span>
                    </div>
                </div>

            </div>
        </div>

        {/* 2. Order Items */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
             
             {/* Search Product */}
             <div className="mb-8 flex justify-center">
                 <div className="relative w-full max-w-2xl">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search size={20} className="text-emerald-500" />
                    </div>
                    <input 
                        type="text" 
                        className="block w-full pl-12 pr-4 py-4 rounded-[1.5rem] bg-slate-50 border-transparent focus:bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold text-slate-700 shadow-sm placeholder:text-slate-400 placeholder:font-medium" 
                        placeholder="Enter Product name / SKU / Scan bar code to add to list"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddRow()}
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center">
                        <button className="p-2 bg-white rounded-full text-slate-400 hover:text-emerald-600 shadow-sm transition-colors">
                            <Plus size={20} />
                        </button>
                    </div>
                </div>
             </div>

             {/* Table */}
             <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-[#5cb85c] text-white text-[11px] font-bold uppercase tracking-wider">
                            <th className="p-4 text-center w-10">#</th>
                            <th className="p-4 text-left w-64 border-l border-[#4cae4c]">Product Name</th>
                            <th className="p-4 text-center w-32 border-l border-[#4cae4c]">Purchase Qty</th>
                            <th className="p-4 text-right w-40 border-l border-[#4cae4c]">Unit Cost <span className="opacity-70 normal-case">(Before Disc)</span></th>
                            <th className="p-4 text-center w-32 border-l border-[#4cae4c]">Discount %</th>
                            <th className="p-4 text-right w-40 border-l border-[#4cae4c]">Unit Cost <span className="opacity-70 normal-case">(Before Tax)</span></th>
                            <th className="p-4 text-right w-40 border-l border-[#4cae4c]">Line Total</th>
                            <th className="p-4 text-center w-32 border-l border-[#4cae4c]">Margin %</th>
                            <th className="p-4 text-right w-40 border-l border-[#4cae4c]">Selling Price</th>
                            <th className="p-4 text-left w-40 border-l border-[#4cae4c]">Lot Number</th>
                            <th className="p-4 text-center w-12 border-l border-[#4cae4c]"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {rows.map((row, index) => (
                            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 text-center font-bold text-slate-500">{index + 1}</td>
                                <td className="p-4 relative">
                                    <input
                                        type="text"
                                        placeholder="Search product..."
                                        value={rowProductSearches[row.id] ?? row.name}
                                        onChange={(e) => {
                                            setRowProductSearches(prev => ({ ...prev, [row.id]: e.target.value }));
                                            setRowProductDropdownOpen(prev => ({ ...prev, [row.id]: true }));
                                        }}
                                        onFocus={() => setRowProductDropdownOpen(prev => ({ ...prev, [row.id]: true }))}
                                        onBlur={() => setTimeout(() => setRowProductDropdownOpen(prev => ({ ...prev, [row.id]: false })), 200)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                    />
                                    {rowProductDropdownOpen[row.id] && (
                                        <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-48 overflow-y-auto">
                                            {getFilteredProducts(rowProductSearches[row.id] ?? '').map(p => (
                                                <div
                                                    key={p.id}
                                                    onMouseDown={() => handleProductSelectForRow(row.id, p)}
                                                    className="px-4 py-2.5 hover:bg-emerald-50 cursor-pointer text-xs border-b border-slate-50 last:border-0"
                                                >
                                                    <div className="font-bold text-slate-800">{p.name}</div>
                                                    <div className="text-slate-500 mt-0.5">SKU: {p.sku} | Stock: {p.stock} | Cost: {formatCurrency(p.unitPurchasePrice)}</div>
                                                </div>
                                            ))}
                                            {getFilteredProducts(rowProductSearches[row.id] ?? '').length === 0 && (
                                                <div className="px-4 py-3 text-xs text-slate-400 italic">No products found</div>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td className="p-4">
                                    <input 
                                        type="number" 
                                        value={row.qty}
                                        onChange={(e) => updateRow(row.id, 'qty', parseInt(e.target.value) || 0)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                    />
                                </td>
                                <td className="p-4">
                                    <input 
                                        type="number" 
                                        value={row.unitCost} 
                                        onChange={(e) => updateRow(row.id, 'unitCost', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-medium text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                    />
                                </td>
                                <td className="p-4">
                                    <input type="number" value={row.discount} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-medium text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                                </td>
                                <td className="p-4 text-right font-medium text-slate-600">{row.costBeforeTax.toFixed(3)}</td>
                                <td className="p-4 text-right font-bold text-slate-800">{row.lineTotal.toFixed(3)}</td>
                                <td className="p-4">
                                    <input type="number" value={row.margin} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-medium text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                                </td>
                                <td className="p-4">
                                    <input type="number" value={row.sellingPrice} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-medium text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                                </td>
                                <td className="p-4">
                                    <input type="text" value={row.lot} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" placeholder="Lot #" />
                                </td>
                                <td className="p-4 text-center">
                                    <button onClick={() => handleRemoveRow(row.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={11} className="p-8 text-center text-slate-400 italic">No products added. Use the search bar above.</td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-700 text-xs uppercase">
                        <tr>
                            <td colSpan={6} className="p-4 text-right">Total Items: <span className="text-slate-900">{rows.length}</span></td>
                            <td className="p-4 text-right font-mono text-base text-slate-900">{subTotal.toFixed(3)}</td>
                            <td colSpan={4}></td>
                        </tr>
                    </tfoot>
                </table>
             </div>
        </div>

        {/* 3. Footer Calculations */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-fuchsia-500"></div>
             
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 
                 {/* Left Column: Discounts & Tax */}
                 <div className="space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                         <div className="group">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Discount Type</label>
                            <div className="relative">
                                <select 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                                    value={discountType}
                                    onChange={(e) => setDiscountType(e.target.value)}
                                >
                                    <option>None</option>
                                    <option>Fixed</option>
                                    <option>Percentage</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                            </div>
                        </div>
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Amount</label>
                            <input 
                                type="number" 
                                placeholder="0.00" 
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all text-sm font-bold text-slate-700" 
                                value={discountAmount}
                                onChange={(e) => setDiscountAmount(parseFloat(e.target.value))}
                            />
                        </div>
                     </div>

                     <div className="group">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Purchase Tax</label>
                        <div className="relative">
                            <select 
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                                value={purchaseTax}
                                onChange={(e) => setPurchaseTax(e.target.value)}
                            >
                                <option value="None">None</option>
                                {taxRates.map(tr => (
                                  <option key={tr.id} value={tr.name}>{tr.name} ({tr.rate}%)</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    </div>
                 </div>

                 {/* Middle Column: Shipping & Notes */}
                 <div className="space-y-6">
                     <div className="group">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Shipping Details</label>
                        <input type="text" placeholder="Carrier, tracking, etc." className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all text-sm font-medium text-slate-700" />
                    </div>
                    <div className="group">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">Additional Shipping Charges <Info size={12} className="text-purple-500" /></label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">OMR</span>
                            <input 
                                type="number" 
                                placeholder="0.000" 
                                className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all text-sm font-bold text-slate-700" 
                                value={shippingCharges}
                                onChange={(e) => setShippingCharges(parseFloat(e.target.value))}
                            />
                        </div>
                    </div>
                 </div>

                 {/* Right Column: Total Summary */}
                 <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 h-full flex flex-col justify-center">
                     <div className="space-y-3">
                         <div className="flex justify-between text-sm font-medium text-slate-500">
                             <span>Subtotal:</span>
                             <span>{subTotal.toFixed(3)}</span>
                         </div>
                         <div className="flex justify-between text-sm font-medium text-slate-500">
                             <span>Discount:</span>
                             <span>(-) {discountType === 'None' ? '0.000' : typeof discountAmount === 'number' ? discountAmount.toFixed(3) : '0.000'}</span>
                         </div>
                         <div className="flex justify-between text-sm font-medium text-slate-500">
                             <span>Tax ({purchaseTax}):</span>
                             <span>(+) {(() => {
                               if (purchaseTax === 'None') return '0.000';
                               const tr = taxRates.find(r => r.name === purchaseTax);
                               if (!tr) return '0.000';
                               const afterDiscount = discountType === 'Fixed' && typeof discountAmount === 'number'
                                 ? subTotal - discountAmount
                                 : discountType === 'Percentage' && typeof discountAmount === 'number'
                                   ? subTotal * (1 - discountAmount / 100)
                                   : subTotal;
                               return (afterDiscount * (tr.rate / 100)).toFixed(3);
                             })()}</span>
                         </div>
                         <div className="flex justify-between text-sm font-medium text-slate-500">
                             <span>Shipping:</span>
                             <span>(+) {typeof shippingCharges === 'number' ? shippingCharges.toFixed(3) : '0.000'}</span>
                         </div>
                         <div className="h-px bg-slate-200 my-2"></div>
                         <div className="flex justify-between text-xl font-black text-slate-900">
                             <span>Purchase Total:</span>
                             <span>OMR {netTotal.toFixed(3)}</span>
                         </div>
                     </div>
                 </div>

             </div>

             <div className="mt-6 pt-6 border-t border-slate-100">
                 <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Additional Notes</label>
                    <textarea rows={2} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all text-sm font-medium text-slate-700 resize-none" placeholder="Enter any specific notes for this purchase..."></textarea>
                </div>
             </div>
        </div>

        {/* 4. Payment Section */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-700 to-slate-900"></div>
             <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
                <CreditCard size={20} className="text-slate-700" /> Add Payment
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Advance Balance</label>
                    <div className="w-full px-4 py-3 rounded-xl bg-slate-100 border-transparent text-sm font-bold text-slate-500 cursor-not-allowed">
                        0.000
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Amount <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="number" 
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-bold text-slate-900" 
                            placeholder="0.000"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(parseFloat(e.target.value))}
                        />
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Paid on <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="datetime-local" className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-bold text-slate-700" />
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Method <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <select 
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                        >
                            <option>Cash</option>
                            <option>Card</option>
                            <option>Cheque</option>
                            <option>Bank Transfer</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>

                <div className="group lg:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Note</label>
                    <textarea rows={1} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-medium text-slate-700 resize-none" placeholder="Transaction ID, Cheque No, etc."></textarea>
                </div>

                <div className="group lg:col-span-2 flex items-end justify-end">
                    <div className="text-right">
                        <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Payment Due</span>
                        <span className="text-2xl font-black text-slate-900">OMR {paymentDue.toFixed(3)}</span>
                    </div>
                </div>

            </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-md text-white px-2 py-2 rounded-full shadow-2xl flex items-center gap-2 border border-white/10 hover:scale-105 transition-transform duration-300">
             <button 
                onClick={handleSave}
                className="px-8 py-3 rounded-full font-bold text-sm bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/50 transition flex items-center gap-2"
             >
                <Save size={18} /> Save Purchase
            </button>
       </div>

    </div>
  );
};

export default AddPurchase;