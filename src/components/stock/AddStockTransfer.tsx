import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calendar, Search, Trash2, Info, ChevronDown, Save, X, ArrowRightLeft } from 'lucide-react';
import { Product, useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import {
  fetchLocationInventoryFromDB,
  syncChangedLocationInventoryStrict,
} from '@/utils/stockLocationInventory';
import {
  StockTransferItem,
  StockTransferRecord,
  StockTransferStatus,
  appendStockLedgerEntriesStrict,
  bootstrapStockTransfersFromDB,
  makeNextStockTransferRef,
  readStockTransfers,
  simulateStockTransfer,
  syncChangedProductsStrict,
  writeStockTransfers,
} from '@/utils/stockTransfers';

interface AddStockTransferProps {
  onNavigate?: (page: string) => void;
  editTransferId?: string;
}

const STATUS_OPTIONS: StockTransferStatus[] = ['Pending', 'In Transit', 'Completed'];

const normalize = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const round3 = (value: number) => Math.round(value * 1000) / 1000;

const getNowLocalDateTime = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  const tzOffsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 16);
};

const toDateTimeInput = (value: string) => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return getNowLocalDateTime();
  const d = new Date(parsed);
  d.setSeconds(0, 0);
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
};

const toIso = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
};

const AddStockTransfer: React.FC<AddStockTransferProps> = ({ onNavigate, editTransferId }) => {
  const { locations, products, setProducts, generateId, settings, currentUser, formatCurrency, addActivityLog } = useGlobalContext();
  const { addNotification } = useNotifications();
  const defaultUnitLabel = String(settings.defaultUnit || 'Pc(s)').trim() || 'Pc(s)';

  const [date, setDate] = useState(getNowLocalDateTime());
  const [refNo, setRefNo] = useState('');
  const [status, setStatus] = useState<StockTransferStatus>('Pending');
  const [locationFrom, setLocationFrom] = useState('');
  const [locationTo, setLocationTo] = useState('');
  const [shippingCharges, setShippingCharges] = useState('0');
  const [notes, setNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [rows, setRows] = useState<StockTransferItem[]>([]);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const activeLocations = useMemo(
    () => locations.filter(location => location.isActive !== false),
    [locations]
  );

  const resolveLocationRecord = (value: string) => {
    const normalizedValue = normalize(value);
    if (!normalizedValue) return undefined;
    return locations.find(loc =>
      normalize(loc.id) === normalizedValue || normalize(loc.name) === normalizedValue
    );
  };

  const resolveLocationName = (value: string) => {
    const matched = resolveLocationRecord(value);
    return matched?.name || value;
  };

  const resolveLocationIdentity = (value: string) => {
    const matched = resolveLocationRecord(value);
    return matched ? `id:${normalize(matched.id)}` : `name:${normalize(value)}`;
  };
  const selectableSourceLocations = useMemo(() => {
    if (!locationFrom) return activeLocations;
    const current = resolveLocationRecord(locationFrom);
    if (
      current &&
      current.isActive === false &&
      !activeLocations.some(location => normalize(location.id) === normalize(current.id))
    ) {
      return [current, ...activeLocations];
    }
    return activeLocations;
  }, [activeLocations, locationFrom, locations]);
  const selectableDestinationLocations = useMemo(() => {
    if (!locationTo) return activeLocations;
    const current = resolveLocationRecord(locationTo);
    if (
      current &&
      current.isActive === false &&
      !activeLocations.some(location => normalize(location.id) === normalize(current.id))
    ) {
      return [current, ...activeLocations];
    }
    return activeLocations;
  }, [activeLocations, locationTo, locations]);

  useEffect(() => {
    let isMounted = true;
    const loadTransfer = async () => {
      await bootstrapStockTransfersFromDB().catch(() => {});
      if (!isMounted) return;

      const editId = String(editTransferId || '').trim();
      if (!editId) return;
      const existing = readStockTransfers().find(row => row.id === editId);
      if (!existing) return;
      setEditingTransferId(existing.id);
      setDate(toDateTimeInput(existing.date));
      setRefNo(existing.refNo || '');
      setStatus(existing.status);
      setLocationFrom(resolveLocationName(existing.locationFrom || ''));
      setLocationTo(resolveLocationName(existing.locationTo || ''));
      setShippingCharges(String(existing.shippingCharges ?? 0));
      setNotes(existing.notes || '');
      setRows(
        (existing.items || []).map(item => ({
          productId: String(item.productId || ''),
          productName: String(item.productName || ''),
          sku: String(item.sku || ''),
          qty: round3(Number(item.qty || 0)),
          unit: item.unit || defaultUnitLabel,
          unitCost: round3(Number(item.unitCost || 0)),
        })),
      );
    };
    loadTransfer();
    return () => {
      isMounted = false;
    };
  }, [defaultUnitLabel, locations, editTransferId]);

  const sourceProducts = useMemo(
    () => products.filter(product => !locationFrom || resolveLocationIdentity(product.businessLocation) === resolveLocationIdentity(locationFrom)),
    [products, locationFrom, locations],
  );

  const filteredProducts = useMemo(() => {
    const query = normalize(productSearch);
    if (!query) return sourceProducts.slice(0, 20);
    return sourceProducts
      .filter((product) =>
        normalize(product.name).includes(query) ||
        normalize(product.sku).includes(query),
      )
      .slice(0, 20);
  }, [sourceProducts, productSearch]);

  const totals = useMemo(() => {
    const subtotal = rows.reduce((sum, row) => sum + ((Number(row.qty) || 0) * (Number(row.unitCost) || 0)), 0);
    const shipping = Number(shippingCharges || 0);
    return {
      subtotal: round3(subtotal),
      grandTotal: round3(subtotal + (Number.isFinite(shipping) ? shipping : 0)),
    };
  }, [rows, shippingCharges]);

  const handleAddProduct = (product: Product) => {
    setRows((prev) => {
      const existing = prev.find(row => row.productId === product.id);
      if (existing) {
        return prev.map((row) => row.productId === product.id
          ? { ...row, qty: round3(Number(row.qty || 0) + 1) }
          : row);
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          qty: 1,
          unit: product.unit || defaultUnitLabel,
          unitCost: round3(Number(product.unitPurchasePrice || 0)),
        },
      ];
    });
    setProductSearch('');
  };

  const handleRemoveProduct = (productId: string) => {
    setRows((prev) => prev.filter(item => item.productId !== productId));
  };

  const handleUpdateQty = (productId: string, qty: string) => {
    const parsed = round3(Number(qty));
    setRows((prev) => prev.map((row) => {
      if (row.productId !== productId) return row;
      return {
        ...row,
        qty: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
      };
    }));
  };

  const handleUpdateUnitCost = (productId: string, unitCost: string) => {
    const parsed = round3(Number(unitCost));
    setRows((prev) => prev.map((row) => {
      if (row.productId !== productId) return row;
      return {
        ...row,
        unitCost: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
      };
    }));
  };

  const handleCancel = () => {
    onNavigate?.('list-stock-transfers');
  };

  const handleSave = async () => {
    const cleanRows = rows
      .map(row => ({
        ...row,
        qty: round3(Number(row.qty || 0)),
        unitCost: round3(Number(row.unitCost || 0)),
      }))
      .filter(row => row.productId && row.qty > 0);

    if (!locationFrom || !locationTo) {
      addNotification({ title: 'Validation Error', message: 'Select both source and destination locations.', type: 'error' });
      return;
    }
    const sourceLocationRecord = resolveLocationRecord(locationFrom);
    const destinationLocationRecord = resolveLocationRecord(locationTo);
    if (!sourceLocationRecord || sourceLocationRecord.isActive === false || !destinationLocationRecord || destinationLocationRecord.isActive === false) {
      addNotification({ title: 'Validation Error', message: 'Source and destination locations must both be active.', type: 'error' });
      return;
    }
    if (resolveLocationIdentity(locationFrom) === resolveLocationIdentity(locationTo)) {
      addNotification({ title: 'Validation Error', message: 'Source and destination locations must be different.', type: 'error' });
      return;
    }
    if (cleanRows.length === 0) {
      addNotification({ title: 'Validation Error', message: 'Add at least one product with quantity greater than zero.', type: 'error' });
      return;
    }

    await bootstrapStockTransfersFromDB().catch(() => {});
    const allTransfers = readStockTransfers();
    const editingRecord = editingTransferId
      ? allTransfers.find(row => row.id === editingTransferId)
      : undefined;
    const resolvedRef = String(refNo || '').trim()
      || makeNextStockTransferRef(settings.stockTransferPrefix || 'ST', allTransfers);
    const duplicateRef = allTransfers.find(row =>
      row.id !== editingTransferId &&
      normalize(row.refNo) === normalize(resolvedRef),
    );
    if (duplicateRef) {
      addNotification({ title: 'Validation Error', message: `Reference "${resolvedRef}" already exists.`, type: 'error' });
      return;
    }

    const shipping = round3(Number(shippingCharges || 0));
    if (!Number.isFinite(shipping) || shipping < 0) {
      addNotification({ title: 'Validation Error', message: 'Shipping charges must be a valid non-negative number.', type: 'error' });
      return;
    }

    const nowIso = new Date().toISOString();
    const resolvedLocationFrom = resolveLocationName(locationFrom);
    const resolvedLocationTo = resolveLocationName(locationTo);
    const nextRecord: StockTransferRecord = {
      id: editingRecord?.id || generateId('ST'),
      date: toIso(date),
      refNo: resolvedRef,
      locationFrom: resolvedLocationFrom,
      locationTo: resolvedLocationTo,
      status,
      shippingCharges: shipping,
      totalAmount: totals.grandTotal,
      notes: notes.trim(),
      items: cleanRows,
      addedBy: currentUser?.name || editingRecord?.addedBy || 'System',
      createdAt: editingRecord?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    try {
      let workingProducts = products.map(product => ({ ...product }));
      const originalInventory = await fetchLocationInventoryFromDB();
      let workingInventory = originalInventory.map(row => ({ ...row }));
      const ledgerEntries = [];
      const actorName = currentUser?.name || 'System';

      if (editingRecord?.status === 'Completed') {
        const rollbackSource = resolveLocationRecord(editingRecord.locationFrom) || sourceLocationRecord;
        const rollbackDestination = resolveLocationRecord(editingRecord.locationTo) || destinationLocationRecord;
        const rollback = simulateStockTransfer({
          transfer: editingRecord,
          direction: -1,
          products: workingProducts,
          inventoryRows: workingInventory,
          locationFromId: rollbackSource.id,
          locationToId: rollbackDestination.id,
          generateId,
          actorName,
          notePrefix: 'Edit rollback',
        });
        workingProducts = rollback.productsAfter;
        workingInventory = rollback.inventoryAfter;
        ledgerEntries.push(...rollback.ledgerEntries);
      }

      if (nextRecord.status === 'Completed') {
        const applied = simulateStockTransfer({
          transfer: nextRecord,
          direction: 1,
          products: workingProducts,
          inventoryRows: workingInventory,
          locationFromId: sourceLocationRecord.id,
          locationToId: destinationLocationRecord.id,
          generateId,
          actorName,
        });
        workingProducts = applied.productsAfter;
        workingInventory = applied.inventoryAfter;
        ledgerEntries.push(...applied.ledgerEntries);
      }

      const ledgerSaved = await appendStockLedgerEntriesStrict(ledgerEntries);
      if (!ledgerSaved.ok) {
        const detail = ledgerSaved.error || `HTTP ${ledgerSaved.status || 0}`;
        throw new Error(`Unable to save stock ledger entries in Postgres. ${detail}`);
      }

      const productsSaved = await syncChangedProductsStrict(workingProducts, products);
      if (!productsSaved.ok) {
        const detail = productsSaved.error || `HTTP ${productsSaved.status || 0}`;
        throw new Error(`Unable to save product stock changes in Postgres. ${detail}`);
      }

      const inventorySaved = await syncChangedLocationInventoryStrict(workingInventory, originalInventory);
      if (!inventorySaved.ok) {
        const detail = inventorySaved.error || `HTTP ${inventorySaved.status || 0}`;
        throw new Error(`Unable to save location stock changes in Postgres. ${detail}`);
      }

      const mergedTransfers = editingRecord
        ? allTransfers.map(row => (row.id === editingRecord.id ? nextRecord : row))
        : [nextRecord, ...allTransfers];
      const transferSaved = await writeStockTransfers(
        mergedTransfers.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
        nextRecord.id,
      );
      if (!transferSaved) {
        throw new Error('Unable to save stock transfer in Postgres.');
      }
      setProducts(workingProducts);

      addNotification({
        title: editingRecord ? 'Transfer Updated' : 'Transfer Saved',
        message: `${nextRecord.refNo} has been ${editingRecord ? 'updated' : 'created'} successfully.`,
        type: 'success',
      });
      await addActivityLog({
        action: editingRecord ? 'Updated' : 'Created',
        module: 'Stock Transfers',
        description: `${nextRecord.refNo} ${editingRecord ? 'updated' : 'created'}`,
      });
      onNavigate?.('list-stock-transfers');
    } catch (error) {
      addNotification({
        title: 'Unable to Save Transfer',
        message: error instanceof Error ? error.message : 'Unexpected error while applying stock transfer.',
        type: 'error',
      });
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCancel}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <ArrowRightLeft size={22} className="text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {editingTransferId ? 'Edit Stock Transfer' : 'Add Stock Transfer'}
          </h2>
          <p className="text-slate-500 mt-0.5 text-sm">Move stock between business locations</p>
        </div>
      </div>

      {/* Transfer Info Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Info size={18} className="text-blue-500" /> Transfer Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Date *</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="datetime-local"
                className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Reference No</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              placeholder={`Auto if blank (prefix: ${settings.stockTransferPrefix || 'ST'})`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">Status * <Info size={12} className="text-blue-500" /></label>
            <div className="relative">
              <select
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                value={status}
                onChange={(e) => setStatus(e.target.value as StockTransferStatus)}
              >
                {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Location (From) *</label>
            <div className="relative">
              <select
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                value={locationFrom}
                onChange={(e) => setLocationFrom(e.target.value)}
              >
                <option value="">Please Select</option>
                {selectableSourceLocations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Location (To) *</label>
            <div className="relative">
              <select
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                value={locationTo}
                onChange={(e) => setLocationTo(e.target.value)}
              >
                <option value="">Please Select</option>
                {selectableDestinationLocations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* Products Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Search size={18} className="text-emerald-500" /> Transfer Items
        </h3>

        <div className="relative w-full mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
            placeholder={locationFrom ? 'Search products by name / SKU' : 'Select "Location (From)" first'}
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            disabled={!locationFrom}
          />
          {locationFrom && productSearch.trim() && filteredProducts.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleAddProduct(product)}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors"
                >
                  <div className="text-sm font-bold text-slate-800">{product.name}</div>
                  <div className="text-[11px] text-slate-500">
                    SKU: {product.sku} | Stock: {Number(product.stock || 0).toFixed(3)} {product.unit || defaultUnitLabel}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-right">Unit Cost</th>
                <th className="px-4 py-3 text-center">Quantity</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-center w-16"><Trash2 size={14} /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.productId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{row.productName}</div>
                      <div className="text-[11px] text-slate-500">SKU: {row.sku} {row.unit ? `| ${row.unit}` : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        className="w-28 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-right focus:outline-none focus:border-blue-500 focus:bg-white text-sm font-medium"
                        value={row.unitCost || 0}
                        onChange={(e) => handleUpdateUnitCost(row.productId, e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        className="w-24 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-center focus:outline-none focus:border-blue-500 focus:bg-white text-sm font-medium"
                        value={row.qty || 0}
                        onChange={(e) => handleUpdateQty(row.productId, e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      {formatCurrency((Number(row.unitCost) || 0) * (Number(row.qty) || 0))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleRemoveProduct(row.productId)} className="text-rose-500 hover:text-rose-700 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                    No products selected.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Shipping Charges</label>
            <input
              type="number"
              step="0.001"
              min="0"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
              value={shippingCharges}
              onChange={(e) => setShippingCharges(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Additional Notes</label>
            <textarea
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 resize-none"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Totals & Actions Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>

        <div className="flex items-center justify-between">
          <div className="text-sm space-y-1">
            <div><span className="text-slate-500">Subtotal:</span> <span className="font-bold text-slate-800">{formatCurrency(totals.subtotal)}</span></div>
            <div><span className="text-slate-500">Grand Total:</span> <span className="font-black text-blue-700 text-base">{formatCurrency(totals.grandTotal)}</span></div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition active:scale-95"
            >
              <X size={14} /> Cancel
            </button>
            <button
              onClick={handleSave}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2 active:scale-95"
            >
              <Save size={14} /> Save Transfer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddStockTransfer;
