import { useGlobalContext } from '../src/context/GlobalContext';
import React, { useMemo, useState } from 'react';
import { Filter, ArrowUpDown, Calendar, Printer, FileText, FileSpreadsheet, Download } from 'lucide-react';

import { printActiveReportTable } from '../src/utils/printUtils';
import { getExpenseCashSignedAmount } from '../src/utils/expenses';
import { buildDueSnapshot, paymentLocationCandidates } from '../src/utils/accountingSnapshot';

const TrialBalance: React.FC = () => {
  const { locations, sales, purchases, payments, expenses, customers, suppliers, products, formatCurrency } = useGlobalContext();
  const [locationFilter, setLocationFilter] = useState('all');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));

  const rows = useMemo(() => {
    const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase();
    const isAllLocations = locationFilter === 'all';
    const cutoffMs = new Date(`${reportDate}T23:59:59.999`).getTime();
    const isOnOrBeforeReportDate = (value?: string) => {
      const ms = Date.parse(String(value || ''));
      if (!Number.isFinite(ms)) return true;
      return ms <= cutoffMs;
    };
    const matchesLocation = (value?: string) =>
      isAllLocations || normalizeText(value) === normalizeText(locationFilter);

    const salesLocationByInvoice = new Map<string, string>();
    sales.forEach((sale) => {
      const invoiceNo = String(sale.invoiceNo || '').trim();
      if (!invoiceNo) return;
      salesLocationByInvoice.set(invoiceNo, String(sale.location || '').trim());
    });

    const expensesById = new Map<string, any>();
    expenses.forEach((expense) => expensesById.set(String(expense.id || ''), expense));

    const dueSnapshot = buildDueSnapshot({
      sales,
      purchases,
      payments,
      reportDate,
      locationFilter,
    });
    const supplierDue = dueSnapshot.supplierDue;
    const customerDue = dueSnapshot.customerDue;
    const closingStock = products
      .filter(product => isAllLocations || matchesLocation(product.businessLocation))
      .reduce((acc, product) => acc + ((product.stock || 0) * (product.unitPurchasePrice || 0)), 0);

    const filteredPayments = payments.filter(payment => {
      if (!isOnOrBeforeReportDate(payment.date)) return false;
      if (isAllLocations) return true;
      const locationsToMatch = paymentLocationCandidates({
        payment,
        salesLocationByInvoice,
        expensesById,
      });
      return locationsToMatch.some(location => matchesLocation(location));
    });

    const received = filteredPayments.filter(p => p.type === 'received').reduce((acc, p) => acc + (p.amount || 0), 0);
    const paid = filteredPayments.filter(p => p.type === 'sent').reduce((acc, p) => acc + (p.amount || 0), 0);
    const expenseCashFromExpenses = expenses
      .filter(expense => isOnOrBeforeReportDate(expense.date) && matchesLocation(expense.location))
      .reduce((acc, expense) => acc + getExpenseCashSignedAmount(expense), 0);
    const expenseCashFromLedger = payments
      .filter(payment =>
        payment.contactType === 'Expense' &&
        isOnOrBeforeReportDate(payment.date) &&
        (
          isAllLocations ||
          paymentLocationCandidates({
            payment,
            salesLocationByInvoice,
            expensesById,
          }).some(location => matchesLocation(location))
        )
      )
      .reduce((acc, payment) => acc + (payment.type === 'sent' ? payment.amount : -payment.amount), 0);
    const missingExpenseCashImpact = expenseCashFromExpenses - expenseCashFromLedger;
    const accountBalances = received - (paid + missingExpenseCashImpact);

    const scopedCustomerKeys = new Set<string>();
    sales.forEach((sale) => {
      if (String(sale.status || sale.saleStatus || '').trim() !== 'Final') return;
      if (!isOnOrBeforeReportDate(sale.date)) return;
      if (!matchesLocation(sale.location)) return;
      const customerId = String(sale.customerId || '').trim().toLowerCase();
      const customerName = String(sale.customerName || '').trim().toLowerCase();
      if (customerId) scopedCustomerKeys.add(customerId);
      if (customerName) scopedCustomerKeys.add(customerName);
    });
    filteredPayments
      .filter(payment => payment.contactType === 'Customer')
      .forEach((payment) => {
        const contactId = String(payment.contactId || '').trim().toLowerCase();
        const contactName = String(payment.contactName || '').trim().toLowerCase();
        if (contactId) scopedCustomerKeys.add(contactId);
        if (contactName) scopedCustomerKeys.add(contactName);
      });

    const scopedSupplierKeys = new Set<string>();
    purchases.forEach((purchase) => {
      if (!isOnOrBeforeReportDate(purchase.date)) return;
      if (!matchesLocation(purchase.location)) return;
      const supplierId = String(purchase.supplierId || '').trim().toLowerCase();
      const supplierName = String(purchase.supplier || '').trim().toLowerCase();
      if (supplierId) scopedSupplierKeys.add(supplierId);
      if (supplierName) scopedSupplierKeys.add(supplierName);
    });
    filteredPayments
      .filter(payment => payment.contactType === 'Supplier')
      .forEach((payment) => {
        const contactId = String(payment.contactId || '').trim().toLowerCase();
        const contactName = String(payment.contactName || '').trim().toLowerCase();
        if (contactId) scopedSupplierKeys.add(contactId);
        if (contactName) scopedSupplierKeys.add(contactName);
      });

    const customerOpening = customers.reduce((acc, customer) => {
      const value = Number(customer.openingBalance || 0);
      if (!value) return acc;
      if (!isAllLocations) {
        const idKey = String(customer.id || '').trim().toLowerCase();
        const nameKey = String(customer.businessName || '').trim().toLowerCase();
        if (!scopedCustomerKeys.has(idKey) && !scopedCustomerKeys.has(nameKey)) return acc;
      }
      return acc + value;
    }, 0);

    const supplierOpening = suppliers.reduce((acc, supplier) => {
      const value = Number(supplier.openingBalance || 0);
      if (!value) return acc;
      if (!isAllLocations) {
        const idKey = String(supplier.id || '').trim().toLowerCase();
        const nameKey = String(supplier.businessName || '').trim().toLowerCase();
        if (!scopedSupplierKeys.has(idKey) && !scopedSupplierKeys.has(nameKey)) return acc;
      }
      return acc + value;
    }, 0);

    const base = [
      { name: 'Customer Opening Balance', debit: customerOpening > 0 ? customerOpening : 0, credit: customerOpening < 0 ? Math.abs(customerOpening) : 0 },
      { name: 'Supplier Opening Balance', debit: supplierOpening < 0 ? Math.abs(supplierOpening) : 0, credit: supplierOpening > 0 ? supplierOpening : 0 },
      { name: 'Customer Due', debit: customerDue, credit: 0 },
      { name: 'Supplier Due', debit: 0, credit: supplierDue },
      { name: 'Closing Stock', debit: closingStock, credit: 0 },
      { name: 'Account Balances', debit: accountBalances > 0 ? accountBalances : 0, credit: accountBalances < 0 ? Math.abs(accountBalances) : 0 },
    ].filter(row => row.debit > 0 || row.credit > 0);

    const draftDebit = base.reduce((acc, r) => acc + r.debit, 0);
    const draftCredit = base.reduce((acc, r) => acc + r.credit, 0);
    const imbalance = Number((draftDebit - draftCredit).toFixed(3));
    if (Math.abs(imbalance) > 0.001) {
      base.push({
        name: 'Capital / Equity (Balancing)',
        debit: imbalance < 0 ? Math.abs(imbalance) : 0,
        credit: imbalance > 0 ? imbalance : 0,
      });
    }

    const totalDebit = base.reduce((acc, r) => acc + r.debit, 0);
    const totalCredit = base.reduce((acc, r) => acc + r.credit, 0);
    return {
      base,
      totalDebit,
      totalCredit,
    };
  }, [locationFilter, reportDate, sales, purchases, payments, expenses, customers, suppliers, products]);

  const handleExportCSV = () => {
    const headers = ['Account', 'Debit', 'Credit'];
    const body = rows.base.map(row => [
      row.name,
      row.debit ? row.debit.toFixed(3) : '',
      row.credit ? row.credit.toFixed(3) : '',
    ]);
    const footer = ['Total', rows.totalDebit.toFixed(3), rows.totalCredit.toFixed(3)];
    const csv = [
      headers.join(','),
      ...body.map(line => line.map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(',')),
      footer.map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(','),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'trial_balance.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const headers = ['Account', 'Debit', 'Credit'];
    const body = rows.base.map(row => [
      row.name,
      row.debit ? row.debit.toFixed(3) : '',
      row.credit ? row.credit.toFixed(3) : '',
    ]);
    const footer = ['Total', rows.totalDebit.toFixed(3), rows.totalCredit.toFixed(3)];
    const tsv = [headers.join('\t'), ...body.map(line => line.join('\t')), footer.join('\t')].join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'trial_balance.xls';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Trial Balance</h2>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
          <Filter className="text-cyan-500" size={20} />
          <h3 className="text-lg font-bold text-cyan-500">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-900">Business Location:</label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white border border-slate-200 focus:border-blue-500 transition-all text-sm text-slate-700 appearance-none cursor-pointer"
            >
              <option value="all">All locations</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.name}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-900">Filter by date:</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none bg-slate-100 border-r border-slate-200 rounded-l-lg px-3">
                <Calendar size={16} className="text-slate-500" />
              </div>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 transition-all text-sm text-slate-700"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-6">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="flex flex-wrap justify-end gap-2 mb-4">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <FileText size={12} /> Export CSV
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <FileSpreadsheet size={12} /> Export Excel
          </button>
          <button
            onClick={() => printActiveReportTable()}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Download size={12} className="hidden" />
            <Printer size={12} /> Print
          </button>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-200/80 text-slate-900 font-bold border-b border-slate-300">
              <tr>
                <th className="px-6 py-4 w-1/2">Trial Balance</th>
                <th className="px-6 py-4 w-1/4 border-l border-slate-300">Debit <ArrowUpDown size={12} className="inline ml-1 text-slate-500" /></th>
                <th className="px-6 py-4 w-1/4 border-l border-slate-300">Credit <ArrowUpDown size={12} className="inline ml-1 text-slate-500" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.base.map(row => (
                <tr key={row.name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">{row.name}:</td>
                  <td className="px-6 py-4 text-slate-700 border-l border-slate-200">{row.debit ? formatCurrency(row.debit) : ''}</td>
                  <td className="px-6 py-4 text-slate-700 border-l border-slate-200">{row.credit ? formatCurrency(row.credit) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-200/80 text-slate-900 font-bold border-t border-slate-300">
              <tr>
                <td className="px-6 py-4">Total</td>
                <td className="px-6 py-4 border-l border-slate-300">{formatCurrency(rows.totalDebit)}</td>
                <td className="px-6 py-4 border-l border-slate-300">{formatCurrency(rows.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrialBalance;


