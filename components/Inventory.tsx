
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, Filter, MoreVertical, Edit, Trash2, Printer, 
  FileText, Download, FileSpreadsheet, Eye, Copy, ChevronDown, 
  Settings, Database, Archive, BarChart3, Tag, MapPin, History, DollarSign,
  Package, Zap, Box, Layers, ArrowUpRight, ArrowDownRight, SlidersHorizontal,
  Columns, ArrowUpDown as ArrowUpDownIcon, Image as ImageIcon, X, AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import ViewProduct from './ViewProduct';
import AddOpeningStock from './AddOpeningStock';
import ProductStockHistory from './ProductStockHistory';
import MultiSelect from './MultiSelect';
import { useGlobalContext, Product } from '../src/context/GlobalContext';

// Utility for currency
const formatOMR = (amount: number) => {
  return `OMR ${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
};

const formatRiyal = (amount: number) => {
   return `${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ريال`;
}

interface StockReportItem {
  id: string;
  sku: string;
  product: string;
  variation: string;
  category: string;
  location: string;
  unitSellingPrice: number;
  currentStock: number;
  unit: string;
  stockValuePurchase: number;
  stockValueSale: number;
  potentialProfit: number;
  totalUnitSold: number;
  totalUnitTransferred: number;
  totalUnitAdjusted: number;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  transformOrigin: string;
}

interface InventoryProps {
    onNavigate: (page: string) => void;
}

const Inventory: React.FC<InventoryProps> = ({ onNavigate }) => {
  const { products, addProduct, updateProduct, deleteProduct: globalDeleteProduct, locations } = useGlobalContext();
  const [view, setView] = useState<'list' | 'view'>('list');
  const [activeTab, setActiveTab] = useState<'all_products' | 'stock_report'>('all_products');
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-right' });
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Modals for Actions
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [productToAction, setProductToAction] = useState<Product | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateSku, setDuplicateSku] = useState('');

  // Filter States
  const [filters, setFilters] = useState({
      productType: [] as string[],
      category: [] as string[],
      unit: [] as string[],
      tax: [] as string[],
      brand: [] as string[],
      businessLocation: [] as string[]
  });

  // View Product Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Product History Modal State
  const [productHistoryOpen, setProductHistoryOpen] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<any>(null);

  // Add Opening Stock Modal State
  const [isAddOpeningStockOpen, setIsAddOpeningStockOpen] = useState(false);
  const [productForOpeningStock, setProductForOpeningStock] = useState<Product | null>(null);

  // Inline Edit State
  const [editingCell, setEditingCell] = useState<{ id: string, field: 'sellingPrice' | 'stock' } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Bulk Actions State
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedProducts(products.map(p => p.id));
    } else {
      setSelectedProducts([]);
    }
  };

  const handleSelectProduct = (id: string) => {
    if (selectedProducts.includes(id)) {
      setSelectedProducts(selectedProducts.filter(pId => pId !== id));
    } else {
      setSelectedProducts([...selectedProducts, id]);
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedProducts.length} products?`)) {
        selectedProducts.forEach(id => globalDeleteProduct(id));
        setSelectedProducts([]);
        setIsBulkActionOpen(false);
    }
  };

  // Mock Data for Stock Report
  const stockReport: StockReportItem[] = [
    { id: '1', sku: '0004', product: 'Kennol 5W-30 (5L)', variation: '', category: 'Engine oil', location: 'CR:1450968', unitSellingPrice: 13.000, currentStock: 239.000, unit: 'Pc(s)', stockValuePurchase: 0.000, stockValueSale: 3107.000, potentialProfit: 3107.000, totalUnitSold: 673.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000 },
    { id: '2', sku: '0006', product: 'Kennol 5W-40 (5L)', variation: '', category: 'Engine oil', location: 'CR:1450968', unitSellingPrice: 13.000, currentStock: 368.000, unit: 'Pc(s)', stockValuePurchase: 0.000, stockValueSale: 4784.000, potentialProfit: 4784.000, totalUnitSold: 782.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000 },
    { id: '3', sku: '0008', product: 'Kennol 0W-20 (5L)', variation: '', category: 'Engine oil', location: 'CR:1450968', unitSellingPrice: 15.000, currentStock: 73.000, unit: 'Pc(s)', stockValuePurchase: 0.000, stockValueSale: 1095.000, potentialProfit: 1095.000, totalUnitSold: 175.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000 },
    { id: '4', sku: '0009', product: 'Kennol 5W-30 (1L)', variation: '', category: 'Engine oil', location: 'CR:1450968', unitSellingPrice: 3.500, currentStock: 728.000, unit: 'Pc(s)', stockValuePurchase: 0.000, stockValueSale: 2548.000, potentialProfit: 2548.000, totalUnitSold: 576.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000 },
    { id: '5', sku: '0010', product: 'Kennol 5W-40 (1L)', variation: '', category: 'Engine oil', location: 'CR:1450968', unitSellingPrice: 3.500, currentStock: 315.000, unit: 'Pc(s)', stockValuePurchase: 0.000, stockValueSale: 1102.500, potentialProfit: 1102.500, totalUnitSold: 730.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000 },
    { id: '6', sku: '0011', product: 'Kennol 0W-20 (1L)', variation: '', category: 'Engine oil', location: 'CR:1450968', unitSellingPrice: 4.000, currentStock: 63.000, unit: 'Pc(s)', stockValuePurchase: 0.000, stockValueSale: 252.000, potentialProfit: 252.000, totalUnitSold: 173.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000 },
    { id: '7', sku: '0012', product: 'Cebican (Daily Care)_20kg', variation: '', category: 'Dry Pet Food', location: 'CR:1450968', unitSellingPrice: 11.000, currentStock: 0.000, unit: 'Pc(s)', stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 939.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 7.000 },
    { id: '8', sku: '0012', product: 'Cebican (Daily Care)_20kg', variation: '', category: 'Dry Pet Food', location: 'KNWZ ARD ALKHALYJ ALMTHDAH', unitSellingPrice: 11.000, currentStock: 0.000, unit: 'Pc(s)', stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 995.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 1.000 },
    { id: '9', sku: '0013', product: 'Garpidog (Adult)', variation: '', category: 'Dry Pet Food', location: 'CR:1450968', unitSellingPrice: 10.000, currentStock: 0.000, unit: 'Pc(s)', stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 74.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000 },
    { id: '10', sku: '0014', product: 'Cebican (High Energy)_20kg', variation: '', category: 'Dry Pet Food', location: 'CR:1450968', unitSellingPrice: 15.000, currentStock: 0.000, unit: 'Pc(s)', stockValuePurchase: 0.000, stockValueSale: 0.000, potentialProfit: 0.000, totalUnitSold: 144.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000 },
    { id: '11', sku: '0014', product: 'Cebican (High Energy)_20kg', variation: '', category: 'Dry Pet Food', location: 'KNWZ ARD ALKHALYJ ALMTHDAH', unitSellingPrice: 15.000, currentStock: 1.000, unit: 'Pc(s)', stockValuePurchase: 33.000, stockValueSale: 15.000, potentialProfit: -18.000, totalUnitSold: 136.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000 },
    { id: '12', sku: '0015', product: 'Cebican (Cat) Mix_20KG', variation: '', category: 'Dry Pet Food', location: 'CR:1450968', unitSellingPrice: 15.000, currentStock: 1.000, unit: 'Pc(s)', stockValuePurchase: 0.000, stockValueSale: 15.000, potentialProfit: 15.000, totalUnitSold: 88.000, totalUnitTransferred: 0.000, totalUnitAdjusted: 0.000 },
  ];

  const toggleActions = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (activeActionId === id) {
      setActiveActionId(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const dropdownHeight = 320; 
      const spaceBelow = window.innerHeight - rect.bottom;
      
      const isDropUp = spaceBelow < dropdownHeight;
      
      setDropdownPosition({
        top: isDropUp ? undefined : rect.bottom + 8,
        bottom: isDropUp ? window.innerHeight - rect.top + 8 : undefined,
        left: rect.left,
        transformOrigin: isDropUp ? 'origin-bottom-left' : 'origin-top-left'
      });
      setActiveActionId(id);
    }
  };

  const handleViewProduct = (product: Product) => {
      setSelectedProduct(product);
      setView('view');
      setActiveActionId(null);
  };

  const handleProductHistory = (product: any) => {
      setSelectedProductForHistory(product);
      setProductHistoryOpen(true);
      setActiveActionId(null);
  }

  const openAddOpeningStock = (product: Product) => {
      setProductForOpeningStock(product);
      setIsAddOpeningStockOpen(true);
      setActiveActionId(null);
  };

  // Action Logic
  const handleEdit = (id: string) => {
      onNavigate(`edit-product/${id}`);
      setActiveActionId(null);
  };

  const openDuplicateModal = (product: Product) => {
      setProductToAction(product);
      setDuplicateName(`${product.name} (Copy)`);
      setDuplicateSku(`${product.sku}-COPY`);
      setIsDuplicateModalOpen(true);
      setActiveActionId(null);
  };

  const executeDuplicate = () => {
      if (!productToAction) return;
      const newProduct: Product = {
          ...productToAction,
          id: `clone-${Date.now()}`,
          name: duplicateName,
          sku: duplicateSku,
          stock: 0 // New duplicate starts with 0 stock
      };
      addProduct(newProduct);
      setIsDuplicateModalOpen(false);
      setProductToAction(null);
  };

  const openDeleteModal = (product: Product) => {
      setProductToAction(product);
      setIsDeleteModalOpen(true);
      setActiveActionId(null);
  };

  const executeDelete = () => {
      if (!productToAction) return;
      globalDeleteProduct(productToAction.id);
      setIsDeleteModalOpen(false);
      setProductToAction(null);
  };

  const handleCellEdit = (product: Product, field: 'sellingPrice' | 'stock') => {
      setEditingCell({ id: product.id, field });
      setEditValue(product[field].toString());
  };

  const handleCellSave = () => {
      if (!editingCell) return;
      const val = parseFloat(editValue);
      if (!isNaN(val)) {
          const product = products.find(p => p.id === editingCell.id);
          if (product) {
              updateProduct({ ...product, [editingCell.field]: val });
          }
      }
      setEditingCell(null);
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          handleCellSave();
      } else if (e.key === 'Escape') {
          setEditingCell(null);
      }
  };

  // Close action menu on scroll or click outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
        if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
            return;
        }
        setActiveActionId(null);
    };

    const handleScroll = () => setActiveActionId(null);
    const handleResize = () => setActiveActionId(null);

    if (activeActionId) {
        window.addEventListener('mousedown', handleOutsideClick);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
    }

    return () => {
        window.removeEventListener('mousedown', handleOutsideClick);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
    };
  }, [activeActionId]);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      
      {view === 'list' ? (
        <>
      {/* 1. Futuristic Header */}
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 p-10 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
            <div className="space-y-2">
                <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-widest border border-white/10 flex items-center gap-2">
                        <Package size={12} className="text-blue-400" /> Inventory 2.0
                    </span>
                    <span className="px-3 py-1 bg-emerald-500/20 backdrop-blur-md rounded-full text-xs font-bold text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                        <Zap size={10} fill="currentColor" /> Live Sync
                    </span>
                </div>
                <h2 className="text-5xl font-black tracking-tighter">Product<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Intelligence</span></h2>
                <p className="text-slate-400 text-lg font-light max-w-xl">
                    Centralized catalog management with real-time stock velocity tracking.
                </p>
            </div>

            <div className="flex items-center gap-6">
                 <div className="hidden lg:flex flex-col items-end border-r border-white/10 pr-6">
                    <span className="text-sm font-bold text-slate-400">Total SKUs</span>
                    <span className="text-3xl font-mono font-bold text-white tracking-tight">{products.length + stockReport.length}</span>
                </div>
                 <div className="hidden lg:flex flex-col items-end mr-2">
                    <span className="text-sm font-bold text-slate-400">Stock Value</span>
                    <span className="text-3xl font-mono font-bold text-emerald-400 tracking-tight">OMR 12.4k</span>
                </div>
                {activeTab === 'all_products' && (
                  <button 
                    onClick={() => onNavigate('add-product')}
                    className="group relative px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-10px_rgba(255,255,255,0.4)] transition-all duration-300 active:scale-95 flex items-center gap-3 overflow-hidden"
                  >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-100 via-white to-blue-100 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      <Plus size={22} className="relative z-10" /> 
                      <span className="relative z-10 text-lg">Add Product</span>
                  </button>
                )}
            </div>
        </div>
      </div>

      {/* 2. Main Interface Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden flex flex-col z-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
        
        {/* Navigation Tabs */}
        <div className="px-8 pt-8 pb-0">
           <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl w-fit border border-slate-200">
                <button 
                    onClick={() => setActiveTab('all_products')}
                    className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                        activeTab === 'all_products' 
                        ? 'bg-white text-slate-900 shadow-md shadow-slate-200' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                >
                    <Database size={16} className={activeTab === 'all_products' ? 'text-blue-600' : ''} />
                    All Products
                </button>
                <button 
                    onClick={() => setActiveTab('stock_report')}
                    className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                        activeTab === 'stock_report' 
                        ? 'bg-white text-slate-900 shadow-md shadow-slate-200' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                >
                    <BarChart3 size={16} className={activeTab === 'stock_report' ? 'text-purple-600' : ''} />
                    Stock Report
                </button>
            </div>
        </div>

        {/* Command Center (Filters & Actions) */}
        <div className="p-8 pb-4">
            <div className="flex flex-col xl:flex-row gap-6 items-center justify-between bg-slate-50/50 p-4 rounded-[1.5rem] border border-slate-200 transition-all">
                 {/* Search */}
                 <div className="relative w-full xl:max-w-md group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search SKU, name, or category..." 
                        className="block w-full pl-14 pr-4 py-4 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-800 placeholder:text-slate-400 shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Report Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    {/* Bulk Actions (Conditional) */}
                    {selectedProducts.length > 0 && (
                        <div className="relative">
                            <button 
                                onClick={() => setIsBulkActionOpen(!isBulkActionOpen)}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-all shadow-sm"
                            >
                                <span>{selectedProducts.length} Selected</span>
                                <ChevronDown size={14} className={`transition-transform duration-300 ${isBulkActionOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isBulkActionOpen && (
                                <div className="absolute top-full mt-2 right-0 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    <button 
                                        onClick={handleBulkDelete}
                                        className="w-full text-left px-4 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors"
                                    >
                                        <Trash2 size={14} /> Delete Selected
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Export Actions Group - Modern Pill Design */}
                    <div className="flex items-center p-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto max-w-full no-scrollbar">
                        {[
                            { icon: FileText, label: 'Export CSV', color: 'hover:text-emerald-600 hover:bg-emerald-50' },
                            { icon: FileSpreadsheet, label: 'Export Excel', color: 'hover:text-emerald-600 hover:bg-emerald-50' },
                            { icon: Printer, label: 'Print', color: 'hover:text-blue-600 hover:bg-blue-50' },
                            { icon: Columns, label: 'Column visibility', color: 'hover:text-purple-600 hover:bg-purple-50' },
                            { icon: FileText, label: 'Export PDF', color: 'hover:text-red-600 hover:bg-red-50' }
                        ].map((action, i) => (
                            <React.Fragment key={i}>
                                <button className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 transition-all whitespace-nowrap ${action.color}`}>
                                    <action.icon size={14} />
                                    <span>{action.label}</span>
                                </button>
                                {i < 4 && <div className="w-px h-4 bg-slate-200 my-auto shrink-0"></div>}
                            </React.Fragment>
                        ))}
                    </div>
                    
                    {/* Filter Button */}
                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold transition-all border shadow-sm ${
                            showFilters 
                            ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                     >
                        <SlidersHorizontal size={16} /> 
                        <span>Filter</span>
                        <ChevronDown size={14} className={`transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Expanded Filter Panel */}
            {showFilters && (
                <div className="mt-4 p-6 bg-slate-50 rounded-[1.5rem] border border-slate-200 animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                         <MultiSelect 
                            label="Product Type"
                            options={['Single', 'Variable', 'Combo']}
                            selected={filters.productType}
                            onChange={(val) => setFilters({...filters, productType: val})}
                        />
                         <MultiSelect 
                            label="Category"
                            options={['Engine Oil', 'Pet Food', 'Sand']}
                            selected={filters.category}
                            onChange={(val) => setFilters({...filters, category: val})}
                        />
                         <MultiSelect 
                            label="Unit"
                            options={['Pieces', 'Box', 'Kg']}
                            selected={filters.unit}
                            onChange={(val) => setFilters({...filters, unit: val})}
                        />
                         <MultiSelect 
                            label="Tax"
                            options={['VAT', 'None']}
                            selected={filters.tax}
                            onChange={(val) => setFilters({...filters, tax: val})}
                        />
                         <MultiSelect 
                            label="Brand"
                            options={['Brand A', 'Brand B']}
                            selected={filters.brand}
                            onChange={(val) => setFilters({...filters, brand: val})}
                        />
                         <MultiSelect 
                            label="Business Location"
                            options={locations.map(loc => loc.name)}
                            selected={filters.businessLocation}
                            onChange={(val) => setFilters({...filters, businessLocation: val})}
                        />

                        <div className="lg:col-span-2 flex items-end pb-1">
                            <label className="flex items-center gap-3 cursor-pointer group bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all w-full">
                                <input type="checkbox" className="w-5 h-5 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500 transition-all" />
                                <span className="text-xs font-bold text-slate-600 group-hover:text-blue-700 transition-colors">Show "Not for selling" only</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Table Content Switch */}
        {activeTab === 'all_products' ? (
            <div className="overflow-x-auto min-h-[600px] px-2">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 w-12 text-center">
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                    checked={selectedProducts.length === products.length && products.length > 0}
                                    onChange={handleSelectAll}
                                />
                            </th>
                            <th className="px-4 py-3 w-24">Product image</th>
                            <th className="px-4 py-3 text-center w-24">Action</th>
                            <th className="px-4 py-3">Product</th>
                            <th className="px-4 py-3">Business Location</th>
                            <th className="px-4 py-3 text-right" title="Click a value to edit">Selling Price ✎</th>
                            <th className="px-4 py-3 text-right" title="Click a value to edit">Current stock ✎</th>
                            <th className="px-4 py-3">Product Type</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Brand</th>
                            <th className="px-4 py-3">Tax</th>
                            <th className="px-4 py-3">SKU</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {products.map((product) => (
                            <tr key={product.id} className={`group transition-all duration-300 relative text-sm ${selectedProducts.includes(product.id) ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'}`}>
                                <td className="px-4 py-3 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                        checked={selectedProducts.includes(product.id)}
                                        onChange={() => handleSelectProduct(product.id)}
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm group-hover:scale-105 transition-transform duration-300">
                                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <button 
                                        onClick={(e) => toggleActions(e, product.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 mx-auto transition-all duration-200 ${
                                            activeActionId === product.id 
                                            ? 'bg-slate-900 text-white shadow-lg scale-105' 
                                            : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50'
                                        }`}
                                    >
                                        Actions <ChevronDown size={10} />
                                    </button>
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-800">{product.name}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs">{product.businessLocation}</td>
                                <td 
                                    className="px-4 py-3 text-right font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleCellEdit(product, 'sellingPrice')}
                                >
                                    {editingCell?.id === product.id && editingCell.field === 'sellingPrice' ? (
                                        <input 
                                            type="number" 
                                            className="w-24 text-right px-2 py-1 border border-blue-500 rounded outline-none"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleCellSave}
                                            onKeyDown={handleCellKeyDown}
                                            autoFocus
                                        />
                                    ) : (
                                        formatOMR(product.sellingPrice)
                                    )}
                                </td>
                                <td 
                                    className="px-4 py-3 text-right font-medium text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleCellEdit(product, 'stock')}
                                >
                                    {editingCell?.id === product.id && editingCell.field === 'stock' ? (
                                        <input 
                                            type="number" 
                                            className="w-20 text-right px-2 py-1 border border-blue-500 rounded outline-none"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleCellSave}
                                            onKeyDown={handleCellKeyDown}
                                            autoFocus
                                        />
                                    ) : (
                                        <>{product.stock.toFixed(3)} {product.unit}</>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                        {product.type}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{product.category}</td>
                                <td className="px-4 py-3 text-slate-600">{product.brand}</td>
                                <td className="px-4 py-3 text-slate-500">{product.tax}</td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-500">{product.sku}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
             <div className="overflow-x-auto min-h-[600px] px-2">
                <table className="w-full text-[11px] text-left border-collapse">
                    <thead className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white">Action</th>
                            <th className="px-6 py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white">SKU <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-6 py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white">Product <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-6 py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white">Variation <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-6 py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white">Category <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-6 py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white">Location</th>
                            <th className="px-6 py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white text-right">Unit Selling Price <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-6 py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white text-right">Current stock <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-6 py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white text-right">Stock Value <br/>(Purchase) <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-6 py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white text-right">Stock Value <br/>(Sale) <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-6 py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white text-right">Profit Potential</th>
                            <th className="px-6 py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white text-right">Total Sold <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-6 py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white text-right">Transferred <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-6 py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white text-right">Adjusted <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {stockReport.map((item, idx) => (
                            <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                <td className="px-6 py-4">
                                    <button 
                                        onClick={() => handleProductHistory(item)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-50 hover:border-indigo-200 shadow-sm whitespace-nowrap transition-all"
                                    >
                                        <History size={10} /> History
                                    </button>
                                </td>
                                <td className="px-6 py-4 font-mono font-bold text-slate-500">{item.sku}</td>
                                <td className="px-6 py-4 font-bold text-slate-700">{item.product}</td>
                                <td className="px-6 py-4 text-slate-500 italic">{item.variation || '-'}</td>
                                <td className="px-6 py-4 text-slate-600">{item.category}</td>
                                <td className="px-6 py-4 text-slate-500 truncate max-w-[120px]" title={item.location}>{item.location}</td>
                                <td className="px-6 py-4 text-right font-medium text-slate-700 whitespace-nowrap">{formatRiyal(item.unitSellingPrice)}</td>
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                    <span className="font-bold text-slate-800">{item.currentStock.toFixed(3)}</span> <span className="text-[10px] text-slate-400">{item.unit}</span>
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap text-slate-500">{formatRiyal(item.stockValuePurchase)}</td>
                                <td className="px-6 py-4 text-right whitespace-nowrap text-slate-500">{formatRiyal(item.stockValueSale)}</td>
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                    <span className={`font-bold ${item.potentialProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {formatRiyal(item.potentialProfit)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                    <span className="font-medium text-slate-700">{item.totalUnitSold.toFixed(3)}</span>
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap text-slate-500">
                                    {item.totalUnitTransferred.toFixed(3)}
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap text-slate-500">
                                    {item.totalUnitAdjusted.toFixed(3)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold text-slate-800 border-t border-slate-200 sticky bottom-0 z-10 shadow-inner">
                        <tr>
                            <td colSpan={8} className="px-6 py-4 text-right uppercase text-xs tracking-wider text-slate-500">Total Aggregated:</td>
                            <td className="px-6 py-4 text-right font-mono text-slate-700">{formatRiyal(44.200)}</td>
                            <td className="px-6 py-4 text-right font-mono text-slate-700">{formatRiyal(12933.500)}</td>
                            <td className="px-6 py-4 text-right font-mono text-emerald-700">{formatRiyal(12889.300)}</td>
                            <td className="px-6 py-4 text-right font-mono text-slate-700">4521.000</td>
                            <td className="px-6 py-4 text-right font-mono text-slate-700">0.000</td>
                            <td className="px-6 py-4 text-right font-mono text-slate-700">8.000</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        )}
      </div>

      {/* Action Menu Portal */}
      {activeActionId && createPortal(
        <div 
            ref={dropdownRef}
            className={`fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 py-2 w-48 animate-in fade-in zoom-in-95 duration-200 ${dropdownPosition.transformOrigin}`}
            style={{ top: dropdownPosition.top, left: dropdownPosition.left, bottom: dropdownPosition.bottom }}
        >
            <div className="px-4 py-2 border-b border-slate-50 mb-1">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Actions</span>
            </div>
            
            <button 
                onClick={() => onNavigate('print-labels')}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <Tag size={16} className="text-blue-500" /> Labels
            </button>
            <button 
                onClick={() => {
                    const product = products.find(p => p.id === activeActionId);
                    if (product) handleViewProduct(product);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <Eye size={16} className="text-emerald-500" /> View
            </button>
            <button 
                onClick={() => handleEdit(activeActionId!)}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <Edit size={16} className="text-amber-500" /> Edit
            </button>
            <button 
                onClick={() => {
                   const product = products.find(p => p.id === activeActionId);
                    if (product) handleProductHistory(product);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <History size={16} className="text-purple-500" /> History
            </button>
            <button 
                onClick={() => {
                    const product = products.find(p => p.id === activeActionId);
                    if (product) openDuplicateModal(product);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <Copy size={16} className="text-cyan-500" /> Duplicate
            </button>
            <button 
                onClick={() => {
                    const product = products.find(p => p.id === activeActionId);
                    if (product) openAddOpeningStock(product);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <Plus size={16} className="text-green-600" /> Add or edit opening stock
            </button>
            
            <div className="h-px bg-slate-100 my-1 mx-2"></div>
            
            <button 
                onClick={() => {
                    const product = products.find(p => p.id === activeActionId);
                    if (product) openDeleteModal(product);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-3 transition-colors"
            >
                <Trash2 size={16} /> Delete
            </button>
        </div>,
        document.body
      )}
      </>
      ) : (
        <ViewProduct 
          onBack={() => setView('list')} 
          product={selectedProduct}
        />
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && productToAction && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 text-center">
                      <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Trash2 size={32} />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 mb-2">Delete Product?</h3>
                      <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                          Are you sure you want to delete <span className="font-bold text-slate-800">"{productToAction.name}"</span>? 
                          This action cannot be undone and will remove it from all locations.
                      </p>
                      <div className="flex gap-3">
                          <button 
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                          >
                              Cancel
                          </button>
                          <button 
                            onClick={executeDelete}
                            className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-900/20"
                          >
                              Delete Product
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Duplicate Modal */}
      {isDuplicateModalOpen && productToAction && (
           <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6">
                      <div className="flex justify-between items-center mb-6">
                           <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                               <Copy size={20} className="text-cyan-500" /> Duplicate Product
                           </h3>
                           <button onClick={() => setIsDuplicateModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                      </div>
                      
                      <div className="space-y-4">
                           <div className="group">
                               <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">New Product Name</label>
                               <input 
                                    type="text"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none text-sm font-bold text-slate-800"
                                    value={duplicateName}
                                    onChange={(e) => setDuplicateName(e.target.value)}
                               />
                           </div>
                           <div className="group">
                               <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">New SKU</label>
                               <input 
                                    type="text"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none text-sm font-mono text-slate-700"
                                    value={duplicateSku}
                                    onChange={(e) => setDuplicateSku(e.target.value)}
                               />
                           </div>
                      </div>

                      <div className="mt-8 flex gap-3">
                          <button 
                            onClick={() => setIsDuplicateModalOpen(false)}
                            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                          >
                              Cancel
                          </button>
                          <button 
                            onClick={executeDuplicate}
                            className="flex-1 px-4 py-3 bg-cyan-600 text-white rounded-xl text-xs font-bold hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-900/20"
                          >
                              Confirm Duplicate
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}



       {/* Product History Modal */}
      <ProductStockHistory
        isOpen={productHistoryOpen}
        onClose={() => setProductHistoryOpen(false)}
        product={selectedProductForHistory}
      />

      {/* Add Opening Stock Modal */}
      <AddOpeningStock
        isOpen={isAddOpeningStockOpen}
        onClose={() => setIsAddOpeningStockOpen(false)}
        product={productForOpeningStock}
      />

    </div>
  );
};

export default Inventory;
