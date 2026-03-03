import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, Printer, Download, ChevronDown, 
  ArrowUpDown, Edit, Ban, ShoppingBag, X,
  CreditCard, Eye, SlidersHorizontal, FileText, Sparkles,
  Filter, MoreVertical, Phone, Mail, MapPin, Settings,
  BarChart3, StickyNote, Activity, Banknote, CheckCircle2
} from 'lucide-react';
import MultiSelect from './MultiSelect';
import { useGlobalContext, Supplier as GlobalSupplier } from '../src/context/GlobalContext';

// Utility for currency
const formatOMR = (amount: number) => {
  return `OMR ${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
};

interface Supplier {
  id: string; // Contact ID
  businessName: string;
  name: string; // Name (Contact Person)
  email: string;
  taxNumber: string;
  payTerm: string;
  openingBalance: number;
  advanceBalance: number;
  addedOn: string;
  address: string;
  mobile: string;
  totalPurchaseDue: number;
  totalReturnDue: number;
  status: 'Active' | 'Inactive';
  assignedTo?: string;
  purchaseStatus?: string;
  customValues?: Record<string, string>;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  transformOrigin: string;
}

const initialSuppliers: Supplier[] = [
  {
    id: 'SUP-1001',
    businessName: 'Oman Oil Marketing Co.',
    name: 'Ahmed Al-Balushi',
    email: 'sales@oomco.com',
    taxNumber: 'OM12345678',
    payTerm: 'Net 30',
    openingBalance: 0,
    advanceBalance: 500.000,
    addedOn: '2023-01-15',
    address: 'PO Box 123, Muscat',
    mobile: '+968 9988 7766',
    totalPurchaseDue: 4500.000,
    totalReturnDue: 0,
    status: 'Active',
    assignedTo: 'Admin',
    purchaseStatus: 'Received'
  },
  {
    id: 'SUP-1002',
    businessName: 'Global Pet Supplies LLC',
    name: 'Sarah Jenkins',
    email: 'sarah@globalpet.com',
    taxNumber: 'OM87654321',
    payTerm: 'Net 15',
    openingBalance: 150.000,
    advanceBalance: 0,
    addedOn: '2023-03-22',
    address: 'Rusayl Industrial Estate',
    mobile: '+968 9123 4567',
    totalPurchaseDue: 1250.500,
    totalReturnDue: 50.000,
    status: 'Active',
    assignedTo: 'Sales Rep 1',
    purchaseStatus: 'Pending'
  },
  {
    id: 'SUP-1003',
    businessName: 'Al Maha Ceramics',
    name: 'Mohammed Al-Lawati',
    email: 'procurement@almaha.com',
    taxNumber: 'OM11223344',
    payTerm: 'Cash',
    openingBalance: 0,
    advanceBalance: 0,
    addedOn: '2023-06-10',
    address: 'Sohar Port Freezone',
    mobile: '+968 9876 5432',
    totalPurchaseDue: 0,
    totalReturnDue: 0,
    status: 'Inactive',
    assignedTo: 'Admin',
    purchaseStatus: 'Ordered'
  },
  {
    id: 'SUP-1004',
    businessName: 'Kennol Performance Oil',
    name: 'Jean Pierre',
    email: 'export@kennol.com',
    taxNumber: 'OM55667788',
    payTerm: 'Net 60',
    openingBalance: 2000.000,
    advanceBalance: 1000.000,
    addedOn: '2023-08-05',
    address: 'Ghala Industrial Area',
    mobile: '+968 9555 4433',
    totalPurchaseDue: 12000.000,
    totalReturnDue: 0,
    status: 'Active',
    assignedTo: 'Sales Rep 2',
    purchaseStatus: 'Received'
  },
];

interface SuppliersProps {
    onNavigate: (page: string) => void;
}

const Suppliers: React.FC<SuppliersProps> = ({ onNavigate }) => {
  // Pull ALL suppliers from GlobalContext — single source of truth
  const {
    suppliers: globalSuppliers,
    addSupplier: globalAddSupplier,
    updateSupplier: globalUpdateSupplier,
    deleteSupplier: globalDeleteSupplier,
    users,
    currentUser,
  } = useGlobalContext();

  const suppliers = globalSuppliers;
  const setSuppliers = (_fn: any) => {}; // no-op stub — all mutations go through context

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [customColumns, setCustomColumns] = useState<string[]>([]);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-right' });
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Custom Field UX State
  const [isAddingCustomField, setIsAddingCustomField] = useState(false);
  const [newCustomFieldName, setNewCustomFieldName] = useState('');

  // Filter States
  const [filters, setFilters] = useState({
      assignedTo: [] as string[],
      status: [] as string[],
      // Checkbox filters
      purchaseDue: false,
      purchaseReturn: false,
      advanceBalance: false,
      openingBalance: false
  });

  // Confirmation Modal State
  const [confirmationModal, setConfirmationModal] = useState<{
      isOpen: boolean;
      type: 'deactivate' | 'activate';
      supplierId: string | null;
      supplierName: string;
  }>({
      isOpen: false,
      type: 'deactivate',
      supplierId: null,
      supplierName: ''
  });

  // Form State
  const [formData, setFormData] = useState<Partial<Supplier>>({
    customValues: {}
  });

  // GlobalContext handles localStorage persistence — no need to duplicate here

  const confirmAddCustomField = () => {
    const trimmedName = newCustomFieldName.trim();
    if (trimmedName && !customColumns.includes(trimmedName)) {
        setCustomColumns([...customColumns, trimmedName]);
        setNewCustomFieldName('');
        setIsAddingCustomField(false);
    } else if (!trimmedName) {
        setIsAddingCustomField(false);
    } else {
        alert('Field already exists!');
    }
  };

  const removeCustomField = (fieldToRemove: string) => {
    if (confirm(`Remove custom field "${fieldToRemove}"?`)) {
        setCustomColumns(customColumns.filter(col => col !== fieldToRemove));
        if (formData.customValues) {
            const newValues = { ...formData.customValues };
            delete newValues[fieldToRemove];
            setFormData({ ...formData, customValues: newValues });
        }
    }
  };

  const handleInputChange = (field: keyof Supplier, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCustomFieldChange = (field: string, value: string) => {
    setFormData(prev => ({
        ...prev,
        customValues: {
            ...prev.customValues,
            [field]: value
        }
    }));
  };

  const handleSaveSupplier = () => {
    if (!formData.businessName || !formData.mobile) {
        alert("Please fill in required fields: Business Name and Mobile");
        return;
    }

    const isEdit = !!(formData as any).id && suppliers.some(s => s.id === (formData as any).id);
    const existing = isEdit ? suppliers.find(s => s.id === (formData as any).id) : null;

    const supplierData: GlobalSupplier = {
        id: (formData as any).id || `SUP-${Math.floor(2000 + Math.random() * 8000)}`,
        type: 'Supplier',
        businessName: formData.businessName!,
        name: formData.name || '',
        email: formData.email || '',
        mobile: formData.mobile!,
        taxNumber: formData.taxNumber || '',
        payTerm: formData.payTerm || 'Net 30',
        openingBalance: Number(formData.openingBalance) || 0,
        advanceBalance: isEdit ? (existing?.advanceBalance ?? 0) : 0,
        addedOn: isEdit ? (existing?.addedOn || new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
        address: formData.address || '',
        totalPurchaseDue: isEdit ? (existing?.totalPurchaseDue ?? 0) : 0,
        totalReturnDue: isEdit ? (existing?.totalReturnDue ?? 0) : 0,
        status: formData.status || 'Active',
        customValues: formData.customValues || {},
        assignedTo: formData.assignedTo || currentUser?.name || 'Admin',
        purchaseStatus: formData.purchaseStatus || 'Ordered',
    };

    if (isEdit) {
        globalUpdateSupplier(supplierData);
    } else {
        globalAddSupplier(supplierData);
    }

    setFormData({ customValues: {} });
    setIsAddModalOpen(false);
  };

  const handleEdit = (id: string) => {
      const supplierToEdit = suppliers.find(s => s.id === id);
      if (supplierToEdit) {
          setFormData({ ...supplierToEdit });
          setIsAddModalOpen(true);
          setActiveActionId(null);
      }
  };

  const handleToggleStatus = (id: string) => {
    const supplier = suppliers.find(s => s.id === id);
    if (!supplier) return;

    const action = supplier.status === 'Active' ? 'deactivate' : 'activate';
    
    setConfirmationModal({
        isOpen: true,
        type: action,
        supplierId: supplier.id,
        supplierName: supplier.businessName
    });
    setActiveActionId(null);
  };

  const executeConfirmation = () => {
      if (!confirmationModal.supplierId) return;

      const supplier = suppliers.find(s => s.id === confirmationModal.supplierId);
      if (supplier) {
          globalUpdateSupplier({
              ...supplier,
              status: confirmationModal.type === 'deactivate' ? 'Inactive' : 'Active'
          });
      }
      setConfirmationModal({ isOpen: false, type: 'deactivate', supplierId: null, supplierName: '' });
  };

  const toggleActions = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (activeActionId === id) {
      setActiveActionId(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const dropdownHeight = 480; // Approximate height for items
      const dropdownWidth = 224; // w-56 = 224px
      const spaceBelow = window.innerHeight - rect.bottom;
      const isDropUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
      
      let leftPos = rect.right - dropdownWidth;
      if (leftPos < 10) leftPos = 10;
      
      setDropdownPosition({
        top: isDropUp ? undefined : rect.bottom + 4,
        bottom: isDropUp ? window.innerHeight - rect.top + 4 : undefined,
        left: leftPos,
        transformOrigin: isDropUp ? 'origin-bottom-right' : 'origin-top-right'
      });
      setActiveActionId(id);
    }
  };

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

  // --- Filtering Logic ---
  const filteredSuppliers = suppliers.filter(supplier => {
    // 1. Search Filter
    const matchesSearch = 
        supplier.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.mobile.includes(searchTerm) ||
        supplier.id.toLowerCase().includes(searchTerm.toLowerCase());

    // 2. Status Filter
    const matchesStatus = filters.status.length === 0 || filters.status.includes(supplier.status);

    // 3. Assigned To Filter
    const matchesAssignedTo = filters.assignedTo.length === 0 || (supplier.assignedTo && filters.assignedTo.includes(supplier.assignedTo));

    // 4. New Checkbox Logic
    const matchesPurchaseDue = !filters.purchaseDue || supplier.totalPurchaseDue > 0;
    const matchesPurchaseReturn = !filters.purchaseReturn || supplier.totalReturnDue > 0;
    const matchesAdvanceBalance = !filters.advanceBalance || supplier.advanceBalance > 0;
    const matchesOpeningBalance = !filters.openingBalance || supplier.openingBalance > 0;

    return matchesSearch && matchesStatus && matchesAssignedTo && matchesPurchaseDue && matchesPurchaseReturn && matchesAdvanceBalance && matchesOpeningBalance;
  });

  return (
    <div className="space-y-6 animate-fade-in relative pb-10">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Suppliers</h2>
          <p className="text-slate-500 mt-2 text-lg font-light">
            Manage vendor relationships, track balances, and purchasing history.
          </p>
        </div>
        <div className="flex gap-3">
            <button className="bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition flex items-center gap-2 shadow-sm hover:shadow-md">
                <Printer size={16} /> 
            </button>
            <button className="bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition flex items-center gap-2 shadow-sm hover:shadow-md">
                <Download size={16} /> 
            </button>
            <button 
                onClick={() => {
                    setFormData({ customValues: {} });
                    setIsAddModalOpen(true);
                }}
                className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
            >
                <Plus size={18} /> Add Supplier
            </button>
        </div>
      </div>

      {/* 2. Main Content Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative z-0">
        
        {/* Toolbar & Filters */}
        <div className="p-5 border-b border-slate-100 space-y-4 bg-slate-50/50">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                {/* Search */}
                <div className="relative flex-1 w-full md:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search supplier name, ID, or mobile..." 
                        className="w-full pl-11 pr-4 py-3 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:shadow-md transition-all placeholder:text-slate-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    {/* Filter Toggle */}
                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${showFilters ? 'bg-slate-200 text-slate-900 border-slate-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                        <Filter size={16} /> Filters
                        <ChevronDown size={14} className={`transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Expanded Filters Area */}
            {showFilters && (
                <div className="pt-4 animate-in slide-in-from-top-2 fade-in duration-200 border-t border-slate-100 mt-2">
                    
                    {/* Checkboxes Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                        <div className="flex items-center gap-3 group cursor-pointer">
                             <input 
                                type="checkbox" 
                                id="purchaseDue" 
                                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                checked={filters.purchaseDue}
                                onChange={(e) => setFilters({ ...filters, purchaseDue: e.target.checked })}
                            />
                            <label htmlFor="purchaseDue" className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded shadow-sm hover:bg-blue-700 transition-colors cursor-pointer select-none">
                                Purchase Due
                            </label>
                        </div>

                        <div className="flex items-center gap-3 group cursor-pointer">
                             <input 
                                type="checkbox" 
                                id="purchaseReturn" 
                                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                checked={filters.purchaseReturn}
                                onChange={(e) => setFilters({ ...filters, purchaseReturn: e.target.checked })}
                            />
                            <label htmlFor="purchaseReturn" className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded shadow-sm hover:bg-blue-700 transition-colors cursor-pointer select-none">
                                Purchase Return
                            </label>
                        </div>

                        <div className="flex items-center gap-3 group cursor-pointer">
                             <input 
                                type="checkbox" 
                                id="advanceBalance" 
                                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                checked={filters.advanceBalance}
                                onChange={(e) => setFilters({ ...filters, advanceBalance: e.target.checked })}
                            />
                            <label htmlFor="advanceBalance" className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded shadow-sm hover:bg-blue-700 transition-colors cursor-pointer select-none">
                                Advance Balance
                            </label>
                        </div>

                         <div className="flex items-center gap-3 group cursor-pointer">
                             <input 
                                type="checkbox" 
                                id="openingBalance" 
                                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                checked={filters.openingBalance}
                                onChange={(e) => setFilters({ ...filters, openingBalance: e.target.checked })}
                            />
                            <label htmlFor="openingBalance" className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded shadow-sm hover:bg-blue-700 transition-colors cursor-pointer select-none">
                                Opening Balance
                            </label>
                        </div>
                    </div>

                    {/* Dropdowns Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="col-span-1">
                            <MultiSelect
                                label="Assigned To"
                                options={users.length > 0 ? users.map(u => u.name) : ['Admin', 'Sales Rep 1', 'Sales Rep 2']}
                                selected={filters.assignedTo}
                                onChange={(val) => setFilters({...filters, assignedTo: val})}
                            />
                        </div>
                        <div className="col-span-1">
                            <MultiSelect 
                                label="Status"
                                options={['Active', 'Inactive']}
                                selected={filters.status}
                                onChange={(val) => setFilters({...filters, status: val})}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10 text-slate-500 font-semibold border-b border-slate-200 whitespace-nowrap">
              <tr>
                <th className="px-6 py-4 w-[100px] text-center text-xs font-black uppercase tracking-wider text-slate-500 bg-slate-50/90">
                    Action
                </th>
                <th className="px-6 py-4 min-w-[140px] cursor-pointer hover:text-slate-800 transition-colors group">
                     <div className="flex items-center gap-1">
                        Contact ID <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </th>
                <th className="px-6 py-4 min-w-[180px]">Business Name</th>
                <th className="px-6 py-4 min-w-[150px]">Contact Person</th>
                <th className="px-6 py-4 min-w-[180px]">Email Address</th>
                <th className="px-6 py-4 min-w-[120px]">Tax Number</th>
                <th className="px-6 py-4 min-w-[120px]">Pay Term</th>
                <th className="px-6 py-4 min-w-[130px] text-right">Opening Bal.</th>
                <th className="px-6 py-4 min-w-[130px] text-right">Advance Bal.</th>
                <th className="px-6 py-4 min-w-[150px] text-right">Total Due</th>
                <th className="px-6 py-4 min-w-[150px] text-right">Return Due</th>
                <th className="px-6 py-4 min-w-[120px]">Status</th>
                {customColumns.map((col) => (
                    <th key={col} className="px-6 py-4 whitespace-nowrap text-blue-600 bg-blue-50/30 border-l border-blue-100">
                        {col}
                    </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.length > 0 ? (
                  filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-slate-50/80 transition-all duration-200 group">
                       {/* Action Column */}
                       <td className="px-4 py-3 text-center">
                        <button 
                            onClick={(e) => toggleActions(e, supplier.id)}
                            className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 mx-auto transition-all duration-200 ${
                                activeActionId === supplier.id 
                                ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                                : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                            }`}
                        >
                            Actions <ChevronDown size={10} />
                        </button>
                      </td>

                      <td className="px-6 py-4">
                          <div className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit">
                              {supplier.id}
                          </div>
                      </td>
                      <td className="px-6 py-4">
                          <div className="flex flex-col">
                              <span className="font-bold text-slate-900">{supplier.businessName}</span>
                              <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                  <MapPin size={10} /> {supplier.address.split(',')[0]}
                              </span>
                          </div>
                      </td>
                      <td className="px-6 py-4">
                          <div className="flex flex-col">
                              <span className="text-slate-700 font-medium">{supplier.name}</span>
                              <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Phone size={10} /> {supplier.mobile}
                              </span>
                          </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{supplier.email}</td>
                      <td className="px-6 py-4 font-mono text-slate-600 text-xs">{supplier.taxNumber}</td>
                      <td className="px-6 py-4 text-slate-600">{supplier.payTerm}</td>
                      <td className="px-6 py-4 text-right text-slate-700 font-medium">{formatOMR(supplier.openingBalance)}</td>
                      <td className="px-6 py-4 text-right text-emerald-600 font-medium">{formatOMR(supplier.advanceBalance)}</td>
                      <td className="px-6 py-4 text-right">
                          <span className={`font-bold ${supplier.totalPurchaseDue > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                              {formatOMR(supplier.totalPurchaseDue)}
                          </span>
                      </td>
                      <td className="px-6 py-4 text-right text-amber-600 font-medium">{formatOMR(supplier.totalReturnDue)}</td>
                      <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              supplier.status === 'Active' 
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                              {supplier.status}
                          </span>
                      </td>
                      
                      {/* Custom Fields */}
                      {customColumns.map((col) => (
                        <td key={`${supplier.id}-${col}`} className="px-6 py-4 text-slate-600 border-l border-r border-dashed border-slate-100 bg-slate-50/20">
                            {supplier.customValues && supplier.customValues[col] ? (
                                <span className="font-medium text-slate-800">{supplier.customValues[col]}</span>
                            ) : (
                                <span className="text-slate-300 italic text-xs">--</span>
                            )}
                        </td>
                      ))}
                    </tr>
                  ))
              ) : (
                  <tr>
                      <td colSpan={12 + customColumns.length} className="px-6 py-12 text-center text-slate-400 italic">
                          No suppliers found matching your criteria.
                      </td>
                  </tr>
              )}
            </tbody>
            {/* Table Footer with Totals */}
             <tfoot className="bg-slate-50/80 backdrop-blur-sm font-bold text-slate-700 text-xs uppercase border-t border-slate-200 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <tr>
                    <td colSpan={7} className="px-4 py-4 text-right">Grand Total:</td>
                    <td className="px-6 py-4 text-right">{formatOMR(filteredSuppliers.reduce((a, c) => a + c.openingBalance, 0))}</td>
                    <td className="px-6 py-4 text-right text-emerald-700">{formatOMR(filteredSuppliers.reduce((a, c) => a + c.advanceBalance, 0))}</td>
                    <td className="px-6 py-4 text-right text-red-700">{formatOMR(filteredSuppliers.reduce((a, c) => a + c.totalPurchaseDue, 0))}</td>
                    <td className="px-6 py-4 text-right text-amber-700">{formatOMR(filteredSuppliers.reduce((a, c) => a + c.totalReturnDue, 0))}</td>
                    <td colSpan={1 + customColumns.length}></td>
                </tr>
            </tfoot>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-slate-50/50">
          <span>Showing 1 to {filteredSuppliers.length} of {filteredSuppliers.length} entries</span>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm" disabled>Previous</button>
            <button className="px-4 py-2 bg-slate-900 text-white rounded-lg shadow-md shadow-slate-900/10">1</button>
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm" disabled>Next</button>
          </div>
        </div>
      </div>

      {/* Add/Edit Supplier Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full rounded-2xl shadow-2xl max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-100">
                {/* Modal Header */}
                <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{formData.id ? 'Edit Supplier' : 'Add New Supplier'}</h3>
                        <p className="text-slate-500 text-sm mt-1">Fill in the details below to register a new vendor.</p>
                    </div>
                    <button 
                        onClick={() => setIsAddModalOpen(false)} 
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>
                
                {/* Modal Body */}
                <div className="overflow-y-auto p-8 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Column 1 */}
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">Contact Type</label>
                                <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="type" defaultChecked className="w-4 h-4 text-red-600 focus:ring-red-500 border-slate-300" />
                                        <span className="text-sm font-medium text-slate-700">Supplier</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="type" className="w-4 h-4 text-red-600 focus:ring-red-500 border-slate-300" />
                                        <span className="text-sm font-medium text-slate-700">Individual</span>
                                    </label>
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Contact ID <span className="text-slate-300 font-normal normal-case">(Auto-generated)</span></label>
                                <input 
                                    type="text" 
                                    placeholder="Leave blank to auto-generate" 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all text-sm font-medium placeholder:text-slate-400"
                                    value={formData.id || ''}
                                    onChange={(e) => handleInputChange('id', e.target.value)}
                                    disabled={!!formData.id && suppliers.some(s => s.id === formData.id)} // Disable edit of ID if existing
                                />
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Business Name <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Acme Corp" 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800"
                                    value={formData.businessName || ''}
                                    onChange={(e) => handleInputChange('businessName', e.target.value)}
                                />
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Contact Person <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    placeholder="Full Name" 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium"
                                    value={formData.name || ''}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Column 2 */}
                        <div className="space-y-6">
                             <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Email Address</label>
                                <input 
                                    type="email" 
                                    placeholder="name@company.com" 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all text-sm font-medium"
                                    value={formData.email || ''}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                />
                            </div>

                             <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Tax Number</label>
                                <input 
                                    type="text" 
                                    placeholder="VAT / Tax ID" 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all text-sm font-medium"
                                    value={formData.taxNumber || ''}
                                    onChange={(e) => handleInputChange('taxNumber', e.target.value)}
                                />
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Pay Term</label>
                                <div className="flex gap-2">
                                    <input type="number" placeholder="Days" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all text-sm font-medium" />
                                    <select className="px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all text-sm font-medium cursor-pointer">
                                        <option>Days</option>
                                        <option>Months</option>
                                    </select>
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Assigned To</label>
                                <div className="relative">
                                    <select 
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all text-sm font-medium cursor-pointer appearance-none"
                                        value={formData.assignedTo || ''}
                                        onChange={(e) => handleInputChange('assignedTo', e.target.value)}
                                    >
                                        <option value="">Select User</option>
                                        <option value="Admin">Admin</option>
                                        <option value="Sales Rep 1">Sales Rep 1</option>
                                        <option value="Sales Rep 2">Sales Rep 2</option>
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                </div>
                            </div>

                             <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Opening Balance</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">OMR</span>
                                    <input 
                                        type="number" 
                                        placeholder="0.000" 
                                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all text-sm font-medium"
                                        value={formData.openingBalance || ''}
                                        onChange={(e) => handleInputChange('openingBalance', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Column 3 */}
                        <div className="space-y-6">
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Advance Balance</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">OMR</span>
                                    <input 
                                        type="number" 
                                        placeholder="0.000" 
                                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all text-sm font-medium"
                                        value={formData.advanceBalance || ''}
                                        onChange={(e) => handleInputChange('advanceBalance', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Added On</label>
                                <input 
                                    type="date" 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all text-sm font-medium text-slate-600"
                                    defaultValue={new Date().toISOString().split('T')[0]}
                                />
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Mobile <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    placeholder="+968" 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all text-sm font-medium"
                                    value={formData.mobile || ''}
                                    onChange={(e) => handleInputChange('mobile', e.target.value)}
                                />
                            </div>
                            
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Address</label>
                                <textarea 
                                    placeholder="Street, City, Building..." 
                                    rows={3} 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all text-sm font-medium resize-none"
                                    value={formData.address || ''}
                                    onChange={(e) => handleInputChange('address', e.target.value)}
                                ></textarea>
                            </div>
                        </div>
                    </div>

                    {/* Custom Fields Section */}
                    <div className="mt-8 pt-8 border-t border-slate-100">
                        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                        <SlidersHorizontal size={18} className="text-blue-600" /> 
                                        Custom Fields
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-1">Add specific attributes to this supplier.</p>
                                </div>
                                {!isAddingCustomField && (
                                    <button 
                                        onClick={() => setIsAddingCustomField(true)}
                                        type="button"
                                        className="text-xs flex items-center gap-2 bg-white text-blue-600 border border-blue-200 font-bold hover:bg-blue-50 hover:border-blue-300 px-4 py-2 rounded-lg transition-all shadow-sm"
                                    >
                                        <Plus size={14} /> Add Field
                                    </button>
                                )}
                            </div>
                            
                            {isAddingCustomField && (
                                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mb-4 animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-xs font-bold text-blue-800 mb-2">New Field Name</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={newCustomFieldName}
                                            onChange={(e) => setNewCustomFieldName(e.target.value)}
                                            placeholder="e.g. Region, Zone, Manager"
                                            className="flex-1 px-4 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') confirmAddCustomField();
                                            }}
                                        />
                                        <button 
                                            onClick={confirmAddCustomField}
                                            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-900/20"
                                        >
                                            Add
                                        </button>
                                        <button 
                                            onClick={() => setIsAddingCustomField(false)}
                                            className="bg-white text-slate-600 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                            
                            {customColumns.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {customColumns.map((col) => (
                                        <div key={col} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm group hover:border-blue-300 transition-colors relative">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-xs font-bold text-slate-700">{col}</label>
                                                <button 
                                                    onClick={() => removeCustomField(col)}
                                                    className="text-slate-300 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <input 
                                                type="text" 
                                                placeholder="Value..." 
                                                className="w-full px-3 py-2 bg-slate-50 border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm transition-all"
                                                value={formData.customValues?.[col] || ''}
                                                onChange={(e) => handleCustomFieldChange(col, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                !isAddingCustomField && (
                                    <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-white/50">
                                        <SlidersHorizontal size={24} className="mx-auto text-slate-300 mb-2" />
                                        <p className="text-sm text-slate-500">No custom fields added yet.</p>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-8 py-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                    <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-3 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-white hover:shadow-sm transition-all">
                        Cancel
                    </button>
                    <button onClick={handleSaveSupplier} className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-xl shadow-red-900/20 hover:scale-[1.02] active:scale-95">
                        {formData.id && suppliers.some(s => s.id === formData.id) ? 'Update Supplier' : 'Save Supplier'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmationModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 p-6">
                <div className="flex flex-col items-center text-center">
                    <div className={`p-4 rounded-full mb-4 ${
                        confirmationModal.type === 'deactivate' ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'
                    }`}>
                        {confirmationModal.type === 'deactivate' && <Ban size={32} />}
                        {confirmationModal.type === 'activate' && <CheckCircle2 size={32} />}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2 capitalize">
                        {confirmationModal.type} Supplier
                    </h3>
                    <p className="text-slate-500 text-sm mb-6">
                        Are you sure you want to {confirmationModal.type} <span className="font-bold text-slate-800">"{confirmationModal.supplierName}"</span>?
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setConfirmationModal({ isOpen: false, type: 'deactivate', supplierId: null, supplierName: '' })}
                            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={executeConfirmation}
                            className={`flex-1 px-4 py-2.5 rounded-lg text-white font-bold shadow-lg transition-colors ${
                                 confirmationModal.type === 'deactivate' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-900/20' : 
                                 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20'
                            }`}
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Global Fixed Dropdown Portal */}
      {activeActionId && createPortal(
        <div 
            ref={dropdownRef}
            className={`fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 py-2 text-left w-56 animate-in fade-in zoom-in-95 duration-200 ${dropdownPosition.transformOrigin}`}
            style={{ 
                top: dropdownPosition.top, 
                left: dropdownPosition.left,
                bottom: dropdownPosition.bottom
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="px-4 py-2 border-b border-slate-50 mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</span>
            </div>
            
            <button 
                onClick={() => onNavigate(`view-supplier/${activeActionId}:add-payment`)}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-3 transition-colors"
            >
                <CreditCard size={16} className="text-emerald-500" /> Pay
            </button>
            <button 
                onClick={() => onNavigate(`view-supplier/${activeActionId}`)}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 transition-colors"
            >
                <Eye size={16} className="text-blue-500" /> View
            </button>
            <button 
                onClick={() => handleEdit(activeActionId!)}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-3 transition-colors"
            >
                <Edit size={16} className="text-amber-500" /> Edit
            </button>
            <button 
                onClick={() => onNavigate(`view-supplier/${activeActionId}:ledger`)}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-3 transition-colors"
            >
                <FileText size={16} className="text-indigo-500" /> Ledger
            </button>
            <button 
                onClick={() => onNavigate(`view-supplier/${activeActionId}:purchases`)}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-3 transition-colors"
            >
                <ShoppingBag size={16} className="text-purple-500" /> Purchases
            </button>
            <button 
                onClick={() => onNavigate(`view-supplier/${activeActionId}:stock`)}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-3 transition-colors"
            >
                <BarChart3 size={16} className="text-teal-500" /> Stock Report
            </button>
            <button 
                onClick={() => onNavigate(`view-supplier/${activeActionId}:docs`)}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-3 transition-colors"
            >
                <StickyNote size={16} className="text-slate-400" /> Documents & Note
            </button>
            <button 
                onClick={() => onNavigate(`view-supplier/${activeActionId}:payments`)}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-3 transition-colors"
            >
                <Banknote size={16} className="text-cyan-500" /> Payments
            </button>
            <button 
                onClick={() => onNavigate(`view-supplier/${activeActionId}:activities`)}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-3 transition-colors"
            >
                <Activity size={16} className="text-orange-500" /> Activities
            </button>
            
            <div className="h-px bg-slate-100 my-1.5 mx-2"></div>
            
            {(() => {
                const supplier = suppliers.find(s => s.id === activeActionId);
                if (!supplier) return null;
                const isActive = supplier.status === 'Active';
                
                return (
                    <button 
                        onClick={() => handleToggleStatus(supplier.id)}
                        className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center gap-3 transition-colors ${isActive ? 'text-red-500 hover:bg-red-50 hover:text-red-700' : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'}`}
                    >
                        {isActive ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                        {isActive ? 'Deactivate' : 'Activate'}
                    </button>
                )
            })()}
        </div>,
        document.body
      )}
    </div>
  );
};

export default Suppliers;