import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  FileText,
  FileSpreadsheet,
  Printer,
  Columns,
  ArrowUpDown,
  Edit,
  Trash2,
  MoreVertical,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import AddDiscountModal, { DiscountFormData } from './AddDiscountModal';
import MultiSelect from '@/components/shared/MultiSelect';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Discount, useGlobalContext } from '@/context/GlobalContext';
import { printActiveReportTable } from '@/utils/printUtils';
import { formatDiscountAmount, sortDiscountsByPriority } from '@/utils/discountRules';

interface DiscountsProps {
  onNavigate: (page: string) => void;
}

const Discounts: React.FC<DiscountsProps> = ({ onNavigate: _onNavigate }) => {
  const {
    discounts: globalDiscounts,
    addDiscount,
    updateDiscount,
    deleteDiscount,
    generateId,
    locations,
    products,
    currentUser,
    roles,
    settings,
  } = useGlobalContext();

  const currentRoleRecord = roles.find(role => role.name === currentUser?.role);
  const rolePermissions = currentRoleRecord?.permissions || [];
  const roleHasExplicitPermissions = rolePermissions.length > 0;
  const hasRolePermission = (moduleName: string, permission: string) => {
    if (!currentUser) return false;
    if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
    if (!roleHasExplicitPermissions) return true;
    return rolePermissions.includes(permission) || rolePermissions.includes(`${moduleName}::${permission}`);
  };
  const canManageDiscounts = hasRolePermission('Sell', 'Add/Edit/Delete Discount');

  const discounts = useMemo(
    () => (globalDiscounts || [])
      .map(discount => ({
        ...discount,
        id: String(discount.id || '').trim(),
        name: String(discount.name || '').trim(),
        isActive: discount.isActive !== false,
      }))
      .filter(discount => discount.id && discount.name),
    [globalDiscounts]
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    brand: [] as string[],
    category: [] as string[],
    location: [] as string[],
  });
  const [entriesPerPage, setEntriesPerPage] = useState<number>(Number(settings.defaultTableEntries || 25));
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAdvancedColumns, setShowAdvancedColumns] = useState(true);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    tone?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  const parseDateValue = (value?: string): Date | null => {
    if (!value) return null;
    const normalized = value.includes(' ') && !value.includes('T') ? value.replace(' ', 'T') : value;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const formatDateTimeDisplay = (value?: string): string => {
    if (!value) return '--';
    const parsed = parseDateValue(value);
    if (!parsed) return value;
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    const hours24 = parsed.getHours();
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    const meridiem = hours24 >= 12 ? 'PM' : 'AM';
    const dateOnly = settings.dateFormat === 'mm/dd/yyyy' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
    return settings.timeFormat === '24'
      ? `${dateOnly} ${String(hours24).padStart(2, '0')}:${minutes}`
      : `${dateOnly} ${String(hours24 % 12 || 12).padStart(2, '0')}:${minutes} ${meridiem}`;
  };

  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach(product => { if (product.brand) set.add(product.brand); });
    discounts.forEach(discount => { if (discount.brand) set.add(discount.brand); });
    return Array.from(set).sort();
  }, [products, discounts]);
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach(product => { if (product.category) set.add(product.category); });
    discounts.forEach(discount => { if (discount.category) set.add(discount.category); });
    return Array.from(set).sort();
  }, [products, discounts]);
  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    locations.forEach(location => { if (location.name) set.add(location.name); });
    discounts.forEach(discount => { if (discount.location) set.add(discount.location); });
    return Array.from(set).sort();
  }, [locations, discounts]);

  const filteredDiscounts = useMemo(
    () => discounts.filter(discount => {
      const search = searchTerm.trim().toLowerCase();
      const textMatch = !search || [
        discount.name,
        discount.brand,
        discount.category,
        discount.products,
        discount.location,
      ].some(value => String(value || '').toLowerCase().includes(search));

      const brand = String(discount.brand || 'All');
      const category = String(discount.category || 'All');
      const location = String(discount.location || 'All locations');
      const filterMatch =
        (filters.brand.length === 0 || filters.brand.includes(brand)) &&
        (filters.category.length === 0 || filters.category.includes(category)) &&
        (filters.location.length === 0 || filters.location.includes(location));
      return textMatch && filterMatch;
    }).sort(sortDiscountsByPriority),
    [discounts, searchTerm, filters]
  );

  const totalPages = Math.max(1, Math.ceil(filteredDiscounts.length / entriesPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * entriesPerPage;
  const pageEnd = pageStart + entriesPerPage;
  const pagedDiscounts = filteredDiscounts.slice(pageStart, pageEnd);
  const allPageSelected = pagedDiscounts.length > 0 && pagedDiscounts.every(discount => selectedIds.has(discount.id));

  useEffect(() => {
    setCurrentPage(1);
    setActiveActionId(null);
  }, [searchTerm, filters, entriesPerPage]);

  useEffect(() => {
    const parsed = Number(settings.defaultTableEntries || 25);
    if (Number.isFinite(parsed) && parsed > 0) setEntriesPerPage(parsed);
  }, [settings.defaultTableEntries]);

  const setRowSelection = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };
  const setPageSelection = (checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      pagedDiscounts.forEach(discount => checked ? next.add(discount.id) : next.delete(discount.id));
      return next;
    });
  };

  const handleSaveDiscount = (formData: DiscountFormData) => {
    const payload: Discount = {
      id: editingDiscount?.id || generateId('DISC'),
      name: formData.name,
      products: formData.products,
      brand: formData.brand,
      category: formData.category,
      location: formData.location,
      priority: formData.priority,
      discountType: formData.discountType,
      discountAmount: formData.discountAmount,
      startsAt: formData.startsAt,
      endsAt: formData.endsAt,
      sellingPriceGroup: formData.sellingPriceGroup,
      isActive: formData.isActive,
      applyInCustomerGroups: formData.applyInCustomerGroups,
      selectedGroups: formData.selectedGroups,
    };
    if (editingDiscount) updateDiscount(payload); else addDiscount(payload);
    setEditingDiscount(null);
    setIsDiscountModalOpen(false);
  };

  const handleToggleStatus = (discount: Discount) => {
    const action = discount.isActive ? 'deactivate' : 'activate';
    setConfirmDialog({
      title: `${discount.isActive ? 'Deactivate' : 'Activate'} Discount`,
      message: `Are you sure you want to ${action} discount "${discount.name}"?`,
      confirmLabel: discount.isActive ? 'Deactivate' : 'Activate',
      tone: discount.isActive ? 'warning' : 'primary',
      onConfirm: () => {
        updateDiscount({ ...discount, isActive: !discount.isActive });
        setActiveActionId(null);
      },
    });
  };
  const handleDelete = (discount: Discount) => {
    setConfirmDialog({
      title: 'Delete Discount',
      message: `Are you sure you want to delete "${discount.name}"?`,
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: () => {
        deleteDiscount(discount.id);
        setActiveActionId(null);
      },
    });
  };
  const handleBulkDeactivate = () => {
    const targets = discounts.filter(discount => selectedIds.has(discount.id) && discount.isActive);
    if (targets.length === 0) return;
    setConfirmDialog({
      title: 'Bulk Deactivate Discounts',
      message: `Deactivate ${targets.length} selected discount(s)?`,
      confirmLabel: 'Deactivate',
      tone: 'warning',
      onConfirm: () => {
        targets.forEach(discount => updateDiscount({ ...discount, isActive: false }));
        setSelectedIds(new Set());
      },
    });
  };

  const downloadBlob = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const handleExport = (excel = false) => {
    const separator = excel ? '\t' : ',';
    const headers = ['Name', 'Starts At', 'Ends At', 'Discount Amount', 'Priority', 'Brand', 'Category', 'Products', 'Location', 'Status'];
    const rows = filteredDiscounts.map(discount => [
      discount.name,
      formatDateTimeDisplay(discount.startsAt),
      formatDateTimeDisplay(discount.endsAt),
      formatDiscountAmount(discount),
      Number(discount.priority || 0),
      discount.brand || 'All',
      discount.category || 'All',
      discount.products || 'All',
      discount.location || 'All locations',
      discount.isActive ? 'Active' : 'Inactive',
    ]);
    const content = [headers.join(separator), ...rows.map(row => row.join(separator))].join('\n');
    const date = new Date().toISOString().slice(0, 10);
    if (excel) downloadBlob(`discounts-${date}.xls`, content, 'application/vnd.ms-excel;charset=utf-8;');
    else downloadBlob(`discounts-${date}.csv`, content, 'text/csv;charset=utf-8;');
  };

  if (!canManageDiscounts) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400">
        <h2 className="text-2xl font-bold text-slate-300 mb-2">Access Denied</h2>
        <p>You do not have permission to access Discounts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <h2 className="text-2xl font-bold text-slate-900">Discounts</h2>
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Show</span>
            <select value={entriesPerPage} onChange={e => setEntriesPerPage(Number(e.target.value) || 25)} className="border border-slate-300 rounded px-2 py-1 text-sm">
              <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
            </select>
            <span className="text-sm text-slate-600">entries</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => handleExport(false)} className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><FileText size={12} /> Export CSV</button>
            <button onClick={() => handleExport(true)} className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><FileSpreadsheet size={12} /> Export Excel</button>
            <button onClick={() => printActiveReportTable()} className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><Printer size={12} /> Print</button>
            <button onClick={() => setShowAdvancedColumns(prev => !prev)} className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><Columns size={12} /> {showAdvancedColumns ? 'Hide Columns' : 'Show Columns'}</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditingDiscount(null); setIsDiscountModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-1"><Plus size={16} /> Add</button>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input type="text" placeholder="Search..." className="pl-8 pr-3 py-2 rounded border border-slate-300 text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
          <MultiSelect label="Brand" options={brandOptions} selected={filters.brand} onChange={val => setFilters({ ...filters, brand: val })} />
          <MultiSelect label="Category" options={categoryOptions} selected={filters.category} onChange={val => setFilters({ ...filters, category: val })} />
          <MultiSelect label="Location" options={locationOptions} selected={filters.location} onChange={val => setFilters({ ...filters, location: val })} />
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-white text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-8"><input type="checkbox" className="rounded border-slate-300" checked={allPageSelected} onChange={e => setPageSelection(e.target.checked)} /></th>
                <th className="px-4 py-3 whitespace-nowrap">Name <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Starts At <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Ends At <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Discount Amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Priority <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                {showAdvancedColumns && <th className="px-4 py-3 whitespace-nowrap">Brand</th>}
                {showAdvancedColumns && <th className="px-4 py-3 whitespace-nowrap">Category</th>}
                {showAdvancedColumns && <th className="px-4 py-3 whitespace-nowrap">Products</th>}
                {showAdvancedColumns && <th className="px-4 py-3 whitespace-nowrap">Location</th>}
                <th className="px-4 py-3 w-24 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selectedIds.size > 0 && <tr className="bg-amber-50"><td colSpan={showAdvancedColumns ? 11 : 7} className="px-4 py-2"><button onClick={handleBulkDeactivate} className="bg-amber-400 text-amber-900 text-[10px] font-bold px-3 py-1 rounded hover:bg-amber-500">Deactivate Selected ({selectedIds.size})</button></td></tr>}
              {pagedDiscounts.length > 0 ? pagedDiscounts.map(discount => (
                <tr key={discount.id} className={`hover:bg-slate-50 transition-colors ${discount.isActive ? '' : 'opacity-60 bg-slate-50'}`}>
                  <td className="px-4 py-3"><input type="checkbox" className="rounded border-slate-300" checked={selectedIds.has(discount.id)} onChange={e => setRowSelection(discount.id, e.target.checked)} /></td>
                  <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">{discount.name}{!discount.isActive && <span className="ml-2 text-[10px] text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">Inactive</span>}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTimeDisplay(discount.startsAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTimeDisplay(discount.endsAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDiscountAmount(discount)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{Number(discount.priority || 0)}</td>
                  {showAdvancedColumns && <td className="px-4 py-3 whitespace-nowrap">{discount.brand || 'All'}</td>}
                  {showAdvancedColumns && <td className="px-4 py-3 whitespace-nowrap">{discount.category || 'All'}</td>}
                  {showAdvancedColumns && <td className="px-4 py-3 whitespace-nowrap">{discount.products || 'All'}</td>}
                  {showAdvancedColumns && <td className="px-4 py-3 whitespace-nowrap">{discount.location || 'All locations'}</td>}
                  <td className="px-4 py-3 text-center relative">
                    <button onClick={() => setActiveActionId(prev => prev === discount.id ? null : discount.id)} className={`p-2 rounded-lg ${activeActionId === discount.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}><MoreVertical size={16} /></button>
                    {activeActionId === discount.id && (
                      <div className="absolute right-2 top-10 z-20 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 w-44">
                        <button onClick={() => { setEditingDiscount(discount); setIsDiscountModalOpen(true); setActiveActionId(null); }} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Edit size={14} className="text-amber-500" /> Edit</button>
                        <button onClick={() => handleDelete(discount)} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Trash2 size={14} className="text-rose-500" /> Delete</button>
                        <div className="h-px bg-slate-100 my-1 mx-2"></div>
                        <button onClick={() => handleToggleStatus(discount)} className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center gap-2 ${discount.isActive ? 'text-red-500 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>{discount.isActive ? <Ban size={14} /> : <CheckCircle2 size={14} />}{discount.isActive ? 'Deactivate' : 'Activate'}</button>
                      </div>
                    )}
                  </td>
                </tr>
              )) : <tr><td colSpan={showAdvancedColumns ? 11 : 7} className="px-6 py-12 text-center text-slate-500 bg-slate-50/50">No discounts found</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div>{filteredDiscounts.length === 0 ? 'Showing 0 to 0 of 0 entries' : `Showing ${pageStart + 1} to ${Math.min(pageEnd, filteredDiscounts.length)} of ${filteredDiscounts.length} entries`}</div>
          <div className="flex gap-1">
            <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}>Previous</button>
            <button className="px-3 py-1 bg-blue-600 text-white rounded shadow-sm">{safeCurrentPage}</button>
            <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}>Next</button>
          </div>
        </div>
      </div>

      <AddDiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => { setIsDiscountModalOpen(false); setEditingDiscount(null); }}
        onSave={handleSaveDiscount}
        initialData={editingDiscount}
      />
      <ConfirmDialog
        isOpen={!!confirmDialog}
        title={confirmDialog?.title || 'Confirm Action'}
        message={confirmDialog?.message || ''}
        confirmLabel={confirmDialog?.confirmLabel || 'Confirm'}
        tone={confirmDialog?.tone || 'danger'}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => {
          const action = confirmDialog?.onConfirm;
          setConfirmDialog(null);
          action?.();
        }}
      />
    </div>
  );
};

export default Discounts;

