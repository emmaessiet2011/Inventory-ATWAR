import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, FileText, FileSpreadsheet, Printer, Filter, ArrowUpDown, BookOpen, List, MapPin,
  X, Edit, Trash2, History, ChevronDown
} from 'lucide-react';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

interface ListAccountsProps {
  onNavigate?: (page: string) => void;
}

interface PaymentAccountRow {
  id: string;
  name: string;
  location: string;
  type: string;
  subType: string;
  accountNumber: string;
  note: string;
  balance: number;
  addedBy: string;
  status: 'Active' | 'Inactive';
  system?: boolean;
}

const ListAccounts: React.FC<ListAccountsProps> = ({ onNavigate }) => {
  const { locations, payments, currentUser, formatCurrency } = useGlobalContext();

  const [activeTab, setActiveTab] = useState<'accounts' | 'accountTypes'>('accounts');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newType, setNewType] = useState('');
  const [filters, setFilters] = useState({
    status: [] as string[],
    location: [] as string[],
  });

  const [customAccounts, setCustomAccounts] = useState<PaymentAccountRow[]>(() => {
    try {
      const raw = localStorage.getItem('app_payment_accounts');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [accountTypes, setAccountTypes] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('app_payment_account_types');
      return raw ? JSON.parse(raw) : ['Cash', 'Bank'];
    } catch {
      return ['Cash', 'Bank'];
    }
  });

  const [form, setForm] = useState({
    name: '',
    location: locations[0]?.name || '',
    type: 'Cash',
    subType: 'Default',
    accountNumber: '',
    note: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  useEffect(() => {
    localStorage.setItem('app_payment_accounts', JSON.stringify(customAccounts));
  }, [customAccounts]);

  useEffect(() => {
    localStorage.setItem('app_payment_account_types', JSON.stringify(accountTypes));
  }, [accountTypes]);

  const balanceByAccount = useMemo(() => {
    return payments.reduce<Record<string, number>>((acc, p) => {
      const account = p.account || (p.method === 'Cash' ? 'Cash' : 'Bank');
      const delta = p.type === 'received' ? p.amount : -p.amount;
      acc[account] = (acc[account] || 0) + (delta || 0);
      return acc;
    }, {});
  }, [payments]);

  const accounts = useMemo<PaymentAccountRow[]>(() => {
    const customByName = new Map(customAccounts.map(a => [a.name.toLowerCase(), a]));
    const mergedCustom = customAccounts.map(a => ({
      ...a,
      balance: balanceByAccount[a.name] ?? a.balance,
    }));

    const generated: PaymentAccountRow[] = Object.entries(balanceByAccount)
      .filter(([name]) => !customByName.has(name.toLowerCase()))
      .map(([name, balance]) => ({
        id: `AUTO-${name}`,
        name,
        location: locations[0]?.name || '',
        type: name.toLowerCase().includes('cash') ? 'Cash' : 'Bank',
        subType: 'Auto',
        accountNumber: '',
        note: 'Auto-generated from payment transactions',
        balance: Number(balance) || 0,
        addedBy: 'System',
        status: 'Active',
        system: true,
      }));

    return [...mergedCustom, ...generated];
  }, [customAccounts, balanceByAccount, locations]);

  const filteredAccounts = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return accounts.filter(acc =>
      (filters.status.length === 0 || filters.status.includes(acc.status)) &&
      (filters.location.length === 0 || filters.location.includes(acc.location)) &&
      (!lowerSearch || `${acc.name} ${acc.accountNumber} ${acc.note} ${acc.type}`.toLowerCase().includes(lowerSearch))
    );
  }, [accounts, filters, search]);

  const totalBalance = filteredAccounts.reduce((acc, a) => acc + a.balance, 0);

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      name: '',
      location: locations[0]?.name || '',
      type: accountTypes[0] || 'Cash',
      subType: 'Default',
      accountNumber: '',
      note: '',
      status: 'Active',
    });
    setIsAddModalOpen(true);
  };

  const handleSaveAccount = () => {
    if (!form.name.trim()) return;
    if (editingId) {
      setCustomAccounts(prev => prev.map(a => a.id === editingId ? {
        ...a,
        ...form,
      } : a));
    } else {
      setCustomAccounts(prev => [...prev, {
        id: `ACC-${Date.now()}`,
        ...form,
        balance: 0,
        addedBy: currentUser?.name || 'Admin',
      }]);
    }
    setIsAddModalOpen(false);
  };

  const handleEdit = (id: string) => {
    const account = customAccounts.find(a => a.id === id);
    if (!account) return;
    setEditingId(id);
    setForm({
      name: account.name,
      location: account.location,
      type: account.type,
      subType: account.subType,
      accountNumber: account.accountNumber,
      note: account.note,
      status: account.status,
    });
    setIsAddModalOpen(true);
    setActiveDropdown(null);
  };

  const handleAccountBook = () => {
    if (onNavigate) onNavigate('payment-account-report');
    setActiveDropdown(null);
  };

  const handleDelete = (id: string) => {
    const account = customAccounts.find(a => a.id === id);
    if (!account) return;
    if (window.confirm(`Delete account "${account.name}"?`)) {
      setCustomAccounts(prev => prev.filter(acc => acc.id !== id));
    }
    setActiveDropdown(null);
  };

  const handleSaveType = () => {
    const cleaned = newType.trim();
    if (!cleaned || accountTypes.some(t => t.toLowerCase() === cleaned.toLowerCase())) return;
    setAccountTypes(prev => [...prev, cleaned]);
    setNewType('');
    setIsAddTypeModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          Payment Accounts <span className="text-sm font-normal text-slate-500 mt-2">Manage your accounts</span>
        </h2>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 px-6 pt-4 gap-8">
          <button onClick={() => setActiveTab('accounts')} className={`flex items-center gap-2 pb-4 text-sm font-bold transition-colors ${activeTab === 'accounts' ? 'border-b-2 border-blue-500 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
            <BookOpen size={18} /> Accounts
          </button>
          <button onClick={() => setActiveTab('accountTypes')} className={`flex items-center gap-2 pb-4 text-sm font-bold transition-colors ${activeTab === 'accountTypes' ? 'border-b-2 border-blue-500 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
            <List size={18} /> Account Types
          </button>
        </div>

        <div className="p-6 space-y-6">
          {activeTab === 'accounts' ? (
            <>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                  <div className="w-full sm:w-48">
                    <MultiSelect label="Status" options={['Active', 'Inactive']} selected={filters.status} onChange={(val) => setFilters({ ...filters, status: val })} />
                  </div>
                  <div className="w-full sm:w-64">
                    <MultiSelect label="Location" options={locations.map(loc => loc.name)} selected={filters.location} onChange={(val) => setFilters({ ...filters, location: val })} />
                  </div>
                </div>
                <button onClick={openAddModal} className="bg-blue-500 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-blue-600 transition shadow-sm flex items-center gap-2">
                  <Plus size={16} /> Add
                </button>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex flex-wrap gap-2">
                  <button className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"><FileText size={14} /> Export CSV</button>
                  <button className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"><FileSpreadsheet size={14} /> Export Excel</button>
                  <button className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"><Printer size={14} /> Print</button>
                  <button className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"><Filter size={14} /> Column visibility</button>
                </div>
                <div className="relative w-full md:w-auto">
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ..." className="w-full md:w-64 px-4 py-1.5 rounded border border-slate-200 bg-white focus:border-blue-500 focus:outline-none text-sm placeholder:text-slate-400" />
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-white text-slate-900 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 whitespace-nowrap">Name <ArrowUpDown size={14} className="inline ml-1 text-slate-400"/></th>
                      <th className="px-4 py-3 whitespace-nowrap border-l border-slate-200">Location</th>
                      <th className="px-4 py-3 whitespace-nowrap border-l border-slate-200">Account Type</th>
                      <th className="px-4 py-3 whitespace-nowrap border-l border-slate-200">Account Sub Type</th>
                      <th className="px-4 py-3 whitespace-nowrap border-l border-slate-200">Account Number</th>
                      <th className="px-4 py-3 whitespace-nowrap border-l border-slate-200">Note</th>
                      <th className="px-4 py-3 whitespace-nowrap border-l border-slate-200">Balance</th>
                      <th className="px-4 py-3 whitespace-nowrap border-l border-slate-200">Added By</th>
                      <th className="px-4 py-3 whitespace-nowrap border-l border-slate-200">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-slate-50/50">
                    {filteredAccounts.map((account) => (
                      <tr key={account.id} className="bg-white hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{account.name}</td>
                        <td className="px-4 py-3 text-slate-600 border-l border-slate-200 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold">
                            <MapPin size={12} /> {account.location || '--'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 border-l border-slate-200 whitespace-nowrap">{account.type}</td>
                        <td className="px-4 py-3 text-slate-600 border-l border-slate-200 whitespace-nowrap">{account.subType}</td>
                        <td className="px-4 py-3 text-slate-600 border-l border-slate-200 whitespace-nowrap">{account.accountNumber || '--'}</td>
                        <td className="px-4 py-3 text-slate-600 border-l border-slate-200">{account.note || '--'}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 border-l border-slate-200 whitespace-nowrap">{formatCurrency(account.balance)}</td>
                        <td className="px-4 py-3 text-slate-600 border-l border-slate-200 whitespace-nowrap">{account.addedBy}</td>
                        <td className="px-4 py-3 text-slate-600 border-l border-slate-200 whitespace-nowrap relative">
                          <button onClick={() => setActiveDropdown(activeDropdown === account.id ? null : account.id)} className="bg-blue-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-600 transition-colors flex items-center gap-1">
                            Options <ChevronDown size={12} />
                          </button>
                          {activeDropdown === account.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-100 z-10 py-1">
                              {!account.system && (
                                <button onClick={() => handleEdit(account.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                  <Edit size={14} className="text-slate-400" /> Edit
                                </button>
                              )}
                              <button onClick={handleAccountBook} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                <History size={14} className="text-slate-400" /> Account Book
                              </button>
                              {!account.system && (
                                <button onClick={() => handleDelete(account.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                  <Trash2 size={14} /> Delete
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredAccounts.length === 0 && (
                      <tr><td colSpan={9} className="px-6 py-8 text-center text-slate-400 italic">No accounts found</td></tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-200/80 font-bold text-slate-900 border-t border-slate-300">
                    <tr>
                      <td colSpan={6} className="px-6 py-3 text-center text-base">Total:</td>
                      <td className="px-4 py-3 whitespace-nowrap border-l border-slate-300">{formatCurrency(totalBalance)}</td>
                      <td colSpan={2} className="px-4 py-3 border-l border-slate-300"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-end">
                <button onClick={() => setIsAddTypeModalOpen(true)} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm flex items-center gap-2">
                  <Plus size={16} /> Add
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-white text-slate-900 font-bold border-b border-slate-200">
                    <tr><th className="px-4 py-3 whitespace-nowrap">Name</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-slate-50/50">
                    {accountTypes.map(type => (
                      <tr key={type} className="bg-white hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-900">{editingId ? 'Edit Account' : 'Add Account'}</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all" placeholder="Account Name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Location *</label>
                  <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white">
                    <option value="">Select Location</option>
                    {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Account Type *</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white">
                    {accountTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Account Sub Type</label>
                  <input value={form.subType} onChange={(e) => setForm({ ...form, subType: e.target.value })} type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all" placeholder="Sub Type" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Account Number</label>
                  <input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all" placeholder="Account Number" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'Active' | 'Inactive' })} className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Note</label>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all" rows={3} placeholder="Account details..."></textarea>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors">Close</button>
              <button onClick={handleSaveAccount} className="px-6 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm">Save</button>
            </div>
          </div>
        </div>
      )}

      {isAddTypeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-normal text-slate-800">Add account type</h3>
              <button onClick={() => setIsAddTypeModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-900">Name:*</label>
                <input value={newType} onChange={(e) => setNewType(e.target.value)} type="text" className="w-full px-4 py-2 rounded border border-slate-200 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400" placeholder="Name" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={handleSaveType} className="px-6 py-2 rounded font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors">Save</button>
              <button onClick={() => setIsAddTypeModalOpen(false)} className="px-6 py-2 rounded font-bold text-white bg-slate-700 hover:bg-slate-800 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListAccounts;
