import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Save, Plus, Calendar, Search, Trash2, 
  ChevronDown, FileText, Truck, CreditCard, 
  DollarSign, Info, Upload, User, MapPin, 
  ShoppingCart, Calculator, AlertCircle, X, Printer,
  Briefcase, Eye, Check, FileCheck, Edit
} from 'lucide-react';
import { useNotifications } from '../src/context/NotificationContext';
import { useGlobalContext } from '../src/context/GlobalContext';

interface AddSaleProps {
    onNavigate?: (page: string) => void;
    fromOrder?: boolean;
    isEdit?: boolean;
    saleId?: string;
    initialStatus?: 'Final' | 'Draft' | 'Quotation';
}

const AddSale: React.FC<AddSaleProps> = ({ onNavigate, fromOrder, isEdit, saleId, initialStatus }) => {
  const { addNotification } = useNotifications();
  const {
    locations, sales, addSale, updateSale,
    customers, products, orders,
    settings, currentUser,
    nextInvoiceNumber,
    formatCurrency,
    taxRates,
  } = useGlobalContext();

  // --- General Info State ---
  const [saleType, setSaleType] = useState('Paid');
  const [location, setLocation] = useState('');
  const [customer, setCustomer] = useState(''); // Stores Customer ID
  const [payTermNumber, setPayTermNumber] = useState('');
  const [payTermUnit, setPayTermUnit] = useState('Days');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 16));
  const [status, setStatus] = useState<'Final' | 'Draft' | 'Quotation'>(initialStatus || 'Final');
  const [invoiceScheme, setInvoiceScheme] = useState('Default');

  // --- Customer Search State ---
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [selectedCustomerObj, setSelectedCustomerObj] = useState<any>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Real customers from GlobalContext — active only, for the dropdown
  const customerList = useMemo(() => (
    customers
      .filter(c => c.status === 'Active')
      .map(c => ({
        id: c.id,
        name: c.businessName,
        phone: c.mobile,
        payTerm: c.payTerm,
        creditLimit: c.creditLimit,
        billingAddress: c.address,
      }))
  ), [customers]);

  // --- Product Search per Row ---
  const [rowProductSearch, setRowProductSearch] = useState<Record<number, string>>({});
  const [rowProductDropdownOpen, setRowProductDropdownOpen] = useState<Record<number, boolean>>({});

  // --- Product Grid State ---
  const [rows, setRows] = useState<any[]>([
    { id: 1, productId: '', name: '', qty: 1, unit: '', unitPrice: 0, discount: 0, subtotal: 0, tax: 0, total: 0 }
  ]);

  // --- Bottom Section State ---
  const [discountType, setDiscountType] = useState('None');
  const [discountAmount, setDiscountAmount] = useState<number | ''>('');
  const [orderTax, setOrderTax] = useState('None');
  const [sellNote, setSellNote] = useState('');
  
  // --- Shipping State ---
  const [shippingDetails, setShippingDetails] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCharges, setShippingCharges] = useState<number | ''>('');
  const [shippingStatus, setShippingStatus] = useState('Ordered');
  const [deliveredTo, setDeliveredTo] = useState('');

  // --- Payment State ---
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 16));
  const [paymentMethod, setPaymentMethod] = useState(settings.defaultSalePaymentMethod || 'Cash');
  const [paymentAccount, setPaymentAccount] = useState('None');
  const [paymentNote, setPaymentNote] = useState('');

  // --- Preview State ---
  const [showPreview, setShowPreview] = useState(false);
  const [sourceOrderNumber, setSourceOrderNumber] = useState('');

  // --- Draft State ---
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftData, setDraftData] = useState<any>(null);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  useEffect(() => {
    if (isEdit || fromOrder) return;
    if (!initialStatus) return;
    setStatus(initialStatus);
    if (initialStatus !== 'Final') {
      setSaleType('Credit Sale');
    }
  }, [initialStatus, isEdit, fromOrder]);

  // Load Draft Logic
  useEffect(() => {
    if (!isEdit && !fromOrder) {
      const savedDraft = localStorage.getItem('addSaleDraft');
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.customer || (parsed.rows && parsed.rows.length > 0 && parsed.rows[0].name !== 'New Item (Search to add)')) {
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
    } else {
       setIsDraftLoaded(true);
    }
  }, [isEdit, fromOrder]);

  // Save Draft Logic
  useEffect(() => {
    if (isDraftLoaded && !isEdit && !fromOrder && !showDraftPrompt) {
      const draft = {
        saleType, customer, payTermNumber, payTermUnit, saleDate, status, invoiceScheme,
        rows, discountType, discountAmount, orderTax, sellNote, shippingDetails, shippingAddress,
        shippingCharges, shippingStatus, deliveredTo, amount, paymentDate, paymentMethod, paymentAccount, paymentNote,
        location
      };
      localStorage.setItem('addSaleDraft', JSON.stringify(draft));
    }
  }, [isDraftLoaded, showDraftPrompt, saleType, customer, payTermNumber, payTermUnit, saleDate, status, invoiceScheme, rows, discountType, discountAmount, orderTax, sellNote, shippingDetails, shippingAddress, shippingCharges, shippingStatus, deliveredTo, amount, paymentDate, paymentMethod, paymentAccount, paymentNote, isEdit, fromOrder, location]);

  const restoreDraft = () => {
     if (draftData) {
         setSaleType(draftData.saleType || 'Paid');
         setLocation(draftData.location || '');
         setCustomer(draftData.customer || '');
         setPayTermNumber(draftData.payTermNumber || '');
         setPayTermUnit(draftData.payTermUnit || 'Days');
         setSaleDate(draftData.saleDate || new Date().toISOString().slice(0, 16));
         setStatus(draftData.status || 'Final');
         setInvoiceScheme(draftData.invoiceScheme || 'Default');
         setRows(draftData.rows || []);
         setDiscountType(draftData.discountType || 'None');
         setDiscountAmount(draftData.discountAmount || '');
         setOrderTax(draftData.orderTax || 'None');
         setSellNote(draftData.sellNote || '');
         setShippingDetails(draftData.shippingDetails || '');
         setShippingAddress(draftData.shippingAddress || '');
         setShippingCharges(draftData.shippingCharges || '');
         setShippingStatus(draftData.shippingStatus || 'Ordered');
         setDeliveredTo(draftData.deliveredTo || '');
         setAmount(draftData.amount || '');
         setPaymentDate(draftData.paymentDate || new Date().toISOString().slice(0, 16));
         setPaymentMethod(draftData.paymentMethod || 'Cash');
         setPaymentAccount(draftData.paymentAccount || 'None');
         setPaymentNote(draftData.paymentNote || '');
         
         // Try to restore customer search text from real customers
         if (draftData.customer) {
             const cust = customerList.find(c => c.id === draftData.customer);
             if (cust) {
                 setCustomerSearch(cust.name);
                 setSelectedCustomerObj(cust);
             }
         }
     }
     setShowDraftPrompt(false);
     setIsDraftLoaded(true);
  };

  const discardDraft = () => {
     localStorage.removeItem('addSaleDraft');
     setShowDraftPrompt(false);
     setIsDraftLoaded(true);
  };

  const toDateTimeLocal = (value?: string) => {
    if (!value) return new Date().toISOString().slice(0, 16);
    return value.includes('T') ? value.slice(0, 16) : `${value}T00:00`;
  };

  // Pre-fill logic
  useEffect(() => {
    if (fromOrder) {
        const selectedOrderId = localStorage.getItem('app_convert_order_id');
        const sourceOrder = selectedOrderId ? orders.find(o => o.id === selectedOrderId) : undefined;

        if (sourceOrder) {
          const selectedCustomer = customerList.find(c => c.id === sourceOrder.customerId) || {
            id: sourceOrder.customerId,
            name: sourceOrder.customerName,
            phone: sourceOrder.customerPhone,
            payTerm: '',
            creditLimit: 0,
            billingAddress: sourceOrder.deliveryAddress || '',
          };

          const mappedRows = sourceOrder.items.map((item, idx) => ({
            id: Date.now() + idx,
            productId: String(item.id ?? ''),
            name: item.name || '',
            qty: Number(item.qty || 0),
            unit: '',
            unitPrice: Number(item.price || 0),
            discount: 0,
            subtotal: Number(item.total || 0),
            tax: 0,
            total: Number(item.total || 0),
          }));

          setCustomer(selectedCustomer.id);
          setSelectedCustomerObj(selectedCustomer);
          setCustomerSearch(selectedCustomer.name);
          setRows(mappedRows.length ? mappedRows : [{
            id: 1, productId: '', name: '', qty: 1, unit: '', unitPrice: 0, discount: 0, subtotal: 0, tax: 0, total: 0
          }]);
          setSaleDate(toDateTimeLocal(sourceOrder.orderDate));
          setSellNote(
            sourceOrder.note
              ? `Converted from Order #${sourceOrder.orderNumber}. ${sourceOrder.note}`
              : `Converted from Order #${sourceOrder.orderNumber}`
          );
          setSourceOrderNumber(sourceOrder.orderNumber);
          setLocation(locations[0]?.name || sourceOrder.area || '');
          setShippingAddress(sourceOrder.deliveryAddress || '');
          setShippingDetails(sourceOrder.deliveryTimeSlot || '');
          setDeliveredTo(sourceOrder.customerName || '');
          setOrderTax(sourceOrder.taxType || 'None');
          setPaymentMethod(sourceOrder.paymentMethod || settings.defaultSalePaymentMethod || 'Cash');
          setStatus('Final');

          if (sourceOrder.orderType === 'Credit') {
            setSaleType('Credit Sale');
            setAmount(0);
          } else {
            setSaleType('Paid');
            setAmount(sourceOrder.total || 0);
          }
        } else {
          setSourceOrderNumber('');
          if (locations.length > 0 && !location) {
            setLocation(locations[0].name);
          }
        }

        localStorage.removeItem('app_convert_order_id');
    } else if (isEdit && saleId) {
        // Pre-fill for editing an existing sale from GlobalContext
        const existingSale = sales.find(s => s.id === saleId);
        if (!existingSale) {
          if (onNavigate) onNavigate('sales');
          return;
        }

        const selectedCustomer = customerList.find(c => c.id === String(existingSale.customerId)) || (
          existingSale.customerName ? {
            id: String(existingSale.customerId || ''),
            name: existingSale.customerName,
            phone: existingSale.contactNumber || '',
            payTerm: existingSale.payTerm || '',
            creditLimit: 0,
            billingAddress: existingSale.billingAddress || '',
          } : null
        );

        if (selectedCustomer) {
          handleCustomerSelect(selectedCustomer);
        } else {
          setCustomer(String(existingSale.customerId || ''));
          setCustomerSearch(existingSale.customerName || '');
        }

        setRows((existingSale.items || []).length > 0
          ? existingSale.items.map((item, idx) => ({
              id: Number(item.id) || Date.now() + idx,
              productId: item.id || '',
              name: item.name || '',
              qty: Number(item.qty || 0),
              unit: item.unit || '',
              unitPrice: Number(item.unitPrice || 0),
              discount: Number(item.discount || 0),
              subtotal: Number(item.subtotal || 0),
              tax: Number(item.tax || 0),
              total: Number(item.total || 0),
            }))
          : [{ id: 1, productId: '', name: '', qty: 1, unit: '', unitPrice: 0, discount: 0, subtotal: 0, tax: 0, total: 0 }]
        );

        setSaleDate(toDateTimeLocal(existingSale.date));
        setSellNote(existingSale.sellNote || '');
        setStatus((existingSale.status || existingSale.saleStatus || 'Final') as 'Final' | 'Draft' | 'Quotation');
        setSaleType(existingSale.saleType || (existingSale.paymentStatus === 'Paid' ? 'Paid' : 'Credit Sale'));
        setLocation(existingSale.location || locations[0]?.name || '');
        setInvoiceScheme(existingSale.invoiceScheme || 'Default');
        setShippingDetails(existingSale.shippingDetails || '');
        setShippingAddress(existingSale.shippingAddress || '');
        setShippingCharges(existingSale.shippingCharges || '');
        setShippingStatus(existingSale.shippingStatus || 'Ordered');
        setDeliveredTo(existingSale.deliveredTo || '');
        setPaymentMethod(existingSale.paymentMethod || settings.defaultSalePaymentMethod || 'Cash');
        setPaymentAccount(existingSale.paymentAccount || 'None');
        setPaymentNote(existingSale.paymentNote || '');
        setOrderTax(existingSale.tax || 'None');
        setDiscountType(existingSale.discountType || 'None');
        setDiscountAmount(existingSale.discountAmount || 0);
        setAmount(existingSale.totalPaid || 0);

        if (existingSale.payTerm) {
          const [num, unit] = existingSale.payTerm.split(' ');
          setPayTermNumber(num || '');
          setPayTermUnit(unit || 'Days');
        }
    } else if (locations.length > 0 && !location) {
        // Default to first location if adding new sale
        setLocation(locations[0].name);
    }
  }, [fromOrder, isEdit, saleId, locations, orders, customerList, settings.defaultSalePaymentMethod, sales, onNavigate]);

  // --- Calculations ---
  const subTotal = rows.reduce((acc, row) => acc + row.total, 0);

  const calculateGrandTotal = () => {
      let total = subTotal;
      
      // Discount
      if (discountType === 'Fixed' && typeof discountAmount === 'number') {
          total -= discountAmount;
      } else if (discountType === 'Percentage' && typeof discountAmount === 'number') {
          total -= (total * (discountAmount / 100));
      }

      // Order Tax (dynamic from taxRates)
      if (orderTax !== 'None') {
          const taxRateObj = taxRates.find(r => r.name === orderTax);
          if (taxRateObj) total += total * (taxRateObj.rate / 100);
      }

      // Shipping
      if (typeof shippingCharges === 'number') {
          total += shippingCharges;
      }

      return total;
  };

  const grandTotal = calculateGrandTotal();
  
  // Auto-update Amount based on Sale Type and Grand Total
  useEffect(() => {
    if (saleType === 'Credit Sale') {
        setAmount(0);
    } else {
        setAmount(grandTotal);
    }
  }, [saleType, grandTotal]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const paymentValue = typeof amount === 'number' ? amount : 0;
  const balance = grandTotal - paymentValue;
  const changeReturn = paymentValue > grandTotal ? paymentValue - grandTotal : 0;

  // --- Handlers ---
  const handleCustomerSelect = (cust: any) => {
      setCustomer(cust.id);
      setSelectedCustomerObj(cust);
      setCustomerSearch(cust.name);
      setIsCustomerDropdownOpen(false);
  };

  // Filter customers from real GlobalContext data
  const filteredCustomers = customerList.filter(c =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch))
  );

  // Product search for row line items
  const getFilteredProducts = (search: string) => {
    if (!search) return products.slice(0, 20);
    return products.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 20);
  };

  const handleProductSelectForRow = (rowId: number, product: any) => {
    const taxRateObj = taxRates.find(r => r.name === product.tax);
    const taxRate = taxRateObj ? taxRateObj.rate / 100 : 0;
    setRows(prev => prev.map(row => {
      if (row.id === rowId) {
        const price = product.sellingPrice || 0;
        const qty = row.qty || 1;
        const disc = row.discount || 0;
        const subtotal = (price * qty) - disc;
        const taxAmount = subtotal * taxRate;
        const total = subtotal + taxAmount;
        return { ...row, productId: product.id, name: product.name, unit: product.unit, unitPrice: price, tax: taxAmount, subtotal, total };
      }
      return row;
    }));
    setRowProductSearch(prev => ({ ...prev, [rowId]: product.name }));
    setRowProductDropdownOpen(prev => ({ ...prev, [rowId]: false }));
  };

  const handleAddRow = () => {
      const newId = Date.now();
      const newRow = {
          id: newId,
          productId: '',
          name: '',
          qty: 1,
          unit: '',
          unitPrice: 0,
          discount: 0,
          subtotal: 0,
          tax: 0,
          total: 0
      };
      setRows(prev => [...prev, newRow]);
  };

  const handleRemoveRow = (id: number) => {
      setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: number, field: string, value: any) => {
      setRows(rows.map(row => {
          if (row.id === id) {
              const updated = { ...row, [field]: value };
              // Simple recalc
              if (field === 'qty' || field === 'unitPrice' || field === 'discount') {
                  const price = parseFloat(updated.unitPrice) || 0;
                  const qty = parseFloat(updated.qty) || 0;
                  const disc = parseFloat(updated.discount) || 0;
                  updated.subtotal = (price * qty) - disc;
                  updated.total = updated.subtotal; // Assuming tax inclusive for demo or simple calc
              }
              return updated;
          }
          return row;
      }));
  };

  // --- Build Sale Object (single source of truth) ---
  const buildSaleObject = (existingSale?: any): any => {
    const locObj = locations.find(l => l.name === location);
    const scheme = locObj?.invoiceScheme || invoiceScheme;
    return {
      id: existingSale?.id || Date.now().toString(),
      date: saleDate,
      invoiceNo: existingSale?.invoiceNo || nextInvoiceNumber(locObj?.id),
      invoiceScheme: scheme,
      customerId: customer || 'WALK-IN',
      customerName: selectedCustomerObj?.name || 'Walk-in Customer',
      contactNumber: selectedCustomerObj?.phone || '',
      billingAddress: selectedCustomerObj?.billingAddress || '',
      shippingAddress,
      location,
      saleType,
      saleStatus: status,
      payTerm: payTermNumber ? `${payTermNumber} ${payTermUnit}` : '',
      paymentStatus: saleType === 'Credit Sale' ? 'Due' : (typeof amount === 'number' && amount >= grandTotal ? 'Paid' : amount > 0 ? 'Partial' : 'Due') as any,
      paymentMethod,
      paymentAccount,
      paymentNote,
      totalAmount: grandTotal,
      totalPaid: saleType === 'Credit Sale' ? 0 : (typeof amount === 'number' ? amount : 0),
      sellDue: saleType === 'Credit Sale' ? grandTotal : Math.max(0, grandTotal - (typeof amount === 'number' ? amount : 0)),
      discount: discountType === 'Percentage' ? `${discountAmount}%` : `${discountAmount}`,
      orderTax,
      shippingStatus: shippingStatus as any,
      shippingDetails,
      shippingCharges: typeof shippingCharges === 'number' ? shippingCharges : 0,
      deliveredTo,
      totalItems: rows.filter(r => r.name).length,
      addedBy: currentUser?.name || 'Admin',
      sellNote,
      staffNote: '',
      items: rows.filter(r => r.name).map(r => ({
        id: r.productId || r.id?.toString(),
        name: r.name,
        qty: parseFloat(r.qty) || 0,
        unit: r.unit || '',
        unitPrice: parseFloat(r.unitPrice) || 0,
        discount: parseFloat(r.discount) || 0,
        subtotal: parseFloat(r.subtotal) || 0,
        tax: parseFloat(r.tax) || 0,
        total: parseFloat(r.total) || 0,
      })),
      subTotal,
      discountType,
      discountAmount: typeof discountAmount === 'number' ? discountAmount : 0,
      tax: orderTax,
      grandTotal,
      status: status as any,
    };
  };

  // --- Action Handlers ---
  const handleSave = (andPrint = false) => {
      if (!location) {
          addNotification({ title: 'Error', message: 'Please select a Business Location.', type: 'error' });
          return;
      }
      if (rows.filter(r => r.name).length === 0) {
          addNotification({ title: 'Error', message: 'Please add at least one product.', type: 'error' });
          return;
      }

      const existingSale = isEdit && saleId ? sales.find(s => s.id === saleId) : undefined;
      const newSale = buildSaleObject(existingSale);

      if (isEdit) {
          updateSale(newSale);
      } else {
          addSale(newSale);
      }

      localStorage.removeItem('addSaleDraft');
      addNotification({
        title: isEdit ? 'Sale Updated' : 'Sale Created',
        message: `Invoice ${newSale.invoiceNo} has been successfully ${isEdit ? 'updated' : 'created'}.`,
        type: 'success'
      });

      if (andPrint) {
        setTimeout(() => window.print(), 300);
      }

      const targetPage = newSale.status === 'Draft'
        ? 'drafts'
        : newSale.status === 'Quotation'
          ? 'quotations'
          : 'sales';
      if (onNavigate) onNavigate(targetPage);
      setShowPreview(false);
  };

  const handleSaveAndPrint = () => handleSave(true);

  // --- Formatting Helper (uses settings currency) ---
  const formatRiyal = (val: number) => formatCurrency(val);

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
                        <p className="text-amber-700 text-sm">You have an unsaved sale draft. Would you like to restore it?</p>
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

        {/* FROM ORDER BANNER */}
        {fromOrder && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between animate-in slide-in-from-top-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        <FileCheck size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Converting Order to Invoice</h3>
                        <p className="text-blue-100 text-sm">{sourceOrderNumber ? `Order #${sourceOrderNumber} details have been pre-filled.` : 'Order details have been pre-filled.'}</p>
                    </div>
                </div>
                <button onClick={() => onNavigate && onNavigate('orders')} className="text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors font-medium">
                    Cancel & Return
                </button>
            </div>
        )}

        {/* Header */}
        <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                {isEdit ? <Edit className="text-blue-600" size={32} /> : <ShoppingCart className="text-blue-600" size={32} />}
                {isEdit ? 'Edit Sale' : 'Add Sale'}
            </h2>
            <p className="text-slate-500 mt-1 text-lg">
                {isEdit ? 'Modify details of existing invoice.' : 'Create a new invoice for a customer.'}
            </p>
        </div>

            {/* 1. Customer & General Info */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
            
            {/* Row 1: Business Location & Sale Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Business Location <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select 
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        >
                            <option value="">Select Location</option>
                            {locations.map(loc => (
                                <option key={loc.id} value={loc.name}>{loc.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sale Date <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="datetime-local" 
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700" 
                            value={saleDate}
                            onChange={(e) => setSaleDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Row 2: Sale Type, Customer, Pay Term */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sale Type <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select 
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                            value={saleType}
                            onChange={(e) => setSaleType(e.target.value)}
                        >
                            <option>Paid</option>
                            <option>Credit Sale</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>

                {/* SEARCHABLE CUSTOMER DROPDOWN */}
                <div className="group" ref={customerDropdownRef}>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Customer <span className="text-red-500">*</span></label>
                    <div className="flex gap-2 relative">
                        <div className="relative w-full">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text"
                                className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 placeholder:font-normal"
                                placeholder="Type to search..."
                                value={customerSearch}
                                onChange={(e) => {
                                    setCustomerSearch(e.target.value);
                                    setIsCustomerDropdownOpen(true);
                                    if(e.target.value === '') {
                                        setCustomer('');
                                        setSelectedCustomerObj(null);
                                    }
                                }}
                                onFocus={() => setIsCustomerDropdownOpen(true)}
                            />
                            {isCustomerDropdownOpen && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-60 overflow-y-auto custom-scrollbar">
                                    {filteredCustomers.length > 0 ? (
                                        filteredCustomers.map(cust => (
                                            <div 
                                                key={cust.id}
                                                className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center"
                                                onClick={() => handleCustomerSelect(cust)}
                                            >
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">{cust.name}</div>
                                                    {cust.phone && <div className="text-xs text-slate-400">{cust.phone}</div>}
                                                </div>
                                                <div className="text-[10px] font-bold px-2 py-1 bg-slate-100 rounded text-slate-500">
                                                    {cust.type}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-4 py-3 text-sm text-slate-400 italic">No customers found</div>
                                    )}
                                </div>
                            )}
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                        <button className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md transition-transform active:scale-95 flex-shrink-0"><Plus size={20} /></button>
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">Pay Term <Info size={12} className="text-blue-500" /></label>
                    <div className="flex">
                        <input 
                            type="number" 
                            placeholder="Term" 
                            className="w-1/2 px-4 py-3 rounded-l-xl bg-slate-50 border-r border-slate-200 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 outline-none"
                            value={payTermNumber}
                            onChange={(e) => setPayTermNumber(e.target.value)}
                        />
                        <select 
                            className="w-1/2 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer outline-none"
                            value={payTermUnit}
                            onChange={(e) => setPayTermUnit(e.target.value)}
                        >
                            <option value="Days">Days</option>
                            <option value="Months">Months</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Status <span className="text-red-500">*</span></label>
                    <select 
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option>Final</option>
                        <option>Draft</option>
                        <option>Quotation</option>
                        <option>Proforma</option>
                    </select>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Invoice Scheme</label>
                    <select 
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                        value={invoiceScheme}
                        onChange={(e) => setInvoiceScheme(e.target.value)}
                    >
                        <option>Default</option>
                        <option>Format A</option>
                    </select>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Attach Document</label>
                    <div className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 hover:border-blue-400 transition-colors cursor-pointer group hover:bg-white">
                        <Upload size={18} className="text-slate-400 group-hover:text-blue-500" />
                        <span className="text-xs font-medium text-slate-500">pdf, csv, zip, doc, jpg, png</span>
                    </div>
                </div>
            </div>
        </div>

        {/* 2. Products Grid */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
             
             {/* Search Bar */}
             <div className="mb-8 flex justify-center">
                 <div className="relative w-full max-w-4xl group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Search size={22} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input 
                        type="text" 
                        className="block w-full pl-14 pr-16 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-lg text-slate-800 shadow-sm placeholder:text-slate-400 placeholder:font-medium" 
                        placeholder="Enter Product name / SKU / Scan bar code"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddRow()}
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center">
                        <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-blue-600 hover:bg-blue-50 hover:border-blue-200 shadow-sm transition-all" onClick={handleAddRow}>
                            <Plus size={20} />
                        </button>
                    </div>
                </div>
             </div>

             {/* Table */}
             <div className="overflow-x-auto rounded-xl border border-slate-200 mb-4">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-[#5cb85c] text-white text-[11px] font-bold uppercase tracking-wider">
                            <th className="p-4 text-center w-12">#</th>
                            <th className="p-4 text-left w-64 border-l border-[#4cae4c]">Product Name</th>
                            <th className="p-4 text-center w-32 border-l border-[#4cae4c]">Quantity</th>
                            <th className="p-4 text-right w-40 border-l border-[#4cae4c]">Unit Price</th>
                            <th className="p-4 text-right w-32 border-l border-[#4cae4c]">Discount</th>
                            <th className="p-4 text-right w-40 border-l border-[#4cae4c]">Subtotal</th>
                            <th className="p-4 text-right w-32 border-l border-[#4cae4c]">Tax</th>
                            <th className="p-4 text-right w-40 border-l border-[#4cae4c]">Total</th>
                            <th className="p-4 text-center w-12 border-l border-[#4cae4c]"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {rows.map((row, index) => {
                          const prodSearch = rowProductSearch[row.id] ?? row.name;
                          const prodDropOpen = rowProductDropdownOpen[row.id] ?? false;
                          const filteredProds = getFilteredProducts(prodSearch && prodSearch !== row.name ? prodSearch : '');
                          const selectedProduct = products.find(p => p.id === row.productId);
                          return (
                            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 text-center font-bold text-slate-500">{index + 1}</td>
                                <td className="p-2 font-bold text-slate-800 min-w-[220px]">
                                    {/* Real product search input */}
                                    <div className="relative">
                                      <input
                                        type="text"
                                        value={prodSearch}
                                        placeholder="Search product by name or SKU..."
                                        onFocus={() => setRowProductDropdownOpen(prev => ({ ...prev, [row.id]: true }))}
                                        onChange={(e) => {
                                          setRowProductSearch(prev => ({ ...prev, [row.id]: e.target.value }));
                                          setRowProductDropdownOpen(prev => ({ ...prev, [row.id]: true }));
                                        }}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white"
                                      />
                                      {prodDropOpen && (
                                        <div className="absolute left-0 top-full mt-1 w-80 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-56 overflow-y-auto">
                                          {filteredProds.length > 0 ? filteredProds.map(p => (
                                            <div
                                              key={p.id}
                                              className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0"
                                              onMouseDown={() => handleProductSelectForRow(row.id, p)}
                                            >
                                              <div className="font-bold text-sm text-slate-800">{p.name}</div>
                                              <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                                                <span>SKU: {p.sku}</span>
                                                <span className={`font-bold ${p.stock <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>Stock: {p.stock}</span>
                                                <span>Price: {formatCurrency(p.sellingPrice)}</span>
                                              </div>
                                            </div>
                                          )) : (
                                            <div className="px-3 py-4 text-center text-slate-400 text-sm">No products found</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    {selectedProduct && (
                                      <div className="text-[10px] text-slate-400 font-normal mt-0.5 px-1">
                                        Stock: {selectedProduct.stock} {selectedProduct.unit} | {selectedProduct.category}
                                      </div>
                                    )}
                                </td>
                                <td className="p-4">
                                    <input 
                                        type="number" 
                                        value={row.qty}
                                        onChange={(e) => updateRow(row.id, 'qty', e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    />
                                </td>
                                <td className="p-4">
                                    <input 
                                        type="number" 
                                        value={row.unitPrice} 
                                        onChange={(e) => updateRow(row.id, 'unitPrice', e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-medium text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    />
                                </td>
                                <td className="p-4">
                                    <input 
                                        type="number" 
                                        value={row.discount} 
                                        onChange={(e) => updateRow(row.id, 'discount', e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-medium text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                                        placeholder="0.00"
                                    />
                                </td>
                                <td className="p-4 text-right font-medium text-slate-600">{row.subtotal.toFixed(3)}</td>
                                <td className="p-4 text-right text-slate-500">{row.tax.toFixed(3)}</td>
                                <td className="p-4 text-right font-bold text-slate-800">{row.total.toFixed(3)}</td>
                                <td className="p-4 text-center">
                                    <button onClick={() => handleRemoveRow(row.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                                </td>
                            </tr>
                          );
                        })}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                                    Scan barcode or search to add items
                                </td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-700 uppercase">
                        <tr>
                            <td colSpan={2} className="p-4">Total Items: <span className="text-slate-900 ml-1">{rows.length}</span></td>
                            <td colSpan={5} className="p-4 text-right">Net Total Amount:</td>
                            <td className="p-4 text-right font-mono text-base text-slate-900">{subTotal.toFixed(3)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
             </div>
        </div>

        {/* 3. Discount, Tax & Note */}
        <div className="bg-white rounded shadow-sm border border-slate-200 p-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                 <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Discount Type:*</label>
                    <select 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value)}
                    >
                        <option>Percentage</option>
                        <option>Fixed</option>
                    </select>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Discount Amount:*</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm" 
                            value={discountAmount}
                            onChange={(e) => setDiscountAmount(parseFloat(e.target.value))}
                        />
                        <Info size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Order Tax:*</label>
                    <select 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={orderTax}
                        onChange={(e) => setOrderTax(e.target.value)}
                    >
                        <option value="None">None</option>
                        {taxRates.map(tr => (
                          <option key={tr.id} value={tr.name}>{tr.name} ({tr.rate}%)</option>
                        ))}
                    </select>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                 <div className="group md:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Sell note</label>
                    <textarea 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm resize-none" 
                        rows={3}
                        value={sellNote}
                        onChange={(e) => setSellNote(e.target.value)}
                    ></textarea>
                </div>
             </div>
             
             <div className="flex justify-end text-xs text-slate-500 space-y-1 flex-col items-end border-t border-slate-100 pt-4">
                 <div className="flex justify-between w-64"><span>Discount Amount: (-)</span> <span>0.000</span></div>
                 <div className="flex justify-between w-64"><span>Order Tax: (+)</span> <span>0.000</span></div>
             </div>
        </div>

        {/* 4. Shipping */}
        <div className="bg-white rounded shadow-sm border border-slate-200 p-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                 <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Shipping Details</label>
                    <textarea 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm resize-none" 
                        rows={2}
                        value={shippingDetails}
                        onChange={(e) => setShippingDetails(e.target.value)}
                    ></textarea>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Shipping Address</label>
                    <textarea 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm resize-none" 
                        rows={2}
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                    ></textarea>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Shipping Charges</label>
                    <div className="relative">
                        <Info size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="number" 
                            className="w-full pl-9 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm" 
                            placeholder="0.000"
                            value={shippingCharges}
                            onChange={(e) => setShippingCharges(parseFloat(e.target.value))}
                        />
                    </div>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Shipping Status</label>
                    <select 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={shippingStatus}
                        onChange={(e) => setShippingStatus(e.target.value)}
                    >
                        <option>Please Select</option>
                        <option>Ordered</option>
                        <option>Delivered</option>
                    </select>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Delivered To</label>
                    <input 
                        type="text" 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                        value={deliveredTo}
                        onChange={(e) => setDeliveredTo(e.target.value)}
                    />
                </div>
             </div>
             
             <div className="flex justify-end pt-4 border-t border-slate-100">
                 <div className="text-right">
                     <span className="block text-xs font-bold text-slate-700 uppercase mb-1">Total Payable:</span>
                     <span className="text-lg font-bold text-slate-900">OMR {grandTotal.toFixed(3)}</span>
                 </div>
             </div>
        </div>

        {/* 4. Payment */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-700 to-slate-900"></div>
             <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
                <CreditCard size={20} className="text-slate-700" /> Add Payment
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">Advance Balance <Info size={12} /></label>
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
                            className={`w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-bold text-slate-900 ${saleType === 'Credit Sale' ? 'opacity-50 cursor-not-allowed' : ''}`} 
                            placeholder="0.000"
                            value={amount}
                            onChange={(e) => setAmount(parseFloat(e.target.value))}
                            readOnly={saleType === 'Credit Sale'}
                        />
                    </div>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Paid on <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="datetime-local" 
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-bold text-slate-700" 
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                        />
                    </div>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Method <span className="text-red-500">*</span></label>
                    <select
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                        {(() => {
                          const locObj = locations.find(l => l.name === location);
                          const methods = locObj?.paymentMethods?.filter(pm => pm.enabled) || [];
                          if (methods.length > 0) {
                            return methods.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>);
                          }
                          return ['Cash', 'Card', 'Cheque', 'Bank Transfer'].map(m => <option key={m} value={m}>{m}</option>);
                        })()}
                    </select>
                </div>
                <div className="md:col-span-2 group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Account</label>
                    <select 
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                        value={paymentAccount}
                        onChange={(e) => setPaymentAccount(e.target.value)}
                    >
                        <option>None</option>
                        <option>Cash Account</option>
                        <option>Bank Account</option>
                    </select>
                </div>
                <div className="md:col-span-2 group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Note</label>
                    <textarea 
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-medium text-slate-700 resize-none" 
                        rows={1}
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                    ></textarea>
                </div>
            </div>

            <div className="pt-6 border-t border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Change Return</label>
                        <div className="text-xl font-mono font-bold text-slate-700">
                            {formatRiyal(changeReturn)}
                        </div>
                    </div>
                    <div className="text-right">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Balance</label>
                        <div className={`text-xl font-mono font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatRiyal(Math.max(0, balance))}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-md text-white px-3 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-white/10 hover:scale-105 transition-transform duration-300">
             <button 
                className="px-6 py-2.5 rounded-full font-bold text-xs bg-slate-700 hover:bg-slate-600 shadow-lg transition flex items-center gap-2"
                onClick={() => setShowPreview(true)}
             >
                <Eye size={16} /> Preview
            </button>
             <button onClick={handleSave} className="px-6 py-2.5 rounded-full font-bold text-xs bg-indigo-600 hover:bg-indigo-500 shadow-lg transition flex items-center gap-2">
                <Save size={16} /> {isEdit ? 'Update' : 'Save'}
            </button>
            <button onClick={handleSaveAndPrint} className="px-6 py-2.5 rounded-full font-bold text-xs bg-emerald-600 hover:bg-emerald-500 shadow-lg transition flex items-center gap-2">
                <Printer size={16} /> Save & Print
            </button>
       </div>

        {/* Invoice Preview Modal */}
        {showPreview && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white w-full rounded-2xl shadow-2xl max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                    
                    {/* Modal Header */}
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <FileText size={18} className="text-slate-500" /> Invoice Preview
                        </h3>
                        <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Invoice Content */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="border border-slate-200 rounded-lg p-8 bg-white shadow-sm min-h-[600px] flex flex-col">
                            
                            {/* Invoice Header */}
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <div className="flex items-baseline mb-2">
                                        <span className="text-2xl font-black italic tracking-tighter text-red-600 mr-[1px]">A</span>
                                        <span className="text-2xl font-black italic tracking-tighter text-slate-900">TWAR</span>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        ATWAR AL MUSTAQBAL<br />
                                        Muscat, Oman<br />
                                        CR: 12345678<br />
                                        VAT: OM123456789
                                    </p>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-2xl font-bold text-slate-900 mb-1">INVOICE</h2>
                                    <p className="text-sm font-medium text-slate-500 mb-1"># INV-{Date.now().toString().slice(-6)}</p>
                                    <p className="text-xs text-slate-400">Date: {new Date(saleDate).toLocaleDateString()}</p>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 my-4"></div>

                            {/* Bill To */}
                            <div className="mb-8">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Bill To:</h4>
                                <p className="text-sm font-bold text-slate-800">
                                    {selectedCustomerObj ? selectedCustomerObj.name : 'Unknown Customer'}
                                </p>
                                <p className="text-xs text-slate-500">Muscat, Oman</p>
                                <p className="text-xs text-slate-500">Ph: {selectedCustomerObj ? selectedCustomerObj.phone : '+968...'}</p>
                            </div>

                            {/* Items Table */}
                            <div className="mb-8">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                        <tr>
                                            <th className="py-3 px-4 font-bold">Item</th>
                                            <th className="py-3 px-4 text-center font-bold">Qty</th>
                                            <th className="py-3 px-4 text-right font-bold">Price</th>
                                            <th className="py-3 px-4 text-right font-bold">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {rows.map((row, i) => (
                                            <tr key={i}>
                                                <td className="py-3 px-4 font-medium text-slate-700">{row.name}</td>
                                                <td className="py-3 px-4 text-center text-slate-600">{row.qty}</td>
                                                <td className="py-3 px-4 text-right text-slate-600">{row.unitPrice.toFixed(3)}</td>
                                                <td className="py-3 px-4 text-right font-bold text-slate-800">{row.total.toFixed(3)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals */}
                            <div className="mt-auto flex justify-end">
                                <div className="w-64 space-y-2">
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>Subtotal:</span>
                                        <span>{subTotal.toFixed(3)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>Tax ({orderTax}):</span>
                                        <span>{(() => {
                                          if (orderTax === 'None') return '0.000';
                                          const tr = taxRates.find(r => r.name === orderTax);
                                          return tr ? (subTotal * (tr.rate / 100)).toFixed(3) : '0.000';
                                        })()}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>Discount:</span>
                                        <span>-{typeof discountAmount === 'number' ? discountAmount.toFixed(3) : '0.000'}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>Shipping:</span>
                                        <span>{typeof shippingCharges === 'number' ? shippingCharges.toFixed(3) : '0.000'}</span>
                                    </div>
                                    <div className="border-t border-slate-200 pt-2 flex justify-between text-lg font-black text-slate-900">
                                        <span>Total:</span>
                                        <span>{formatRiyal(grandTotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-emerald-600 font-bold pt-1">
                                        <span>Paid:</span>
                                        <span>{formatRiyal(paymentValue)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-red-600 font-bold">
                                        <span>Balance Due:</span>
                                        <span>{formatRiyal(balance)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-8 text-center text-[10px] text-slate-400">
                                <p>Thank you for your business!</p>
                                <p>Terms & Conditions Apply.</p>
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                        <button onClick={() => setShowPreview(false)} className="px-6 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-white hover:shadow-sm transition-all text-sm">
                            Close
                        </button>
                        <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 shadow-lg transition-all text-sm flex items-center gap-2">
                            <Save size={16} /> Save
                        </button>
                        <button onClick={handleSaveAndPrint} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 transition-all text-sm flex items-center gap-2">
                            <Printer size={16} /> Save & Print
                        </button>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

export default AddSale;
