import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  category?: string;
  [key: string]: any;
}

interface MultiProductPickerProps {
  products: Product[];
  getPrice: (product: Product) => number;
  formatCurrency: (amount: number) => string;
  onConfirm: (selected: Product[]) => void;
  onClose: () => void;
}

export default function MultiProductPicker({
  products,
  getPrice,
  formatCurrency,
  onConfirm,
  onClose,
}: MultiProductPickerProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? products.filter(
          p =>
            p.name.toLowerCase().includes(q) ||
            String(p.sku || '').toLowerCase().includes(q) ||
            String(p.category || '').toLowerCase().includes(q),
        )
      : products;
    return list.slice(0, 100);
  }, [search, products]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every(p => selected.has(p.id));

  const toggleProduct = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach(p => next.delete(p.id));
      } else {
        filtered.forEach(p => next.add(p.id));
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedProducts = products.filter(p => selected.has(p.id));
    onConfirm(selectedProducts);
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
        style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Select Multiple Products</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tick the products you need, then click Add
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-slate-100">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by product name, SKU or category..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-sm outline-none transition-all"
            />
          </div>
        </div>

        {/* Select All row */}
        {filtered.length > 1 && (
          <div
            className="flex items-center gap-3 px-6 py-2.5 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={toggleAll}
          >
            <div
              className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                allFilteredSelected
                  ? 'bg-blue-600 border-blue-600'
                  : 'border-slate-300 bg-white'
              }`}
            >
              {allFilteredSelected && <Check size={12} className="text-white" />}
            </div>
            <span className="text-xs font-semibold text-slate-600">
              {allFilteredSelected ? 'Deselect all' : `Select all ${filtered.length} shown`}
            </span>
          </div>
        )}

        {/* Product list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              No products match your search
            </div>
          ) : (
            filtered.map(p => {
              const isChecked = selected.has(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggleProduct(p.id)}
                  className={`flex items-center gap-3 px-6 py-3 cursor-pointer transition-colors ${
                    isChecked ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      isChecked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                    }`}
                  >
                    {isChecked && <Check size={12} className="text-white" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-800 truncate">
                      {p.name}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] mt-0.5">
                      <span className="text-slate-500">SKU: {p.sku || '—'}</span>
                      <span
                        className={`font-bold ${
                          p.stock <= 0 ? 'text-red-500' : 'text-emerald-600'
                        }`}
                      >
                        Stock: {p.stock}
                      </span>
                      {p.category && (
                        <span className="text-slate-400">{p.category}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-sm font-bold text-slate-700 flex-shrink-0">
                    {formatCurrency(getPrice(p))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-2xl">
          <span className="text-sm text-slate-600">
            {selected.size === 0
              ? 'No products selected'
              : `${selected.size} product${selected.size !== 1 ? 's' : ''} selected`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add {selected.size > 0 ? `${selected.size} Product${selected.size !== 1 ? 's' : ''}` : 'Products'}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body,
  );
}
