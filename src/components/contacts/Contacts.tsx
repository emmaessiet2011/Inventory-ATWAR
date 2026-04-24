import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, Edit, Trash2, 
  User, Mail, Phone,
  Building2, FileText,
  MoreVertical, FileSpreadsheet,
  Printer, Import,
  Briefcase, Wallet,
  Users as UsersIcon, X, CheckCircle2
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { useGlobalContext, Contact } from '@/context/GlobalContext';
import { formatDateBySettings } from '@/utils/dateTime';
import { printActiveReportTable } from '@/utils/printUtils';

interface ContactsProps {
  onNavigate?: (page: string) => void;
}

const Contacts: React.FC<ContactsProps> = ({ onNavigate }) => {
  const { addNotification } = useNotifications();
  const { contacts, addContact, updateContact, deleteContact, sales, purchases, payments, customers, suppliers, formatCurrency, settings } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Supplier' | 'Customer'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeActionId, setActiveActionId] = useState<number | null>(null);
  const [contactToDelete, setContactToDelete] = useState<{ id: number; name: string } | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Statement Modal State
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [selectedContactForStatement, setSelectedContactForStatement] = useState<Contact | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    id: null as number | null,
    type: 'Customer' as 'Supplier' | 'Customer',
    name: '',
    businessName: '',
    contactId: '',
    taxNumber: '',
    openingBalance: 0,
    payTerm: '',
    creditLimit: 0,
    email: '',
    mobile: '',
    address: '',
    shippingAddress: ''
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveActionId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.id) {
      const existingContact = contacts.find(c => c.id === formData.id);
      if (existingContact) {
        updateContact({
          ...existingContact,
          type: formData.type,
          name: formData.name,
          businessName: formData.businessName,
          contactId: formData.contactId,
          taxNumber: formData.taxNumber,
          creditLimit: formData.creditLimit,
          email: formData.email,
          mobile: formData.mobile,
          payTerm: formData.payTerm
        });
        addNotification({ title: 'Contact Updated', message: 'Contact details updated successfully.', type: 'success' });
      }
    } else {
      const newContact: Contact = {
        id: Date.now(),
        type: formData.type,
        contactId: formData.contactId || `CON-${Date.now().toString().slice(-4)}`,
        name: formData.name,
        businessName: formData.businessName,
        mobile: formData.mobile,
        email: formData.email,
        taxNumber: formData.taxNumber,
        creditLimit: formData.creditLimit,
        balance: formData.openingBalance,
        payTerm: formData.payTerm,
        status: 'Active'
      };
      addContact(newContact);
      addNotification({ title: 'Contact Added', message: 'New contact created successfully.', type: 'success' });
    }
    setIsModalOpen(false);
    resetForm();
  };

  const handleDeleteContact = (id: number) => {
    const contact = contacts.find(c => c.id === id);
    setContactToDelete({ id, name: contact?.businessName || contact?.name || 'this contact' });
    setActiveActionId(null);
  };

  const handleConfirmDelete = () => {
    if (!contactToDelete) return;
    deleteContact(contactToDelete.id);
    addNotification({ title: 'Contact Deleted', message: `"${contactToDelete.name}" was removed successfully.`, type: 'info' });
    setContactToDelete(null);
  };

  const handleEditContact = (contact: Contact) => {
    setFormData({
      id: contact.id,
      type: contact.type,
      name: contact.name,
      businessName: contact.businessName,
      contactId: contact.contactId,
      taxNumber: contact.taxNumber,
      openingBalance: contact.balance,
      payTerm: contact.payTerm,
      creditLimit: contact.creditLimit,
      email: contact.email,
      mobile: contact.mobile,
      address: '',
      shippingAddress: ''
    });
    setIsModalOpen(true);
    setActiveActionId(null);
  };

  const handleViewStatement = (contact: Contact) => {
      setSelectedContactForStatement(contact);
      setIsStatementModalOpen(true);
      setActiveActionId(null);
  };

  const handleImportContacts = () => {
    if (onNavigate) {
      onNavigate('import-contacts');
      return;
    }
    addNotification({
      title: 'Import Contacts',
      message: 'Contacts import screen is available at Contacts > Import Contacts.',
      type: 'info',
    });
  };

  const resetForm = () => {
    setFormData({
      id: null,
      type: 'Customer',
      name: '',
      businessName: '',
      contactId: '',
      taxNumber: '',
      openingBalance: 0,
      payTerm: '',
      creditLimit: 0,
      email: '',
      mobile: '',
      address: '',
      shippingAddress: ''
    });
  };

  const totalDue = useMemo(
    () =>
      contacts.reduce(
        (sum, contact) => (contact.balance < 0 ? sum + Math.abs(Number(contact.balance || 0)) : sum),
        0
      ),
    [contacts]
  );

  const normalizeText = (value: unknown): string => String(value || '').trim().toLowerCase();
  const escapeHtml = (value: unknown): string =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const handlePayContact = (contact: Contact) => {
    const contactKey = normalizeText(contact.contactId);
    const businessKey = normalizeText(contact.businessName || contact.name);
    const personKey = normalizeText(contact.name);
    const mobileKey = normalizeText(contact.mobile);

    if (contact.type === 'Supplier') {
      const supplierMatch = suppliers.find(supplier =>
        normalizeText(supplier.id) === contactKey ||
        normalizeText(supplier.businessName) === businessKey ||
        normalizeText(supplier.name) === personKey ||
        normalizeText(supplier.mobile) === mobileKey
      );
      if (supplierMatch && onNavigate) {
        onNavigate(`view-supplier/${supplierMatch.id}:add-payment`);
      } else {
        addNotification({
          title: 'Supplier Not Linked',
          message: 'This contact is not linked to a supplier profile yet.',
          type: 'warning',
        });
      }
      setActiveActionId(null);
      return;
    }

    const customerMatch = customers.find(customer =>
      normalizeText(customer.id) === contactKey ||
      normalizeText(customer.businessName) === businessKey ||
      normalizeText(customer.name) === personKey ||
      normalizeText(customer.mobile) === mobileKey
    );
    if (customerMatch && onNavigate) {
      onNavigate(`view-customer/${customerMatch.id}:add-payment`);
    } else {
      addNotification({
        title: 'Customer Not Linked',
        message: 'This contact is not linked to a customer profile yet.',
        type: 'warning',
      });
    }
    setActiveActionId(null);
  };

  const toEpochMs = (value: string): number => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  };

  const formatStatementDate = (value: string): string => {
    return formatDateBySettings(value || '', settings.dateFormat, settings.timeZone);
  };

  const statementRows = useMemo(() => {
    if (!selectedContactForStatement) return [] as Array<{
      date: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
    }>;

    const isCustomer = selectedContactForStatement.type === 'Customer';
    const contactName = normalizeText(selectedContactForStatement.businessName || selectedContactForStatement.name);
    const contactRef = normalizeText(selectedContactForStatement.contactId);
    const rows: Array<{ date: string; description: string; debit: number; credit: number; sortMs: number }> = [];

    if (isCustomer) {
      sales.forEach(sale => {
        const saleCustomerName = normalizeText(sale.customerName);
        const saleCustomerId = normalizeText(sale.customerId);
        if (saleCustomerName !== contactName && saleCustomerId !== contactRef) return;
        const amount = Number(sale.grandTotal || sale.totalAmount || 0);
        if (amount <= 0) return;
        rows.push({
          date: String(sale.date || ''),
          description: `Invoice #${sale.invoiceNo || sale.id}`,
          debit: amount,
          credit: 0,
          sortMs: toEpochMs(String(sale.date || '')),
        });
      });
    } else {
      purchases.forEach(purchase => {
        const supplierName = normalizeText(purchase.supplier);
        const supplierId = normalizeText(purchase.supplierId);
        if (supplierName !== contactName && supplierId !== contactRef) return;
        const amount = Number(purchase.grandTotal || 0);
        if (amount <= 0) return;
        rows.push({
          date: String(purchase.date || ''),
          description: `Purchase #${purchase.refNo || purchase.id}`,
          debit: amount,
          credit: 0,
          sortMs: toEpochMs(String(purchase.date || '')),
        });
      });
    }

    payments.forEach(payment => {
      const paymentName = normalizeText(payment.contactName);
      const paymentId = normalizeText(payment.contactId);
      const contactTypeMatches = payment.contactType === (isCustomer ? 'Customer' : 'Supplier');
      if (!contactTypeMatches) return;
      if (paymentName !== contactName && paymentId !== contactRef) return;
      const amount = Number(payment.amount || 0);
      if (amount <= 0) return;
      const label = payment.type === 'received' ? 'Payment Received' : 'Payment Sent';
      rows.push({
        date: String(payment.date || ''),
        description: `${label}${payment.method ? ` (${payment.method})` : ''}`,
        debit: 0,
        credit: amount,
        sortMs: toEpochMs(String(payment.date || '')),
      });
    });

    rows.sort((a, b) => a.sortMs - b.sortMs);

    if (rows.length === 0) {
      const balance = Number(selectedContactForStatement.balance || 0);
      return [
        {
          date: '',
          description: 'Current Balance Snapshot',
          debit: balance < 0 ? Math.abs(balance) : 0,
          credit: balance > 0 ? balance : 0,
          balance: balance < 0 ? Math.abs(balance) : -Math.abs(balance),
        },
      ];
    }

    let running = 0;
    return rows.map(row => {
      running += row.debit - row.credit;
      return {
        date: row.date,
        description: row.description,
        debit: row.debit,
        credit: row.credit,
        balance: running,
      };
    });
  }, [payments, purchases, sales, selectedContactForStatement]);

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.mobile.includes(searchTerm) ||
      contact.contactId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'All' || contact.type === filterType;

    return matchesSearch && matchesType;
  });

  const handlePrintContacts = () => {
    printActiveReportTable({
      title: 'Contacts',
      subtitle: filterType === 'All' ? 'Suppliers + Customers' : `${filterType}s`,
    });
  };

  const handleExportContacts = () => {
    if (filteredContacts.length === 0) {
      addNotification({
        title: 'Nothing To Export',
        message: 'No contacts match the current filters.',
        type: 'warning',
      });
      return;
    }

    const headers = ['Type', 'Contact ID', 'Business Name', 'Name', 'Mobile', 'Email', 'Balance', 'Status'];
    const rows = filteredContacts.map((contact) => [
      contact.type,
      contact.contactId,
      contact.businessName || '',
      contact.name || '',
      contact.mobile || '',
      contact.email || '',
      Number(contact.balance || 0).toFixed(3),
      contact.status || '',
    ]);

    const tableHtml = `
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    `;

    const blob = new Blob([`\ufeff${tableHtml}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contacts-${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addNotification({
      title: 'Contacts Exported',
      message: `${filteredContacts.length} contacts exported to Excel.`,
      type: 'success',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Briefcase className="text-blue-600" size={32} />
            Contacts
          </h2>
          <p className="text-slate-500 mt-1">Manage suppliers and customers directory.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleImportContacts}
            className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
          >
            <Import size={18} /> Import
          </button>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
          >
            <Plus size={18} /> Add Contact
          </button>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Contacts', value: contacts.length, icon: UsersIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Suppliers', value: contacts.filter(c => c.type === 'Supplier').length, icon: Building2, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Customers', value: contacts.filter(c => c.type === 'Customer').length, icon: User, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Due', value: formatCurrency(totalDue), icon: Wallet, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-lg font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row justify-between gap-4 items-center">
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            {['All', 'Supplier', 'Customer'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  filterType === type 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {type}s
              </button>
            ))}
          </div>

          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
            <div className="relative w-full md:w-80 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search contacts..." 
                className="w-full pl-11 pr-4 py-3 rounded-xl border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-sm shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <button onClick={handlePrintContacts} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition shadow-sm">
                <Printer size={18} />
              </button>
              <button onClick={handleExportContacts} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition shadow-sm">
                <FileSpreadsheet size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Contacts Table */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-20">Action</th>
                <th className="px-6 py-4">Contact ID</th>
                <th className="px-6 py-4">Business Name</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Contact Info</th>
                <th className="px-6 py-4 text-right">Total Balance</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContacts.length > 0 ? (
                filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 relative">
                      <button 
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setDropdownPosition({ top: rect.bottom + 8, left: rect.left });
                          setActiveActionId(activeActionId === contact.id ? null : contact.id);
                        }}
                        className={`p-2 rounded-lg transition-all ${activeActionId === contact.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {activeActionId === contact.id && createPortal(
                        <div 
                          ref={dropdownRef}
                          className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 py-2 w-48 max-w-[calc(100vw-2rem)] animate-in fade-in zoom-in-95 duration-200 origin-top-left"
                          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button 
                            onClick={() => handleViewStatement(contact)}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                          >
                            <FileText size={14} className="text-blue-500" /> Account Statement
                          </button>
                          <button
                            onClick={() => handlePayContact(contact)}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                          >
                            <Wallet size={14} className="text-emerald-500" /> Pay
                          </button>
                          <button 
                            onClick={() => handleEditContact(contact)}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                          >
                            <Edit size={14} className="text-amber-500" /> Edit
                          </button>
                          <div className="h-px bg-slate-100 my-1"></div>
                          <button 
                            onClick={() => handleDeleteContact(contact.id)}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-3"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>,
                        document.body
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{contact.contactId}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {contact.type === 'Supplier' ? <Building2 size={14} className="text-amber-500" /> : <User size={14} className="text-blue-500" />}
                        <span className="font-bold text-slate-900">{contact.businessName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{contact.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5"><Phone size={10} /> {contact.mobile}</span>
                        {contact.email && <span className="flex items-center gap-1.5"><Mail size={10} /> {contact.email}</span>}
                      </div>
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${contact.balance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {Number(contact.balance || 0).toFixed(3)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                        contact.status === 'Active' 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {contact.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic bg-slate-50/30">
                    No contacts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Contact Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[95vh]">
            
            {/* Modal Header */}
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                  <Briefcase size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    {formData.id ? 'Edit Contact' : 'Add New Contact'}
                  </h3>
                  <p className="text-slate-500 text-sm">Create a new supplier or customer profile.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-white p-2 rounded-full transition-all shadow-sm">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="flex flex-col overflow-hidden">
              <div className="p-10 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  
                  {/* Basic Info */}
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <User size={14} className="text-blue-500" /> Identity Information
                    </h4>
                    
                    <div className="group">
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Contact Type</label>
                      <div className="flex gap-4">
                        {['Supplier', 'Customer'].map((type) => (
                          <label key={type} className="flex-1 cursor-pointer">
                            <input 
                              type="radio" 
                              name="contactType"
                              className="peer sr-only"
                              checked={formData.type === type}
                              onChange={() => setFormData({...formData, type: type as any})}
                            />
                            <div className="px-4 py-3 rounded-xl border-2 border-slate-200 peer-checked:border-blue-500 peer-checked:bg-blue-50 text-center text-sm font-bold text-slate-600 peer-checked:text-blue-700 transition-all">
                              {type}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Name *</label>
                        <input 
                          type="text" 
                          required
                          className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800"
                          placeholder="Contact Name"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                      </div>
                      <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Business Name</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800"
                          placeholder="Company LLC"
                          value={formData.businessName}
                          onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="group">
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Contact ID</label>
                      <div className="relative">
                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800"
                          placeholder="Auto-generated if empty"
                          value={formData.contactId}
                          onChange={(e) => setFormData({...formData, contactId: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="group">
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Tax Number</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800"
                        placeholder="Tax ID / VAT Number"
                        value={formData.taxNumber}
                        onChange={(e) => setFormData({...formData, taxNumber: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Financial & Contact Info */}
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Wallet size={14} className="text-emerald-500" /> Financial & Contact
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Opening Balance</label>
                        <input 
                          type="number" 
                          className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-bold text-slate-800"
                          placeholder="0.00"
                          value={formData.openingBalance}
                          onChange={(e) => setFormData({...formData, openingBalance: parseFloat(e.target.value)})}
                        />
                      </div>
                      <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Credit Limit</label>
                        <input 
                          type="number" 
                          className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-bold text-slate-800"
                          placeholder="0.00"
                          value={formData.creditLimit}
                          onChange={(e) => setFormData({...formData, creditLimit: parseFloat(e.target.value)})}
                        />
                      </div>
                    </div>

                    <div className="group">
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Pay Term</label>
                      <div className="flex gap-2">
                        {(() => {
                          const match = String(formData.payTerm || '').match(/^\s*(\d+)\s*(Days|Months)\s*$/i);
                          const termValue = match ? match[1] : '';
                          const termUnit = match ? (match[2].toLowerCase() === 'months' ? 'Months' : 'Days') : 'Days';
                          return (
                            <>
                        <input 
                          type="number" 
                          min={0}
                          step={1}
                          className="w-24 px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800"
                          placeholder="0"
                          value={termValue}
                          onChange={(e) => {
                            const rawValue = e.target.value;
                            const nextValue = rawValue === '' ? '' : String(Math.max(0, Math.floor(Number(rawValue) || 0)));
                            setFormData({ ...formData, payTerm: nextValue ? `${nextValue} ${termUnit}` : '' });
                          }}
                        />
                        <select
                          className="flex-1 px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 appearance-none cursor-pointer"
                          value={termUnit}
                          onChange={(e) => {
                            const unit = e.target.value === 'Months' ? 'Months' : 'Days';
                            setFormData({ ...formData, payTerm: termValue ? `${termValue} ${unit}` : '' });
                          }}
                        >
                          <option value="Days">Days</option>
                          <option value="Months">Months</option>
                        </select>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Mobile</label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            type="text" 
                            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800"
                            placeholder="+968..."
                            value={formData.mobile}
                            onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Email</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            type="email" 
                            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800"
                            placeholder="email@example.com"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-10 py-8 border-t border-slate-100 flex justify-end gap-4 bg-slate-50/50">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-8 py-3.5 border border-slate-200 rounded-2xl text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-white hover:border-slate-300 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-12 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 active:scale-95 flex items-center gap-2"
                >
                  <CheckCircle2 size={18} /> {formData.id ? 'Update Contact' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Statement Modal */}
      {isStatementModalOpen && selectedContactForStatement && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[95vh]">
            
            {/* Modal Header */}
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                  <FileText size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    Account Statement
                  </h3>
                  <p className="text-slate-500 text-sm">{selectedContactForStatement.businessName || selectedContactForStatement.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                      addNotification({ title: 'Printing...', message: 'Sending statement to printer.', type: 'info' });
                  }}
                  className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
                >
                  <Printer size={16} /> Print
                </button>
                <button onClick={() => setIsStatementModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-white p-2 rounded-full transition-all shadow-sm">
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Statement Content */}
            <div className="p-10 overflow-y-auto custom-scrollbar bg-slate-50/30">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                    {/* Header Info */}
                    <div className="flex justify-between items-start mb-8 pb-8 border-b border-slate-100">
                        <div>
                            <h4 className="font-black text-lg text-slate-900 mb-1">{selectedContactForStatement.businessName || selectedContactForStatement.name}</h4>
                            <p className="text-sm text-slate-500">{selectedContactForStatement.contactId}</p>
                            <p className="text-sm text-slate-500">{selectedContactForStatement.mobile}</p>
                            {selectedContactForStatement.email && <p className="text-sm text-slate-500">{selectedContactForStatement.email}</p>}
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Current Balance</p>
                            <p className={`text-3xl font-black ${selectedContactForStatement.balance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                OMR {Math.abs(selectedContactForStatement.balance).toFixed(3)}
                                <span className="text-sm ml-2 text-slate-400">{selectedContactForStatement.balance < 0 ? '(Due)' : '(Advance)'}</span>
                            </p>
                        </div>
                    </div>

                    {/* Transactions Table */}
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="pb-3">Date</th>
                                <th className="pb-3">Description</th>
                                <th className="pb-3 text-right">Debit</th>
                                <th className="pb-3 text-right">Credit</th>
                                <th className="pb-3 text-right">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {statementRows.map((row, idx) => (
                              <tr key={`${row.description}-${idx}`}>
                                  <td className="py-4 font-medium text-slate-700">{row.date ? formatStatementDate(row.date) : '--'}</td>
                                  <td className="py-4 text-slate-600">{row.description}</td>
                                  <td className="py-4 text-right text-rose-600">{row.debit > 0 ? row.debit.toFixed(3) : '-'}</td>
                                  <td className="py-4 text-right text-emerald-600">{row.credit > 0 ? row.credit.toFixed(3) : '-'}</td>
                                  <td className="py-4 text-right font-bold text-slate-900">
                                    {Math.abs(row.balance).toFixed(3)}{row.balance < 0 ? ' (Adv.)' : ''}
                                  </td>
                              </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {contactToDelete && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Contact</h3>
            <p className="text-sm text-slate-600 mb-1">
              Are you sure you want to delete <span className="font-bold text-slate-900">"{contactToDelete.name}"</span>?
            </p>
            <p className="text-xs text-rose-600 mb-5">This action cannot be undone. Any linked sales or purchase records will lose the contact reference.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setContactToDelete(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition"
              >
                Delete Contact
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Contacts;
