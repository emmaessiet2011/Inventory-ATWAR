import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalContext, Expense, Payment } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { Save, Calendar, Upload, Info, CreditCard, DollarSign, RefreshCw, MapPin, Tag, X, ArrowLeft, Receipt } from 'lucide-react';
import { toExpenseDateTimeInput, toExpenseIsoDateTime } from '@/utils/expenses';
import {
  addRegisterTransaction,
  deleteRegisterTransaction,
  getActiveRegisterSession,
} from '@/utils/registerLedger';

interface AddExpenseProps {
  onNavigate?: (page: string) => void;
  isEdit?: boolean;
  editExpenseId?: string;
  canAdd?: boolean;
  canEdit?: boolean;
  restrictToAddedById?: string;
  restrictToAddedByName?: string;
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const roundToThree = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;
const formatDecimalInput = (value: number) => String(value.toFixed(3)).replace(/\.?0+$/, '');
const digitsOnly = (value: string) => value.replace(/[^\d]/g, '');

interface TaxOption {
  id: string;
  name: string;
  rate: number;
}

const resolveExpenseEditAmount = (expense: Expense, matchedTaxRate: TaxOption | null) => {
  const existingAmount = Number(expense.amount);
  if (Number.isFinite(existingAmount) && existingAmount >= 0) {
    return roundToThree(existingAmount);
  }

  const totalAmount = Number(expense.totalAmount || 0);
  const taxAmount = Number(expense.tax || 0);
  if (totalAmount <= 0) return 0;

  if (matchedTaxRate && matchedTaxRate.rate > 0) {
    const computedBase = totalAmount / (1 + matchedTaxRate.rate / 100);
    return roundToThree(Math.max(0, computedBase));
  }

  return roundToThree(Math.max(0, totalAmount - taxAmount));
};

const isExpenseOwnerMatch = (expense: Expense, ownerIdFilter: string, ownerNameFilter: string) => {
  if (!ownerIdFilter && !ownerNameFilter) return true;
  const ownerId = normalize(expense.addedById);
  const ownerName = normalize(expense.addedBy);
  if (ownerIdFilter && ownerNameFilter) {
    return ownerId === ownerIdFilter && ownerName === ownerNameFilter;
  }
  if (ownerIdFilter) return ownerId === ownerIdFilter;
  if (ownerNameFilter) return ownerName === ownerNameFilter;
  return false;
};

const AddExpense: React.FC<AddExpenseProps> = ({
  onNavigate,
  isEdit = false,
  editExpenseId,
  canAdd = true,
  canEdit = true,
  restrictToAddedById = '',
  restrictToAddedByName = '',
}) => {
  const {
    locations,
    expenseCategories,
    taxRates,
    expenses,
    payments,
    addExpense,
    updateExpense,
    addPayment,
    updatePayment,
    deletePayment,
    generateId,
    formatCurrency,
    currentUser,
    settings,
  } = useGlobalContext();
  const { addNotification } = useNotifications();

  const ownerIdFilter = normalize(restrictToAddedById);
  const ownerNameFilter = normalize(restrictToAddedByName);
  const bootstrappedEditIdRef = useRef<string | null>(null);

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [refNo, setRefNo] = useState('');
  const [date, setDate] = useState(() => toExpenseDateTimeInput(new Date().toISOString()));
  const [expenseFor, setExpenseFor] = useState('');
  const [contact, setContact] = useState('');
  const [taxSelection, setTaxSelection] = useState('None');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isRefund, setIsRefund] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState('');
  const [recurringUnit, setRecurringUnit] = useState('Days');
  const [recurringRepetitions, setRecurringRepetitions] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [paidOn, setPaidOn] = useState(() => toExpenseDateTimeInput(new Date().toISOString()));
  const [payMethod, setPayMethod] = useState('Cash');
  const [payAccount, setPayAccount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  const taxOptions = useMemo<TaxOption[]>(() => {
    const mapped = taxRates
      .map(rate => ({
        id: String(rate.id || '').trim(),
        name: String(rate.name || '').trim(),
        rate: Number(rate.rate || 0),
      }))
      .filter(rate => rate.id && rate.name);
    return mapped;
  }, [taxRates]);

  const selectedTaxRate = useMemo(() => {
    if (!taxSelection || taxSelection === 'None') return null;
    return taxOptions.find((rate) => rate.id === taxSelection) || null;
  }, [taxOptions, taxSelection]);

  const baseAmount = roundToThree(Number(amount) || 0);
  const taxAmount = roundToThree(selectedTaxRate ? baseAmount * (selectedTaxRate.rate / 100) : 0);
  const totalAmount = roundToThree(baseAmount + taxAmount);
  const paidAmount = roundToThree(Number(payAmount) || 0);
  const paymentDue = roundToThree(Math.max(0, totalAmount - paidAmount));
  const paymentStatus: 'Paid' | 'Due' | 'Partial' =
    paidAmount >= totalAmount && totalAmount > 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Due';
  const findLinkedExpensePayment = (expenseId: string) =>
    payments.find(
      (payment) =>
        payment.contactType === 'Expense' &&
        (payment.expenseId === expenseId || payment.contactId === expenseId),
    );
  const categoryOptions = useMemo(() => {
    const fromMaster = expenseCategories
      .map((categoryItem) => String(categoryItem.name || '').trim())
      .filter(Boolean);
    if (category && !fromMaster.some((name) => normalize(name) === normalize(category))) {
      return [category, ...fromMaster];
    }
    return fromMaster;
  }, [expenseCategories, category]);

  useEffect(() => {
    const editId = String(editExpenseId || '').trim();
    const shouldEdit = isEdit || !!editId;
    const effectContextId = shouldEdit ? editId : '';
    if (bootstrappedEditIdRef.current === effectContextId) return;

    if (!shouldEdit) {
      bootstrappedEditIdRef.current = '';
      if (!canAdd) {
        addNotification({ title: 'Access Denied', message: 'You do not have permission to add expenses.', type: 'error' });
        onNavigate?.('expenses');
      }
      return;
    }

    if (!canEdit) {
      addNotification({ title: 'Access Denied', message: 'You do not have permission to edit expenses.', type: 'error' });
      onNavigate?.('expenses');
      return;
    }

    if (!editId) {
      addNotification({ title: 'Missing Expense Context', message: 'No expense selected for editing.', type: 'error' });
      onNavigate?.('expenses');
      return;
    }

    const existing = expenses.find((expense) => expense.id === editId);
    if (!existing) {
      addNotification({ title: 'Expense Not Found', message: 'The selected expense no longer exists.', type: 'error' });
      onNavigate?.('expenses');
      return;
    }

    if (!isExpenseOwnerMatch(existing, ownerIdFilter, ownerNameFilter)) {
      addNotification({ title: 'Access Denied', message: 'You can edit only your own expenses.', type: 'error' });
      onNavigate?.('expenses');
      return;
    }

    setEditingExpenseId(existing.id);
    bootstrappedEditIdRef.current = editId;
    setLocation(existing.location || '');
    setCategory(existing.category || '');
    setSubCategory(existing.subCategory || '');
    setRefNo(existing.refNo || '');
    setDate(toExpenseDateTimeInput(existing.date));
    setExpenseFor(existing.expenseFor || '');
    setContact(existing.contact || '');
    const inferredBaseAmount = Number(existing.amount || Math.max(0, Number(existing.totalAmount || 0) - Number(existing.tax || 0)));
    const inferredTaxAmount = Number(existing.tax || 0);
    const inferredRatePercent = inferredBaseAmount > 0
      ? (inferredTaxAmount / inferredBaseAmount) * 100
      : 0;
    const byId = taxOptions.find(rate => rate.id === String(existing.taxRateId || '').trim());
    const byName = !byId
      ? taxOptions.find(rate => normalize(rate.name) === normalize(existing.taxName || ''))
      : undefined;
    const byRate = !byId && !byName && inferredRatePercent > 0
      ? taxOptions.find(rate => Math.abs(Number(rate.rate || 0) - inferredRatePercent) < 0.001)
      : undefined;
    const matchedTaxRate = byId || byName || byRate || null;
    setTaxSelection(matchedTaxRate?.id || 'None');
    setAmount(formatDecimalInput(resolveExpenseEditAmount(existing, matchedTaxRate)));
    setNote(existing.note || '');
    setIsRefund(!!existing.isRefund);
    setIsRecurring(!!existing.isRecurring);
    setRecurringInterval(existing.recurringInterval || '');
    setRecurringUnit(existing.recurringUnit || 'Days');
    setRecurringRepetitions(existing.recurringRepetitions || '');

    const linkedPayment = findLinkedExpensePayment(existing.id);
    const existingTotal = Number(existing.totalAmount || existing.amount || 0);
    const existingDue = Number(existing.paymentDue || 0);
    const existingPaid = Number(
      linkedPayment?.amount ??
      existing.paidAmount ??
      Math.max(0, existingTotal - existingDue),
    );
    setPayAmount(existingPaid > 0 ? String(existingPaid) : '');
    setPaidOn(toExpenseDateTimeInput(linkedPayment?.date || existing.paidOn || existing.date));
    setPayMethod(linkedPayment?.method || existing.paymentMethod || 'Cash');
    setPayAccount(linkedPayment?.account || existing.paymentAccount || '');
    setPayNote(linkedPayment?.note || existing.paymentNote || '');
    setAttachmentName(existing.attachmentName || '');
  }, [isEdit, editExpenseId, canAdd, canEdit, addNotification, onNavigate, expenses, ownerIdFilter, ownerNameFilter, taxOptions]);

  useEffect(() => {
    if (editingExpenseId) return;
    if (locations.length > 0 && !location) {
      setLocation(locations[0].name);
    }
  }, [locations, location, editingExpenseId]);

  useEffect(() => {
    if (editingExpenseId) return;
    if (refNo.trim()) return;
    const prefix = settings?.expensesPrefix || 'EP';
    const year = new Date().getFullYear();
    setRefNo(`${prefix}${year}-${Math.floor(Math.random() * 9000 + 1000)}`);
  }, [settings?.expensesPrefix, editingExpenseId, refNo]);

  const handleCancel = () => {
    onNavigate?.('expenses');
  };

  const handleSave = () => {
    if (editingExpenseId && !canEdit) {
      addNotification({ title: 'Access Denied', message: 'You do not have permission to edit expenses.', type: 'error' });
      return;
    }
    if (!editingExpenseId && !canAdd) {
      addNotification({ title: 'Access Denied', message: 'You do not have permission to add expenses.', type: 'error' });
      return;
    }

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
    if (paidAmount > totalAmount + 0.001) {
      addNotification({ title: 'Error', message: 'Paid amount cannot be greater than total amount.', type: 'error' });
      return;
    }
    const parsedRecurringInterval = Number(recurringInterval);
    if (
      isRecurring &&
      (!recurringInterval || !Number.isInteger(parsedRecurringInterval) || parsedRecurringInterval <= 0)
    ) {
      addNotification({ title: 'Error', message: 'Recurring interval must be a whole number greater than zero.', type: 'error' });
      return;
    }
    const parsedRecurringRepetitions = Number(recurringRepetitions);
    if (
      isRecurring &&
      (
        !Number.isFinite(parsedRecurringRepetitions)
        || !Number.isInteger(parsedRecurringRepetitions)
        || parsedRecurringRepetitions <= 0
      )
    ) {
      addNotification({ title: 'Error', message: 'No. of repetitions must be a whole number greater than zero.', type: 'error' });
      return;
    }

    const existing = editingExpenseId ? expenses.find((expense) => expense.id === editingExpenseId) : undefined;
    if (editingExpenseId && !existing) {
      addNotification({ title: 'Expense Not Found', message: 'The selected expense no longer exists.', type: 'error' });
      onNavigate?.('expenses');
      return;
    }

    if (existing && !isExpenseOwnerMatch(existing, ownerIdFilter, ownerNameFilter)) {
      addNotification({ title: 'Access Denied', message: 'You can edit only your own expenses.', type: 'error' });
      onNavigate?.('expenses');
      return;
    }

    const linkedPayment = existing ? findLinkedExpensePayment(existing.id) : undefined;
    const normalizedPaidAmount = Math.max(0, paidAmount);
    const expense: Expense = {
      id: existing?.id || generateId('EXP'),
      refNo: String(refNo || '').trim() || `${settings?.expensesPrefix || 'EP'}${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`,
      date: toExpenseIsoDateTime(date),
      category,
      subCategory,
      location,
      amount: baseAmount,
      tax: taxAmount,
      taxRateId: selectedTaxRate?.id || '',
      taxName: selectedTaxRate?.name || 'None',
      totalAmount,
      paymentStatus,
      paymentDue,
      expenseFor,
      contact,
      paymentAccount: payAccount,
      paymentMethod: payMethod,
      note,
      paidAmount: normalizedPaidAmount,
      paidOn: normalizedPaidAmount > 0 ? toExpenseIsoDateTime(paidOn || date) : '',
      paymentNote: payNote,
      addedById: existing ? (existing.addedById || '') : (currentUser?.id || ''),
      addedBy: existing?.addedBy || currentUser?.name || 'Admin',
      isRefund,
      isRecurring,
      recurringInterval: isRecurring ? String(parsedRecurringInterval) : '',
      recurringUnit: isRecurring ? recurringUnit : '',
      recurringRepetitions: isRecurring && recurringRepetitions ? String(parsedRecurringRepetitions) : '',
      attachmentName,
    };

    const paymentPrefix = String(settings?.expensePaymentPrefix || 'EPY').trim() || 'EPY';
    const paymentReference = `${paymentPrefix}-${expense.refNo || expense.id}`;
    const expensePaymentAmount = Number(normalizedPaidAmount.toFixed(3));
    const expensePayment: Payment = {
      id: linkedPayment?.id || generateId('PAY'),
      date: toExpenseIsoDateTime(paidOn || date),
      contactId: expense.id,
      contactName: expense.category || 'Expense',
      contactType: 'Expense',
      amount: expensePaymentAmount,
      method: payMethod || 'Cash',
      account: payAccount || 'Expense',
      location: expense.location || '',
      referenceNo: paymentReference,
      note: payNote || note || `Payment for expense ${expense.refNo || expense.id}`,
      type: isRefund ? 'received' : 'sent',
      addedBy: linkedPayment?.addedBy || currentUser?.name || 'Admin',
      attachmentName: attachmentName || undefined,
      expenseId: expense.id,
    };

    const registerTxId = `RTX-EXP-${expense.id}`;

    if (existing) {
      updateExpense(expense);
      if (expensePaymentAmount > 0) {
        if (linkedPayment) {
          updatePayment(expensePayment);
        } else {
          addPayment(expensePayment);
        }
      } else if (linkedPayment) {
        deletePayment(linkedPayment.id);
      }
      addNotification({ title: 'Expense Updated', message: `Expense ${expense.refNo} has been updated.`, type: 'success' });
    } else {
      addExpense(expense);
      if (expensePaymentAmount > 0) {
        addPayment(expensePayment);
      }

      // Generate recurring instances (skip the first which was just saved above)
      if (isRecurring && parsedRecurringRepetitions > 1) {
        const advanceDate = (d: Date): void => {
          const n = parsedRecurringInterval;
          if (recurringUnit === 'Days') d.setDate(d.getDate() + n);
          else if (recurringUnit === 'Weeks') d.setDate(d.getDate() + n * 7);
          else if (recurringUnit === 'Months') d.setMonth(d.getMonth() + n);
          else if (recurringUnit === 'Years') d.setFullYear(d.getFullYear() + n);
        };
        const cursor = new Date(expense.date);
        for (let i = 1; i < parsedRecurringRepetitions; i++) {
          advanceDate(cursor);
          const childId = generateId('EXP');
          const childRefNo = `${expense.refNo}-R${i + 1}`;
          addExpense({
            ...expense,
            id: childId,
            refNo: childRefNo,
            date: cursor.toISOString(),
            paymentStatus: 'Due',
            paymentDue: totalAmount,
            paidAmount: 0,
            paidOn: '',
            isRecurring: false,
            recurringInterval: '',
            recurringUnit: '',
            recurringRepetitions: '',
          });
        }
        addNotification({
          title: 'Recurring Expenses Created',
          message: `${parsedRecurringRepetitions} expense instances created (${recurringInterval} ${recurringUnit} apart).`,
          type: 'success',
        });
      } else {
        addNotification({ title: 'Expense Added', message: `Expense ${expense.refNo} for ${formatCurrency(totalAmount)} has been saved.`, type: 'success' });
      }
    }

    if (expensePaymentAmount > 0) {
      const activeRegister = getActiveRegisterSession();
      const expenseLocation = normalize(expense.location);
      const registerLocation = normalize(activeRegister?.locationName);
      if (activeRegister && (!expenseLocation || expenseLocation === registerLocation)) {
        addRegisterTransaction({
          id: registerTxId,
          sessionId: activeRegister.id,
          date: expensePayment.date,
          type: isRefund ? 'payment' : 'expense',
          amount: expensePaymentAmount,
          method: payMethod || undefined,
          invoiceNo: expense.refNo || expense.id,
          note: isRefund
            ? `Expense refund ${expense.refNo || expense.id}`
            : `Expense payment ${expense.refNo || expense.id}`,
          addedBy: currentUser?.name || 'Admin',
        });
      }
    } else {
      deleteRegisterTransaction(registerTxId);
    }

    onNavigate?.('expenses');
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCancel}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="p-2.5 bg-amber-500 rounded-2xl shadow-md">
          <Receipt size={22} className="text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {editingExpenseId ? 'Edit Expense' : 'Add Expense'}
          </h2>
          <p className="text-slate-500 mt-0.5 text-sm">Record a business expense with payment details.</p>
        </div>
      </div>

      {/* Expense Details Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
          <Tag size={18} className="text-blue-500" /> Expense Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Business Location *</label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" value={location} onChange={(e) => setLocation(e.target.value)}>
                <option value="">Please Select</option>
                {locations.map((loc) => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Expense Category *</label>
            <div className="relative">
              <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Please Select</option>
                {categoryOptions.map((catName) => <option key={catName} value={catName}>{catName}</option>)}
              </select>
            </div>
            {category && !expenseCategories.some((cat) => normalize(cat.name) === normalize(category)) && (
              <p className="text-[11px] text-amber-600 mt-1">This expense uses a category that is no longer in master list.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sub Category</label>
            <input type="text" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" placeholder="Optional sub category" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Reference No</label>
            <input type="text" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 font-mono" value={refNo} onChange={(e) => setRefNo(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Date *</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input type="datetime-local" className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Expense For</label>
            <input type="text" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" value={expenseFor} onChange={(e) => setExpenseFor(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Contact (Customer/Supplier)</label>
            <input type="text" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">Applicable Tax <Info size={12} className="text-blue-500" /></label>
            <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" value={taxSelection} onChange={(e) => setTaxSelection(e.target.value)}>
              <option value="None">None</option>
              {taxOptions.map((rate) => (
                <option key={rate.id} value={rate.id}>{rate.name} ({rate.rate.toFixed(3)}%)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Total Amount *</label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="number" step="0.001" min="0" className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            {taxAmount > 0 && <p className="text-xs text-slate-500 mt-1">Base: {formatCurrency(baseAmount)} + Tax: {formatCurrency(taxAmount)} = Total: {formatCurrency(totalAmount)}</p>}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Attach Document</label>
          <label className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500 flex items-center justify-between cursor-pointer hover:bg-white transition-all">
            <span className="truncate">{attachmentName || 'Browse...'}</span>
            <span className="text-blue-600 flex items-center gap-1"><Upload size={14} /> Browse</span>
            <input type="file" className="hidden" onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || '')} />
          </label>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Expense Note</label>
          <textarea className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 resize-none" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isRefund} onChange={(e) => setIsRefund(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-slate-300" />
          <span className="text-sm font-bold text-slate-700 flex items-center gap-1">Is this a refund? <Info size={12} className="text-blue-500" /></span>
        </label>
      </div>

      {/* Recurring Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <label className="flex items-center gap-2 cursor-pointer mb-4">
          <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-slate-300" />
          <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><RefreshCw size={14} className="text-indigo-500" />Is Recurring Expense? <Info size={12} className="text-blue-500" /></span>
        </label>

        {isRecurring && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Recurring Interval *</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                  value={recurringInterval}
                  onChange={(e) => setRecurringInterval(digitsOnly(e.target.value))}
                />
                <select className="px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" value={recurringUnit} onChange={(e) => setRecurringUnit(e.target.value)}>
                  <option>Days</option><option>Weeks</option><option>Months</option><option>Years</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">No. of Repetitions</label>
              <input
                type="number"
                min="1"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                value={recurringRepetitions}
                onChange={(e) => setRecurringRepetitions(digitsOnly(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Payment Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
          <CreditCard size={18} className="text-amber-500" /> Add Payment
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Amount</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input type="number" step="0.001" min="0" className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Paid On</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input type="datetime-local" className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Method</label>
            <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option>Cash</option><option>Card</option><option>Cheque</option><option>Bank Transfer</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Account</label>
            <input type="text" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" value={payAccount} onChange={(e) => setPayAccount(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Note</label>
            <textarea className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 resize-none" rows={2} value={payNote} onChange={(e) => setPayNote(e.target.value)} />
          </div>
        </div>

        <div className="flex items-end justify-between pt-4 border-t border-slate-100">
          <div className="text-right space-y-1 text-sm ml-auto">
            <div className="flex justify-between gap-8"><span className="text-slate-500">Total Amount:</span><span className="font-bold text-slate-700">{formatCurrency(totalAmount)}</span></div>
            <div className="flex justify-between gap-8"><span className="text-slate-500">Amount Paid:</span><span className="font-bold text-emerald-600">{formatCurrency(paidAmount)}</span></div>
            <div className="flex justify-between gap-8 border-t border-slate-200 pt-1"><span className="font-bold text-slate-700">Payment Due:</span><span className={`font-bold ${paymentDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(paymentDue)}</span></div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <button onClick={handleCancel} className="px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition active:scale-95 flex items-center gap-2">
          <X size={14} /> Cancel
        </button>
        <button onClick={handleSave} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2 active:scale-95">
          <Save size={16} /> {editingExpenseId ? 'Update Expense' : 'Save Expense'}
        </button>
      </div>
    </div>
  );
};

export default AddExpense;
