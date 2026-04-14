import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  FileText, Download, Printer, ChevronDown,
  Edit, SlidersHorizontal,
  CreditCard, Eye, Ban, ShoppingBag, StickyNote, X, Filter,
  CheckCircle2, FileSpreadsheet, Paperclip,
  DollarSign, Calendar as CalendarIcon, Banknote, Trash2, Users
} from 'lucide-react';
import MultiSelect from '@/components/shared/MultiSelect';
import { useGlobalContext, Customer as GlobalCustomer } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { printActiveReportTable, printDocument, statusBadge as printStatusBadge } from '@/utils/printUtils';
import { clampPrecision, normalizePrefix, toFixedPrecision } from '@/utils/paymentUtils';
import { buildPaginationItems } from '@/utils/pagination';
import {
  buildPaymentAccountOptions,
  PAYMENT_ACCOUNTS_UPDATED_EVENT,
  resolveDefaultAccountFromMethod,
} from '@/utils/paymentAccounts';

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
  customerGroupId?: string;
  customerGroup: string;
  address: string;
  mobile: string;
  totalSellDue: number;
  totalSellReturnDue: number;
  status: 'Active' | 'Inactive';
  assignedTo?: string;
  lastSellDate?: string; // YYYY-MM-DD for filtering logic
  contactCategory?: 'Individual' | 'Business';
  customValues?: Record<string, string>;
  rebatePercent?: number;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  transformOrigin: string;
}


interface CustomersProps {
    onNavigate: (page: string) => void;
}

type ConfirmationActionType = 'deactivate' | 'activate' | 'deleteCustomer' | 'removeCustomField';

const Customers: React.FC<CustomersProps> = ({ onNavigate }) => {
  // Pull ALL customers from GlobalContext — single source of truth
  const {
    customers: globalCustomers,
    setCustomers: globalSetCustomers,
    addCustomer: globalAddCustomer,
    updateCustomer: globalUpdateCustomer,
    deleteCustomer: globalDeleteCustomer,
    sales,
    customerGroups,
    locations,
    users,
    addPayment: globalAddPayment,
    formatCurrency,
    generateId,
    settings,
    currentUser,
  } = useGlobalContext();
  const { addNotification } = useNotifications();

  // Local alias (typed as GlobalCustomer for compatibility)
  const customers = globalCustomers;
  const normalizeText = (value?: string) => String(value || '').trim().toLowerCase();
  const customerGroupOptions = customerGroups;
  const activeCustomerGroupOptions = useMemo(
    () => customerGroups.filter(g => (g.status || 'Active') === 'Active'),
    [customerGroups]
  );
  const customerGroupFilterOptions = useMemo(() => Array.from(new Set([
    ...customerGroupOptions.map(g => g.name),
    ...customers.map(c => c.customerGroup).filter(Boolean),
  ])), [customerGroupOptions, customers]);

  const resolveCustomerGroupLink = (groupId?: string, groupName?: string) => {
    if (groupId) {
      const byId = customerGroupOptions.find(g => g.id === groupId);
      if (byId) return { id: byId.id, name: byId.name };
    }
    if (groupName) {
      const byName = customerGroupOptions.find(g => normalizeText(g.name) === normalizeText(groupName));
      if (byName) return { id: byName.id, name: byName.name };
      return { id: '', name: groupName };
    }
    return { id: '', name: '' };
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-right' });
  const [showFilters, setShowFilters] = useState(true);
  
  // Custom Fields State — persisted to localStorage so definitions survive page refresh
  const [customColumns, setCustomColumns] = useState<string[]>(() => {
    try { const s = localStorage.getItem('app_customer_custom_columns'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  useEffect(() => { localStorage.setItem('app_customer_custom_columns', JSON.stringify(customColumns)); }, [customColumns]);
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
  const selectableCustomerGroupOptions = useMemo(() => {
    if (!formData.customerGroupId) return activeCustomerGroupOptions;
    const exists = activeCustomerGroupOptions.some(g => g.id === formData.customerGroupId);
    if (exists) return activeCustomerGroupOptions;
    const linkedInactive = customerGroupOptions.find(g => g.id === formData.customerGroupId);
    return linkedInactive ? [...activeCustomerGroupOptions, linkedInactive] : activeCustomerGroupOptions;
  }, [activeCustomerGroupOptions, customerGroupOptions, formData.customerGroupId]);

  // Pay Term fields for modal
  const [payTermDays, setPayTermDays] = useState<string>('');
  const [payTermUnit, setPayTermUnit] = useState<string>('Days');

  // Pagination
  const [pageSize, setPageSize] = useState(Number(settings.defaultTableEntries) || 25);
  const [currentPage, setCurrentPage] = useState(1);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [paymentAccount, setPaymentAccount] = useState('Cash Account');
  const [payFileName, setPayFileName] = useState('');

  const handleDelete = (customer: GlobalCustomer) => {
    setConfirmationModal({
      isOpen: true,
      type: 'deleteCustomer',
      customerId: customer.id,
      customerName: customer.businessName || customer.name,
      customFieldName: '',
    });
    setActiveActionId(null);
  };
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [payRebateEnabled, setPayRebateEnabled] = useState(false);
  const [payChequeDate, setPayChequeDate] = useState('');
  const [payChequeNo, setPayChequeNo] = useState('');
  const [payChequeBankName, setPayChequeBankName] = useState('');
  const [payChequeDrawerName, setPayChequeDrawerName] = useState('');
  const [accountOptionsVersion, setAccountOptionsVersion] = useState(0);

  // Confirmation Modal State
  const [confirmationModal, setConfirmationModal] = useState<{
      isOpen: boolean;
      type: ConfirmationActionType;
      customerId: string | null;
      customerName: string;
      customFieldName: string;
  }>({
      isOpen: false,
      type: 'deactivate',
      customerId: null,
      customerName: '',
      customFieldName: '',
  });

  // GlobalContext handles localStorage persistence — no need to duplicate here

  const assignableUsers = useMemo(() => {
    const names = users.length > 0 ? users.map(u => u.name).filter(Boolean) : [];
    if (names.length > 0) return Array.from(new Set(names));
    return [currentUser?.name || 'Admin'];
  }, [users, currentUser]);

  const paymentMethodOptions = useMemo(() => {
    const methods = locations
      .flatMap(location => location.paymentMethods || [])
      .filter(method => method.enabled)
      .map(method => method.name)
      .filter(Boolean);
    return Array.from(new Set(methods)).length > 0
      ? Array.from(new Set(methods))
      : ['Cash', 'Card', 'Cheque', 'Bank Transfer'];
  }, [locations]);

  const paymentAccountOptions = useMemo(() => {
    return buildPaymentAccountOptions({
      locations,
      methodName: paymentMethod,
      includeAllLocationAccounts: true,
      includeStoredAccounts: true,
      includeNone: false,
    });
  }, [locations, paymentMethod, accountOptionsVersion]);

  useEffect(() => {
    const handleAccountsUpdated = () => setAccountOptionsVersion(prev => prev + 1);
    window.addEventListener(PAYMENT_ACCOUNTS_UPDATED_EVENT, handleAccountsUpdated as EventListener);
    return () => window.removeEventListener(PAYMENT_ACCOUNTS_UPDATED_EVENT, handleAccountsUpdated as EventListener);
  }, []);

  useEffect(() => {
    const resolvedAccount = resolveDefaultAccountFromMethod(paymentMethod || 'Cash');
    if (paymentAccount !== resolvedAccount) {
      setPaymentAccount(resolvedAccount);
    }
  }, [paymentMethod, paymentAccount]);

  const currencyPrecision = clampPrecision(Number(settings.currencyPrecision ?? 3));
  const currencySymbol = settings.currencySymbol || settings.currencyCode || '';
  const amountStep = currencyPrecision > 0 ? `0.${'0'.repeat(currencyPrecision - 1)}1` : '1';

  const resetCustomerForm = () => {
    const defaultGroup = activeCustomerGroupOptions[0] || customerGroupOptions[0];
    setEditingCustomerId(null);
    setFormData({
      id: '',
      businessName: '',
      name: '',
      email: '',
      taxNumber: '',
      creditLimit: Number(settings.defaultCreditLimit) || 0,
      payTerm: settings.defaultPayTerm || '',
      openingBalance: 0,
      advanceBalance: 0,
      addedOn: new Date().toISOString().split('T')[0],
      customerGroupId: defaultGroup?.id || '',
      customerGroup: defaultGroup?.name || '',
      address: '',
      mobile: '',
      totalSellDue: 0,
      totalSellReturnDue: 0,
      status: 'Active',
      assignedTo: currentUser?.name || 'Admin',
      lastSellDate: new Date().toISOString().split('T')[0],
      contactCategory: 'Business',
      customValues: {},
    });
    const defaultPayTermMatch = (settings.defaultPayTerm || '').match(/^\s*(\d+)\s*(Days|Months)\s*$/i);
    setPayTermDays(defaultPayTermMatch ? defaultPayTermMatch[1] : '');
    setPayTermUnit(defaultPayTermMatch ? (defaultPayTermMatch[2].toLowerCase() === 'months' ? 'Months' : 'Days') : 'Days');
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setIsAddingCustomField(false);
    setNewCustomFieldName('');
    resetCustomerForm();
  };

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
    const alreadyExists = customColumns.some(col => col.toLowerCase() === trimmedName.toLowerCase());
    if (trimmedName && !alreadyExists) {
      setCustomColumns([...customColumns, trimmedName]);
      setNewCustomFieldName('');
      setIsAddingCustomField(false);
    } else if (!trimmedName) {
      setIsAddingCustomField(false);
    } else {
      addNotification({ title: 'Duplicate Field', message: `Custom field "${trimmedName}" already exists.`, type: 'warning' });
    }
  };

  const removeCustomField = (fieldToRemove: string) => {
    setConfirmationModal({
      isOpen: true,
      type: 'removeCustomField',
      customerId: null,
      customerName: '',
      customFieldName: fieldToRemove,
    });
  };

  const handleSaveCustomer = () => {
    const businessName = String(formData.businessName || '').trim();
    const contactName = String(formData.name || '').trim();
    const effectiveBusinessName = businessName || contactName;
    const mobile = String(formData.mobile || '').trim();
    const email = String(formData.email || '').trim();
    const taxNumber = String(formData.taxNumber || '').trim();
    const idInput = String(formData.id || '').trim();
    const isEdit = !!editingCustomerId;
    const existing = isEdit ? customers.find(c => c.id === editingCustomerId) : null;

    if (!contactName) {
      addNotification({
        title: 'Missing Required Fields',
        message: 'Name is required.',
        type: 'error',
      });
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      addNotification({
        title: 'Invalid Email',
        message: 'Please enter a valid email address.',
        type: 'error',
      });
      return;
    }

    if (payTermDays && Number(payTermDays) < 0) {
      addNotification({
        title: 'Invalid Pay Term',
        message: 'Pay term days cannot be negative.',
        type: 'error',
      });
      return;
    }

    if (isEdit && !existing) {
      addNotification({
        title: 'Customer Not Found',
        message: 'This customer no longer exists. Refresh and try again.',
        type: 'error',
      });
      return;
    }

    const resolvedId = isEdit ? existing!.id : (idInput || generateId('CUST-'));
    const normalize = (value: string) => value.trim().toLowerCase();
    const normalizeMobile = (value: string) => {
      const digits = String(value || '').replace(/\D+/g, '');
      return digits || normalize(value);
    };

    const duplicateId = customers.some(c => c.id === resolvedId && c.id !== editingCustomerId);
    if (duplicateId) {
      addNotification({
        title: 'Duplicate Contact ID',
        message: `Customer ID "${resolvedId}" already exists.`,
        type: 'error',
      });
      return;
    }

    const duplicateBusiness = customers.some(c => c.id !== editingCustomerId && normalize(c.businessName) === normalize(effectiveBusinessName));
    if (duplicateBusiness) {
      addNotification({
        title: 'Duplicate Business Name',
        message: `A customer with business name "${effectiveBusinessName}" already exists.`,
        type: 'error',
      });
      return;
    }

    const normalizedMobile = normalizeMobile(mobile);
    if (normalizedMobile) {
      const duplicateMobile = customers.some(c =>
        c.id !== editingCustomerId &&
        normalizeMobile(String(c.mobile || '')) === normalizedMobile
      );
      if (duplicateMobile) {
        addNotification({
          title: 'Duplicate Mobile',
          message: `A customer with mobile "${mobile}" already exists.`,
          type: 'error',
        });
        return;
      }
    }

    if (email) {
      const duplicateEmail = customers.some(c => c.id !== editingCustomerId && normalize(c.email || '') === normalize(email));
      if (duplicateEmail) {
        addNotification({
          title: 'Duplicate Email',
          message: `A customer with email "${email}" already exists.`,
          type: 'error',
        });
        return;
      }
    }

    if (Number(formData.openingBalance) < 0) {
      addNotification({
        title: 'Invalid Opening Balance',
        message: 'Opening balance cannot be negative.',
        type: 'error',
      });
      return;
    }

    const linkedCustomerGroup = resolveCustomerGroupLink(
      formData.customerGroupId,
      formData.customerGroup
    );

    const builtPayTerm = payTermDays
      ? `${Math.max(0, Number(payTermDays))} ${payTermUnit}`
      : (formData.payTerm || settings.defaultPayTerm || 'No Limit');
    const openingBalance = Number(formData.openingBalance) || 0;
    const creditLimit = Number(formData.creditLimit) || 0;
    const advanceBalance = Number(formData.advanceBalance) || 0;
    const today = new Date().toISOString().split('T')[0];
    const addedOnInput = String(formData.addedOn || '').trim();
    const addedOn = /^\d{4}-\d{2}-\d{2}$/.test(addedOnInput) ? addedOnInput : (existing?.addedOn || today);

    const newCustomer: GlobalCustomer = {
      id: resolvedId,
      type: 'Customer',
      businessName: effectiveBusinessName,
      name: contactName,
      email,
      mobile,
      taxNumber,
      creditLimit,
      payTerm: builtPayTerm,
      openingBalance,
      advanceBalance,
      addedOn,
      customerGroupId: linkedCustomerGroup.id,
      customerGroup: linkedCustomerGroup.name,
      address: formData.address || '',
      totalSellDue: isEdit ? (existing?.totalSellDue ?? 0) : 0,
      totalSellReturnDue: isEdit ? (existing?.totalSellReturnDue ?? 0) : 0,
      status: formData.status || 'Active',
      assignedTo: formData.assignedTo || currentUser?.name || 'Admin',
      lastSellDate: formData.lastSellDate || today,
      customValues: formData.customValues || {},
      contactCategory: formData.contactCategory || 'Business',
      rebatePercent: formData.rebatePercent ?? undefined,
    };

    if (isEdit) {
      globalUpdateCustomer(newCustomer);
      addNotification({ title: 'Customer Updated', message: `"${effectiveBusinessName}" was updated successfully.`, type: 'success' });
    } else {
      globalAddCustomer(newCustomer);
      addNotification({ title: 'Customer Added', message: `"${effectiveBusinessName}" was added successfully.`, type: 'success' });
    }

    closeAddModal();
  };

  const handlePay = (customer: Customer) => {
    setPaymentCustomer(customer);
    setPaymentAmount(Math.max(0, Number(customer.totalSellDue || 0)).toFixed(currencyPrecision));
    setPaymentDate(new Date().toISOString().slice(0, 16));
    const defaultMethod = paymentMethodOptions[0] || 'Cash';
    setPaymentMethod(defaultMethod);
    setPaymentAccount(resolveDefaultAccountFromMethod(defaultMethod));
    setPaymentNote('');
    setPayRebateEnabled(Number(customer.rebatePercent || 0) > 0);
    setIsPaymentModalOpen(true);
    setActiveActionId(null);
  };

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setPaymentCustomer(null);
    setPaymentAmount('');
    setPaymentDate('');
    const defaultMethod = paymentMethodOptions[0] || 'Cash';
    setPaymentMethod(defaultMethod);
    setPaymentNote('');
    setPaymentAccount(resolveDefaultAccountFromMethod(defaultMethod));
    setPayFileName('');
    setPayRebateEnabled(false);
    setPayChequeDate(''); setPayChequeNo(''); setPayChequeBankName(''); setPayChequeDrawerName('');
  };

  const processPayment = () => {
    if (!paymentCustomer) return;
    if (!paymentDate) {
      addNotification({ title: 'Missing Date', message: 'Please select a payment date.', type: 'error' });
      return;
    }
    if (!paymentMethod) {
      addNotification({ title: 'Missing Method', message: 'Please select a payment method.', type: 'error' });
      return;
    }

    const amountPaid = parseFloat(paymentAmount || '0');
    if (isNaN(amountPaid) || amountPaid <= 0) {
      addNotification({ title: 'Invalid Amount', message: 'Please enter an amount greater than 0.', type: 'error' });
      return;
    }
    const roundedAmount = Number(toFixedPrecision(amountPaid, currencyPrecision));
    const dateValue = paymentDate || new Date().toISOString().slice(0, 16);
    const paymentPrefix = normalizePrefix(settings.sellPaymentPrefix || settings.paymentPrefix, 'PAY');
    let remaining = roundedAmount;
    const dueSales = sales
      .filter(sale =>
        String(sale.status || sale.saleStatus || '').trim() === 'Final' &&
        (String(sale.customerId || '') === String(paymentCustomer.id || '') ||
          String(sale.customerName || '').trim().toLowerCase() === String(paymentCustomer.businessName || '').trim().toLowerCase()) &&
        ['Due', 'Partial', 'Overdue'].includes(String(sale.paymentStatus || ''))
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const linkedInvoices: string[] = [];
    dueSales.forEach(sale => {
      if (remaining <= 0) return;
      const due = typeof sale.sellDue === 'number'
        ? Math.max(0, sale.sellDue)
        : Math.max(0, (sale.grandTotal || sale.totalAmount || 0) - (sale.totalPaid || 0));
      if (due <= 0) return;
      const settled = Math.min(remaining, due);
      if (settled > 0 && sale.invoiceNo) linkedInvoices.push(String(sale.invoiceNo));
      remaining -= settled;
    });
    const uniqueLinkedInvoices = Array.from(new Set(linkedInvoices));
    const primaryLinkedSale = uniqueLinkedInvoices.length > 0
      ? sales.find(sale => uniqueLinkedInvoices.includes(String(sale.invoiceNo || '').trim()))
      : undefined;
    const latestSale = sales
      .filter(sale =>
        String(sale.status || sale.saleStatus || '').trim() === 'Final' &&
        (String(sale.customerId || '') === String(paymentCustomer.id || '') ||
          String(sale.customerName || '').trim().toLowerCase() === String(paymentCustomer.businessName || '').trim().toLowerCase())
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    // GlobalContext addPayment handles: FIFO invoice distribution,
    // customer balance update, and localStorage persistence automatically
    const payRebatePercent = Number(paymentCustomer.rebatePercent || 0);
    const payRebateAmount = (payRebateEnabled && payRebatePercent > 0)
      ? Number((roundedAmount * payRebatePercent / 100).toFixed(currencyPrecision))
      : 0;
    globalAddPayment({
      id: `PAY-${Date.now()}`,
      date: dateValue,
      contactId: paymentCustomer.id,
      contactName: paymentCustomer.businessName,
      contactType: 'Customer',
      amount: roundedAmount,
      method: paymentMethod,
      account: resolveDefaultAccountFromMethod(paymentMethod || 'Cash'),
      location: primaryLinkedSale?.location || latestSale?.location || '',
      referenceNo: `${paymentPrefix}-${Date.now().toString().slice(-6)}`,
      note: paymentNote || `Payment from ${paymentCustomer.businessName}`,
      type: 'received',
      addedBy: currentUser?.name || 'Admin',
      attachmentName: payFileName || undefined,
      linkedInvoices: uniqueLinkedInvoices,
      rebatePercent: payRebateEnabled && payRebatePercent > 0 ? payRebatePercent : undefined,
      rebateAmount: payRebateEnabled && payRebateAmount > 0 ? payRebateAmount : undefined,
      rebateApplied: payRebateEnabled && payRebateAmount > 0,
      ...(paymentMethod === 'Cheque' && payChequeDate ? {
        chequeDate: payChequeDate,
        chequeNo: payChequeNo || undefined,
        bankName: payChequeBankName || undefined,
        drawerName: payChequeDrawerName || undefined,
      } : {}),
    });

    closePaymentModal();
    addNotification({
      title: 'Payment Recorded',
      message: `Payment of ${formatCurrency(roundedAmount)} recorded for ${paymentCustomer.businessName}.`,
      type: 'success',
    });
  };

  const handleEdit = (customer: Customer) => {
    const linkedCustomerGroup = resolveCustomerGroupLink(
      customer.customerGroupId,
      customer.customerGroup
    );
    setEditingCustomerId(customer.id);
    setFormData({
      ...customer,
      customerGroupId: linkedCustomerGroup.id,
      customerGroup: linkedCustomerGroup.name,
      contactCategory: customer.contactCategory || 'Business',
      customValues: customer.customValues || {},
      addedOn: customer.addedOn || new Date().toISOString().split('T')[0],
      assignedTo: customer.assignedTo || currentUser?.name || 'Admin',
    });
    const payTermMatch = (customer.payTerm || '').match(/^\s*(\d+)\s*(Days|Months)\s*$/i);
    const days = payTermMatch ? payTermMatch[1] : '';
    const unit = payTermMatch
      ? (payTermMatch[2].toLowerCase() === 'months' ? 'Months' : 'Days')
      : 'Days';
    setPayTermDays(days);
    setPayTermUnit(unit);
    setIsAddingCustomField(false);
    setNewCustomFieldName('');
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
      customerName: customer.businessName || customer.name,
      customFieldName: '',
    });
    setActiveActionId(null);
  }

  const executeConfirmation = () => {
      if (confirmationModal.type === 'removeCustomField') {
        if (confirmationModal.customFieldName) {
          const fieldName = confirmationModal.customFieldName;
          setCustomColumns(prev => prev.filter(col => col !== fieldName));
          setFormData(prev => {
            const newValues = { ...(prev.customValues || {}) };
            delete newValues[fieldName];
            return { ...prev, customValues: newValues };
          });
          globalSetCustomers(prev => prev.map(c => {
            const newValues = { ...(c.customValues || {}) };
            delete newValues[fieldName];
            return { ...c, customValues: newValues };
          }));
          addNotification({
            title: 'Custom Field Removed',
            message: `Custom field "${fieldName}" was removed.`,
            type: 'info',
          });
        }
      } else if (confirmationModal.type === 'deleteCustomer') {
        if (confirmationModal.customerId) {
          globalDeleteCustomer(confirmationModal.customerId);
          addNotification({
            title: 'Customer Deleted',
            message: `"${confirmationModal.customerName}" was removed.`,
            type: 'success',
          });
        }
      } else if (confirmationModal.customerId) {
        const customer = customers.find(c => c.id === confirmationModal.customerId);
        if (customer) {
          const nextStatus = confirmationModal.type === 'deactivate' ? 'Inactive' : 'Active';
          globalUpdateCustomer({ ...customer, status: nextStatus });
          addNotification({
            title: `Customer ${nextStatus === 'Active' ? 'Activated' : 'Deactivated'}`,
            message: `"${customer.businessName}" is now ${nextStatus}.`,
            type: 'success',
          });
        }
      }
      setConfirmationModal({ isOpen: false, type: 'deactivate', customerId: null, customerName: '', customFieldName: '' });
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, JSON.stringify(filters), pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedCustomers = filteredCustomers.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageItems = buildPaginationItems(safePage, totalPages);

  // Calculate Totals based on filtered list
  const totalOpeningBalance = filteredCustomers.reduce((acc, curr) => acc + curr.openingBalance, 0);
  const totalAdvanceBalance = filteredCustomers.reduce((acc, curr) => acc + curr.advanceBalance, 0);
  const totalSellDue = filteredCustomers.reduce((acc, curr) => acc + curr.totalSellDue, 0);
  const totalSellReturnDue = filteredCustomers.reduce((acc, curr) => acc + curr.totalSellReturnDue, 0);

  // --- Export Functions ---
  const buildCSVRows = () => {
    const csvEscape = (value: unknown) => {
      const safe = String(value ?? '');
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const baseHeaders = ['Contact ID', 'Business Name', 'Contact Person', 'Email', 'Tax Number', 'Pay Term', 'Opening Balance', 'Advance Balance', 'Added On', 'Customer Group', 'Mobile', 'Total Sell Due', 'Total Return Due', 'Status'];
    const headers = [...baseHeaders, ...customColumns];
    const rows = filteredCustomers.map(c => [
        csvEscape(c.id),
        csvEscape(c.businessName),
        csvEscape(c.name),
        csvEscape(c.email),
        csvEscape(c.taxNumber),
        csvEscape(c.payTerm),
        csvEscape((Number(c.openingBalance) || 0).toFixed(3)),
        csvEscape((Number(c.advanceBalance) || 0).toFixed(3)),
        csvEscape(c.addedOn),
        csvEscape(c.customerGroup),
        csvEscape(c.mobile),
        csvEscape((Number(c.totalSellDue) || 0).toFixed(3)),
        csvEscape((Number(c.totalSellReturnDue) || 0).toFixed(3)),
        csvEscape(c.status),
        ...customColumns.map(col => csvEscape(c.customValues?.[col] || '')),
    ].join(','));
    return [headers.join(','), ...rows].join('\n');
  };

  const exportToCSV = () => {
    const csvContent = 'data:text/csv;charset=utf-8,' + buildCSVRows();
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'customers_list.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addNotification({ title: 'Export Complete', message: `${filteredCustomers.length} customer record(s) exported as CSV.`, type: 'success' });
  };

  const exportToExcel = () => {
    // BOM + tab-separated for Excel compatibility
    const baseHeaders = ['Contact ID', 'Business Name', 'Contact Person', 'Email', 'Tax Number', 'Pay Term', 'Opening Balance', 'Advance Balance', 'Added On', 'Customer Group', 'Mobile', 'Total Sell Due', 'Total Return Due', 'Status'];
    const headers = [...baseHeaders, ...customColumns];
    const rows = filteredCustomers.map(c => [
        c.id, c.businessName, c.name, c.email, c.taxNumber, c.payTerm,
        c.openingBalance.toFixed(3), c.advanceBalance.toFixed(3), c.addedOn,
        c.customerGroup, c.mobile, c.totalSellDue.toFixed(3), c.totalSellReturnDue.toFixed(3), c.status,
        ...customColumns.map(col => c.customValues?.[col] || '')
    ].join('\t'));
    const content = '\uFEFF' + [headers.join('\t'), ...rows].join('\n');
    const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'customers_list.xls');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addNotification({ title: 'Export Complete', message: `${filteredCustomers.length} customer record(s) exported as Excel.`, type: 'success' });
  };

  const handlePrint = () => {
    const customerPrintFilterParts = [
      searchTerm.trim() ? `Search: ${searchTerm.trim()}` : '',
      filters.customerGroup.length ? `Group: ${filters.customerGroup.join(', ')}` : '',
      filters.assignedTo.length ? `Assigned To: ${filters.assignedTo.join(', ')}` : '',
      filters.status.length ? `Status: ${filters.status.join(', ')}` : '',
      filters.hasNoSellFrom.length ? `No Sell From: ${filters.hasNoSellFrom.join(', ')}` : '',
      filters.sellDue ? 'Sell Due only' : '',
      filters.sellReturn ? 'Sell Return only' : '',
      filters.advanceBalance ? 'Advance Balance only' : '',
      filters.openingBalance ? 'Opening Balance only' : '',
    ].filter(Boolean);
    const customerPrintSubtitle = customerPrintFilterParts.length
      ? `Filters: ${customerPrintFilterParts.join(' | ')}`
      : undefined;
    const totalCreditLimitPrint = filteredCustomers.reduce((sum, c) => sum + Number(c.creditLimit || 0), 0);
    const totalBalanceDuePrint = filteredCustomers.reduce((sum, c) => {
      const due = Number(c.totalSellDue || 0);
      const returns = Number(c.totalSellReturnDue || 0);
      const advance = Number(c.advanceBalance || 0);
      return sum + Math.max(0, due - returns - advance);
    }, 0);

    printDocument({
      title: 'Customers',
      subtitle: customerPrintSubtitle,
      businessName: settings?.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings?.address || '',
      printedBy: currentUser?.name || '',
      columns: [
        { label: 'Customer ID', width: '90px' },
        { label: 'Business Name' },
        { label: 'Contact Person', width: '110px' },
        { label: 'Mobile', width: '90px' },
        { label: 'Email' },
        { label: 'Credit Limit', align: 'right', width: '90px' },
        { label: 'Balance', align: 'right', width: '90px' },
        { label: 'Status', width: '70px' },
      ],
      rows: filteredCustomers.map(c => [
        c.id,
        c.businessName || c.name || '--',
        c.name || '--',
        c.mobile || '--',
        c.email || '--',
        formatCurrency(Number(c.creditLimit || 0)),
        formatCurrency(Math.max(0, Number(c.totalSellDue || 0) - Number(c.totalSellReturnDue || 0) - Number(c.advanceBalance || 0))),
        printStatusBadge(c.status || 'Active'),
      ]),
      stats: [
        { label: 'Total Customers', value: String(filteredCustomers.length), color: 'blue' },
        { label: 'Total Credit Limit', value: formatCurrency(totalCreditLimitPrint), color: 'amber' },
        { label: 'Total Balance Due', value: formatCurrency(totalBalanceDuePrint), color: 'rose' },
      ],
      totalRow: [
        'TOTAL',
        '',
        '',
        '',
        '',
        formatCurrency(totalCreditLimitPrint),
        formatCurrency(totalBalanceDuePrint),
        '',
      ],
    });
  };

  const activeCustomer = activeActionId
    ? customers.find(c => c.id === activeActionId) || null
    : null;

  return (
    <div className="space-y-6 animate-fade-in pb-16 print:p-0">
      
      {/* 1. Header - Hidden on Print */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
            <Users size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Customers</h2>
            <p className="text-slate-500 text-sm mt-0.5">Manage vendor-style customer relationships, balances, and sales history</p>
          </div>
        </div>
      </div>

      {/* 2. Filters Section - Hidden on Print */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden print:hidden relative z-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-5 border-b border-slate-100 space-y-4 bg-slate-50/50">
          <div className="flex justify-end">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${showFilters ? 'bg-slate-200 text-slate-900 border-slate-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              <Filter size={16} /> Filters
              <ChevronDown size={14} className={`transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showFilters && (
            <div className="pt-4 animate-in slide-in-from-top-2 fade-in duration-200 border-t border-slate-100 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                <div className="flex items-center gap-3 group cursor-pointer">
                  <input
                    type="checkbox"
                    id="sellDue"
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={filters.sellDue}
                    onChange={(e) => setFilters({ ...filters, sellDue: e.target.checked })}
                  />
                  <label htmlFor="sellDue" className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded shadow-sm hover:bg-blue-700 transition-colors cursor-pointer select-none">
                    Sell Due
                  </label>
                </div>
                <div className="flex items-center gap-3 group cursor-pointer">
                  <input
                    type="checkbox"
                    id="sellReturn"
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={filters.sellReturn}
                    onChange={(e) => setFilters({ ...filters, sellReturn: e.target.checked })}
                  />
                  <label htmlFor="sellReturn" className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded shadow-sm hover:bg-blue-700 transition-colors cursor-pointer select-none">
                    Sell Return
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

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MultiSelect
                  label="Has no sell from"
                  options={['1 Month', '3 Months', '6 Months', '1 Year']}
                  selected={filters.hasNoSellFrom}
                  onChange={(val) => setFilters({ ...filters, hasNoSellFrom: val })}
                />

                <MultiSelect
                  label="Customer Group"
                  options={customerGroupFilterOptions}
                  selected={filters.customerGroup}
                  onChange={(val) => setFilters({ ...filters, customerGroup: val })}
                />

                <MultiSelect
                  label="Assigned to"
                  options={assignableUsers}
                  selected={filters.assignedTo}
                  onChange={(val) => setFilters({ ...filters, assignedTo: val })}
                />

                <MultiSelect
                  label="Status"
                  options={['Active', 'Inactive']}
                  selected={filters.status}
                  onChange={(val) => setFilters({ ...filters, status: val })}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Main Interface Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative z-0 print:border-none print:shadow-none">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600 print:hidden"></div>

         {/* Toolbar - Hidden on Print */}
         <div className="p-5 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-center gap-4 bg-slate-50/50 print:hidden">
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show</span>
                <select
                    className="px-2 py-1 border border-slate-200 rounded bg-white text-slate-700 cursor-pointer"
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </select>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">entries</span>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
                <button onClick={exportToCSV} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm">
                    <FileText size={12} /> Export CSV
                </button>
                <button onClick={exportToExcel} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm">
                    <FileSpreadsheet size={12} /> Export Excel
                </button>
                <button onClick={handlePrint} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm">
                    <Printer size={12} /> Print
                </button>
                <button onClick={() => { document.title = 'Customers-Export'; printActiveReportTable(); document.title = 'ATWAR BSS'; }} title="Opens print dialog - select 'Save as PDF' to export" className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm">
                    <Download size={12} /> Export PDF
                </button>
            </div>

            <div className="flex items-center gap-2 w-full xl:w-auto">
                <input 
                    type="text" 
                    placeholder="Search..." 
                    className="flex-1 xl:w-64 pl-4 pr-4 py-2.5 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:shadow-md transition-all placeholder:text-slate-400 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button 
                    onClick={() => {
                        resetCustomerForm();
                        setIsAddingCustomField(false);
                        setNewCustomFieldName('');
                        setIsAddModalOpen(true);
                    }}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2 active:scale-95"
                >
                    <Plus size={16} /> Add Customer
                </button>
            </div>
         </div>

         {/* Table */}
         <div className="overflow-x-auto min-h-[400px] print:overflow-visible print:min-h-0">
            <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10 text-slate-500 font-semibold border-b border-slate-200 whitespace-nowrap">
                    <tr>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 w-[60px] md:w-[100px] text-center text-xs font-black uppercase tracking-wider text-slate-500 bg-slate-50/90 sticky left-0 z-10 print:hidden">Action</th>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 min-w-[130px] hidden sm:table-cell">Contact ID</th>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 min-w-[170px]">Business Name</th>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 min-w-[140px] hidden sm:table-cell">Name</th>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 min-w-[180px] hidden lg:table-cell">Email</th>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 min-w-[120px] hidden lg:table-cell">Tax number</th>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 min-w-[120px] text-right hidden lg:table-cell">Credit Limit</th>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 min-w-[110px] hidden lg:table-cell">Pay term</th>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 min-w-[130px] text-right hidden lg:table-cell">Opening Balance</th>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 min-w-[130px] text-right hidden lg:table-cell">Advance Balance</th>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 min-w-[120px] hidden lg:table-cell">Added On</th>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 min-w-[140px] hidden md:table-cell">Customer Group</th>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 min-w-[160px] hidden md:table-cell">Address</th>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 min-w-[120px]">Mobile</th>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 min-w-[150px] text-right">Total Sale Due</th>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 min-w-[170px] text-right hidden lg:table-cell">Total Sell Return Due</th>
                        <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 min-w-[110px]">Status</th>
                        {/* Custom Column Headers */}
                        {customColumns.map((col) => (
                            <th key={col} className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 whitespace-nowrap text-blue-600 bg-blue-50/30 border-l border-blue-100 hidden lg:table-cell">
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {paginatedCustomers.length > 0 ? (
                        paginatedCustomers.map((customer) => (
                        <tr key={customer.id} className={`hover:bg-slate-50/80 transition-all duration-200 group ${customer.status === 'Inactive' ? 'bg-slate-50/50' : ''}`}>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-4 md:py-3 text-center bg-white group-hover:bg-slate-50 sticky left-0 z-10 border-r border-transparent group-hover:border-slate-200 print:hidden">
                                <button
                                    onClick={(e) => toggleActions(e, customer.id)}
                                    className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 mx-auto transition-all duration-200 ${activeActionId === customer.id ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}
                                >
                                    Actions <ChevronDown size={10} />
                                </button>
                            </td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4 hidden sm:table-cell">
                                <div className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit">{customer.id}</div>
                            </td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4 text-slate-900 font-bold">{customer.businessName}</td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4 text-slate-700 font-medium hidden sm:table-cell">{customer.name}</td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4 text-slate-600 hidden lg:table-cell">{customer.email}</td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4 font-mono text-slate-600 text-xs hidden lg:table-cell">{customer.taxNumber}</td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4 text-right text-slate-700 font-medium hidden lg:table-cell">{customer.creditLimit === 0 ? 'No Limit' : formatCurrency(customer.creditLimit)}</td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4 text-slate-600 hidden lg:table-cell">{customer.payTerm}</td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4 text-right text-slate-700 font-medium hidden lg:table-cell">{formatCurrency(customer.openingBalance)}</td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4 text-right text-emerald-600 font-medium hidden lg:table-cell">{formatCurrency(customer.advanceBalance)}</td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4 text-slate-600 hidden lg:table-cell">{customer.addedOn}</td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4 text-slate-700 hidden md:table-cell">{customer.customerGroup}</td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4 text-slate-600 truncate max-w-[220px] hidden md:table-cell" title={customer.address}>{customer.address}</td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4 text-slate-700">{customer.mobile}</td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4 text-right">
                                <span className={`font-bold ${customer.totalSellDue > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                    {formatCurrency(customer.totalSellDue)}
                                </span>
                            </td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4 text-right hidden lg:table-cell">
                                <span className={`font-bold ${customer.totalSellReturnDue > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                    {formatCurrency(customer.totalSellReturnDue)}
                                </span>
                            </td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                    customer.status === 'Active'
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}>
                                    {customer.status}
                                </span>
                            </td>

                            {/* Custom Column Values */}
                            {customColumns.map((col) => (
                                <td key={`${customer.id}-${col}`} className="px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-4 text-slate-600 border-l border-r border-dashed border-slate-100 bg-slate-50/20 whitespace-nowrap hidden lg:table-cell">
                                    {customer.customValues && customer.customValues[col] ? (
                                        <span className="font-medium text-slate-800">{customer.customValues[col]}</span>
                                    ) : (
                                        <span className="text-slate-300 italic text-xs">--</span>
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
                <tfoot className="bg-slate-50/80 backdrop-blur-sm font-bold text-slate-700 text-xs uppercase border-t border-slate-200 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] print:bg-white print:border-t-2 print:border-slate-800">
                    <tr>
                        <td colSpan={8} className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-right">Grand Total:</td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-right hidden lg:table-cell">{formatCurrency(totalOpeningBalance)}</td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-right text-emerald-700 hidden lg:table-cell">{formatCurrency(totalAdvanceBalance)}</td>
                        <td colSpan={4}></td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-right text-red-700">{formatCurrency(totalSellDue)}</td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-right text-amber-700 hidden lg:table-cell">{formatCurrency(totalSellReturnDue)}</td>
                        <td></td>
                        {customColumns.length > 0 && <td colSpan={customColumns.length}></td>}
                    </tr>
                </tfoot>
            </table>
         </div>

         {/* Pagination Footer - Hidden on Print */}
         <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-slate-50/50 print:hidden">
            <div className="flex items-center gap-3">
              <span>Showing {filteredCustomers.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, filteredCustomers.length)} of {filteredCustomers.length} entries</span>
              <label className="flex items-center gap-2">
                <span className="text-slate-500">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 border border-slate-200 rounded bg-white text-slate-700"
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              {pageItems.map((item, index) => item === '...'
                ? <span key={`page-ellipsis-${index}`} className="px-2 py-2 text-slate-400">...</span>
                : (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item)}
                    className={`px-4 py-2 rounded-lg shadow-sm ${item === safePage ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' : 'bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700 transition'}`}
                  >
                    {item}
                  </button>
                ))}
              <button
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
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
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{editingCustomerId ? 'Edit Customer' : 'Add Customer'}</h3>
                    </div>
                    <button onClick={closeAddModal} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-all">
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
                                        <input
                                            type="radio"
                                            name="customerContactType"
                                            value="Individual"
                                            checked={(formData.contactCategory || 'Business') === 'Individual'}
                                            onChange={() => handleInputChange('contactCategory', 'Individual')}
                                            className="w-4 h-4 text-slate-900 focus:ring-slate-800 border-slate-300"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Individual</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="customerContactType"
                                            value="Business"
                                            checked={(formData.contactCategory || 'Business') !== 'Individual'}
                                            onChange={() => handleInputChange('contactCategory', 'Business')}
                                            className="w-4 h-4 text-slate-900 focus:ring-slate-800 border-slate-300"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Business</span>
                                    </label>
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Contact ID <span className="text-slate-300 font-normal normal-case">(Auto-generated)</span></label>
                                <input 
                                    type="text" 
                                    placeholder="Leave blank to auto-generate" 
                                    className={`w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium placeholder:text-slate-400 ${editingCustomerId ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    value={formData.id || ''}
                                    onChange={(e) => handleInputChange('id', e.target.value)}
                                    disabled={!!editingCustomerId}
                                />
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Customer Group</label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                                    value={formData.customerGroupId || ''}
                                    onChange={(e) => {
                                        const linkedCustomerGroup = resolveCustomerGroupLink(e.target.value, '');
                                        setFormData(prev => ({
                                            ...prev,
                                            customerGroupId: linkedCustomerGroup.id,
                                            customerGroup: linkedCustomerGroup.name,
                                        }));
                                    }}
                                >
                                    <option value="">None</option>
                                    {selectableCustomerGroupOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Business Name</label>
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
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Added On</label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium"
                                    value={formData.addedOn || ''}
                                    onChange={(e) => handleInputChange('addedOn', e.target.value)}
                                />
                            </div>

                             <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Opening Balance</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">{currencySymbol}</span>
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
                                    <input
                                        type="number"
                                        placeholder="e.g. 30"
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium"
                                        value={payTermDays}
                                        onChange={(e) => setPayTermDays(e.target.value)}
                                    />
                                    <select
                                        className="px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium cursor-pointer"
                                        value={payTermUnit}
                                        onChange={(e) => setPayTermUnit(e.target.value)}
                                    >
                                        <option value="Days">Days</option>
                                        <option value="Months">Months</option>
                                    </select>
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Credit Limit</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">{currencySymbol}</span>
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
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Rebate %</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0" max="100" step="0.01"
                                        placeholder="0.00"
                                        className="w-full px-4 pr-10 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium"
                                        value={formData.rebatePercent ?? ''}
                                        onChange={(e) => handleInputChange('rebatePercent', e.target.value === '' ? undefined : Math.min(100, Math.max(0, Number(e.target.value))))}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
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
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Mobile</label>
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
                    <button onClick={closeAddModal} className="px-6 py-3 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-white hover:shadow-sm transition-all">
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
                    {(() => {
                      const isDeactivate = confirmationModal.type === 'deactivate';
                      const isActivate = confirmationModal.type === 'activate';
                      const isDeleteCustomer = confirmationModal.type === 'deleteCustomer';
                      const isRemoveCustomField = confirmationModal.type === 'removeCustomField';
                      const iconClass = isDeleteCustomer || isRemoveCustomField
                        ? 'bg-rose-50 text-rose-500'
                        : isDeactivate
                          ? 'bg-amber-50 text-amber-500'
                          : 'bg-emerald-50 text-emerald-500';
                      const title = isDeleteCustomer
                        ? 'Delete Customer'
                        : isRemoveCustomField
                          ? 'Remove Custom Field'
                          : `${isDeactivate ? 'Deactivate' : 'Activate'} Customer`;
                      const message = isDeleteCustomer
                        ? <>Are you sure you want to delete <span className="font-bold text-slate-800">"{confirmationModal.customerName}"</span>? This action cannot be undone.</>
                        : isRemoveCustomField
                          ? <>Are you sure you want to remove custom field <span className="font-bold text-slate-800">"{confirmationModal.customFieldName}"</span> from all customers?</>
                          : <>Are you sure you want to {isDeactivate ? 'deactivate' : 'activate'} <span className="font-bold text-slate-800">"{confirmationModal.customerName}"</span>?</>;
                      const confirmClass = isDeleteCustomer || isRemoveCustomField
                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/20'
                        : isDeactivate
                          ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-900/20'
                          : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20';

                      return (
                        <>
                    <div className={`p-4 rounded-full mb-4 ${
                        iconClass
                    }`}>
                        {isDeactivate && <Ban size={32} />}
                        {isActivate && <CheckCircle2 size={32} />}
                        {(isDeleteCustomer || isRemoveCustomField) && <Trash2 size={32} />}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                        {title}
                    </h3>
                    <p className="text-slate-500 text-sm mb-6">
                        {message}
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setConfirmationModal({ isOpen: false, type: 'deactivate', customerId: null, customerName: '', customFieldName: '' })}
                            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={executeConfirmation}
                            className={`flex-1 px-4 py-2.5 rounded-lg text-white font-bold shadow-lg transition-colors ${
                                 confirmClass
                            }`}
                        >
                            Confirm
                        </button>
                    </div>
                        </>
                      );
                    })()}
                </div>
            </div>
        </div>
       )}

      {/* Action Menu Portal */}
      {activeActionId && (
        <div 
            className={`fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 py-2 w-56 max-w-[calc(100vw-2rem)] animate-in fade-in zoom-in-95 duration-200 ${dropdownPosition.transformOrigin}`}
            style={{ top: dropdownPosition.top, left: dropdownPosition.left, bottom: dropdownPosition.bottom }}
        >
            <div className="px-4 py-2 border-b border-slate-50 mb-1">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Quick Actions</span>
            </div>
            
            {/* Pay Action */}
            <button 
                onClick={() => activeCustomer && handlePay(activeCustomer)}
                disabled={!activeCustomer}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                onClick={() => activeCustomer && handleEdit(activeCustomer)}
                disabled={!activeCustomer}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                onClick={() => activeCustomer && handleDelete(activeCustomer)}
                disabled={!activeCustomer}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Trash2 size={16} className="text-rose-500" /> Delete
            </button>
            
            <div className="h-px bg-slate-100 my-1 mx-2"></div>
            
            {activeCustomer && (
                <button 
                    onClick={() => handleToggleStatus(activeCustomer)}
                    className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center gap-3 transition-colors ${activeCustomer.status === 'Active' ? 'text-red-500 hover:bg-red-50 hover:text-red-700' : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'}`}
                >
                    {activeCustomer.status === 'Active' ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                    {activeCustomer.status === 'Active' ? 'Deactivate' : 'Activate'}
                </button>
            )}
        </div>
      )}

      {/* Add Payment Modal */}
      {isPaymentModalOpen && paymentCustomer && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <CreditCard size={20} className="text-emerald-600" />
                Add Payment
              </h3>
              <button onClick={closePaymentModal} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 pb-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Info cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{paymentCustomer.businessName}</p>
                  <p className="text-xs text-slate-500 truncate">{paymentCustomer.name}</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sale Due</p>
                  <p className="text-sm font-black text-rose-600">{formatCurrency(paymentCustomer.totalSellDue)}</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Opening Balance</p>
                  <p className="text-sm font-bold text-slate-800">{formatCurrency(paymentCustomer.openingBalance)}</p>
                </div>
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Method *</label>
                  <div className="relative">
                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select
                      className="w-full pl-9 pr-8 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      {paymentMethodOptions.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Paid On *</label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="datetime-local"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium text-slate-700"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Amount *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      onBlur={(e) => {
                        const parsed = parseFloat(e.target.value || '0');
                        if (!isNaN(parsed) && parsed > 0) setPaymentAmount(parsed.toFixed(currencyPrecision));
                      }}
                      step={amountStep}
                      className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-bold text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Rebate panel */}
              {Number(paymentCustomer?.rebatePercent || 0) > 0 && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <div>
                    <p className="text-sm font-bold text-amber-800">
                      {paymentCustomer?.rebatePercent}% Rebate — write-off: {formatCurrency(payRebateEnabled && Number(paymentCustomer?.rebatePercent || 0) > 0 ? Number((Math.max(0, parseFloat(paymentAmount || '0')) * Number(paymentCustomer?.rebatePercent || 0) / 100).toFixed(currencyPrecision)) : 0)}
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {payRebateEnabled
                        ? `Company nets: ${formatCurrency(Math.max(0, Math.max(0, parseFloat(paymentAmount || '0')) - Number((Math.max(0, parseFloat(paymentAmount || '0')) * Number(paymentCustomer?.rebatePercent || 0) / 100).toFixed(currencyPrecision))))}`
                        : 'Rebate disabled for this payment'}
                    </p>
                  </div>
                  <button type="button" onClick={() => setPayRebateEnabled(v => !v)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${payRebateEnabled ? 'bg-amber-500' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${payRebateEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}

              {paymentMethod === 'Cheque' && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Cheque Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Cheque Date *</label>
                      <input type="date" value={payChequeDate} onChange={e => setPayChequeDate(e.target.value)}
                        className="w-full rounded-xl bg-slate-50 border-transparent px-3 py-3 text-sm focus:ring-4 focus:ring-emerald-500/10 outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Cheque No.</label>
                      <input type="text" placeholder="e.g. 001234" value={payChequeNo} onChange={e => setPayChequeNo(e.target.value)}
                        className="w-full rounded-xl bg-slate-50 border-transparent px-3 py-3 text-sm focus:ring-4 focus:ring-emerald-500/10 outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Bank</label>
                      <input type="text" placeholder="e.g. Bank Muscat" value={payChequeBankName} onChange={e => setPayChequeBankName(e.target.value)}
                        className="w-full rounded-xl bg-slate-50 border-transparent px-3 py-3 text-sm focus:ring-4 focus:ring-emerald-500/10 outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Drawer Name</label>
                      <input type="text" placeholder="Name on cheque" value={payChequeDrawerName} onChange={e => setPayChequeDrawerName(e.target.value)}
                        className="w-full rounded-xl bg-slate-50 border-transparent px-3 py-3 text-sm focus:ring-4 focus:ring-emerald-500/10 outline-none" />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Account</label>
                  <div className="relative">
                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select
                      className="w-full pl-9 pr-8 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                      value={paymentAccount}
                      onChange={(e) => setPaymentAccount(e.target.value)}
                    >
                      {paymentAccountOptions.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Attach Document</label>
                  <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all">
                    <Paperclip size={16} className="text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-500 truncate">{payFileName || 'Choose file…'}</span>
                    <input type="file" accept=".pdf,.csv,.zip,.doc,.docx,.jpeg,.jpg,.png" className="hidden" onChange={(e) => setPayFileName(e.target.files?.[0]?.name || '')} />
                  </label>
                  <p className="text-[10px] text-slate-400 mt-1">pdf, csv, zip, doc, jpeg, jpg, png</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Note</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 resize-none"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Optional note…"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button onClick={closePaymentModal} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition">
                Cancel
              </button>
              <button onClick={processPayment} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-md flex items-center gap-2 active:scale-95">
                <CreditCard size={16} /> Save Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
