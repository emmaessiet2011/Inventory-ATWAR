
import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, User, Trash2, Pause, RotateCcw, 
  CreditCard, Plus, Calculator, History, 
  LayoutGrid, Tag, ChevronLeft, Maximize, 
  Minus, PlusCircle, Calendar, FileText, XCircle, 
  Banknote, Wallet, StopCircle, RefreshCw, X,
  ShoppingCart, Undo2, Monitor, ArrowLeftRight, FileCheck, Minimize
} from 'lucide-react';
import { useGlobalContext, Product as GlobalProduct } from '../src/context/GlobalContext';

interface CartItem extends GlobalProduct {
  cartId: number; // Unique ID for cart entry to handle duplicates if needed
  qty: number;
  subtotal: number;
}

const POS: React.FC = () => {
  const {
    products: globalProducts,
    addSale,
    locations,
    customers,
    currentUser,
    settings,
    formatCurrency,
  } = useGlobalContext();
  // --- State ---
  const [dateTime, setDateTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'category' | 'brand'>('category');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState('WALK-IN');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(locations[0]?.id || '');
  
  // Cart Summary State
  const [discount, setDiscount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0); // Percentage
  const [shipping, setShipping] = useState<number>(0);

  // Refs for shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);

  // --- Mock Data ---
  const categories = ['All', ...Array.from(new Set(globalProducts.map(p => p.category)))];
  const brands = ['All', ...Array.from(new Set(globalProducts.map(p => p.brand)))];

  const products = globalProducts;

  const selectedCustomer = customers.find(c => c.id === customerId);
  const selectedLocation = locations.find(loc => loc.id === selectedLocationId);

  // --- Helpers ---
  const calculateTotals = () => {
    const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
    const effectiveTaxRate = settings.posEnableTax ? taxRate : 0;
    const effectiveDiscount = settings.posEnableDiscount ? discount : 0;
    const taxAmount = subtotal * (effectiveTaxRate / 100);
    const total = subtotal + taxAmount + shipping - effectiveDiscount;
    const itemsCount = cart.reduce((acc, item) => acc + item.qty, 0);
    return { subtotal, taxAmount, total, itemsCount };
  };

  const { subtotal, taxAmount, total, itemsCount } = calculateTotals();

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    const effectiveTaxRate = settings.posEnableTax ? taxRate : 0;
    const effectiveDiscount = settings.posEnableDiscount ? discount : 0;
    const customerName = customerId === 'WALK-IN'
      ? 'Walk-in Customer'
      : (selectedCustomer?.businessName || 'Walk-in Customer');
    
    const newSale = {
      id: `INV-${Date.now()}`,
      invoiceNo: `INV-${Date.now()}`,
      date: new Date().toISOString(),
      customerId,
      customerName,
      contactNumber: selectedCustomer?.mobile || '',
      location: selectedLocation?.name || '',
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        unitPrice: item.sellingPrice,
        discount: 0,
        subtotal: item.subtotal,
        tax: 0,
        total: item.subtotal
      })),
      subTotal: subtotal,
      discountType: 'Fixed',
      discountAmount: effectiveDiscount,
      tax: `${effectiveTaxRate}%`,
      shippingCharges: shipping,
      grandTotal: total,
      paymentStatus: 'Paid' as const,
      paymentMethod: settings.posDefaultPaymentMethod || 'Cash',
      totalPaid: total,
      sellDue: 0,
      saleType: 'POS',
      addedBy: currentUser?.name || 'Admin',
      status: 'Final' as const
    };

    addSale(newSale);
    alert(`Processed ${newSale.paymentMethod} payment: ${formatCurrency(total)}`);
    setCart([]);
    setDiscount(0);
    setShipping(0);
    setTaxRate(0);
  };

  // --- Effects ---
  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedLocationId && locations.length > 0) {
      setSelectedLocationId(locations[0].id);
    }
  }, [selectedLocationId, locations]);

  useEffect(() => {
    if (!settings.posEnableDiscount) {
      setDiscount(0);
    }
  }, [settings.posEnableDiscount]);

  useEffect(() => {
    if (!settings.posEnableTax) {
      setTaxRate(0);
    }
  }, [settings.posEnableTax]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleCheckout();
      } else if (e.key === 'F8') {
        e.preventDefault();
        discountInputRef.current?.focus();
      } else if (e.key === 'F9') {
        e.preventDefault();
        setCart([]); setDiscount(0); setShipping(0); setTaxRate(0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, total]);

  // --- Helpers ---
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const filteredProducts = products.filter(p => {
    if (selectedFilter === 'All') return true;
    if (activeTab === 'category') return p.category === selectedFilter;
    if (activeTab === 'brand') return p.brand === selectedFilter;
    return true;
  });

  const addToCart = (product: GlobalProduct) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
          ? { ...item, qty: item.qty + 1, subtotal: (item.qty + 1) * item.sellingPrice } 
          : item
        );
      }
      return [...prev, { ...product, cartId: Date.now(), qty: 1, subtotal: product.sellingPrice }];
    });
  };

  const updateQty = (cartId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.cartId === cartId) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty, subtotal: newQty * item.sellingPrice };
      }
      return item;
    }));
  };

  const removeFromCart = (cartId: number) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  // --- Render ---
  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans">
      
      {/* 1. Top Navigation Bar */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-4">
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors" title="Back">
                <ChevronLeft size={24} />
            </button>
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Location:</span>
                <select
                    className="bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-72 p-2 font-bold shadow-sm"
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                >
                    {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                </select>
            </div>
            <div className="bg-[#6200ea] text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 shadow-sm">
                 <Calendar size={14} />
                 {dateTime.toLocaleDateString()} {dateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
        </div>

        <div className="flex items-center gap-1.5">
             <button className="flex flex-col items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors w-16" title="Add Expense">
                <Wallet size={18} className="mb-0.5 text-red-500" />
                <span className="text-[9px] font-bold">Expense</span>
            </button>
             <button className="flex flex-col items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors w-16" title="Suspended Sales">
                <Pause size={18} className="mb-0.5 text-orange-500" />
                <span className="text-[9px] font-bold">Suspend</span>
            </button>
             <button className="flex flex-col items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors w-16" title="Sell Return">
                <Undo2 size={18} className="mb-0.5 text-rose-500" />
                <span className="text-[9px] font-bold">Return</span>
            </button>
             <button className="flex flex-col items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors w-16" title="Recent Transactions">
                <History size={18} className="mb-0.5 text-purple-600" />
                <span className="text-[9px] font-bold">Recent</span>
            </button>
             <button className="flex flex-col items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors w-16" title="Register Details">
                <Monitor size={18} className="mb-0.5 text-teal-600" />
                <span className="text-[9px] font-bold">Register</span>
            </button>
             <button className="flex flex-col items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors w-16" title="Calculator">
                <Calculator size={18} className="mb-0.5 text-blue-600" />
                <span className="text-[9px] font-bold">Calc</span>
            </button>
             <button onClick={toggleFullscreen} className="flex flex-col items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors w-16" title="Fullscreen">
                <Maximize size={18} className="mb-0.5 text-slate-700" />
                <span className="text-[9px] font-bold">Screen</span>
            </button>
             <button className="flex flex-col items-center justify-center p-2 text-slate-600 hover:bg-red-50 rounded-lg transition-colors w-16 group" title="Reset">
                <RotateCcw size={18} className="mb-0.5 text-red-600 group-hover:rotate-180 transition-transform duration-500" />
                <span className="text-[9px] font-bold text-red-600">Reset</span>
            </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left: Cart & Order Panel */}
        <div className="w-[45%] flex flex-col bg-white border-r border-slate-200">
            
            {/* Customer & Product Search */}
            <div className="p-3 space-y-3 border-b border-slate-100 shadow-sm z-10">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select 
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value)}
                        >
                            <option value="WALK-IN">Walk-in Customer</option>
                            {customers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.businessName}
                              </option>
                            ))}
                        </select>
                        <button className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-white border border-slate-200 rounded hover:bg-blue-50 text-blue-600">
                            <Plus size={14} />
                        </button>
                    </div>
                </div>

                <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                     <input 
                        ref={searchInputRef}
                        type="text" 
                        placeholder="Enter Product name / SKU / Scan bar code (F2)" 
                        className="w-full pl-10 pr-12 py-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm placeholder:text-slate-400 font-medium"
                        autoFocus
                     />
                     <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600">
                         <PlusCircle size={20} />
                     </button>
                </div>
            </div>

            {/* Cart Items Table */}
            <div className="flex-1 overflow-y-auto bg-slate-50">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-white text-slate-600 font-bold border-b border-slate-200 sticky top-0 shadow-sm z-10 text-xs uppercase tracking-wide">
                        <tr>
                            <th className="px-4 py-3">Product</th>
                            <th className="px-2 py-3 text-center">Quantity</th>
                            <th className="px-4 py-3 text-right">Subtotal</th>
                            <th className="px-2 py-3 text-center w-10"><X size={14} /></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {cart.length > 0 ? (
                            cart.map((item) => (
                                <tr key={item.cartId} className="bg-white hover:bg-blue-50/50 transition-colors group">
                                    <td className="px-4 py-3 align-middle">
                                        <div className="font-bold text-slate-800 text-sm mb-0.5">{item.name}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>
                                    </td>
                                    <td className="px-2 py-3 align-middle">
                                        <div className="flex items-center justify-center gap-1">
                                            <button 
                                                onClick={() => updateQty(item.cartId, -1)}
                                                className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors border border-slate-200"
                                            >
                                                <Minus size={12} />
                                            </button>
                                            <input 
                                                type="text" 
                                                value={item.qty} 
                                                readOnly
                                                className="w-10 text-center font-bold text-slate-800 bg-transparent text-sm"
                                            />
                                            <button 
                                                onClick={() => updateQty(item.cartId, 1)}
                                                className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors border border-slate-200"
                                            >
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-800 align-middle">
                                        {formatCurrency(item.subtotal)}
                                    </td>
                                    <td className="px-2 py-3 text-center align-middle">
                                        <button 
                                            onClick={() => removeFromCart(item.cartId)}
                                            className="text-red-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="py-32 text-center text-slate-400 italic">
                                    <div className="flex flex-col items-center gap-2">
                                        <ShoppingCart className="opacity-20" size={48} />
                                        <span>Scan barcode or click products to add</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Cart Summary & Actions */}
            <div className="bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                
                {/* Inputs Row */}
                <div className="grid grid-cols-5 gap-0 text-xs border-b border-slate-200 bg-slate-50">
                    <div className="p-3 border-r border-slate-200">
                         <label className="block font-bold text-slate-500 uppercase mb-1">Items</label>
                         <div className="font-mono font-bold text-base text-slate-800">{itemsCount.toFixed(3)} <span className="text-[10px] text-slate-400 font-normal">({cart.length})</span></div>
                    </div>
                    <div className="p-3 border-r border-slate-200">
                        <label className="block font-bold text-slate-500 uppercase mb-1">Total</label>
                        <div className="font-mono font-bold text-base text-slate-800">{formatCurrency(subtotal)}</div>
                    </div>
                    <div className="p-2 border-r border-slate-200">
                         <label className="block font-bold text-slate-500 uppercase mb-1">
                           Discount (-) [F8]{!settings.posEnableDiscount ? ' (Disabled in Settings)' : ''}
                         </label>
                         <input
                           ref={discountInputRef}
                           type="number"
                           className="w-full px-2 py-1 border border-slate-300 rounded text-sm font-bold focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                           placeholder="0.00"
                           value={discount}
                           onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                           disabled={!settings.posEnableDiscount}
                         />
                    </div>
                    <div className="p-2 border-r border-slate-200">
                         <label className="block font-bold text-slate-500 uppercase mb-1">
                           Order Tax (+){!settings.posEnableTax ? ' (Disabled in Settings)' : ''}
                         </label>
                         <input
                           type="number"
                           className="w-full px-2 py-1 border border-slate-300 rounded text-sm font-bold focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                           placeholder="0%"
                           value={taxRate}
                           onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                           disabled={!settings.posEnableTax}
                         />
                    </div>
                    <div className="p-2">
                        <label className="block font-bold text-slate-500 uppercase mb-1">Shipping (+)</label>
                        <input type="number" className="w-full px-2 py-1 border border-slate-300 rounded text-sm font-bold focus:ring-1 focus:ring-blue-500 outline-none" placeholder="0.00" onChange={(e) => setShipping(Number(e.target.value))} />
                    </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-900 text-white">
                     <span className="font-medium text-slate-300 text-sm">Total Payable:</span>
                     <span className="text-2xl font-black tracking-tight">{formatCurrency(Math.max(0, total))}</span>
                </div>

                {/* Action Buttons Grid */}
                <div className="grid grid-cols-4 gap-2 p-3 bg-white">
                    <button className="flex flex-col items-center justify-center py-3 bg-amber-400 hover:bg-amber-500 text-amber-950 rounded-lg transition-all shadow-sm active:scale-95 group">
                        <FileText size={20} className="mb-1 opacity-80 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Draft</span>
                    </button>
                    <button className="flex flex-col items-center justify-center py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-all shadow-sm active:scale-95 group">
                        <FileText size={20} className="mb-1 opacity-90 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Quotation</span>
                    </button>
                    <button className="flex flex-col items-center justify-center py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all shadow-sm active:scale-95 group">
                        <Pause size={20} className="mb-1 opacity-90 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Suspend</span>
                    </button>
                    <button className="flex flex-col items-center justify-center py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all shadow-sm active:scale-95 group">
                        <CreditCard size={20} className="mb-1 opacity-90 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Credit Sale</span>
                    </button>

                    <button className="flex flex-col items-center justify-center py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm active:scale-95 group">
                        <CreditCard size={20} className="mb-1 opacity-90 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Card</span>
                    </button>
                    <button className="flex flex-col items-center justify-center py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-all shadow-sm active:scale-95 group">
                        <LayoutGrid size={20} className="mb-1 opacity-90 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Multi Pay</span>
                    </button>
                    <button 
                        onClick={handleCheckout}
                        className="flex flex-col items-center justify-center py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-sm active:scale-95 group"
                    >
                        <Banknote size={20} className="mb-1 opacity-90 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">{settings.posDefaultPaymentMethod || 'Cash'} [F4]</span>
                    </button>
                    <button 
                        onClick={() => { setCart([]); setDiscount(0); setShipping(0); setTaxRate(0); }}
                        className="flex flex-col items-center justify-center py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all shadow-sm active:scale-95 group"
                    >
                        <XCircle size={20} className="mb-1 opacity-90 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Cancel [F9]</span>
                    </button>
                </div>

            </div>
        </div>

        {/* Right: Product Catalog */}
        <div className="flex-1 bg-slate-100 flex flex-col overflow-hidden relative border-l border-slate-200">
            
            {/* Category/Brand Tabs */}
            <div className="flex bg-white border-b border-slate-200 shadow-sm z-10">
                <button 
                    onClick={() => { setActiveTab('category'); setSelectedFilter('All'); }}
                    className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-4 transition-all ${activeTab === 'category' ? 'border-[#6200ea] text-[#6200ea] bg-purple-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                >
                    <LayoutGrid size={16} /> Category
                </button>
                <button 
                    onClick={() => { setActiveTab('brand'); setSelectedFilter('All'); }}
                    className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-4 transition-all ${activeTab === 'brand' ? 'border-[#6200ea] text-[#6200ea] bg-purple-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                >
                    <Tag size={16} /> Brands
                </button>
            </div>

            {/* Filter Pills */}
            <div className="px-4 py-3 overflow-x-auto whitespace-nowrap bg-white border-b border-slate-200 custom-scrollbar shadow-sm">
                <div className="flex gap-2">
                    {(activeTab === 'category' ? categories : brands).map(item => (
                        <button
                            key={item}
                            onClick={() => setSelectedFilter(item)}
                            className={`px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm border ${
                                selectedFilter === item 
                                ? 'bg-slate-800 text-white border-slate-800' 
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-100">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-20">
                    {filteredProducts.map(product => (
                        <div 
                            key={product.id}
                            onClick={() => addToCart(product)}
                            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md hover:border-blue-400 transition-all group flex flex-col h-full active:scale-95"
                        >
                            <div className="relative aspect-square bg-slate-50 border-b border-slate-100 overflow-hidden p-4">
                                <img src={product.image} alt={product.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300" />
                                <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    Stock: {product.stock}
                                </div>
                            </div>
                            <div className="p-3 flex flex-col flex-1">
                                <h4 className="text-xs font-bold text-slate-700 line-clamp-2 mb-1 h-8 leading-tight">{product.name}</h4>
                                <div className="text-[10px] text-slate-400 mb-2 font-mono">{product.sku}</div>
                                <div className="mt-auto font-black text-slate-900 text-sm">
                                    {formatCurrency(product.sellingPrice)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default POS;
