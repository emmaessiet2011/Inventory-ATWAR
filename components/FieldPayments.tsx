import React, { useState, useEffect } from 'react';
import {
  Plus, Search, CheckCircle2, Trash2, X, DollarSign, User, FileText, Upload, Paperclip
} from 'lucide-react';
import { useGlobalContext } from '../src/context/GlobalContext';

interface FieldPayment {
  id: string;
  customerName: string;
  customerId: string;
  amount: number;
  date: string;
  method: string;
  collectedBy: string;
  status: 'Pending' | 'Approved';
  note: string;
  document?: string;
}

const FieldPayments: React.FC = () => {
  const { customers, addPayment: globalAddPayment, currentUser, formatCurrency } = useGlobalContext();
  const [payments, setPayments] = useState<FieldPayment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('app_field_payments');
      setPayments(stored ? JSON.parse(stored) : []);
    } catch {
      setPayments([]);
    }
  }, []);

  const persist = (next: FieldPayment[]) => {
    setPayments(next);
    localStorage.setItem('app_field_payments', JSON.stringify(next));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDocumentFile(e.target.files[0]);
    }
  };

  const handleSave = () => {
    if (!selectedCustomer || !amount) return;
    const newPayment: FieldPayment = {
      id: `FP-${Date.now()}`,
      customerName: selectedCustomer.businessName,
      customerId: selectedCustomer.id,
      amount: parseFloat(amount),
      date,
      method,
      collectedBy: currentUser?.name || 'Admin',
      status: 'Pending',
      note,
      document: documentFile ? documentFile.name : '',
    };
    persist([newPayment, ...payments]);
    setAmount('');
    setNote('');
    setDate(new Date().toISOString().slice(0, 16));
    setMethod('Cash');
    setSelectedCustomer(null);
    setCustomerSearch('');
    setDocumentFile(null);
    setIsModalOpen(false);
  };

  const handleApprove = (payment: FieldPayment) => {
    if (confirm(`Approve payment of ${formatCurrency(payment.amount)} from ${payment.customerName}?`)) {
      const updated = payments.map(p => p.id === payment.id ? { ...p, status: 'Approved' as const } : p);
      persist(updated);

      globalAddPayment({
        id: `PAY-FIELD-${Date.now()}`,
        date: payment.date.split('T')[0],
        contactId: payment.customerId,
        contactName: payment.customerName,
        contactType: 'Customer',
        amount: payment.amount,
        method: payment.method,
        account: '',
        referenceNo: payment.id,
        note: `Field Payment. Collected by: ${payment.collectedBy}. ${payment.note}`,
        type: 'received',
        addedBy: currentUser?.name || payment.collectedBy,
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this field payment record?')) {
      persist(payments.filter(p => p.id !== id));
    }
  };

  const filteredPayments = payments.filter(p => p.customerName.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCustomers = customers.filter(c =>
    c.businessName.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Field Payments</h2>
          <p className="text-slate-500 mt-1">Manage cash collected by field staff. Requires approval to impact accounts.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
        >
          <Plus size={18} /> Add Collection
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by customer..."
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-white text-slate-700 font-bold border-b border-slate-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Collected By</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4">Note</th>
                <th className="px-6 py-4 text-center">Attachment</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length > 0 ? (
                filteredPayments.map(payment => (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-600">{new Date(payment.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-bold text-slate-800">{payment.customerName}</td>
                    <td className="px-6 py-4 text-slate-600">{payment.collectedBy}</td>
                    <td className="px-6 py-4 text-slate-600">{payment.method}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">{formatCurrency(payment.amount)}</td>
                    <td className="px-6 py-4 text-slate-500 italic max-w-xs truncate">{payment.note || '--'}</td>
                    <td className="px-6 py-4 text-center">
                      {payment.document ? <Paperclip size={14} className="mx-auto text-blue-500" /> : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        payment.status === 'Approved'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {payment.status === 'Pending' ? (
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleApprove(payment)}
                            className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm transition-transform active:scale-95"
                            title="Approve"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(payment.id)}
                            className="p-2 bg-white border border-slate-200 text-rose-500 rounded-lg hover:bg-rose-50 hover:border-rose-200 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1">
                          <CheckCircle2 size={12} /> Verified
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 italic">No field payments found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-8 relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-500"><X size={24} /></button>
            <h3 className="text-2xl font-bold text-slate-900 mb-1">Record Collection</h3>
            <p className="text-slate-500 text-sm mb-6">Log cash collected from Customers</p>

            <div className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Customer *</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-sm"
                    placeholder="Select customer..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setIsDropdownOpen(true);
                      if (e.target.value === '') setSelectedCustomer(null);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                  />
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-48 overflow-y-auto custom-scrollbar">
                      {filteredCustomers.map(cust => (
                        <div
                          key={cust.id}
                          className="px-4 py-3 hover:bg-slate-50 cursor-pointer text-sm font-medium border-b border-slate-50 last:border-0"
                          onClick={() => {
                            setSelectedCustomer(cust);
                            setCustomerSearch(cust.businessName);
                            setIsDropdownOpen(false);
                          }}
                        >
                          {cust.businessName}
                        </div>
                      ))}
                      {filteredCustomers.length === 0 && <div className="px-4 py-3 text-sm text-slate-400">No customers found</div>}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Amount *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="number"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800"
                      placeholder="0.000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Date</label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium text-slate-700"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Payment Method</label>
                <select
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-sm bg-white"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option>Cash</option>
                  <option>Cheque</option>
                  <option>Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Attach Document</label>
                <div className="flex items-center">
                  <label className="cursor-pointer bg-slate-100 border border-slate-300 text-slate-700 px-4 py-3 rounded-l-xl text-sm hover:bg-slate-200 transition-colors whitespace-nowrap border-r-0 font-bold">
                    <Upload size={16} className="inline mr-2" /> Choose File
                    <input type="file" className="hidden" onChange={handleFileChange} />
                  </label>
                  <span className="px-4 py-3 border border-slate-300 rounded-r-xl w-full text-sm text-slate-500 bg-white truncate">
                    {documentFile ? documentFile.name : 'No file chosen'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Note</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-3 text-slate-400" size={18} />
                  <textarea
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm resize-none"
                    rows={3}
                    placeholder="Optional note..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  ></textarea>
                </div>
              </div>

              <button
                onClick={handleSave}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg mt-4"
              >
                Save Collection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldPayments;
