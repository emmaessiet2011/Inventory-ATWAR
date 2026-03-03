import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Filter, Download, Printer, Eye, Edit, Trash2, MoreHorizontal, Banknote,
  Calendar, User, FileText, ArrowUpDown, X, CheckCircle2, Clock, MapPin, DollarSign, Save, Paperclip, ExternalLink
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useGlobalContext } from '../src/context/GlobalContext';

interface Payment {
  id: string;
  date: string;
  ref: string;
  contactId: string;
  customerName?: string;
  amount: number;
  method: string;
  note: string;
  document?: string;
  paymentAccount?: string;
  location?: string;
  clearedInvoices?: { invoiceNo: string, amount: number, status: string }[];
}

interface ListPaymentsProps {
  onNavigate?: (page: string) => void;
  onContactSelect?: (contactId: string, tab?: string) => void;
}

const ListPayments: React.FC<ListPaymentsProps> = ({ onNavigate, onContactSelect }) => {
  const {
    payments: globalPayments,
    customers,
    updatePayment: globalUpdatePayment,
    deletePayment: globalDeletePayment,
    formatCurrency,
  } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const actionButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c.businessName || c.name])), [customers]);
  const payments: Payment[] = useMemo(() =>
    globalPayments
      .filter(p => p.type === 'received')
      .map(p => ({
        id: p.id,
        date: p.date,
        ref: p.referenceNo,
        contactId: p.contactId,
        customerName: p.contactName || customerMap.get(p.contactId) || 'Unknown',
        amount: p.amount,
        method: p.method,
        note: p.note,
        document: '',
        paymentAccount: p.account || 'Cash',
        location: '',
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [globalPayments, customerMap]
  );

  const filteredPayments = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return payments.filter(p =>
      (p.ref || '').toLowerCase().includes(lowerSearch) ||
      (p.customerName || '').toLowerCase().includes(lowerSearch) ||
      (p.note || '').toLowerCase().includes(lowerSearch) ||
      (p.method || '').toLowerCase().includes(lowerSearch)
    );
  }, [searchTerm, payments]);

  useEffect(() => {
    const handleClickOutside = () => setActiveActionId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const toggleActions = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (activeActionId === id) {
      setActiveActionId(null);
      return;
    }
    const button = actionButtonRefs.current[id];
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setDropdownPosition({ top: rect.bottom + 8, left: rect.right - 192 });
    setActiveActionId(id);
  };

  const handlePrint = (payment: Payment) => {
    setNotification({ message: `Printing receipt for ${payment.ref}...`, type: 'success' });
    setActiveActionId(null);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleUpdatePayment = () => {
    if (!editingPayment) return;
    const original = globalPayments.find(p => p.id === editingPayment.id);
    if (!original) return;
    globalUpdatePayment({ ...original, amount: editingPayment.amount, method: editingPayment.method, note: editingPayment.note, date: editingPayment.date });
    setNotification({ message: 'Payment updated successfully!', type: 'success' });
    setEditingPayment(null);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this payment?')) {
      globalDeletePayment(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">List Payments</h2>
          <p className="text-slate-500 mt-1">Manage and view all received payments.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"><Filter size={16} /> Filter</button>
          <button className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"><Download size={16} /> Export</button>
          <button className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"><Printer size={16} /> Print</button>
        </div>
      </div>

      {notification && (
        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={20} /> : <div className="w-5 h-5 rounded-full bg-red-200 flex items-center justify-center text-red-600 font-bold">!</div>}
          {notification.message}
        </div>
      )}

      <div className="bg-white p-4 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input type="text" placeholder="Search payments..." className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-slate-600" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex gap-6 px-6 border-l border-slate-100">
          <div className="text-center"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Payments</p><p className="text-xl font-black text-slate-800">{filteredPayments.length}</p></div>
          <div className="text-center"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Amount</p><p className="text-xl font-black text-emerald-600">{formatCurrency(filteredPayments.reduce((sum, p) => sum + p.amount, 0))}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-48"><div className="flex items-center gap-2 cursor-pointer hover:text-slate-600">Date <ArrowUpDown size={12} /></div></th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-40">Reference No</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-40">Amount</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-40">Payment Method</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-32">Attachment</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-48">Cleared Invoices</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-64">Note</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-24 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length > 0 ? filteredPayments.map((payment) => (
                <tr key={payment.id} className="group hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Calendar size={16} /></div><span className="font-bold text-slate-700 text-sm">{new Date(payment.date).toLocaleDateString()}<span className="block text-[10px] text-slate-400 font-medium">{new Date(payment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></span></div></td>
                  <td className="px-6 py-4"><span className="font-bold text-slate-600 text-sm bg-slate-100 px-2 py-1 rounded border border-slate-200">{payment.ref}</span></td>
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">{payment.customerName?.charAt(0)}</div><span className="font-bold text-slate-800 text-sm">{payment.customerName}</span></div></td>
                  <td className="px-6 py-4"><span className="font-black text-emerald-600 text-sm">{formatCurrency(payment.amount)}</span></td>
                  <td className="px-6 py-4"><div className="flex items-center gap-2"><Banknote size={14} className="text-slate-400" /><span className="font-bold text-slate-700 text-sm">{payment.method}</span></div></td>
                  <td className="px-6 py-4">{payment.document ? <a href={payment.document} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg transition-colors w-fit"><Paperclip size={12} /> View</a> : <span className="text-xs text-slate-400 font-medium italic">No file</span>}</td>
                  <td className="px-6 py-4">
                    {payment.clearedInvoices && payment.clearedInvoices.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {payment.clearedInvoices.map((inv, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <button
                              onClick={() => {
                                if (onContactSelect) {
                                  onContactSelect(payment.contactId, 'payments');
                                } else if (onNavigate) {
                                  onNavigate(`view-customer/${payment.contactId}:payments`);
                                }
                              }}
                              className="font-bold text-blue-600 hover:underline"
                            >
                              {inv.invoiceNo}
                            </button>
                            <span className="text-slate-500">({formatCurrency(inv.amount)})</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase text-white ${inv.status === 'Paid' ? 'bg-[#74c365]' : 'bg-amber-400'}`}>{inv.status}</span>
                          </div>
                        ))}
                      </div>
                    ) : <span className="text-xs text-slate-400 italic">None</span>}
                  </td>
                  <td className="px-6 py-4"><p className="text-sm text-slate-500 truncate max-w-[200px]" title={payment.note}>{payment.note || '-'}</p></td>
                  <td className="px-6 py-4 text-center relative">
                    <button ref={el => actionButtonRefs.current[payment.id] = el} onClick={(e) => toggleActions(e, payment.id)} className={`p-2 rounded-xl transition-all ${activeActionId === payment.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-slate-200'}`}><MoreHorizontal size={18} /></button>
                    {activeActionId === payment.id && createPortal(
                      <div className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 py-2 w-48 animate-in fade-in zoom-in-95" style={{ top: dropdownPosition.top, left: dropdownPosition.left }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { setViewingPayment(payment); setActiveActionId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"><Eye size={16} className="text-blue-500" /> View Details</button>
                        <button onClick={() => { setEditingPayment(payment); setActiveActionId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"><Edit size={16} className="text-amber-500" /> Edit Payment</button>
                        <button onClick={() => handlePrint(payment)} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"><Printer size={16} className="text-slate-500" /> Print Receipt</button>
                        <div className="h-px bg-slate-100 my-1 mx-2"></div>
                        <button onClick={() => handleDelete(payment.id)} className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-3 transition-colors"><Trash2 size={16} /> Delete Payment</button>
                      </div>,
                      document.body
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-400"><p className="font-medium">No payments found</p><p className="text-xs mt-1">Try adjusting your search or add a new payment.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingPayment && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-200 flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
            <div className="flex justify-between items-start px-8 py-6 border-b border-slate-100">
              <div><h3 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight"><div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Banknote size={24} /></div>Payment Details</h3><p className="text-slate-500 font-medium pl-[3.25rem]">Reference: <span className="text-emerald-600 font-bold">{viewingPayment.ref}</span></p></div>
              <button onClick={() => setViewingPayment(null)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><X size={28} /></button>
            </div>
            <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
              <div className="bg-emerald-50/50 rounded-3xl p-6 border border-emerald-100 flex items-center justify-between">
                <div><p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Amount Received</p><p className="text-4xl font-black text-emerald-700 tracking-tighter">{formatCurrency(viewingPayment.amount)}</p></div>
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm text-emerald-600"><CheckCircle2 size={32} /></div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3"><div className="p-2 bg-slate-100 rounded-lg text-slate-500"><User size={16} /></div><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</p><p className="text-sm font-bold text-slate-800">{viewingPayment.customerName}</p></div></div>
                  <div className="flex items-start gap-3"><div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Calendar size={16} /></div><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment Date</p><p className="text-sm font-bold text-slate-800">{new Date(viewingPayment.date).toLocaleString()}</p></div></div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3"><div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Clock size={16} /></div><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Method</p><p className="text-sm font-bold text-slate-800">{viewingPayment.method}</p></div></div>
                  <div className="flex items-start gap-3"><div className="p-2 bg-slate-100 rounded-lg text-slate-500"><MapPin size={16} /></div><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</p><p className="text-sm font-bold text-slate-800">{viewingPayment.location}</p></div></div>
                  <div className="flex items-start gap-3"><div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Paperclip size={16} /></div><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attachment</p>{viewingPayment.document ? <a href={viewingPayment.document} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-indigo-600 hover:underline flex items-center gap-1">View Document <ExternalLink size={12} /></a> : <p className="text-sm font-bold text-slate-400 italic">No attachment</p>}</div></div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><FileText size={12} /> Notes</p><div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 italic text-slate-600 text-sm">{viewingPayment.note || 'No notes provided for this payment.'}</div></div>
            </div>
            <div className="px-8 py-6 border-t border-slate-100 bg-white flex justify-end gap-4">
              <button onClick={() => setViewingPayment(null)} className="px-8 py-3 bg-white border-2 border-slate-200 text-slate-600 font-bold rounded-2xl text-sm hover:bg-slate-50 transition-all">Close</button>
              <button className="px-8 py-3 bg-slate-900 text-white font-bold rounded-2xl text-sm shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center gap-2"><Printer size={18} /> Print Receipt</button>
            </div>
          </div>
        </div>
      )}

      {editingPayment && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl border border-slate-200 flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 to-orange-500"></div>
            <div className="flex justify-between items-start px-8 py-6 border-b border-slate-100">
              <div><h3 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight"><div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Edit size={24} /></div>Edit Payment</h3><p className="text-slate-500 font-medium pl-[3.25rem]">Reference: <span className="text-amber-600 font-bold">{editingPayment.ref}</span></p></div>
              <button onClick={() => setEditingPayment(null)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><X size={28} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Amount</label>
                <div className="relative group/input">
                  <DollarSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-amber-500 transition-colors" />
                  <input type="number" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none text-lg font-black text-slate-700 transition-all" value={editingPayment.amount} onChange={(e) => setEditingPayment({ ...editingPayment, amount: parseFloat(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Method</label>
                  <select className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none text-sm font-bold text-slate-700 transition-all appearance-none" value={editingPayment.method} onChange={(e) => setEditingPayment({ ...editingPayment, method: e.target.value })}>
                    <option>Cash</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option><option>Emad</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                  <input type="datetime-local" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none text-xs font-bold text-slate-700 transition-all" value={editingPayment.date} onChange={(e) => setEditingPayment({ ...editingPayment, date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Note</label>
                <textarea rows={3} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none text-sm text-slate-600 resize-none transition-all" value={editingPayment.note} onChange={(e) => setEditingPayment({ ...editingPayment, note: e.target.value })} placeholder="Add notes..." />
              </div>
            </div>
            <div className="px-8 py-6 border-t border-slate-100 bg-white flex justify-end gap-4">
              <button onClick={() => setEditingPayment(null)} className="px-8 py-3 bg-white border-2 border-slate-200 text-slate-600 font-bold rounded-2xl text-sm hover:bg-slate-50 transition-all">Cancel</button>
              <button onClick={handleUpdatePayment} className="px-10 py-3 bg-amber-600 text-white font-bold rounded-2xl text-sm shadow-xl shadow-amber-200 hover:bg-amber-700 transition-all active:scale-95 flex items-center gap-2"><Save size={18} /> Update Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListPayments;
