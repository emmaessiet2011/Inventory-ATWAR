import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  User, DollarSign, Calendar, CreditCard, CheckCircle2,
  Search, ChevronDown, Banknote, Upload, FileText
} from 'lucide-react';
import { useGlobalContext } from '../src/context/GlobalContext';

const NewPayment: React.FC = () => {
  const {
    customers,
    sales,
    addPayment: globalAddPayment,
    currentUser,
    formatCurrency,
  } = useGlobalContext();

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const customerStats = useMemo(() => {
    if (!selectedCustomer) return { totalSale: 0, totalPaid: 0, totalSaleDue: 0, openingBalance: 0, openingBalanceDue: 0 };
    const customerSales = sales.filter(s =>
      s.customerId === selectedCustomer.id || s.customerName === selectedCustomer.businessName
    );
    const totalSale = customerSales.reduce((acc, s) => acc + (s.grandTotal || 0), 0);
    const totalPaid = customerSales.reduce((acc, s) => acc + (s.totalPaid || 0), 0);
    const totalSaleDue = customerSales.reduce((acc, s) => acc + (s.sellDue || 0), 0);
    return {
      totalSale,
      totalPaid,
      totalSaleDue,
      openingBalance: selectedCustomer.openingBalance || 0,
      openingBalanceDue: selectedCustomer.openingBalance > 0 ? selectedCustomer.openingBalance : 0,
    };
  }, [selectedCustomer, sales]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.mobile && c.mobile.includes(searchQuery))
  );

  const handleSelectCustomer = (cust: any) => {
    setSelectedCustomer(cust);
    setSearchQuery(cust.businessName || cust.name);
    setIsDropdownOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDocumentFile(e.target.files[0]);
    }
  };

  const handleSave = () => {
    if (!selectedCustomer || !amount) {
      setNotification({ message: 'Please select a customer and enter amount', type: 'error' });
      return;
    }
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setNotification({ message: 'Invalid amount', type: 'error' });
      return;
    }

    globalAddPayment({
      id: `PAY-${Date.now()}`,
      date: date.split('T')[0],
      contactId: selectedCustomer.id,
      contactName: selectedCustomer.businessName,
      contactType: 'Customer',
      amount: paymentAmount,
      method,
      account: '',
      referenceNo: `PAY-${Date.now().toString().slice(-6)}`,
      note: note || 'General Payment',
      type: 'received',
      addedBy: currentUser?.name || 'Admin',
    });

    setNotification({ message: 'Payment recorded successfully!', type: 'success' });
    setAmount('');
    setNote('');
    setDocumentFile(null);
    setSelectedCustomer(null);
    setSearchQuery('');
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">New Payment</h2>
          <p className="text-slate-500 mt-1">Record a payment from a customer.</p>
        </div>
      </div>

      {notification && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={20} /> : <div className="w-5 h-5 rounded-full bg-red-200 flex items-center justify-center text-red-600 font-bold">!</div>}
          {notification.message}
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="group relative" ref={dropdownRef}>
              <label className="block text-sm font-bold text-slate-700 mb-2">Customer <span className="text-red-500">*</span></label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-slate-700"
                  placeholder="Search customer..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                    if (e.target.value === '') {
                      setSelectedCustomer(null);
                    }
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                />
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-60 overflow-y-auto custom-scrollbar">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map(cust => (
                        <div
                          key={cust.id}
                          className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                          onClick={() => handleSelectCustomer(cust)}
                        >
                          <div className="font-bold text-slate-800">{cust.businessName}</div>
                          <div className="text-xs text-slate-500">{cust.name} - {cust.mobile}</div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-400 italic">No customers found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-bold text-slate-700 mb-2">Amount <span className="text-red-500">*</span></label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="number"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-slate-700"
                  placeholder="0.000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-bold text-slate-700 mb-2">Payment Date</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="datetime-local"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-medium text-slate-700"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-bold text-slate-700 mb-2">Payment Method</label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-bold text-slate-700 appearance-none bg-white cursor-pointer"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option>Cash</option>
                  <option>Card</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                  <option>Emad</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-bold text-slate-700 mb-2">Attach Document</label>
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

            <div className="group">
              <label className="block text-sm font-bold text-slate-700 mb-2">Note</label>
              <textarea
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm resize-none"
                placeholder="Payment reference, notes..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              ></textarea>
            </div>

            <button
              onClick={handleSave}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Banknote size={20} /> Record Payment
            </button>
          </div>

          <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 h-fit">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-200 pb-3">
              <User size={18} className="text-emerald-600" /> Customer Account
            </h3>

            {selectedCustomer ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-bold mb-1">Customer</p>
                  <p className="font-bold text-lg text-slate-900 leading-tight">{selectedCustomer.businessName}</p>
                  <p className="text-sm text-slate-600 mt-1">{selectedCustomer.name}</p>
                </div>
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-600">Total Sale:</span><span className="text-sm font-bold text-slate-800">{formatCurrency(customerStats.totalSale)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-600">Total Paid:</span><span className="text-sm font-bold text-emerald-600">{formatCurrency(customerStats.totalPaid)}</span></div>
                  <div className="h-px bg-slate-200"></div>
                  <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-600">Total Sale Due:</span><span className="text-base font-black text-red-600">{formatCurrency(customerStats.totalSaleDue)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-600">Opening Balance:</span><span className="text-sm font-bold text-slate-800">{formatCurrency(customerStats.openingBalance)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-600">Opening Balance Due:</span><span className="text-sm font-bold text-red-600">{formatCurrency(customerStats.openingBalanceDue)}</span></div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-center">
                <FileText size={48} className="mb-2 opacity-20" />
                <p className="text-sm">Select a customer to view account stats</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewPayment;
