import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, Search, Edit, Trash2, X, Tag, Percent, CalendarClock,
  CreditCard, CheckCircle2, Info, Package, ChevronDown, AlertTriangle, DollarSign
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { useGlobalContext } from '@/context/GlobalContext';
import type { Product, SellingPriceGroup, SellingPriceGroupProduct } from '@/context/GlobalContext';
import { buildPaginationItems } from '@/utils/pagination';

const SellingPriceGroups: React.FC = () => {
  const { addNotification } = useNotifications();
  const {
    sellingPriceGroups,
    customerGroups,
    addSellingPriceGroup,
    updateSellingPriceGroup,
    deleteSellingPriceGroup,
    generateId,
    products,
    formatCurrency,
  } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SellingPriceGroup | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    payTermDays: '',
    payTermUnit: 'Days' as 'Days' | 'Months',
    taxRate: '5',
    discount: '0',
    priceCalcPercentage: '0',
    status: 'Active' as 'Active' | 'Inactive',
  });

  // Product search within modal
  const [productSearch, setProductSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<SellingPriceGroupProduct[]>([]);

  const normalizeText = (value?: string) => String(value || '').trim().toLowerCase();
  const normalizeSku = (value?: string) => normalizeText(value).replace(/\s+/g, '');

  const clampDiscount = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value));
  };

  const resolveLiveProduct = (rule: SellingPriceGroupProduct): Product | undefined =>
    products.find(p =>
      p.id === rule.id ||
      (rule.sku && normalizeSku(p.sku) === normalizeSku(rule.sku))
    );

  const resolveLivePrice = (rule: SellingPriceGroupProduct): number => {
    const liveProduct = resolveLiveProduct(rule);
    const livePrice = Number(liveProduct?.sellingPrice);
    if (Number.isFinite(livePrice)) return livePrice;
    const fallback = Number(rule.price);
    return Number.isFinite(fallback) ? fallback : 0;
  };

  const mapRuleWithLiveProduct = (rule: SellingPriceGroupProduct): SellingPriceGroupProduct => {
    const liveProduct = resolveLiveProduct(rule);
    const discount = clampDiscount(Number(rule.discount));
    return {
      id: liveProduct?.id || rule.id,
      name: liveProduct?.name || rule.name,
      sku: liveProduct?.sku || rule.sku,
      price: Number(resolveLivePrice(rule).toFixed(3)),
      discount: Number(discount.toFixed(3)),
    };
  };

  const openAdd = () => {
    setEditingGroup(null);
    setFormData({ name: '', description: '', payTermDays: '', payTermUnit: 'Days', taxRate: '5', discount: '0', priceCalcPercentage: '0', status: 'Active' });
    setSelectedProducts([]);
    setProductSearch('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (group: SellingPriceGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description,
      payTermDays: group.payTermDays > 0 ? String(group.payTermDays) : '',
      payTermUnit: group.payTermUnit,
      taxRate: String(group.taxRate),
      discount: String(group.discount),
      priceCalcPercentage: String(group.priceCalcPercentage),
      status: group.status,
    });
    // Restore previously saved applicable products, refreshing names/SKUs/prices from latest products.
    setSelectedProducts((group.applicableProducts || []).map(mapRuleWithLiveProduct));
    setProductSearch('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      const message = 'Price Group Name is required.';
      setFormError(message);
      addNotification({ title: 'Validation Error', message, type: 'error' });
      return;
    }

    const duplicate = sellingPriceGroups.some(group =>
      group.id !== editingGroup?.id &&
      normalizeText(group.name) === normalizeText(trimmedName)
    );
    if (duplicate) {
      const message = `Selling Price Group "${trimmedName}" already exists.`;
      setFormError(message);
      addNotification({ title: 'Duplicate Price Group', message, type: 'error' });
      return;
    }

    const parsedPayTermDays = formData.payTermDays.trim() === '' ? 0 : Number(formData.payTermDays);
    if (!Number.isFinite(parsedPayTermDays) || parsedPayTermDays < 0 || !Number.isInteger(parsedPayTermDays)) {
      const message = 'Payment term must be a whole number of days/months (0 or greater).';
      setFormError(message);
      addNotification({ title: 'Validation Error', message, type: 'error' });
      return;
    }

    const parsedTaxRate = Number(formData.taxRate);
    if (!Number.isFinite(parsedTaxRate) || parsedTaxRate < 0 || parsedTaxRate > 100) {
      const message = 'Default VAT/Tax must be between 0 and 100.';
      setFormError(message);
      addNotification({ title: 'Validation Error', message, type: 'error' });
      return;
    }

    const parsedDiscount = Number(formData.discount);
    if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100) {
      const message = 'Global Discount must be between 0 and 100.';
      setFormError(message);
      addNotification({ title: 'Validation Error', message, type: 'error' });
      return;
    }

    const parsedPriceCalc = Number(formData.priceCalcPercentage);
    if (!Number.isFinite(parsedPriceCalc) || parsedPriceCalc < -100) {
      const message = 'Price Adjustment cannot be less than -100.';
      setFormError(message);
      addNotification({ title: 'Validation Error', message, type: 'error' });
      return;
    }

    const normalizedSelectedProducts = selectedProducts.map(mapRuleWithLiveProduct);
    const invalidProductDiscount = normalizedSelectedProducts.some(rule => rule.discount < 0 || rule.discount > 100);
    if (invalidProductDiscount) {
      const message = 'Per-product discount must be between 0 and 100.';
      setFormError(message);
      addNotification({ title: 'Validation Error', message, type: 'error' });
      return;
    }

    const groupData: SellingPriceGroup = {
      id: editingGroup ? editingGroup.id : generateId('SPG'),
      name: trimmedName,
      description: formData.description.trim(),
      payTermDays: parsedPayTermDays,
      payTermUnit: formData.payTermUnit,
      taxRate: Number(parsedTaxRate.toFixed(3)),
      discount: Number(parsedDiscount.toFixed(3)),
      priceCalcPercentage: Number(parsedPriceCalc.toFixed(3)),
      status: formData.status,
      applicableProducts: normalizedSelectedProducts.length > 0 ? normalizedSelectedProducts : undefined,
    };

    if (editingGroup) {
      updateSellingPriceGroup(groupData);
      addNotification({ title: 'Price Group Updated', message: `"${trimmedName}" updated successfully.`, type: 'success' });
    } else {
      addSellingPriceGroup(groupData);
      addNotification({ title: 'Price Group Created', message: `"${trimmedName}" created successfully.`, type: 'success' });
    }

    setFormError('');
    setIsModalOpen(false);
  };

  // Product search results (filtered from GlobalContext products)
  const productSearchResults = productSearch.trim()
    ? products.filter(p =>
        (String(p.name).toLowerCase().includes(productSearch.toLowerCase()) ||
        String(p.sku).toLowerCase().includes(productSearch.toLowerCase())) &&
        !selectedProducts.find(sp => sp.id === p.id)
      ).slice(0, 8)
    : [];

  const addProductToGroup = (product: Product) => {
    const basePrice = Number(product.sellingPrice);
    const safePrice = Number.isFinite(basePrice) ? basePrice : 0;
    setSelectedProducts(prev => [
      ...prev,
      {
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: Number(safePrice.toFixed(3)),
        discount: 0,
      }
    ]);
    setFormError('');
    setProductSearch('');
  };

  const removeProduct = (id: string) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== id));
  };

  const updateProductDiscount = (id: string, discount: number) => {
    const safeDiscount = Number(clampDiscount(discount).toFixed(3));
    setSelectedProducts(prev => prev.map(p => p.id === id ? { ...p, discount: safeDiscount } : p));
    setFormError('');
  };

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return sellingPriceGroups.filter(g =>
      g.name.toLowerCase().includes(term) ||
      g.description.toLowerCase().includes(term)
    );
  }, [sellingPriceGroups, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageItems = buildPaginationItems(safePage, totalPages);

  const payTermLabel = (g: SellingPriceGroup) =>
    g.payTermDays === 0 ? 'Immediate' : `${g.payTermDays} ${g.payTermUnit}`;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pendingDeleteImpact = useMemo(() => {
    if (!pendingDeleteId) return { count: 0, sampleNames: [] as string[] };
    const targetGroup = sellingPriceGroups.find(group => group.id === pendingDeleteId);
    if (!targetGroup) return { count: 0, sampleNames: [] as string[] };
    const linked = customerGroups.filter(customerGroup => {
      const linkedById = customerGroup.sellingPriceGroupId === targetGroup.id;
      const linkedByLegacyName = !customerGroup.sellingPriceGroupId &&
        normalizeText(customerGroup.sellingPriceGroup) === normalizeText(targetGroup.name);
      return linkedById || linkedByLegacyName;
    });
    return {
      count: linked.length,
      sampleNames: linked.slice(0, 3).map(group => group.name),
    };
  }, [pendingDeleteId, sellingPriceGroups, customerGroups]);

  const handleConfirmDelete = () => {
    if (!pendingDeleteId) return;
    deleteSellingPriceGroup(pendingDeleteId);
    if (pendingDeleteImpact.count > 0) {
      addNotification({
        title: 'Price Group Deleted',
        message: `${pendingDeleteImpact.count} customer group(s) were unlinked from this selling price group.`,
        type: 'warning',
      });
    } else {
      addNotification({ title: 'Price Group Deleted', message: 'Selling price group deleted successfully.', type: 'success' });
    }
    setPendingDeleteId(null);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
            <DollarSign size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Selling Price Groups</h2>
            <p className="text-slate-500 mt-0.5 text-sm">Manage pricing tiers, payment terms, and tax rules</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2 active:scale-95"
        >
          <Plus size={18} /> Add Price Group
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>

        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
            <div className="flex items-center gap-3 w-full xl:w-auto">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show</span>
              <div className="relative">
                <select
                  className="border-0 bg-white shadow-sm ring-1 ring-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:outline-none cursor-pointer appearance-none"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">entries</span>
            </div>
            <div className="relative w-full xl:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search price groups..."
                className="w-full xl:w-64 pl-9 pr-4 py-2.5 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-red-500/20 focus:outline-none text-sm placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-1/4">Name</th>
                <th className="px-6 py-4">Payment Term</th>
                <th className="px-6 py-4 text-center">Tax (%)</th>
                <th className="px-6 py-4 text-center">Discount (%)</th>
                <th className="px-6 py-4 text-center">Price Adj. (%)</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length > 0 ? paginated.map((group) => (
                <tr key={group.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                        <Tag size={16} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{group.name}</span>
                        <span className="text-[10px] text-slate-400">{group.description}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium bg-slate-100 px-2 py-1 rounded w-fit text-xs">
                      <CalendarClock size={12} className="text-slate-500" />
                      {payTermLabel(group)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-mono text-slate-600 text-xs">{group.taxRate}%</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {group.discount > 0 ? (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-xs">{group.discount}%</span>
                    ) : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`font-bold text-xs px-2 py-0.5 rounded ${
                      group.priceCalcPercentage < 0 ? 'bg-green-50 text-green-700' :
                      group.priceCalcPercentage > 0 ? 'bg-amber-50 text-amber-700' : 'text-slate-400'
                    }`}>
                      {group.priceCalcPercentage > 0 ? '+' : ''}{group.priceCalcPercentage}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                      group.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {group.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(group)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => setPendingDeleteId(group.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                    No data available in table
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span>Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} entries</span>
            <label className="flex items-center gap-2">
              <span className="text-slate-500">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 border border-slate-200 rounded bg-white text-slate-700"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 shadow-sm"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >Previous</button>
            {pageItems.map((item, index) => item === '...'
              ? <span key={`page-ellipsis-${index}`} className="px-2 py-2 text-slate-400">...</span>
              : (
                <button
                  key={item}
                  onClick={() => setCurrentPage(item)}
                  className={`px-4 py-2 rounded-lg shadow-sm ${item === safePage ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' : 'bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700 transition'}`}
                >
                  {item}
                </button>
              ))}
            <button
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 shadow-sm"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >Next</button>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-4xl w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">

            {/* Modal Header */}
            <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Tag className="text-blue-600" size={24} />
                  {editingGroup ? 'Edit Price Group' : 'Add Selling Price Group'}
                </h3>
                <p className="text-slate-500 text-sm mt-1">Configure pricing tier rules.</p>
              </div>
              <button onClick={() => { setIsModalOpen(false); setFormError(''); }} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 overflow-y-auto custom-scrollbar bg-slate-50/50">
              {formError && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Section 1: Basic Info */}
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-2">
                    <Info size={16} /> General Details
                  </h4>

                  <div className="group">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800"
                      placeholder="e.g. Retail, Wholesale, VIP"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        setFormError('');
                      }}
                    />
                  </div>

                  <div className="group">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Description</label>
                    <textarea
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 resize-none"
                      placeholder="Who is this price group for?"
                      value={formData.description}
                      onChange={(e) => {
                        setFormData({ ...formData, description: e.target.value });
                        setFormError('');
                      }}
                    />
                  </div>

                  <div className="group">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Status</label>
                    <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-transparent">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="modal-status"
                          checked={formData.status === 'Active'}
                          onChange={() => {
                            setFormData({ ...formData, status: 'Active' });
                            setFormError('');
                          }}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300"
                        />
                        <span className="text-sm font-bold text-slate-700">Active</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="modal-status"
                          checked={formData.status === 'Inactive'}
                          onChange={() => {
                            setFormData({ ...formData, status: 'Inactive' });
                            setFormError('');
                          }}
                          className="w-4 h-4 text-slate-600 focus:ring-slate-500 border-slate-300"
                        />
                        <span className="text-sm font-medium text-slate-500">Inactive</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Section 2: Financial Rules */}
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-2">
                    <CreditCard size={16} /> Payment & Tax Rules
                  </h4>

                  <div className="group">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Payment Term</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        placeholder="0"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800"
                        value={formData.payTermDays}
                        onChange={(e) => {
                          setFormData({ ...formData, payTermDays: e.target.value });
                          setFormError('');
                        }}
                      />
                      <div className="relative">
                        <select
                          className="px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium cursor-pointer w-32 appearance-none"
                          value={formData.payTermUnit}
                          onChange={(e) => {
                            setFormData({ ...formData, payTermUnit: e.target.value as 'Days' | 'Months' });
                            setFormError('');
                          }}
                        >
                          <option value="Days">Days</option>
                          <option value="Months">Months</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Leave 0 for immediate payment.</p>
                  </div>

                  <div className="group">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Default VAT/Tax (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.001}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800"
                        placeholder="5"
                        value={formData.taxRate}
                        onChange={(e) => {
                          setFormData({ ...formData, taxRate: e.target.value });
                          setFormError('');
                        }}
                      />
                      <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  <div className="group">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Global Discount (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.001}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800"
                        placeholder="0"
                        value={formData.discount}
                        onChange={(e) => {
                          setFormData({ ...formData, discount: e.target.value });
                          setFormError('');
                        }}
                      />
                      <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Applied to total invoice amount.</p>
                  </div>

                  <div className="group">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Price Adjustment (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={-100}
                        step={0.001}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800"
                        placeholder="e.g. -10 for 10% below default"
                        value={formData.priceCalcPercentage}
                        onChange={(e) => {
                          setFormData({ ...formData, priceCalcPercentage: e.target.value });
                          setFormError('');
                        }}
                      />
                      <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Negative = below default price.</p>
                  </div>
                </div>
              </div>

              {/* Section 3: Applicable Products */}
              <div className="mt-8 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Package size={16} /> Applicable Products
                </h4>
                <p className="text-xs text-slate-500 mb-4">Select specific products. If left empty, this group applies to all products.</p>

                {/* Product search */}
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800"
                    placeholder="Type product name or SKU..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setFormError('');
                    }}
                  />
                  {productSearchResults.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                      {productSearchResults.map(p => (
                        <button
                          key={p.id}
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex justify-between items-center transition-colors"
                          onClick={() => addProductToGroup(p)}
                        >
                          <span className="font-medium text-slate-800">{p.name}</span>
                          <span className="text-xs text-slate-400 font-mono">{p.sku} - {formatCurrency(p.sellingPrice)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected products table */}
                <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Product Name</th>
                        <th className="px-4 py-3 w-32">SKU</th>
                        <th className="px-4 py-3 w-32 text-right">Price</th>
                        <th className="px-4 py-3 w-32 text-center">Discount (%)</th>
                        <th className="px-4 py-3 w-32 text-right">Final Price</th>
                        <th className="px-4 py-3 w-16 text-center">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedProducts.map(p => {
                        const livePrice = resolveLivePrice(p);
                        const final = livePrice * (1 - p.discount / 100);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-slate-800 font-medium">{p.name}</td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.sku}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(livePrice)}</td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.001}
                                className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-800 text-center"
                                value={p.discount}
                                onChange={(e) => updateProductDiscount(p.id, parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(final)}</td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => removeProduct(p.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                                <X size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {selectedProducts.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm italic">
                            No products selected - this group will apply to all products.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-6 border-t border-slate-100 flex justify-end gap-3 bg-white z-10">
              <button onClick={() => { setIsModalOpen(false); setFormError(''); }} className="px-6 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all text-sm shadow-sm">
                Cancel
              </button>
              <button onClick={handleSave} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 text-sm flex items-center gap-2">
                <CheckCircle2 size={16} /> {editingGroup ? 'Update' : 'Save Selling Price Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {pendingDeleteId && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Confirm Delete</h3>
            </div>
            <p className="text-slate-500 text-sm mb-2">Are you sure you want to delete this price group? This action cannot be undone.</p>
            {pendingDeleteImpact.count > 0 ? (
              <p className="text-amber-700 text-sm mb-6">
                This will unlink {pendingDeleteImpact.count} customer group(s)
                {pendingDeleteImpact.sampleNames.length > 0 ? `: ${pendingDeleteImpact.sampleNames.join(', ')}` : ''}.
              </p>
            ) : (
              <p className="text-slate-500 text-sm mb-6">No linked customer groups will be affected.</p>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setPendingDeleteId(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition">Cancel</button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition"
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellingPriceGroups;
