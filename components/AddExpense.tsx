import React, { useState, useEffect } from 'react';
import { useGlobalContext } from '../src/context/GlobalContext';
import { useNotifications } from '../src/context/NotificationContext';
import {
  Save, Calendar, Upload,
  ChevronDown, Info, CreditCard,
  DollarSign, RefreshCw, MapPin, Tag
} from 'lucide-react';

interface AddExpenseProps {
  onNavigate?: (page: string) => void;
}

const AddExpense: React.FC<AddExpenseProps> = ({ onNavigate }) => {
  const { locations, expenseCategories, addExpense, generateId, formatCurrency, currentUser, settings } = useGlobalContext();
  const { addNotification } = useNotifications();

  // Form State
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [refNo, setRefNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [expenseFor, setExpenseFor] = useState('');
  const [contact, setContact] = useState('');
  const [tax, setTax] = useState('None');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isRefund, setIsRefund] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);

  // Recurring details
  const [recurringInterval, setRecurringInterval] = useState('');
  const [recurringUnit, setRecurringUnit] = useState('Days');
  const [recurringRepetitions, setRecurringRepetitions] = useState('');

  // Payment
  const [payAmount, setPayAmount] = useState('');
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 16));
  const [payMethod, setPayMethod] = useState('Cash');
  const [payAccount, setPayAccount] = useState('');
  const [payNote, setPayNote] = useState('');

  // Set default location from settings/first location
  useEffect(() => {
    if (locations.length > 0 && !location) {
      setLocation(locations[0].name);
    }
  }, [locations]);

  // Auto-generate reference number
  useEffect(() => {
    const prefix = settings?.expensesPrefix || 'EP';
    const year = new Date().getFullYear();
    setRefNo(`${prefix}${year}-${Math.floor(Math.random() * 9000 + 1000)}`);
  }, [settings]);

  // Computed totals
  const baseAmount = parseFloat(amount) || 0;
  const taxAmount = tax === 'VAT@5%' ? baseAmount * 0.05 : 0;
  const totalAmount = baseAmount + taxAmount;
  const paidAmount = parseFloat(payAmount) || 0;
  const paymentDue = Math.max(0, totalAmount - paidAmount);
  const paymentStatus: 'Paid' | 'Due' | 'Partial' =
    paidAmount >= totalAmount && totalAmount > 0 ? 'Paid' :
    paidAmount > 0 ? 'Partial' : 'Due';

  const handleSave = () => {
    if (!location) {
      addNotification({ title: 'Error', message: 'Please select a Business Location.', type: 'error' });
      return;
    }
    if (!category) {
      addNotification({ title: 'Error', message: 'Please select an Expense Category.', type: 'error' });
      return;
    }
    if (!amount || baseAmount <= 0) {
      addNotification({ title: 'Error', message: 'Please enter a valid Total Amount.', type: 'error' });
      return;
    }

    const newExpense = {
      id: generateId('EXP'),
      refNo,
      date: new Date(date).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
      category,
      subCategory,
      location,
      amount: baseAmount,
      tax: taxAmount,
      totalAmount,
      paymentStatus,
      paymentDue,
      expenseFor,
      contact,
      paymentAccount: payAccount,
      paymentMethod: payMethod,
      note,
      addedBy: currentUser?.name || 'Admin',
      isRefund,
      isRecurring,
      recurringInterval: isRecurring ? recurringInterval : '',
      recurringUnit: isRecurring ? recurringUnit : '',
      recurringRepetitions: isRecurring ? recurringRepetitions : '',
    };

    addExpense(newExpense);
    addNotification({
      title: 'Expense Added',
      message: `Expense ${refNo} for ${formatCurrency(totalAmount)} has been saved.`,
      type: 'success'
    });

    if (onNavigate) onNavigate('expenses');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-32 max-w-[1600px] mx-auto">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Add Expense</h2>
        <p className="text-slate-500 text-sm mt-1">Record a business expense with payment details.</p>
      </div>

      {/* Main Details Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 border-t-[3px] border-t-blue-600">
          <h3 className="text-base font-bold text-slate-800 mb-6">Expense Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Business Location: <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                        className="w-full pl-9 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                    >
                        <option value="">Please Select</option>
                        {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                    </select>
                  </div>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Expense Category: <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                        className="w-full pl-9 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                    >
                        <option value="">Please Select</option>
                        {expenseCategories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                    </select>
                  </div>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Sub Category:</label>
                  <input
                      type="text"
                      className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                      placeholder="Optional sub category"
                      value={subCategory}
                      onChange={(e) => setSubCategory(e.target.value)}
                  />
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Reference No:</label>
                  <input
                      type="text"
                      className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm font-mono"
                      placeholder="Auto-generated"
                      value={refNo}
                      onChange={(e) => setRefNo(e.target.value)}
                  />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Date: <span className="text-red-500">*</span></label>
                  <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                          type="datetime-local"
                          className="w-full pl-9 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                      />
                  </div>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Expense For:</label>
                  <input
                      type="text"
                      className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                      placeholder="e.g. Staff member name"
                      value={expenseFor}
                      onChange={(e) => setExpenseFor(e.target.value)}
                  />
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Contact (Customer/Supplier):</label>
                  <input
                      type="text"
                      className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                      placeholder="Contact name"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                  />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                    Applicable Tax: <Info size={12} className="text-blue-500" />
                  </label>
                  <select
                      className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                      value={tax}
                      onChange={(e) => setTax(e.target.value)}
                  >
                      <option value="None">None</option>
                      <option value="VAT@5%">VAT @ 5%</option>
                  </select>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Total Amount: <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="number"
                        step="0.001"
                        min="0"
                        className="w-full pl-9 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                        placeholder="0.000"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  {taxAmount > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Base: {formatCurrency(baseAmount)} + Tax: {formatCurrency(taxAmount)} = Total: {formatCurrency(totalAmount)}
                    </p>
                  )}
              </div>
          </div>

          <div className="mb-6">
              <label className="block text-xs font-bold text-slate-700 mb-2">Attach Document:</label>
              <div className="flex">
                  <input type="file" className="w-full px-3 py-1.5 rounded-l border border-r-0 border-slate-300 text-sm text-slate-500 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                  <button className="px-3 py-1.5 bg-blue-600 text-white rounded-r text-sm font-medium flex items-center gap-1">
                      <Upload size={14} /> Browse
                  </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Max 5MB · Allowed: pdf, csv, zip, doc, docx, jpeg, jpg, png</p>
          </div>

          <div className="mb-6">
              <label className="block text-xs font-bold text-slate-700 mb-2">Expense Note:</label>
              <textarea
                  className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm resize-none"
                  rows={3}
                  placeholder="Optional note about this expense..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
              />
          </div>

          <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                  type="checkbox"
                  id="isRefund"
                  checked={isRefund}
                  onChange={(e) => setIsRefund(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
              />
              <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
                  Is this a refund? <Info size={12} className="text-blue-500" />
              </span>
          </label>
      </div>

      {/* Recurring Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 border-t-[3px] border-t-indigo-500">
          <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input
                  type="checkbox"
                  id="isRecurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
              />
              <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <RefreshCw size={14} className="text-indigo-500" />
                  Is Recurring Expense? <Info size={12} className="text-blue-500" />
              </span>
          </label>

          {isRecurring && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Recurring Interval: <span className="text-red-500">*</span></label>
                      <div className="flex gap-2">
                          <input
                              type="number"
                              min="1"
                              className="flex-1 px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                              placeholder="e.g. 1"
                              value={recurringInterval}
                              onChange={(e) => setRecurringInterval(e.target.value)}
                          />
                          <select
                              className="px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                              value={recurringUnit}
                              onChange={(e) => setRecurringUnit(e.target.value)}
                          >
                              <option>Days</option>
                              <option>Months</option>
                              <option>Years</option>
                          </select>
                      </div>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">No. of Repetitions:</label>
                      <input
                          type="number"
                          min="1"
                          className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                          placeholder="Leave blank for infinite"
                          value={recurringRepetitions}
                          onChange={(e) => setRecurringRepetitions(e.target.value)}
                      />
                      <p className="text-[10px] text-slate-400 mt-1">If left blank, expense will be generated indefinitely.</p>
                  </div>
              </div>
          )}
      </div>

      {/* Payment Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 border-t-[3px] border-t-emerald-500">
          <h3 className="text-base font-bold text-emerald-700 mb-6 flex items-center gap-2">
            <CreditCard size={16} /> Add Payment
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Amount:</label>
                  <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                          type="number"
                          step="0.001"
                          min="0"
                          className="w-full pl-9 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          placeholder="0.000"
                      />
                  </div>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Paid On:</label>
                  <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                          type="datetime-local"
                          className="w-full pl-9 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                          value={paidOn}
                          onChange={(e) => setPaidOn(e.target.value)}
                      />
                  </div>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Payment Method:</label>
                  <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <select
                          className="w-full pl-9 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                          value={payMethod}
                          onChange={(e) => setPayMethod(e.target.value)}
                      >
                          <option>Cash</option>
                          <option>Card</option>
                          <option>Cheque</option>
                          <option>Bank Transfer</option>
                      </select>
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Payment Account:</label>
                  <input
                      type="text"
                      className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                      placeholder="e.g. Cash Account, Bank Account"
                      value={payAccount}
                      onChange={(e) => setPayAccount(e.target.value)}
                  />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Payment Note:</label>
                  <textarea
                      className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm resize-none"
                      rows={2}
                      placeholder="Optional payment note"
                      value={payNote}
                      onChange={(e) => setPayNote(e.target.value)}
                  />
              </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
              <div className="text-right space-y-1 text-sm">
                  <div className="flex justify-between gap-8">
                    <span className="text-slate-500">Total Amount:</span>
                    <span className="font-bold text-slate-700">{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-8">
                    <span className="text-slate-500">Amount Paid:</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(paidAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-8 border-t border-slate-200 pt-1">
                    <span className="font-bold text-slate-700">Payment Due:</span>
                    <span className={`font-bold ${paymentDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatCurrency(paymentDue)}
                    </span>
                  </div>
              </div>
          </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-center gap-4">
          <button
            onClick={() => onNavigate && onNavigate('expenses')}
            className="px-8 py-2.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white font-bold py-2.5 px-10 rounded-lg shadow hover:bg-blue-700 transition-colors text-sm flex items-center gap-2"
          >
            <Save size={16} /> Save Expense
          </button>
      </div>
    </div>
  );
};

export default AddExpense;
