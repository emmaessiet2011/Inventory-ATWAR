import React, { useEffect, useMemo, useState } from 'react';
import { X, Info } from 'lucide-react';
import { Discount, useGlobalContext } from '../src/context/GlobalContext';

export interface DiscountFormData {
  id?: string;
  name: string;
  products: string;
  brand: string;
  category: string;
  location: string;
  priority: string;
  discountType: 'Fixed' | 'Percentage' | '';
  discountAmount: string;
  startsAt: string;
  endsAt: string;
  sellingPriceGroup: string;
  isActive: boolean;
  applyInCustomerGroups: boolean;
  selectedGroups: string[];
}

interface AddDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: DiscountFormData) => void;
  initialData?: Partial<Discount> | null;
}

const buildInitialFormData = (initialData?: Partial<Discount> | null): DiscountFormData => {
  const discountTypeRaw = String(initialData?.discountType || '').trim().toLowerCase();
  let discountType: DiscountFormData['discountType'] =
    discountTypeRaw === 'fixed'
      ? 'Fixed'
      : discountTypeRaw === 'percentage'
        ? 'Percentage'
        : '';
  const rawAmount = initialData?.discountAmount;
  const numericAmount = typeof rawAmount === 'number'
    ? rawAmount
    : Number(String(rawAmount || '').replace(/[^\d.-]/g, ''));
  if (!discountType && String(rawAmount || '').includes('%')) {
    discountType = 'Percentage';
  }

  return {
    id: initialData?.id ? String(initialData.id) : undefined,
    name: String(initialData?.name || ''),
    products: String(initialData?.products || ''),
    brand: String(initialData?.brand || ''),
    category: String(initialData?.category || ''),
    location: String(initialData?.location || ''),
    priority: String(initialData?.priority ?? ''),
    discountType,
    discountAmount: Number.isFinite(numericAmount) && numericAmount > 0 ? String(numericAmount) : '',
    startsAt: String(initialData?.startsAt || ''),
    endsAt: String(initialData?.endsAt || ''),
    sellingPriceGroup: String(initialData?.sellingPriceGroup || ''),
    isActive: initialData?.isActive !== false,
    applyInCustomerGroups: !!initialData?.applyInCustomerGroups,
    selectedGroups: Array.isArray(initialData?.selectedGroups)
      ? initialData!.selectedGroups!.map(group => String(group)).filter(Boolean)
      : [],
  };
};

const AddDiscountModal: React.FC<AddDiscountModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const { locations, products, customerGroups, sellingPriceGroups } = useGlobalContext();

  const brands = useMemo(() => {
    const set = new Set<string>();
    products.forEach(product => {
      if (product.brand) set.add(product.brand);
    });
    return Array.from(set).sort();
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(product => {
      if (product.category) set.add(product.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const activeSellingPriceGroups = useMemo(
    () => sellingPriceGroups.filter(group => group.status === 'Active'),
    [sellingPriceGroups]
  );

  const [formData, setFormData] = useState<DiscountFormData>(() => buildInitialFormData(initialData));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setFormData(buildInitialFormData(initialData));
    setError('');
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = <K extends keyof DiscountFormData>(field: K, value: DiscountFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const toggleGroup = (groupName: string) => {
    setFormData(prev => ({
      ...prev,
      selectedGroups: prev.selectedGroups.includes(groupName)
        ? prev.selectedGroups.filter(group => group !== groupName)
        : [...prev.selectedGroups, groupName],
    }));
    if (error) setError('');
  };

  const validateAndBuildPayload = (): DiscountFormData | null => {
    const name = formData.name.trim();
    if (!name) {
      setError('Discount name is required.');
      return null;
    }

    if (!formData.discountType) {
      setError('Discount type is required.');
      return null;
    }

    const amount = Number(formData.discountAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Discount amount must be greater than zero.');
      return null;
    }
    if (formData.discountType === 'Percentage' && amount > 100) {
      setError('Percentage discount cannot exceed 100.');
      return null;
    }

    if (formData.applyInCustomerGroups && formData.selectedGroups.length === 0) {
      setError('Select at least one customer group when group targeting is enabled.');
      return null;
    }

    if (formData.startsAt && formData.endsAt) {
      const start = new Date(formData.startsAt);
      const end = new Date(formData.endsAt);
      if (start > end) {
        setError('End date must be after start date.');
        return null;
      }
    }

    const roundedAmount = Number(amount.toFixed(3));
    const normalizedPriority = Number(formData.priority);
    const priority = Number.isFinite(normalizedPriority) && normalizedPriority >= 0
      ? String(normalizedPriority)
      : '0';

    return {
      ...formData,
      name,
      products: formData.products.trim() || 'All',
      brand: formData.brand || 'All',
      category: formData.category || 'All',
      location: formData.location || 'All locations',
      priority,
      discountAmount: String(roundedAmount),
      sellingPriceGroup: formData.sellingPriceGroup || 'All',
      selectedGroups: formData.applyInCustomerGroups ? formData.selectedGroups : [],
    };
  };

  const handleSave = () => {
    const payload = validateAndBuildPayload();
    if (!payload) return;
    onSave?.(payload);
    onClose();
  };

  const saveDisabled =
    !formData.name.trim() ||
    !formData.discountType ||
    !formData.discountAmount ||
    (formData.applyInCustomerGroups && formData.selectedGroups.length === 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl border border-slate-200 relative mt-10 mb-10 overflow-hidden animate-in slide-in-from-top-4 duration-300">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Info size={20} className="text-amber-500" />
            {initialData?.id ? 'Edit Discount' : 'Add Discount'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div className="group">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Name:*</label>
            <input
              type="text"
              placeholder="Name"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />
          </div>

          <div className="group">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Products:</label>
            <input
              type="text"
              placeholder="All or comma-separated product names"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
              value={formData.products}
              onChange={(e) => handleChange('products', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="group">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Brand:</label>
              <select
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                value={formData.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
              >
                <option value="">All Brands</option>
                {brands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
              </select>
            </div>
            <div className="group">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Category:</label>
              <select
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="group">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Location:</label>
              <select
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
              >
                <option value="">All Locations</option>
                {locations.map(location => <option key={location.id} value={location.name}>{location.name}</option>)}
              </select>
            </div>
            <div className="group">
              <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-1">
                Priority: <Info size={14} className="text-blue-500" />
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                value={formData.priority}
                onChange={(e) => handleChange('priority', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="group">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Discount Type:*</label>
              <select
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                value={formData.discountType}
                onChange={(e) => handleChange('discountType', e.target.value as DiscountFormData['discountType'])}
              >
                <option value="">Please Select</option>
                <option value="Fixed">Fixed</option>
                <option value="Percentage">Percentage</option>
              </select>
            </div>
            <div className="group">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Discount Amount:* {formData.discountType === 'Percentage' ? '(%)' : formData.discountType === 'Fixed' ? '(OMR)' : ''}
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                placeholder="0.000"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                value={formData.discountAmount}
                onChange={(e) => handleChange('discountAmount', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="group">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Starts At:</label>
              <input
                type="datetime-local"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                value={formData.startsAt}
                onChange={(e) => handleChange('startsAt', e.target.value)}
              />
            </div>
            <div className="group">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Ends At:</label>
              <input
                type="datetime-local"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                value={formData.endsAt}
                onChange={(e) => handleChange('endsAt', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div className="group">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Selling Price Group:</label>
              <select
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                value={formData.sellingPriceGroup}
                onChange={(e) => handleChange('sellingPriceGroup', e.target.value)}
              >
                <option value="">All</option>
                {activeSellingPriceGroups.map(group => (
                  <option key={group.id} value={group.name}>{group.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  checked={formData.isActive}
                  onChange={(e) => handleChange('isActive', e.target.checked)}
                />
                <span className="text-sm font-bold text-slate-800">Is active</span>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                checked={formData.applyInCustomerGroups}
                onChange={(e) => handleChange('applyInCustomerGroups', e.target.checked)}
              />
              <span className="text-sm font-bold text-slate-800">Apply in customer groups</span>
            </label>
            {formData.applyInCustomerGroups && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-600">
                {customerGroups.length === 0 ? (
                  <p className="text-slate-400 italic">No customer groups found. Add groups in the Customer Groups section.</p>
                ) : (
                  <div className="space-y-2">
                    {customerGroups.map(group => (
                      <label key={group.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.selectedGroups.includes(group.name)}
                          onChange={() => toggleGroup(group.name)}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded"
                        />
                        <span>{group.name}</span>
                        {group.discountPercent > 0 && (
                          <span className="text-xs text-slate-400">({group.discountPercent}% default)</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saveDisabled}
            className="px-6 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {initialData?.id ? 'Update' : 'Save Discount'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddDiscountModal;
