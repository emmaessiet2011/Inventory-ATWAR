import React, { useMemo, useState } from 'react';
import {
  Download,
  Edit,
  FileSpreadsheet,
  Info,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { TaxRate as GlobalTaxRate, useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { buildPaginationItems } from '@/utils/pagination';
import { syncRecordStrict } from '@/utils/apiClient';

type TaxRateFormState = {
  id: string | null;
  name: string;
  rate: string;
  type: 'Inclusive' | 'Exclusive';
  description: string;
};

const normalizeText = (value: unknown): string => String(value || '').trim().toLowerCase();

const buildCsvCell = (value: unknown): string => {
  const raw = String(value ?? '');
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

const emptyFormState: TaxRateFormState = {
  id: null,
  name: '',
  rate: '',
  type: 'Exclusive',
  description: '',
};

const TaxRates: React.FC = () => {
  const {
    taxRates,
    addTaxRate,
    updateTaxRate,
    deleteTaxRate,
    generateId,
    settings,
    updateSettings,
    products,
    sales,
    orders,
    purchases,
    sellReturns,
    purchaseReturns,
    expenses,
    setProducts,
    setSales,
    setOrders,
    setPurchases,
    setSellReturns,
    setPurchaseReturns,
    setExpenses,
    currentUser,
    roles,
  } = useGlobalContext();
  const { addNotification } = useNotifications();

  const currentRoleRecord = roles.find(role => role.name === currentUser?.role);
  const rolePermissions = currentRoleRecord?.permissions || [];
  const roleHasExplicitPermissions = rolePermissions.length > 0;
  const hasRolePermission = (moduleName: string, permission: string) => {
    if (!currentUser) return false;
    if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
    if (!roleHasExplicitPermissions) return true;
    return rolePermissions.includes(permission) || rolePermissions.includes(`${moduleName}::${permission}`);
  };

  const canAddTaxRate = hasRolePermission('Tax rate', 'Add tax rate');
  const canEditTaxRate = hasRolePermission('Tax rate', 'Edit tax rate');
  const canDeleteTaxRate = hasRolePermission('Tax rate', 'Delete tax rate');

  const [search, setSearch] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [formState, setFormState] = useState<TaxRateFormState>(emptyFormState);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void} | null>(null);

  const sortedRates = useMemo(
    () => [...taxRates].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [taxRates],
  );

  const filteredRates = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return sortedRates;
    return sortedRates.filter((rate) => {
      const haystack = [
        rate.name,
        Number(rate.rate || 0).toFixed(3),
        rate.type,
        rate.description || '',
      ].map(normalizeText).join(' ');
      return haystack.includes(q);
    });
  }, [sortedRates, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRates.length / entriesPerPage));
  const currentPageSafe = Math.min(Math.max(currentPage, 1), totalPages);
  const pageItems = buildPaginationItems(currentPageSafe, totalPages);
  const startIndex = (currentPageSafe - 1) * entriesPerPage;
  const paginatedRates = filteredRates.slice(startIndex, startIndex + entriesPerPage);
  const fromEntry = filteredRates.length === 0 ? 0 : startIndex + 1;
  const toEntry = filteredRates.length === 0 ? 0 : startIndex + paginatedRates.length;

  const closeModal = () => {
    setIsModalOpen(false);
    setFormState(emptyFormState);
    setFormError('');
  };

  const openAddModal = () => {
    if (!canAddTaxRate) {
      addNotification({
        title: 'Access Denied',
        message: 'You do not have permission to add tax rates.',
        type: 'error',
      });
      return;
    }
    setFormState(emptyFormState);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (rate: GlobalTaxRate) => {
    if (!canEditTaxRate) {
      addNotification({
        title: 'Access Denied',
        message: 'You do not have permission to edit tax rates.',
        type: 'error',
      });
      return;
    }
    setFormState({
      id: rate.id,
      name: rate.name || '',
      rate: String(Number(rate.rate || 0).toFixed(3)),
      type: rate.type === 'Inclusive' ? 'Inclusive' : 'Exclusive',
      description: String(rate.description || ''),
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const validateForm = (): GlobalTaxRate | null => {
    const name = String(formState.name || '').trim();
    const rateValue = Number(formState.rate);
    const description = String(formState.description || '').trim();

    if (!name) {
      setFormError('Tax name is required.');
      return null;
    }
    if (!Number.isFinite(rateValue)) {
      setFormError('Tax rate must be a valid number.');
      return null;
    }
    if (rateValue < 0 || rateValue > 100) {
      setFormError('Tax rate must be between 0 and 100.');
      return null;
    }

    const duplicate = taxRates.some((rate) =>
      normalizeText(rate.name) === normalizeText(name) &&
      rate.id !== formState.id,
    );
    if (duplicate) {
      setFormError('Tax name already exists.');
      return null;
    }

    setFormError('');
    return {
      id: formState.id || generateId('TAX-'),
      name,
      rate: Number(rateValue.toFixed(3)),
      type: formState.type,
      description: description || undefined,
    };
  };

  const cascadeTaxRename = async (previousName: string, nextName: string, taxId: string) => {
    if (normalizeText(previousName) === normalizeText(nextName)) return;

    const normalizedPrev = normalizeText(previousName);
    const normalizedTaxId = String(taxId || '').trim();
    const persistedProducts = new Map<string, typeof products[number]>();
    for (const product of products) {
      if (normalizeText(product.tax) !== normalizedPrev) continue;
      const updated = { ...product, tax: nextName };
      const saved = await syncRecordStrict('products', updated);
      if (!saved.ok) continue;
      persistedProducts.set(updated.id, updated);
    }

    const persistedSales = new Map<string, typeof sales[number]>();
    for (const sale of sales) {
      if (normalizeText(sale.tax) !== normalizedPrev) continue;
      const updated = { ...sale, tax: nextName };
      const saved = await syncRecordStrict('sales', updated);
      if (!saved.ok) continue;
      persistedSales.set(updated.id, updated);
    }

    const persistedOrders = new Map<string, typeof orders[number]>();
    for (const order of orders) {
      if (normalizeText(order.taxType) !== normalizedPrev) continue;
      const updated = { ...order, taxType: nextName };
      const saved = await syncRecordStrict('orders', updated);
      if (!saved.ok) continue;
      persistedOrders.set(updated.id, updated);
    }

    const persistedSellReturns = new Map<string, typeof sellReturns[number]>();
    for (const ret of sellReturns) {
      if (normalizeText(ret.tax) !== normalizedPrev) continue;
      const updated = { ...ret, tax: nextName };
      const saved = await syncRecordStrict('sellReturns', updated);
      if (!saved.ok) continue;
      persistedSellReturns.set(updated.id, updated);
    }

    const persistedPurchases = new Map<string, typeof purchases[number]>();
    for (const purchase of purchases) {
      const purchaseTaxId = String(purchase.purchaseTaxId || '').trim();
      const shouldRename = purchaseTaxId
        ? purchaseTaxId === normalizedTaxId
        : normalizeText(purchase.purchaseTaxName) === normalizedPrev;
      if (!shouldRename) continue;
      const updated = { ...purchase, purchaseTaxName: nextName };
      const saved = await syncRecordStrict('purchases', updated);
      if (!saved.ok) continue;
      persistedPurchases.set(updated.id, updated);
    }

    const persistedPurchaseReturns = new Map<string, typeof purchaseReturns[number]>();
    for (const ret of purchaseReturns) {
      const returnTaxId = String(ret.purchaseTaxId || '').trim();
      const shouldRename = returnTaxId
        ? returnTaxId === normalizedTaxId
        : normalizeText(ret.purchaseTaxName) === normalizedPrev;
      if (!shouldRename) continue;
      const updated = { ...ret, purchaseTaxName: nextName };
      const saved = await syncRecordStrict('purchaseReturns', updated);
      if (!saved.ok) continue;
      persistedPurchaseReturns.set(updated.id, updated);
    }

    const persistedExpenses = new Map<string, typeof expenses[number]>();
    for (const expense of expenses) {
      const expenseTaxId = String(expense.taxRateId || '').trim();
      const shouldRename = expenseTaxId
        ? expenseTaxId === normalizedTaxId
        : normalizeText(expense.taxName) === normalizedPrev;
      if (!shouldRename) continue;
      const updated = { ...expense, taxName: nextName };
      const saved = await syncRecordStrict('expenses', updated);
      if (!saved.ok) continue;
      persistedExpenses.set(updated.id, updated);
    }

    if (persistedProducts.size > 0) setProducts(prev => prev.map(product => persistedProducts.get(product.id) || product));
    if (persistedSales.size > 0) setSales(prev => prev.map(sale => persistedSales.get(sale.id) || sale));
    if (persistedOrders.size > 0) setOrders(prev => prev.map(order => persistedOrders.get(order.id) || order));
    if (persistedSellReturns.size > 0) setSellReturns(prev => prev.map(ret => persistedSellReturns.get(ret.id) || ret));
    if (persistedPurchases.size > 0) setPurchases(prev => prev.map(purchase => persistedPurchases.get(purchase.id) || purchase));
    if (persistedPurchaseReturns.size > 0) setPurchaseReturns(prev => prev.map(ret => persistedPurchaseReturns.get(ret.id) || ret));
    if (persistedExpenses.size > 0) setExpenses(prev => prev.map(expense => persistedExpenses.get(expense.id) || expense));

    if (normalizeText(settings.defaultSaleTax) === normalizeText(previousName)) {
      updateSettings({ ...settings, defaultSaleTax: nextName });
    }
  };

  const handleSave = async () => {
    const payload = validateForm();
    if (!payload) return;

    if (formState.id) {
      if (!canEditTaxRate) {
        addNotification({
          title: 'Access Denied',
          message: 'You do not have permission to edit tax rates.',
          type: 'error',
        });
        return;
      }
      const previous = taxRates.find(rate => rate.id === formState.id);
      updateTaxRate(payload);
      if (previous) {
        await cascadeTaxRename(previous.name, payload.name, payload.id);
      }
      addNotification({
        title: 'Tax Rate Updated',
        message: `${payload.name} has been updated.`,
        type: 'success',
      });
    } else {
      if (!canAddTaxRate) {
        addNotification({
          title: 'Access Denied',
          message: 'You do not have permission to add tax rates.',
          type: 'error',
        });
        return;
      }
      addTaxRate(payload);
      addNotification({
        title: 'Tax Rate Added',
        message: `${payload.name} has been added.`,
        type: 'success',
      });
    }

    closeModal();
  };

  const handleDelete = (rate: GlobalTaxRate) => {
    if (!canDeleteTaxRate) {
      addNotification({
        title: 'Access Denied',
        message: 'You do not have permission to delete tax rates.',
        type: 'error',
      });
      return;
    }

    const normalizedName = normalizeText(rate.name);
    const productCount = products.filter(product => normalizeText(product.tax) === normalizedName).length;
    const saleCount = sales.filter(sale => normalizeText(sale.tax) === normalizedName).length;
    const orderCount = orders.filter(order => normalizeText(order.taxType) === normalizedName).length;
    const sellReturnCount = sellReturns.filter(ret => normalizeText(ret.tax) === normalizedName).length;
    const purchaseCount = purchases.filter(purchase =>
      String(purchase.purchaseTaxId || '') === rate.id ||
      normalizeText(purchase.purchaseTaxName) === normalizedName,
    ).length;
    const purchaseReturnCount = purchaseReturns.filter(ret =>
      String(ret.purchaseTaxId || '') === rate.id ||
      normalizeText(ret.purchaseTaxName) === normalizedName,
    ).length;
    const expenseCount = expenses.filter(expense =>
      String(expense.taxRateId || '') === rate.id ||
      normalizeText(expense.taxName) === normalizedName,
    ).length;

    const usageParts: string[] = [];
    if (productCount > 0) usageParts.push(`Products (${productCount})`);
    if (saleCount > 0) usageParts.push(`Sales (${saleCount})`);
    if (orderCount > 0) usageParts.push(`Orders (${orderCount})`);
    if (sellReturnCount > 0) usageParts.push(`Sell Returns (${sellReturnCount})`);
    if (purchaseCount > 0) usageParts.push(`Purchases (${purchaseCount})`);
    if (purchaseReturnCount > 0) usageParts.push(`Purchase Returns (${purchaseReturnCount})`);
    if (expenseCount > 0) usageParts.push(`Expenses (${expenseCount})`);

    if (usageParts.length > 0) {
      addNotification({
        title: 'Delete Blocked',
        message: `Cannot delete ${rate.name}. It is in use by: ${usageParts.join(', ')}.`,
        type: 'error',
      });
      return;
    }

    if (taxRates.length <= 1) {
      addNotification({
        title: 'Delete Blocked',
        message: 'At least one tax rate must remain.',
        type: 'error',
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Delete Tax Rate',
      message: `Delete tax rate "${rate.name}"?`,
      onConfirm: () => {
        if (normalizeText(settings.defaultSaleTax) === normalizedName) updateSettings({ ...settings, defaultSaleTax: 'None' });
        deleteTaxRate(rate.id);
        addNotification({ title: 'Tax Rate Deleted', message: `${rate.name} has been deleted.`, type: 'success' });
        setConfirmModal(null);
      },
    });
  };

  const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const lines = [
      ['Name', 'Tax Rate %', 'Type', 'Description'].join(','),
      ...filteredRates.map(rate => [
        buildCsvCell(rate.name),
        buildCsvCell(Number(rate.rate || 0).toFixed(3)),
        buildCsvCell(rate.type),
        buildCsvCell(rate.description || ''),
      ].join(',')),
    ];
    downloadFile('tax-rates.csv', lines.join('\n'), 'text/csv;charset=utf-8;');
  };

  const handleExportExcel = () => {
    const lines = [
      ['Name', 'Tax Rate %', 'Type', 'Description'].join('\t'),
      ...filteredRates.map(rate => [
        rate.name,
        Number(rate.rate || 0).toFixed(3),
        rate.type,
        rate.description || '',
      ].join('\t')),
    ];
    downloadFile('tax-rates.xls', lines.join('\n'), 'application/vnd.ms-excel;charset=utf-8;');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    const rows = filteredRates.map(rate => `
      <tr>
        <td style="padding:8px;border:1px solid #e2e8f0;">${rate.name}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;">${Number(rate.rate || 0).toFixed(3)}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;">${rate.type}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;">${rate.description || ''}</td>
      </tr>
    `).join('');
    printWindow.document.write(`
      <html>
        <head><title>Tax Rates</title></head>
        <body style="font-family:Arial,sans-serif;padding:16px;">
          <h2 style="margin-bottom:12px;">Tax Rates</h2>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr>
                <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">Name</th>
                <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">Tax Rate %</th>
                <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">Type</th>
                <th style="text-align:left;padding:8px;border:1px solid #cbd5e1;">Description</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
            <Info size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Tax Rates</h2>
            <p className="text-slate-500 text-sm mt-0.5">Manage tax rates and tax behavior across modules</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600" />

        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
            <div className="flex items-center gap-3 w-full xl:w-auto">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show</span>
              <select
                className="border-0 bg-white shadow-sm ring-1 ring-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:outline-none cursor-pointer"
                value={entriesPerPage}
                onChange={(event) => {
                  setEntriesPerPage(Number(event.target.value) || 25);
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">entries</span>
            </div>

            <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto">
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap"
              >
                <Download size={14} /> Export CSV
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap"
              >
                <FileSpreadsheet size={14} /> Export Excel
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap"
              >
                <Printer size={14} /> Print
              </button>
            </div>

            <div className="flex items-center gap-2 w-full xl:w-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-red-500/20 focus:outline-none text-sm placeholder:text-slate-400"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              {canAddTaxRate && (
                <button
                  onClick={openAddModal}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2 active:scale-95"
                >
                  <Plus size={16} /> Add Tax Rate
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10 text-slate-500 font-semibold border-b border-slate-200 whitespace-nowrap">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Tax Rate %</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRates.length > 0 ? (
                paginatedRates.map((rate) => (
                  <tr key={rate.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{rate.name}</td>
                    <td className="px-6 py-4 text-slate-600 font-mono">{Number(rate.rate || 0).toFixed(3)}</td>
                    <td className="px-6 py-4 text-slate-600">{rate.type}</td>
                    <td className="px-6 py-4 text-slate-600">{rate.description || '--'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {canEditTaxRate && (
                          <button
                            onClick={() => openEditModal(rate)}
                            className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs font-bold hover:bg-indigo-100 transition-colors"
                          >
                            <Edit size={12} /> Edit
                          </button>
                        )}
                        {canDeleteTaxRate && (
                          <button
                            onClick={() => handleDelete(rate)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        {!canEditTaxRate && !canDeleteTaxRate && <span className="text-slate-400">--</span>}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                    No data available in table
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span>Showing {fromEntry} to {toEntry} of {filteredRates.length} entries</span>
            <label className="flex items-center gap-2">
              <span className="text-slate-500">Rows:</span>
              <select
                value={entriesPerPage}
                onChange={(event) => setEntriesPerPage(Number(event.target.value) || 25)}
                className="px-2 py-1 border border-slate-200 rounded bg-white text-slate-700"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2 items-center">
            <button
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
              disabled={currentPageSafe <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              Previous
            </button>
            {pageItems.map((item, index) => item === '...'
              ? <span key={`page-ellipsis-${index}`} className="px-2 py-2 text-slate-400">...</span>
              : (
                <button
                  key={item}
                  onClick={() => setCurrentPage(item)}
                  className={`px-4 py-2 rounded-lg shadow-sm ${item === currentPageSafe ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' : 'bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700 transition'}`}
                >
                  {item}
                </button>
              ))}
            <button
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
              disabled={currentPageSafe >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                {formState.id ? 'Edit Tax Rate' : 'Add Tax Rate'}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                  value={formState.name}
                  onChange={(event) => setFormState(prev => ({ ...prev, name: event.target.value }))}
                  placeholder="e.g. VAT @ 5%"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                  Tax Rate % <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.001"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                  value={formState.rate}
                  onChange={(event) => setFormState(prev => ({ ...prev, rate: event.target.value }))}
                  placeholder="5.000"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                  Tax Type <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                  value={formState.type}
                  onChange={(event) => setFormState(prev => ({
                    ...prev,
                    type: event.target.value === 'Inclusive' ? 'Inclusive' : 'Exclusive',
                  }))}
                >
                  <option value="Exclusive">Exclusive</option>
                  <option value="Inclusive">Inclusive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                  Description <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm text-slate-700 shadow-sm resize-none"
                  value={formState.description}
                  onChange={(event) => setFormState(prev => ({ ...prev, description: event.target.value }))}
                  placeholder="Tax description"
                />
              </div>
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
                  <Info size={14} className="mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all text-sm shadow-sm"
              >
                Close
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 rounded-full bg-rose-50 text-rose-500 mb-4"><Trash2 size={32} /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{confirmModal.title}</h3>
              <p className="text-slate-500 text-sm mb-6">{confirmModal.message}</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setConfirmModal(null)} className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={confirmModal.onConfirm} className="flex-1 px-4 py-2.5 rounded-lg text-white font-bold bg-rose-600 hover:bg-rose-700 transition-colors">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaxRates;
