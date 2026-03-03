import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, Banknote, ChevronDown } from 'lucide-react';
import { useGlobalContext } from '../src/context/GlobalContext';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: any;
  onSave?: (payment: any) => void;
}

const AddPaymentModal: React.FC<AddPaymentModalProps> = ({ isOpen, onClose, sale, onSave = (_payment: any) => {} }) => {
  const { currentUser, settings, formatCurrency } = useGlobalContext();
  const [amount, setAmount] = useState('0.000');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [method, setMethod] = useState('Cash');
  const [account, setAccount] = useState('None');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setAmount(sale?.sellDue?.toString() || '0.000');
    setDate(new Date().toISOString().slice(0, 16));
    setMethod(settings.defaultSalePaymentMethod || 'Cash');
    setAccount('None');
    setNote('');
  }, [isOpen, sale, settings.defaultSalePaymentMethod]);

  if (!isOpen) return null;

  const handleSave = () => {
    const paymentAmount = parseFloat(amount);
    if (!sale || isNaN(paymentAmount) || paymentAmount <= 0) return;
    onSave({
      id: `PAY-${Date.now()}`,
      date: date.split('T')[0],
      contactId: sale.customerId?.toString() || '',
      contactName: sale.customerName || '',
      contactType: 'Customer',
      amount: paymentAmount,
      method,
      account,
      referenceNo: `PAY-${Date.now().toString().slice(-6)}`,
      note,
      type: 'received',
      addedBy: currentUser?.name || 'Admin',
      linkedInvoices: sale.invoiceNo ? [sale.invoiceNo] : [],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-sm shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative">
        <div className="px-6 py-4 border-b border-slate-100 bg-white">
          <h3 className="text-xl font-normal text-slate-700 text-opacity-90">Add payment</h3>
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 border border-slate-100 rounded-sm">
              <p className="text-sm font-bold text-slate-800 mb-1">Customer : <span className="font-normal">{sale?.customerName}</span></p>
              <p className="text-sm font-bold text-slate-800">Business: <span className="font-normal">{sale?.businessName || ''}</span></p>
            </div>
            <div className="bg-slate-50 p-4 border border-slate-100 rounded-sm">
              <p className="text-sm font-bold text-slate-800 mb-1">Invoice No.: <span className="font-normal">{sale?.invoiceNo}</span></p>
              <p className="text-sm font-bold text-slate-800 mb-1">Location: <span className="font-normal">{sale?.location ? `${sale.location.substring(0, 20)}...` : '--'}</span></p>
            </div>
            <div className="bg-slate-50 p-4 border border-slate-100 rounded-sm">
              <p className="text-sm font-bold text-slate-800 mb-1">Total amount: <span className="font-normal">{formatCurrency(sale?.grandTotal || sale?.totalAmount || 0)}</span></p>
              <p className="text-sm font-bold text-slate-800 mb-1">Payment Note:</p>
              <p className="text-sm text-slate-600">{sale?.sellNote || '--'}</p>
            </div>
          </div>

          <div className="text-sm font-bold text-slate-800">
            Advance Balance: <span className="font-normal">{formatCurrency(0)}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group">
              <label className="block text-sm font-bold text-slate-800 mb-2">Payment Method:*</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500"><Banknote size={16} /></div>
                <select
                  className="w-full pl-10 pr-8 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-600 appearance-none bg-white"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Emad">Emad</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-bold text-slate-800 mb-2">Paid on:*</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500"><Calendar size={16} /></div>
                <input
                  type="datetime-local"
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-600 bg-slate-100"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-bold text-slate-800 mb-2">Amount:*</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500"><DollarSign size={16} /></div>
                <input
                  type="text"
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-600"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="group">
              <label className="block text-sm font-bold text-slate-800 mb-2">Payment Account:</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500"><Banknote size={16} /></div>
                <select
                  className="w-full pl-10 pr-8 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-600 appearance-none bg-white"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                >
                  <option value="None">None</option>
                  <option value="Cash Account">Cash Account</option>
                  <option value="Bank Account">Bank Account</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>
            <div className="group">
              <label className="block text-sm font-bold text-slate-800 mb-2">Attach Document:</label>
              <div className="flex items-center">
                <label className="cursor-pointer bg-slate-100 border border-slate-300 text-slate-700 px-3 py-2 rounded-l text-sm hover:bg-slate-200 transition-colors whitespace-nowrap border-r-0">
                  Choose File
                  <input type="file" className="hidden" />
                </label>
                <span className="px-3 py-2 border border-slate-300 rounded-r w-full text-sm text-slate-500 bg-white">No file chosen</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Allowed File: .pdf, .csv, .zip, .doc, .docx, .jpeg, .jpg, .png</p>
            </div>
          </div>

          <div className="group">
            <label className="block text-sm font-bold text-slate-800 mb-2">Payment Note:</label>
            <textarea
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm resize-none text-slate-600"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            ></textarea>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
          <button onClick={handleSave} className="px-6 py-2 bg-[#6200ea] text-white font-bold text-sm rounded hover:bg-[#5000ca] transition-colors shadow-sm">Save</button>
          <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white font-bold text-sm rounded hover:bg-slate-900 transition-colors shadow-sm">Close</button>
        </div>
      </div>
    </div>
  );
};

export default AddPaymentModal;
