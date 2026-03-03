import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Phone, Mail,
  MapPin, FileText, Download, Printer, ChevronDown,
  ArrowUpDown, Edit, SlidersHorizontal, MoreVertical,
  CreditCard, Eye, Ban, ShoppingBag, StickyNote, X, Filter, Settings,
  User, CheckCircle2, TrendingUp, AlertTriangle, Wallet, FileSpreadsheet,
  DollarSign, Calendar as CalendarIcon, Banknote, Trash2
} from 'lucide-react';
import MultiSelect from './MultiSelect';
import { useGlobalContext, Customer as GlobalCustomer } from '../src/context/GlobalContext';

interface Customer {
  id: string; // Contact ID
  businessName: string;
  name: string; // Contact Person
  email: string;
  taxNumber: string;
  creditLimit: number;
  payTerm: string;
  openingBalance: number;
  advanceBalance: number;
  addedOn: string;
  customerGroup: string;
  address: string;
  mobile: string;
  totalSellDue: number;
  totalSellReturnDue: number;
  status: 'Active' | 'Inactive';
  assignedTo?: string;
  lastSellDate?: string; // YYYY-MM-DD for filtering logic
  customValues?: Record<string, string>;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  transformOrigin: string;
}

const initialCustomers: Customer[] = [
  {
    id: 'CUST-0001',
    businessName: 'Zan Supermarket (Mobailah)',
    name: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649',
    email: 'zan@example.com',
    taxNumber: 'OM123456',
    creditLimit: 0,
    payTerm: 'No Limit',
    openingBalance: 0.000,
    advanceBalance: 0.000,
    addedOn: '26/10/2024',
    customerGroup: 'Supermarkets Customers',
    address: 'Mobailah, Seeb',
    mobile: '96434389',
    totalSellDue: 7.800,
    totalSellReturnDue: 0.000,
    status: 'Active',
    assignedTo: 'Admin',
    lastSellDate: '2025-01-01', // > 1 year ago
    customValues: { 'Route': 'Route A' }
  },
  {
    id: 'CUST-0002',
    businessName: 'Zain Discount Center',
    name: 'Zain Discount Center',
    email: '--',
    taxNumber: '--',
    creditLimit: 0,
    payTerm: 'No Limit',
    openingBalance: 0.000,
    advanceBalance: 0.000,
    addedOn: '04/11/2023',
    customerGroup: 'Supermarkets Customers',
    address: 'Seeb',
    mobile: '+96891665656',
    totalSellDue: 0.000,
    totalSellReturnDue: 0.000,
    status: 'Active',
    assignedTo: 'Sales Rep',
    lastSellDate: '2026-02-01' // Recent
  },
  {
    id: 'CUST-0003',
    businessName: 'Yellow Way LLC (Mobailah)',
    name: 'Yellow Way LLC',
    email: '--',
    taxNumber: 'OM987654',
    creditLimit: 500.000,
    payTerm: '30 Days',
    openingBalance: 0.000,
    advanceBalance: 0.000,
    addedOn: '09/07/2024',
    customerGroup: 'Engine Oil Customers',
    address: 'Mobailah',
    mobile: '95140446',
    totalSellDue: 37.000,
    totalSellReturnDue: 37.000,
    status: 'Active',
    assignedTo: 'Admin',
    lastSellDate: '2025-11-15' // ~3 months ago
  },
];

interface CustomersProps {
    onNavigate: (page: string) => void;
}

const Customers: React.FC<CustomersProps> = ({ onNavigate }) => {
  // Pull ALL customers from GlobalContext — single source of truth
  const {
    customers: globalCustomers,
    addCustomer: globalAddCustomer,
    updateCustomer: globalUpdateCustomer,
    deleteCustomer: globalDeleteCustomer,
    customerGroups,
    users,
    payments: globalPayments,
    addPayment: globalAddPayment,
    formatCurrency,
    settings,
    currentUser,
  } = useGlobalContext();

  const formatOMR = (amount: number) => formatCurrency(amount || 0);
  const formatRiyal = (amount: number) => formatCurrency(amount || 0);

  // Local alias (typed as GlobalCustomer for compatibility)
  const customers = globalCustomers;
  const setCustomers = (fn: any) => {}; // kept for safety — all mutations go through context

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-right' });
  const [showFilters, setShowFilters] = useState(true);
  
  // Custom Fields State
  const [customColumns, setCustomColumns] = useState<string[]>([]);
  const [isAddingCustomField, setIsAddingCustomField] = useState(false);
  const [newCustomFieldName, setNewCustomFieldName] = useState('');
  
  // Filter States
  const [filters, setFilters] = useState({
      hasNoSellFrom: [] as string[],
      customerGroup: [] as string[],
      assignedTo: [] as string[],
      status: [] as string[],
      // Boolean filters
      sellDue: false,
      sellReturn: false,
      advanceBalance: false,
      openingBalance: false
  });

  const [formData, setFormData] = useState<Partial<Customer>>({ customValues: {} });

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);

  const handleDelete = (customer: GlobalCustomer) => {
    if (window.confirm(`Are you sure you want to delete ${customer.businessName}?`)) {
      globalDeleteCustomer(customer.id);
      setActiveActionId(null);
    }
  };
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  // Confirmation Modal State
  const [confirmationModal, setConfirmationModal] = useState<{
      isOpen: boolean;
      type: 'deactivate' | 'activate' | 'delete';
      customerId: string | null;
      customerName: string;
  }>({
      isOpen: false,
      type: 'deactivate',
      customerId: null,
      customerName: ''
  });

  // GlobalContext handles localStorage persistence — no need to duplicate here

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
        top: isDropUp ? undefined : rect.bottom + 4,
        bottom: isDropUp ? window.innerHeight - rect.top + 4 : undefined,
        left: rect.left, 
        transformOrigin: isDropUp ? 'origin-bottom-left' : 'origin-top-left'
      });
      setActiveActionId(id);
    }
  };

  useEffect(() => {
    const handleOutsideClick = () => setActiveActionId(null);
    const handleScroll = () => setActiveActionId(null);
    if (activeActionId) {
        window.addEventListener('click', handleOutsideClick);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);
    }
    return () => {
        window.removeEventListener('click', handleOutsideClick);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
    };
  }, [activeActionId]);

  // --- Handlers ---
  const handleInputChange = (field: keyof Customer, value: any) => setFormData(prev => ({ ...prev, [field]: value }));
  
  const handleCustomFieldChange = (field: string, value: string) => {
    setFormData(prev => ({
        ...prev,
        customValues: {
            ...prev.customValues,
            [field]: value
        }
    }));
  };

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

  const handleSaveCustomer = () => {
    const isEdit = !!(formData as any).id && customers.some(c => c.id === (formData as any).id);

    const newCustomer: GlobalCustomer = {
        id: (formData as any).id || `CUST-${Math.floor(2005 + Math.random() * 8000)}`,
        type: 'Customer',
        businessName: formData.businessName || 'New Customer',
        name: formData.name || 'Unknown',
        email: formData.email || '',
        mobile: formData.mobile || '',
        taxNumber: formData.taxNumber || '',
        creditLimit: Number(formData.creditLimit) || 0,
        payTerm: formData.payTerm || 'No Limit',
        openingBalance: Number(formData.openingBalance) || 0,
        advanceBalance: isEdit ? (formData.advanceBalance ?? 0) : 0,
        addedOn: isEdit ? (formData.addedOn || new Date().toLocaleDateString('en-GB')) : new Date().toLocaleDateString('en-GB'),
        customerGroup: formData.customerGroup || 'Retail',
        address: formData.address || '',
        totalSellDue: isEdit ? (formData.totalSellDue ?? 0) : 0,
        totalSellReturnDue: isEdit ? (formData.totalSellReturnDue ?? 0) : 0,
        status: formData.status || 'Active',
        assignedTo: formData.assignedTo || currentUser?.name || 'Admin',
        lastSellDate: formData.lastSellDate || new Date().toISOString().split('T')[0],
        customValues: formData.customValues || {}
    };

    if (isEdit) {
        globalUpdateCustomer(newCustomer);
    } else {
        globalAddCustomer(newCustomer);
    }

    setFormData({ customValues: {} });
    setIsAddModalOpen(false);
  };

  const handlePay = (customer: Customer) => {
      setPaymentCustomer(customer);
      setPaymentAmount(customer.totalSellDue.toString());
      setPaymentDate(new Date().toISOString().slice(0, 16));
      setPaymentMethod('Cash');
      setPaymentNote('');
      setIsPaymentModalOpen(true);
      setActiveActionId(null);
  };

  const processPayment = () => {
    if (!paymentCustomer) return;

    const amountPaid = parseFloat(paymentAmount || '0');
    if (isNaN(amountPaid) || amountPaid <= 0) return;

    // GlobalContext addPayment handles: FIFO invoice distribution,
    // customer balance update, and localStorage persistence automatically
    globalAddPayment({
        id: `PAY-${Date.now()}`,
        date: paymentDate || new Date().toISOString().split('T')[0],
        contactId: paymentCustomer.id,
        contactName: paymentCustomer.businessName,
        contactType: 'Customer',
        amount: amountPaid,
        method: paymentMethod,
        account: '',
        referenceNo: `PAY-${Date.now().toString().slice(-6)}`,
        note: paymentNote,
        type: 'received',
        addedBy: currentUser?.name || 'Admin',
    });

    setIsPaymentModalOpen(false);
    setPaymentAmount('');
    setPaymentCustomer(null);
    setPaymentNote('');
  };

  const handleEdit = (customer: Customer) => {
      setFormData(customer);
      setIsAddModalOpen(true);
      setActiveActionId(null);
  };

  const handleNavigateView = (id: string) => {
      onNavigate(`view-customer/${id}`);
      setActiveActionId(null);
  }

  const handleNavigateToTab = (id: string, tab: string) => {
      onNavigate(`view-customer/${id}:${tab}`);
      setActiveActionId(null);
  }

  const handleToggleStatus = (customer: Customer) => {
      const action = customer.status === 'Active' ? 'deactivate' : 'activate';
      setConfirmationModal({
          isOpen: true,
          type: action,
          customerId: customer.id,
          customerName: customer.businessName || customer.name
      });
      setActiveActionId(null);
  }

  const executeConfirmation = () => {
      if (!confirmationModal.customerId) return;

      const customer = customers.find(c => c.id === confirmationModal.customerId);
      if (customer) {
          globalUpdateCustomer({
              ...customer,
              status: confirmationModal.type === 'deactivate' ? 'Inactive' : 'Active'
          });
      }
      setConfirmationModal({ isOpen: false, type: 'deactivate', customerId: null, customerName: '' });
  };

  // --- Filtering Logic ---
  const filteredCustomers = customers.filter(customer => {
    // 1. Search
    const matchesSearch = 
        customer.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.mobile.includes(searchTerm) ||
        customer.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 2. Customer Group
    const matchesGroup = filters.customerGroup.length === 0 || filters.customerGroup.includes(customer.customerGroup);
    
    // 3. Status
    const matchesStatus = filters.status.length === 0 || filters.status.includes(customer.status);

    // 4. Assigned To
    const matchesAssignedTo = filters.assignedTo.length === 0 || (customer.assignedTo && filters.assignedTo.includes(customer.assignedTo));

    // 5. Checkbox Logic (Only apply if checked)
    const matchesSellDue = !filters.sellDue || customer.totalSellDue > 0;
    const matchesSellReturn = !filters.sellReturn || customer.totalSellReturnDue > 0;
    const matchesAdvanceBalance = !filters.advanceBalance || customer.advanceBalance > 0;
    const matchesOpeningBalance = !filters.openingBalance || customer.openingBalance > 0;

    // 6. Has No Sell From Logic
    let matchesNoSell = true;
    if (filters.hasNoSellFrom.length > 0 && customer.lastSellDate) {
        // Logic to check date diff
        const lastSell = new Date(customer.lastSellDate);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - lastSell.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        matchesNoSell = filters.hasNoSellFrom.some(filter => {
            if (filter === '1 Month') return diffDays > 30;
            if (filter === '3 Months') return diffDays > 90;
            if (filter === '6 Months') return diffDays > 180;
            if (filter === '1 Year') return diffDays > 365;
            return false;
        });
    }

    return matchesSearch && matchesGroup && matchesStatus && matchesAssignedTo && matchesNoSell && matchesSellDue && matchesSellReturn && matchesAdvanceBalance && matchesOpeningBalance;
  });

  // Calculate Totals based on filtered list
  const totalOpeningBalance = filteredCustomers.reduce((acc, curr) => acc + curr.openingBalance, 0);
  const totalAdvanceBalance = filteredCustomers.reduce((acc, curr) => acc + curr.advanceBalance, 0);
  const totalSellDue = filteredCustomers.reduce((acc, curr) => acc + curr.totalSellDue, 0);
  const totalSellReturnDue = filteredCustomers.reduce((acc, curr) => acc + curr.totalSellReturnDue, 0);

  // --- Export Function ---
  const exportToCSV = () => {
    const headers = ['Contact ID', 'Business Name', 'Contact Person', 'Email', 'Tax Number', 'Opening Balance', 'Advance Balance', 'Added On', 'Customer Group', 'Mobile', 'Total Sell Due', 'Total Return Due', 'Status'];
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n"
        + filteredCustomers.map(c => [
            c.id, 
            `"${c.businessName}"`, // Quote strings with commas
            `"${c.name}"`, 
            c.email, 
            c.taxNumber, 
            c.openingBalance, 
            c.advanceBalance, 
            c.addedOn, 
            c.customerGroup, 
            c.mobile, 
            c.totalSellDue, 
            c.totalSellReturnDue, 
            c.status
        ].join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "customers_list.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
      window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 print:p-0">
      
      {/* 1. Header - Hidden on Print */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 print:hidden">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Customers</h2>
          <p className="text-slate-500 mt-2 text-lg font-light">
            Manage your Customers
          </p>
        </div>
      </div>

      {/* 2. Filters Section - Hidden on Print */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm print:hidden">
          <div 
            className="flex items-center gap-2 cursor-pointer text-blue-600 mb-4 font-bold text-sm"
            onClick={() => setShowFilters(!showFilters)}
          >
              <Filter size={16} /> Filters
          </div>
          
          {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                  <div className="group">
                      <div className="flex items-center gap-2 mb-1.5">
                          <input 
                              type="checkbox" 
                              id="sellDue" 
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              checked={filters.sellDue}
                              onChange={(e) => setFilters({ ...filters, sellDue: e.target.checked })}
                          />
                          <label htmlFor="sellDue" className="text-xs font-bold text-slate-700 cursor-pointer">Sell Due</label>
                      </div>
                  </div>
                  <div className="group">
                      <div className="flex items-center gap-2 mb-1.5">
                          <input 
                              type="checkbox" 
                              id="sellReturn" 
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                              checked={filters.sellReturn}
                              onChange={(e) => setFilters({ ...filters, sellReturn: e.target.checked })}
                          />
                          <label htmlFor="sellReturn" className="text-xs font-bold text-slate-700 cursor-pointer">Sell Return</label>
                      </div>
                  </div>
                  <div className="group">
                      <div className="flex items-center gap-2 mb-1.5">
                          <input 
                              type="checkbox" 
                              id="advanceBalance" 
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                              checked={filters.advanceBalance}
                              onChange={(e) => setFilters({ ...filters, advanceBalance: e.target.checked })}
                          />
                          <label htmlFor="advanceBalance" className="text-xs font-bold text-slate-700 cursor-pointer">Advance Balance</label>
                      </div>
                  </div>
                  <div className="group">
                      <div className="flex items-center gap-2 mb-1.5">
                          <input 
                              type="checkbox" 
                              id="openingBalance" 
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                              checked={filters.openingBalance}
                              onChange={(e) => setFilters({ ...filters, openingBalance: e.target.checked })}
                          />
                          <label htmlFor="openingBalance" className="text-xs font-bold text-slate-700 cursor-pointer">Opening Balance</label>
                      </div>
                  </div>

                  <MultiSelect 
                      label="Has no sell from"
                      options={['1 Month', '3 Months', '6 Months', '1 Year']}
                      selected={filters.hasNoSellFrom}
                      onChange={(val) => setFilters({...filters, hasNoSellFrom: val})}
                  />
                  
                  <MultiSelect
                      label="Customer Group"
                      options={customerGroups.length > 0 ? customerGroups.map(g => g.name) : ['Supermarkets Customers', 'Engine Oil Customers', 'Pet food customer', 'Retail']}
                      selected={filters.customerGroup}
                      onChange={(val) => setFilters({...filters, customerGroup: val})}
                  />

                  <MultiSelect
                      label="Assigned to"
                      options={users.length > 0 ? users.map(u => u.name) : ['Admin', 'Sales Rep']}
                      selected={filters.assignedTo}
                      onChange={(val) => setFilters({...filters, assignedTo: val})}
                  />
                  
                  <MultiSelect 
                      label="Status"
                      options={['Active', 'Inactive']}
                      selected={filters.status}
                      onChange={(val) => setFilters({...filters, status: val})}
                  />
              </div>
          )}
      </div>

      {/* 3. Main Interface Card */}
      <div className="bg-white rounded-[1rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative z-0 print:border-none print:shadow-none">
         
         {/* Title Bar */}
         <div className="p-5 border-b border-slate-100 bg-slate-50/50 print:bg-white print:border-b-2 print:border-slate-800">
             <h3 className="text-sm font-bold text-slate-700 print:text-xl print:text-slate-900">All your Customers</h3>
         </div>

         {/* Toolbar - Hidden on Print */}
         <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-center gap-4 print:hidden">
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show</span>
                <select className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none cursor-pointer">
                    <option>25</option>
                    <option>50</option>
                    <option>100</option>
                </select>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">entries</span>
            </div>

            <div className="flex flex-wrap justify-center gap-1">
                <button onClick={exportToCSV} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm">
                    <FileText size={12} /> Export CSV
                </button>
                <button onClick={exportToCSV} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm">
                    <FileSpreadsheet size={12} /> Export Excel
                </button>
                <button onClick={handlePrint} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm">
                    <Printer size={12} /> Print
                </button>
                <button onClick={handlePrint} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm">
                    <Download size={12} /> Export PDF
                </button>
            </div>

            <div className="flex items-center gap-2 w-full xl:w-auto">
                <input 
                    type="text" 
                    placeholder="Search..." 
                    className="flex-1 xl:w-64 px-3 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button 
                    onClick={() => { setFormData({ customValues: {} }); setIsAddModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                >
                    <Plus size={14} /> Add
                </button>
            </div>
         </div>

         {/* Table */}
         <div className="overflow-x-auto min-h-[500px] print:overflow-visible print:min-h-0">
            <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                    <tr className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200 print:bg-white print:border-b-2 print:border-slate-800">
                        <th className="px-4 py-3 text-center w-12 bg-slate-50 sticky left-0 z-10 print:hidden">Action</th>
                        <th className="px-4 py-3 whitespace-nowrap">Contact ID</th>
                        <th className="px-4 py-3 whitespace-nowrap">Business Name</th>
                        <th className="px-4 py-3 whitespace-nowrap">Name</th>
                        <th className="px-4 py-3 whitespace-nowrap">Email</th>
                        <th className="px-4 py-3 whitespace-nowrap">Tax number</th>
                        <th className="px-4 py-3 whitespace-nowrap">Credit Limit</th>
                        <th className="px-4 py-3 whitespace-nowrap">Pay term</th>
                        <th className="px-4 py-3 whitespace-nowrap text-right">Opening Balance</th>
                        <th className="px-4 py-3 whitespace-nowrap text-right">Advance Balance</th>
                        <th className="px-4 py-3 whitespace-nowrap">Added On</th>
                        <th className="px-4 py-3 whitespace-nowrap">Customer Group</th>
                        <th className="px-4 py-3 whitespace-nowrap">Address</th>
                        <th className="px-4 py-3 whitespace-nowrap">Mobile</th>
                        <th className="px-4 py-3 whitespace-nowrap text-right">Total Sale Due</th>
                        <th className="px-4 py-3 whitespace-nowrap text-right">Total Sell Return Due</th>
                        <th className="px-4 py-3 whitespace-nowrap">Status</th>
                        
                        {/* Custom Column Headers */}
                        {customColumns.map((col) => (
                            <th key={col} className="px-4 py-3 whitespace-nowrap text-blue-600 bg-blue-50/20 border-l border-blue-100 print:text-slate-800">
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => (
                        <tr key={customer.id} className={`hover:bg-slate-50 transition-colors group ${customer.status === 'Inactive' ? 'bg-slate-50/50' : ''}`}>
                            <td className="px-4 py-3 text-center bg-white group-hover:bg-slate-50 sticky left-0 z-10 border-r border-transparent group-hover:border-slate-200 print:hidden">
                                <button 
                                    onClick={(e) => toggleActions(e, customer.id)}
                                    className={`px-2 py-1 rounded border text-[10px] font-bold flex items-center gap-1 mx-auto transition-all ${activeActionId === customer.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-blue-500 border-blue-200 hover:bg-blue-50'}`}
                                >
                                    Actions <ChevronDown size={10} />
                                </button>
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-medium">{customer.id}</td>
                            <td className="px-4 py-3 text-slate-800 font-bold">{customer.businessName}</td>
                            <td className="px-4 py-3 text-slate-600">{customer.name}</td>
                            <td className="px-4 py-3 text-slate-500">{customer.email}</td>
                            <td className="px-4 py-3 text-slate-500">{customer.taxNumber}</td>
                            <td className="px-4 py-3 text-slate-600">{customer.creditLimit === 0 ? 'No Limit' : formatOMR(customer.creditLimit)}</td>
                            <td className="px-4 py-3 text-slate-600">{customer.payTerm}</td>
                            <td className="px-4 py-3 text-right text-slate-600 font-medium">{formatOMR(customer.openingBalance)}</td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatOMR(customer.advanceBalance)}</td>
                            <td className="px-4 py-3 text-slate-500">{customer.addedOn}</td>
                            <td className="px-4 py-3 text-slate-600">{customer.customerGroup}</td>
                            <td className="px-4 py-3 text-slate-500 truncate max-w-[150px]" title={customer.address}>{customer.address}</td>
                            <td className="px-4 py-3 text-slate-600">{customer.mobile}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                <span className={`${customer.totalSellDue > 0 ? '' : 'text-slate-400'}`}>
                                    {formatOMR(customer.totalSellDue)}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                <span className={`${customer.totalSellReturnDue > 0 ? '' : 'text-slate-400'}`}>
                                    {formatOMR(customer.totalSellReturnDue)}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                    customer.status === 'Active' 
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                    {customer.status}
                                </span>
                            </td>

                            {/* Custom Column Values */}
                            {customColumns.map((col) => (
                                <td key={`${customer.id}-${col}`} className="px-4 py-3 text-slate-600 border-l border-r border-dashed border-slate-100 bg-slate-50/20 whitespace-nowrap">
                                    {customer.customValues && customer.customValues[col] ? (
                                        <span className="font-medium text-slate-800">{customer.customValues[col]}</span>
                                    ) : (
                                        <span className="text-slate-300 italic">--</span>
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))) : (
                        <tr>
                            <td colSpan={17 + customColumns.length} className="px-6 py-12 text-center text-slate-400 italic">
                                No customers found matching your criteria.
                            </td>
                        </tr>
                    )}
                </tbody>
                <tfoot className="bg-slate-50 font-bold text-slate-800 border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sticky bottom-0 z-20 print:bg-white print:border-t-2 print:border-slate-800">
                    <tr>
                        <td colSpan={8} className="px-4 py-3 text-right">Total:</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-600">{formatOMR(totalOpeningBalance)}</td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatOMR(totalAdvanceBalance)}</td>
                        <td colSpan={4}></td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">{formatOMR(totalSellDue)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">{formatOMR(totalSellReturnDue)}</td>
                        <td></td>
                        {customColumns.length > 0 && <td colSpan={customColumns.length}></td>}
                    </tr>
                </tfoot>
            </table>
         </div>

         {/* Pagination Footer - Hidden on Print */}
         <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/50 text-xs text-slate-500 font-medium print:hidden">
            <span>Showing 1 to {filteredCustomers.length} of {filteredCustomers.length} entries</span>
            <div className="flex gap-1">
                <button className="px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
                <button className="px-2 py-1 bg-blue-600 text-white border border-blue-600 rounded">1</button>
                <button className="px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Next</button>
            </div>
         </div>
      </div>

       {/* Add Customer Modal */}
       {isAddModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full rounded-2xl shadow-2xl max-w-5xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-100 max-h-[90vh]">
                 {/* Modal Header */}
                 <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{formData.id ? 'Edit Customer' : 'Add Customer'}</h3>
                    </div>
                    <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-all">
                        <X size={24} />
                    </button>
                </div>
                
                {/* Modal Content */}
                <div className="overflow-y-auto p-8 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Column 1 */}
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">Contact Type</label>
                                <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="type" className="w-4 h-4 text-slate-900 focus:ring-slate-800 border-slate-300" />
                                        <span className="text-sm font-medium text-slate-700">Individual</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="type" defaultChecked className="w-4 h-4 text-slate-900 focus:ring-slate-800 border-slate-300" />
                                        <span className="text-sm font-medium text-slate-700">Business</span>
                                    </label>
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Contact ID <span className="text-slate-300 font-normal normal-case">(Auto-generated)</span></label>
                                <input 
                                    type="text" 
                                    placeholder="Leave blank to auto-generate" 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium placeholder:text-slate-400"
                                    value={formData.id || ''}
                                    onChange={(e) => handleInputChange('id', e.target.value)}
                                />
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Customer Group</label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                                    value={formData.customerGroup || 'Retail'}
                                    onChange={(e) => handleInputChange('customerGroup', e.target.value)}
                                >
                                    {customerGroups.length > 0
                                        ? customerGroups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)
                                        : ['Retail', 'Supermarkets Customers', 'Engine Oil Customers', 'Pet food customer', 'Wholesale'].map(g => <option key={g} value={g}>{g}</option>)
                                    }
                                </select>
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
                        </div>

                        {/* Column 2 */}
                        <div className="space-y-6">
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Name <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    placeholder="Full Name" 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium"
                                    value={formData.name || ''}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                />
                            </div>

                             <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Email Address</label>
                                <input 
                                    type="email" 
                                    placeholder="name@company.com" 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium"
                                    value={formData.email || ''}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                />
                            </div>

                             <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Tax Number</label>
                                <input 
                                    type="text" 
                                    placeholder="VAT / Tax ID" 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium"
                                    value={formData.taxNumber || ''}
                                    onChange={(e) => handleInputChange('taxNumber', e.target.value)}
                                />
                            </div>

                             <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Opening Balance</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">OMR</span>
                                    <input 
                                        type="number" 
                                        placeholder="0.000" 
                                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium"
                                        value={formData.openingBalance || ''}
                                        onChange={(e) => handleInputChange('openingBalance', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Column 3 */}
                        <div className="space-y-6">
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Pay Term</label>
                                <div className="flex gap-2">
                                    <input type="number" placeholder="Days" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium" />
                                    <select className="px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium cursor-pointer">
                                        <option>Days</option>
                                        <option>Months</option>
                                    </select>
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Credit Limit</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">OMR</span>
                                    <input 
                                        type="number" 
                                        placeholder="0.000" 
                                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium"
                                        value={formData.creditLimit || ''}
                                        onChange={(e) => handleInputChange('creditLimit', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Address</label>
                                <textarea 
                                    placeholder="Street, City, Building..." 
                                    rows={3} 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium resize-none"
                                    value={formData.address || ''}
                                    onChange={(e) => handleInputChange('address', e.target.value)}
                                ></textarea>
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Mobile <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    placeholder="+968" 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium"
                                    value={formData.mobile || ''}
                                    onChange={(e) => handleInputChange('mobile', e.target.value)}
                                />
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
                                    <p className="text-xs text-slate-500 mt-1">Add specific attributes to this customer.</p>
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
                                            placeholder="e.g. Route, Zone, Preferred Day"
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
                    <button onClick={handleSaveCustomer} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-blue-900/20 transition-all active:scale-95">
                        Save
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
                        {confirmationModal.type} Customer
                    </h3>
                    <p className="text-slate-500 text-sm mb-6">
                        Are you sure you want to {confirmationModal.type} <span className="font-bold text-slate-800">"{confirmationModal.customerName}"</span>?
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setConfirmationModal({ isOpen: false, type: 'deactivate', customerId: null, customerName: '' })}
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

      {/* Action Menu Portal */}
      {activeActionId && (
        <div 
            className={`fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 py-2 w-56 animate-in fade-in zoom-in-95 duration-200 ${dropdownPosition.transformOrigin}`}
            style={{ top: dropdownPosition.top, left: dropdownPosition.left, bottom: dropdownPosition.bottom }}
        >
            <div className="px-4 py-2 border-b border-slate-50 mb-1">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Quick Actions</span>
            </div>
            
            {/* Pay Action */}
            <button 
                onClick={() => handlePay(customers.find(c => c.id === activeActionId)!)}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <CreditCard size={16} className="text-emerald-500" /> Pay
            </button>
            
            {/* View Action */}
            <button 
                onClick={() => handleNavigateView(activeActionId!)}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <Eye size={16} className="text-blue-500" /> View
            </button>
            
            {/* Edit Action */}
            <button 
                onClick={() => handleEdit(customers.find(c => c.id === activeActionId)!)}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <Edit size={16} className="text-amber-500" /> Edit
            </button>
            
            {/* Ledger Action */}
            <button 
                onClick={() => handleNavigateToTab(activeActionId!, 'ledger')}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <FileText size={16} className="text-indigo-500" /> Ledger
            </button>
            
            {/* Sales Action */}
            <button 
                onClick={() => handleNavigateToTab(activeActionId!, 'sales')}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <ShoppingBag size={16} className="text-purple-500" /> Sales
            </button>
            
            {/* Documents Action */}
            <button 
                onClick={() => handleNavigateToTab(activeActionId!, 'docs')}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <StickyNote size={16} className="text-slate-400" /> Documents & Note
            </button>
            
            <div className="h-px bg-slate-100 my-1 mx-2"></div>

            {/* Delete Action */}
            <button 
                onClick={() => handleDelete(customers.find(c => c.id === activeActionId)!)}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors"
            >
                <Trash2 size={16} className="text-rose-500" /> Delete
            </button>
            
            <div className="h-px bg-slate-100 my-1 mx-2"></div>
            
            {(() => {
                const customer = customers.find(c => c.id === activeActionId);
                if (!customer) return null;
                const isActive = customer.status === 'Active';
                
                return (
                    <button 
                        onClick={() => handleToggleStatus(customer)}
                        className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center gap-3 transition-colors ${isActive ? 'text-red-500 hover:bg-red-50 hover:text-red-700' : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'}`}
                    >
                        {isActive ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                        {isActive ? 'Deactivate' : 'Activate'}
                    </button>
                )
            })()}
        </div>
      )}

      {/* Add Payment Modal */}
      {isPaymentModalOpen && paymentCustomer && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-slate-800">Add payment</h3>
                        <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                    
                    {/* Content */}
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            {/* Customer Info */}
                            <div className="bg-slate-50 p-4 rounded border border-slate-200">
                                <p className="text-sm font-bold text-slate-700">
                                    Customer name: <span className="font-normal text-slate-600">{paymentCustomer.businessName} ({paymentCustomer.name})</span>
                                </p>
                            </div>
                            
                            {/* Financial Summary */}
                            <div className="bg-slate-50 p-4 rounded border border-slate-200 text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-700">Total Sale Due:</span>
                                    <span className="font-medium text-slate-600">{formatRiyal(paymentCustomer.totalSellDue)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-700">Opening Balance:</span>
                                    <span className="font-medium text-slate-600">{formatRiyal(paymentCustomer.openingBalance)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            <div className="group">
                                <label className="block text-sm font-bold text-slate-800 mb-1">Payment Method:*</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                        <Banknote size={16} />
                                    </div>
                                    <select
                                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white"
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                    >
                                        <option>Cash</option>
                                        <option>Card</option>
                                        <option>Cheque</option>
                                        <option>Bank Transfer</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-sm font-bold text-slate-800 mb-1">Paid on:*</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                        <CalendarIcon size={16} />
                                    </div>
                                    <input
                                        type="datetime-local"
                                        value={paymentDate}
                                        onChange={(e) => setPaymentDate(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-sm font-bold text-slate-800 mb-1">Amount:*</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                        <DollarSign size={16} />
                                    </div>
                                    <input 
                                        type="number" 
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="group">
                                <label className="block text-sm font-bold text-slate-800 mb-1">Attach Document:</label>
                                <div className="flex items-center">
                                    <label className="cursor-pointer bg-slate-100 border border-slate-300 text-slate-700 px-3 py-2 rounded-l text-sm hover:bg-slate-200 transition-colors whitespace-nowrap">
                                        Choose File
                                        <input type="file" className="hidden" />
                                    </label>
                                    <span className="px-3 py-2 border border-l-0 border-slate-300 rounded-r w-full text-sm text-slate-500 bg-white">No file chosen</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">Allowed File: .pdf, .csv, .zip, .doc, .docx, .jpeg, .jpg, .png</p>
                            </div>

                            <div className="group">
                                <label className="block text-sm font-bold text-slate-800 mb-1">Payment Account:</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                        <Banknote size={16} />
                                    </div>
                                    <select className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white">
                                        <option>None</option>
                                        <option>Cash Account</option>
                                        <option>Bank Account</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            </div>
                        </div>

                        <div className="group mb-6">
                            <label className="block text-sm font-bold text-slate-800 mb-1">Payment Note:</label>
                            <textarea
                                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm h-24 resize-none"
                                value={paymentNote}
                                onChange={(e) => setPaymentNote(e.target.value)}
                            ></textarea>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
                        <button 
                            onClick={processPayment}
                            className="px-6 py-2 bg-[#6200ea] text-white rounded font-bold text-sm hover:bg-[#5000ca] transition-colors"
                        >
                            Save
                        </button>
                        <button 
                            onClick={() => setIsPaymentModalOpen(false)}
                            className="px-6 py-2 bg-slate-800 text-white rounded font-bold text-sm hover:bg-slate-900 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Customers;
