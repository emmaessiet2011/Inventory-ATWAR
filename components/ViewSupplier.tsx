import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, User, MapPin, Phone, FileText, ShoppingBag, BarChart3, StickyNote,
  CreditCard, Activity, Calendar, Plus, Eye, Edit, Trash2
} from 'lucide-react';
import AddDiscountModal from './AddDiscountModal';
import { useGlobalContext } from '../src/context/GlobalContext';

interface ViewSupplierProps {
  onNavigate: (page: string) => void;
  contactId?: string;
  initialTab?: string;
}

interface SupplierPaymentForm {
  amount: string;
  method: string;
  account: string;
  date: string;
  note: string;
}

const ViewSupplier: React.FC<ViewSupplierProps> = ({ onNavigate, contactId, initialTab }) => {
  const {
    suppliers,
    purchases,
    payments,
    products,
    sales,
    currentUser,
    addPayment: globalAddPayment,
    updatePayment: globalUpdatePayment,
    deletePayment: globalDeletePayment,
    formatCurrency,
  } = useGlobalContext();

  const [activeTab, setActiveTab] = useState(initialTab === 'add-payment' ? 'payments' : (initialTab || 'ledger'));
  const [searchTerm, setSearchTerm] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(initialTab === 'add-payment');
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [viewPaymentId, setViewPaymentId] = useState<string | null>(null);
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<SupplierPaymentForm>({
    amount: '',
    method: 'Cash',
    account: '',
    date: new Date().toISOString().slice(0, 16),
    note: '',
  });

  const supplier = useMemo(() => {
    if (contactId) {
      const found = suppliers.find(s => s.id === contactId);
      if (found) return found;
    }
    return suppliers[0] || null;
  }, [suppliers, contactId]);

  useEffect(() => {
    if (initialTab === 'add-payment') {
      setActiveTab('payments');
      setIsPaymentModalOpen(true);
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const supplierPurchases = useMemo(() => {
    if (!supplier) return [];
    return purchases
      .filter(p => p.supplierId === supplier.id || p.supplier === supplier.businessName)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [purchases, supplier]);

  const supplierPayments = useMemo(() => {
    if (!supplier) return [];
    return payments
      .filter(p => p.contactType === 'Supplier' && (p.contactId === supplier.id || p.contactName === supplier.businessName))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, supplier]);

  const purchaseTotal = supplierPurchases.reduce((acc, p) => acc + (p.grandTotal || 0), 0);
  const paidTotal = supplierPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const dueTotal = Math.max(0, purchaseTotal - paidTotal);

  const ledgerRows = useMemo(() => {
    const rows = [
      ...supplierPurchases.map(p => ({
        id: `PUR-${p.id}`,
        date: p.date,
        ref: p.refNo,
        type: 'Purchase',
        location: p.location,
        debit: 0,
        credit: p.grandTotal || 0,
        method: p.paymentMethod || '',
        note: p.status,
      })),
      ...supplierPayments.map(pay => ({
        id: `PAY-${pay.id}`,
        date: pay.date,
        ref: pay.referenceNo,
        type: 'Payment',
        location: '',
        debit: pay.amount || 0,
        credit: 0,
        method: pay.method,
        note: pay.note,
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    return rows.map(r => {
      running += (r.credit - r.debit);
      return { ...r, balance: running };
    });
  }, [supplierPurchases, supplierPayments]);

  const stockRows = useMemo(() => {
    const purchasedByProduct = new Map<string, number>();
    supplierPurchases.forEach(purchase => {
      (purchase.items || []).forEach(item => {
        const key = String(item.id || item.name);
        purchasedByProduct.set(key, (purchasedByProduct.get(key) || 0) + (item.qty || 0));
      });
    });

    const soldByProduct = new Map<string, number>();
    sales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const key = String(item.id || item.name);
        soldByProduct.set(key, (soldByProduct.get(key) || 0) + (item.qty || 0));
      });
    });

    return Array.from(purchasedByProduct.entries()).map(([key, purchased]) => {
      const product = products.find(p => p.id === key || p.sku === key || p.name === key);
      const sold = soldByProduct.get(key) || 0;
      const currentStock = product?.stock || 0;
      const unitPrice = product?.unitPurchasePrice || 0;
      return {
        key,
        product: product?.name || key,
        sku: product?.sku || key,
        purchased,
        sold,
        currentStock,
        stockValue: currentStock * unitPrice,
      };
    });
  }, [supplierPurchases, products, sales]);

  const activities = useMemo(() => {
    return [
      ...supplierPurchases.map(p => ({ id: `AP-${p.id}`, date: p.date, action: 'Purchase Added', by: p.addedBy || '-', note: p.refNo })),
      ...supplierPayments.map(p => ({ id: `AY-${p.id}`, date: p.date, action: 'Payment Recorded', by: p.addedBy || '-', note: p.referenceNo })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [supplierPurchases, supplierPayments]);

  const filteredPayments = supplierPayments.filter(pay =>
    `${pay.referenceNo} ${pay.note} ${pay.method}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedViewPayment = supplierPayments.find(p => p.id === viewPaymentId) || null;
  const selectedEditPayment = supplierPayments.find(p => p.id === editPaymentId) || null;

  const resetPaymentForm = () => {
    setPaymentForm({
      amount: '',
      method: 'Cash',
      account: '',
      date: new Date().toISOString().slice(0, 16),
      note: '',
    });
  };

  const handleSaveSupplierPayment = () => {
    if (!supplier) return;
    const amount = parseFloat(paymentForm.amount);
    if (Number.isNaN(amount) || amount <= 0) return;
    globalAddPayment({
      id: `PAY-SUP-${Date.now()}`,
      date: paymentForm.date.split('T')[0],
      contactId: supplier.id,
      contactName: supplier.businessName,
      contactType: 'Supplier',
      amount,
      method: paymentForm.method,
      account: paymentForm.account || '',
      referenceNo: `PAY-${Date.now().toString().slice(-6)}`,
      note: paymentForm.note,
      type: 'sent',
      addedBy: currentUser?.name || 'Admin',
    });
    setIsPaymentModalOpen(false);
    resetPaymentForm();
  };

  const openEditPayment = (paymentId: string) => {
    const pay = supplierPayments.find(p => p.id === paymentId);
    if (!pay) return;
    setPaymentForm({
      amount: String(pay.amount || 0),
      method: pay.method || 'Cash',
      account: pay.account || '',
      date: `${pay.date}T00:00`,
      note: pay.note || '',
    });
    setEditPaymentId(paymentId);
  };

  const handleUpdatePayment = () => {
    if (!selectedEditPayment) return;
    const amount = parseFloat(paymentForm.amount);
    if (Number.isNaN(amount) || amount <= 0) return;
    globalUpdatePayment({
      ...selectedEditPayment,
      amount,
      method: paymentForm.method,
      account: paymentForm.account,
      date: paymentForm.date.split('T')[0],
      note: paymentForm.note,
    });
    setEditPaymentId(null);
    resetPaymentForm();
  };

  const handleDeletePayment = (id: string) => {
    if (confirm('Delete this supplier payment?')) {
      globalDeletePayment(id);
    }
  };

  if (!supplier) {
    return <div className="p-10 text-center text-slate-500">No suppliers available.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('suppliers')} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold text-slate-900">View Supplier</h2>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="text-slate-400" size={18} />
            <span className="font-bold text-slate-800 text-lg">{supplier.businessName}</span>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Supplier</span>
          </div>
          <div className="space-y-1 pl-7">
            <div className="text-sm text-slate-600 flex items-center gap-2"><MapPin size={14} className="text-slate-400" />{supplier.address}</div>
            <div className="text-sm text-slate-600 flex items-center gap-2"><Phone size={14} className="text-slate-400" />{supplier.mobile}</div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsPaymentModalOpen(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition shadow-sm flex items-center gap-2">
            <CreditCard size={16} /> Pay
          </button>
          <button onClick={() => setIsDiscountModalOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition shadow-sm flex items-center gap-2">
            Add Discount
          </button>
        </div>
      </div>

      <div className="flex flex-wrap border-b border-slate-200 bg-white rounded-t-xl overflow-hidden">
        {[
          { id: 'ledger', label: 'Ledger', icon: FileText },
          { id: 'purchases', label: 'Purchases', icon: ShoppingBag },
          { id: 'stock', label: 'Stock Report', icon: BarChart3 },
          { id: 'docs', label: 'Documents & Note', icon: StickyNote },
          { id: 'payments', label: 'Payments', icon: CreditCard },
          { id: 'activities', label: 'Activities', icon: Activity },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'ledger' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div><span className="font-bold">Total Purchase:</span> {formatCurrency(purchaseTotal)}</div>
            <div><span className="font-bold">Total Paid:</span> {formatCurrency(paidTotal)}</div>
            <div><span className="font-bold">Balance Due:</span> {formatCurrency(dueTotal)}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgerRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">{row.date}</td>
                    <td className="px-4 py-3 font-medium">{row.ref}</td>
                    <td className="px-4 py-3">{row.type}</td>
                    <td className="px-4 py-3">{row.location || '--'}</td>
                    <td className="px-4 py-3 text-right">{row.debit ? formatCurrency(row.debit) : ''}</td>
                    <td className="px-4 py-3 text-right">{row.credit ? formatCurrency(row.credit) : ''}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(row.balance)}</td>
                  </tr>
                ))}
                {ledgerRows.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">No ledger activity.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'purchases' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-right">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplierPurchases.map(p => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{p.date}</td>
                    <td className="px-4 py-3 font-medium">{p.refNo}</td>
                    <td className="px-4 py-3">{p.location}</td>
                    <td className="px-4 py-3">{p.status}</td>
                    <td className="px-4 py-3">{p.paymentStatus}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(p.grandTotal || 0)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(p.paymentDue || 0)}</td>
                  </tr>
                ))}
                {supplierPurchases.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">No purchases for this supplier.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'stock' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Purchased Qty</th>
                  <th className="px-4 py-3 text-right">Sold Qty</th>
                  <th className="px-4 py-3 text-right">Current Stock</th>
                  <th className="px-4 py-3 text-right">Stock Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockRows.map(row => (
                  <tr key={row.key}>
                    <td className="px-4 py-3">{row.product}</td>
                    <td className="px-4 py-3">{row.sku}</td>
                    <td className="px-4 py-3 text-right">{row.purchased}</td>
                    <td className="px-4 py-3 text-right">{row.sold}</td>
                    <td className="px-4 py-3 text-right">{row.currentStock}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(row.stockValue)}</td>
                  </tr>
                ))}
                {stockRows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">No stock data available from supplier purchases.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'docs' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm p-8 text-center text-slate-400 italic">
          Document management is not configured yet.
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search payments..."
                className="px-3 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button onClick={() => setIsPaymentModalOpen(true)} className="px-3 py-1.5 bg-emerald-600 text-white rounded font-bold text-xs shadow-sm hover:bg-emerald-700 whitespace-nowrap">
              <Plus size={12} className="inline mr-1" /> Add Payment
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-white text-slate-800 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Paid on</th>
                  <th className="px-6 py-4">Reference No</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Note</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map(pay => (
                  <tr key={pay.id}>
                    <td className="px-6 py-4">{pay.date}</td>
                    <td className="px-6 py-4">{pay.referenceNo}</td>
                    <td className="px-6 py-4 text-right font-bold">{formatCurrency(pay.amount || 0)}</td>
                    <td className="px-6 py-4">{pay.method}</td>
                    <td className="px-6 py-4">{pay.note || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => setViewPaymentId(pay.id)} className="text-blue-600 hover:text-blue-800"><Eye size={14} /></button>
                        <button onClick={() => openEditPayment(pay.id)} className="text-amber-600 hover:text-amber-800"><Edit size={14} /></button>
                        <button onClick={() => handleDeletePayment(pay.id)} className="text-rose-600 hover:text-rose-800"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">No supplier payments found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'activities' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-white text-slate-800 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">By</th>
                  <th className="px-6 py-4">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activities.map(act => (
                  <tr key={act.id}>
                    <td className="px-6 py-4">{act.date}</td>
                    <td className="px-6 py-4">{act.action}</td>
                    <td className="px-6 py-4">{act.by}</td>
                    <td className="px-6 py-4">{act.note}</td>
                  </tr>
                ))}
                {activities.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">No activities found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Add Supplier Payment</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">x</button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700">Amount</label>
                <input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Method</label>
                <select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded bg-white">
                  <option>Cash</option>
                  <option>Card</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Account</label>
                <input type="text" value={paymentForm.account} onChange={(e) => setPaymentForm({ ...paymentForm, account: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Paid On</label>
                <input type="datetime-local" value={paymentForm.date} onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700">Note</label>
                <textarea value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} rows={3} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded"></textarea>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button onClick={handleSaveSupplierPayment} className="px-6 py-2 bg-emerald-600 text-white rounded font-bold text-sm hover:bg-emerald-700 transition-colors">Save</button>
              <button onClick={() => setIsPaymentModalOpen(false)} className="px-6 py-2 bg-slate-700 text-white rounded font-bold text-sm hover:bg-slate-800 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {selectedViewPayment && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-3">
            <h3 className="text-lg font-bold text-slate-800">Payment Details</h3>
            <p><span className="font-bold">Reference:</span> {selectedViewPayment.referenceNo}</p>
            <p><span className="font-bold">Date:</span> {selectedViewPayment.date}</p>
            <p><span className="font-bold">Amount:</span> {formatCurrency(selectedViewPayment.amount || 0)}</p>
            <p><span className="font-bold">Method:</span> {selectedViewPayment.method}</p>
            <p><span className="font-bold">Note:</span> {selectedViewPayment.note || '-'}</p>
            <div className="pt-2 flex justify-end">
              <button onClick={() => setViewPaymentId(null)} className="px-4 py-2 bg-slate-700 text-white rounded text-sm font-bold">Close</button>
            </div>
          </div>
        </div>
      )}

      {selectedEditPayment && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Edit Payment</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700">Amount</label>
                <input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Method</label>
                <select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded bg-white">
                  <option>Cash</option>
                  <option>Card</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Account</label>
                <input type="text" value={paymentForm.account} onChange={(e) => setPaymentForm({ ...paymentForm, account: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Date</label>
                <input type="datetime-local" value={paymentForm.date} onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700">Note</label>
                <textarea value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} rows={3} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded"></textarea>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button onClick={handleUpdatePayment} className="px-6 py-2 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700 transition-colors">Update</button>
              <button onClick={() => setEditPaymentId(null)} className="px-6 py-2 bg-slate-700 text-white rounded font-bold text-sm hover:bg-slate-800 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {isDiscountModalOpen && (
        <AddDiscountModal
          isOpen={isDiscountModalOpen}
          onClose={() => setIsDiscountModalOpen(false)}
        />
      )}
    </div>
  );
};

export default ViewSupplier;
