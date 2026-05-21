import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Database,
  PackagePlus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Product, useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import {
  fetchLocationInventoryFromDB,
  inventoryKey,
  ProductLocationInventory,
} from '@/utils/stockLocationInventory';
import {
  SeedLocationStockItem,
  applyReverseSeedLocationStockStrict,
  applySeedLocationStockStrict,
  simulateReverseSeedLocationStock,
  simulateSeedLocationStock,
} from '@/utils/stockSeeding';
import { bootstrapStockTransfersFromDB, readStockLedger } from '@/utils/stockTransfers';

interface SeedLocationStockProps {
  onNavigate?: (page: string) => void;
}

interface SeedRow extends SeedLocationStockItem {
  currentStock: number;
  unit: string;
}

interface SeedHistoryRow {
  ref: string;
  date: string;
  rowCount: number;
  totalChange: number;
  reversed: boolean;
}

const normalize = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const round3 = (value: number) => Math.round(value * 1000) / 1000;

const getNowLocalDateTime = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  const tzOffsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 16);
};

const toIso = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
};

const isWarehouseLocation = (location: { id?: string; name?: string; landmark?: string }) => {
  const id = normalize(location.id);
  const joined = normalize(`${location.id || ''} ${location.name || ''} ${location.landmark || ''}`);
  return (
    id === 'bl0001' ||
    joined.includes('atwar al mustaqbal') ||
    joined.includes('cr:1450968') ||
    joined.includes('cr 1450968') ||
    joined.includes('1450968')
  );
};

const SeedLocationStock: React.FC<SeedLocationStockProps> = ({ onNavigate }) => {
  const {
    locations,
    products,
    setProducts,
    generateId,
    currentUser,
    settings,
    formatCurrency,
    addActivityLog,
  } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [location, setLocation] = useState('');
  const [date, setDate] = useState(getNowLocalDateTime());
  const [refNo, setRefNo] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [rows, setRows] = useState<SeedRow[]>([]);
  const [locationInventory, setLocationInventory] = useState<ProductLocationInventory[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [ledgerVersion, setLedgerVersion] = useState(0);
  const [reverseSeedRef, setReverseSeedRef] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetchLocationInventoryFromDB(),
      bootstrapStockTransfersFromDB().catch(() => undefined),
    ])
      .then(([records]) => {
        if (isMounted) setLocationInventory(records);
        if (isMounted) setLedgerVersion((prev) => prev + 1);
      })
      .catch(() => {
        if (isMounted) setLocationInventory([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const activeLocations = useMemo(
    () => locations.filter((record) => record.isActive !== false),
    [locations],
  );

  const secondaryLocations = useMemo(() => {
    const filtered = activeLocations.filter((record) => !isWarehouseLocation(record));
    return filtered.length > 0 ? filtered : activeLocations.slice(1);
  }, [activeLocations]);

  const selectedLocation = useMemo(
    () => activeLocations.find((record) => normalize(record.name) === normalize(location)),
    [activeLocations, location],
  );

  const inventoryByProductLocation = useMemo(() => {
    const map = new Map<string, ProductLocationInventory[]>();
    locationInventory.forEach((record) => {
      const key = inventoryKey(record.productId, record.locationId);
      map.set(key, [...(map.get(key) || []), record]);
    });
    return map;
  }, [locationInventory]);

  const catalogProducts = useMemo(() => {
    const bySku = new Map<string, Product>();
    products.forEach((product) => {
      const skuKey = normalize(product.sku);
      if (!skuKey) return;
      const existing = bySku.get(skuKey);
      if (!existing) {
        bySku.set(skuKey, product);
        return;
      }
      const existingAtSelected = normalize(existing.businessLocation) === normalize(location);
      const productAtSelected = normalize(product.businessLocation) === normalize(location);
      if (existingAtSelected && !productAtSelected) {
        bySku.set(skuKey, product);
      }
    });
    return Array.from(bySku.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [products, location]);

  const filteredProducts = useMemo(() => {
    const query = normalize(productSearch);
    const selectedIds = new Set(rows.map((row) => row.productId));
    return catalogProducts
      .filter((product) => !selectedIds.has(product.id))
      .filter((product) => {
        if (!query) return true;
        return normalize(product.name).includes(query) || normalize(product.sku).includes(query);
      })
      .slice(0, 20);
  }, [catalogProducts, productSearch, rows]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const nextQty = round3(Number(row.quantity || 0));
        const delta = round3(nextQty - Number(row.currentStock || 0));
        acc.totalQuantity = round3(acc.totalQuantity + nextQty);
        acc.netChange = round3(acc.netChange + delta);
        acc.totalValue = round3(acc.totalValue + (nextQty * Number(row.unitCost || 0)));
        if (delta > 0) acc.increaseCount += 1;
        if (delta < 0) acc.decreaseCount += 1;
        if (delta === 0) acc.unchangedCount += 1;
        return acc;
      },
      { totalQuantity: 0, netChange: 0, totalValue: 0, increaseCount: 0, decreaseCount: 0, unchangedCount: 0 },
    );
  }, [rows]);

  const nextRefNo = () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `SEED-${today}-${String(Date.now()).slice(-5)}`;
  };

  const getCurrentStockFor = (product: Product) => {
    if (!selectedLocation?.id) return 0;
    const matches = inventoryByProductLocation.get(inventoryKey(product.id, selectedLocation.id)) || [];
    if (matches.length !== 1) return 0;
    return round3(Number(matches[0].stock || 0));
  };

  const handleAddProduct = (product: Product) => {
    const currentStock = getCurrentStockFor(product);
    setRows((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: currentStock,
        unitCost: round3(Number(product.unitPurchasePrice || 0)),
        currentStock,
        unit: product.unit || settings.defaultUnit || 'Pc(s)',
      },
    ]);
    setProductSearch('');
  };

  const handleQuantityChange = (productId: string, value: string) => {
    const parsed = round3(Number(value));
    setRows((prev) => prev.map((row) => (
      row.productId === productId
        ? { ...row, quantity: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 }
        : row
    )));
  };

  const handleUnitCostChange = (productId: string, value: string) => {
    const parsed = round3(Number(value));
    setRows((prev) => prev.map((row) => (
      row.productId === productId
        ? { ...row, unitCost: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 }
        : row
    )));
  };

  const seedHistory = useMemo<SeedHistoryRow[]>(() => {
    if (!location) return [];
    const groups = new Map<string, SeedHistoryRow>();
    const reversedRefs = new Set<string>();
    readStockLedger().forEach((entry) => {
      if (normalize(entry.location) !== normalize(location)) return;
      if (normalize(entry.type) === normalize('Opening Balance Reversal')) {
        const note = String(entry.note || '');
        const match = note.match(/Reverse seed\s+(.+)$/i);
        if (match?.[1]) reversedRefs.add(normalize(match[1]));
        return;
      }
      if (normalize(entry.type) !== normalize('Opening Balance')) return;
      const ref = String(entry.ref || '').trim();
      if (!ref) return;
      const current = groups.get(ref) || {
        ref,
        date: String(entry.date || ''),
        rowCount: 0,
        totalChange: 0,
        reversed: false,
      };
      current.rowCount += 1;
      current.totalChange = round3(current.totalChange + Number(entry.change || 0));
      if (!current.date || Date.parse(String(entry.date || '')) > Date.parse(current.date)) {
        current.date = String(entry.date || current.date);
      }
      groups.set(ref, current);
    });
    return Array.from(groups.values())
      .map((row) => ({ ...row, reversed: reversedRefs.has(normalize(row.ref)) }))
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }, [location, ledgerVersion]);

  const refreshSeedData = async () => {
    const [freshInventory] = await Promise.all([
      fetchLocationInventoryFromDB(),
      bootstrapStockTransfersFromDB(),
    ]);
    setLocationInventory(freshInventory);
    setLedgerVersion((prev) => prev + 1);
    return freshInventory;
  };

  const handleApplySeed = async () => {
    if (isSaving) return;
    if (!selectedLocation || selectedLocation.isActive === false) {
      addNotification({ title: 'Validation Error', message: 'Select an active secondary location.', type: 'error' });
      return;
    }
    if (isWarehouseLocation(selectedLocation)) {
      addNotification({ title: 'Validation Error', message: 'Opening seed is only for shop or secondary locations.', type: 'error' });
      return;
    }

    const cleanRows = rows
      .map((row) => ({
        ...row,
        quantity: round3(Number(row.quantity || 0)),
        unitCost: round3(Number(row.unitCost || 0)),
      }))
      .filter((row) => row.productId && row.sku && row.quantity >= 0);

    if (cleanRows.length === 0) {
      addNotification({ title: 'Validation Error', message: 'Add at least one product to seed.', type: 'error' });
      return;
    }

    const resolvedRef = String(refNo || '').trim() || nextRefNo();
    setIsSaving(true);
    try {
      await bootstrapStockTransfersFromDB();
      const duplicateRef = readStockLedger().some((entry) => (
        normalize(entry.ref) === normalize(resolvedRef) &&
        normalize(entry.location) === normalize(location) &&
        normalize(entry.type) === normalize('Opening Balance')
      ));
      if (duplicateRef) {
        throw new Error(`Reference "${resolvedRef}" has already been used for opening balance at this location.`);
      }

      const freshInventory = await fetchLocationInventoryFromDB();
      const result = simulateSeedLocationStock({
        location,
        locationId: selectedLocation.id,
        items: cleanRows,
        products,
        inventoryRows: freshInventory,
        generateId,
        actorName: currentUser?.name || 'System',
        ref: resolvedRef,
        date: toIso(date),
      });

      await applySeedLocationStockStrict(result, products, freshInventory);
      setProducts(result.productsAfter);
      setLocationInventory(result.inventoryAfter);
      setLedgerVersion((prev) => prev + 1);

      addNotification({
        title: 'Seed Stock Applied',
        message: `${resolvedRef}: ${result.createdCount} created, ${result.updatedCount} updated, ${result.unchangedCount} unchanged.`,
        type: 'success',
      });
      await addActivityLog({
        action: 'Created',
        module: 'Stock Seed',
        description: `${resolvedRef} applied for ${location}`,
      });
      onNavigate?.('report-stock');
    } catch (error) {
      addNotification({
        title: 'Unable to Apply Seed',
        message: error instanceof Error ? error.message : 'Unexpected error while seeding stock.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReverseSeed = async (seedRef: string) => {
    if (isSaving) return;
    if (!selectedLocation || selectedLocation.isActive === false) {
      addNotification({ title: 'Validation Error', message: 'Select an active secondary location.', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const freshInventory = await refreshSeedData();
      const result = simulateReverseSeedLocationStock({
        seedRef,
        location,
        locationId: selectedLocation.id,
        products,
        inventoryRows: freshInventory,
        existingLedgerEntries: readStockLedger(),
        generateId,
        actorName: currentUser?.name || 'System',
        date: new Date().toISOString(),
      });
      await applyReverseSeedLocationStockStrict(result, freshInventory);
      setLocationInventory(result.inventoryAfter);
      setLedgerVersion((prev) => prev + 1);
      addNotification({
        title: 'Seed Stock Reversed',
        message: `${seedRef}: ${result.reversedCount} row(s), ${result.totalReversedQty.toFixed(3)} quantity reversed.`,
        type: 'success',
      });
      await addActivityLog({
        action: 'Reversed',
        module: 'Stock Seed',
        description: `${seedRef} reversed for ${location}`,
      });
      setReverseSeedRef(null);
      onNavigate?.('report-stock');
    } catch (error) {
      addNotification({
        title: 'Unable to Reverse Seed',
        message: error instanceof Error ? error.message : 'Unexpected error while reversing seed stock.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate?.('list-stock-transfers')}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
          title="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="p-2.5 bg-emerald-600 rounded-2xl shadow-md">
          <PackagePlus size={22} className="text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Seed Location Stock</h2>
          <p className="text-slate-500 mt-0.5 text-sm">Set exact opening stock for secondary locations</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Secondary Location *</label>
            <div className="relative">
              <select
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value);
                  setRows([]);
                  setProductSearch('');
                }}
              >
                <option value="">Please Select</option>
                {secondaryLocations.map((record) => (
                  <option key={record.id} value={record.name}>{record.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Date *</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="datetime-local"
                className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium text-slate-700"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Reference No</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium text-slate-700"
              value={refNo}
              onChange={(event) => setRefNo(event.target.value)}
              placeholder="Auto if blank"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-rose-500" />
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw size={18} className="text-amber-500" /> Reverse Seed Stock
          </h3>
          <button
            type="button"
            onClick={() => { void refreshSeedData(); }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Reference</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Rows</th>
                <th className="px-4 py-3 text-right">Seed Change</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {location ? seedHistory.length > 0 ? seedHistory.map((seed) => (
                <tr key={seed.ref} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{seed.ref}</td>
                  <td className="px-4 py-3 text-slate-600">{seed.date ? new Date(seed.date).toLocaleString() : '--'}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">{seed.rowCount}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">{seed.totalChange.toFixed(3)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${seed.reversed ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                      {seed.reversed ? 'Reversed' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      disabled={seed.reversed || isSaving}
                      onClick={() => setReverseSeedRef(seed.ref)}
                      className="px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 text-xs font-bold hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reverse
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">No seed history found for this location.</td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">Select a secondary location to view seed history.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 relative overflow-visible">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500" />
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Database size={18} className="text-blue-500" /> Products
          </h3>
          <div className="text-xs font-bold text-slate-500">{rows.length} selected</div>
        </div>

        <div className="relative w-full mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            className="block w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
            placeholder={location ? 'Search products by name / SKU' : 'Select secondary location first'}
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
            disabled={!location}
          />
          {location && productSearch.trim() && filteredProducts.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {filteredProducts.map((product) => {
                const currentStock = getCurrentStockFor(product);
                const duplicateCount = selectedLocation?.id
                  ? inventoryByProductLocation.get(inventoryKey(product.id, selectedLocation.id))?.length || 0
                  : 0;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleAddProduct(product)}
                    disabled={duplicateCount > 1}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="text-sm font-bold text-slate-800">{product.name}</div>
                    <div className="text-[11px] text-slate-500">
                      SKU: {product.sku} | Current: {currentStock.toFixed(3)} {product.unit || settings.defaultUnit || 'Pc(s)'}
                      {duplicateCount > 1 ? ' | duplicate rows need merge' : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-right">Current</th>
                <th className="px-4 py-3 text-center">Seed Qty</th>
                <th className="px-4 py-3 text-right">Delta</th>
                <th className="px-4 py-3 text-right">Unit Cost</th>
                <th className="px-4 py-3 text-center w-16"><Trash2 size={14} /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length > 0 ? rows.map((row) => {
                const delta = round3(Number(row.quantity || 0) - Number(row.currentStock || 0));
                return (
                  <tr key={row.productId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{row.productName}</div>
                      <div className="text-[11px] text-slate-500">SKU: {row.sku} {row.unit ? `| ${row.unit}` : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">{Number(row.currentStock || 0).toFixed(3)}</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        className="w-28 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-center focus:outline-none focus:border-blue-500 focus:bg-white text-sm font-medium"
                        value={row.quantity}
                        onChange={(event) => handleQuantityChange(row.productId, event.target.value)}
                      />
                    </td>
                    <td className={`px-4 py-3 text-right font-black ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {delta > 0 ? '+' : ''}{delta.toFixed(3)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        className="w-28 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-right focus:outline-none focus:border-blue-500 focus:bg-white text-sm font-medium"
                        value={row.unitCost || 0}
                        onChange={(event) => handleUnitCostChange(row.productId, event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.filter((item) => item.productId !== row.productId))}
                        className="text-rose-500 hover:text-rose-700 transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                    No products selected.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-emerald-500" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase">Total Qty</div>
              <div className="font-black text-slate-800">{summary.totalQuantity.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase">Net Change</div>
              <div className="font-black text-slate-800">{summary.netChange > 0 ? '+' : ''}{summary.netChange.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase">Value</div>
              <div className="font-black text-slate-800">{formatCurrency(summary.totalValue)}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase">Rows</div>
              <div className="font-black text-slate-800">{summary.increaseCount} / {summary.decreaseCount} / {summary.unchangedCount}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate?.('list-stock-transfers')}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition active:scale-95"
            >
              <X size={14} /> Cancel
            </button>
            <button
              type="button"
              onClick={handleApplySeed}
              disabled={isSaving}
              className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? <CheckCircle2 size={14} /> : <Save size={14} />}
              {isSaving ? 'Applying...' : 'Apply Seed'}
            </button>
          </div>
        </div>
      </div>

      {reverseSeedRef && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 p-6">
            <h3 className="text-lg font-black text-slate-900 mb-2">Reverse Seed Stock</h3>
            <p className="text-sm text-slate-600 mb-6">
              Reverse seed reference <span className="font-mono font-bold">{reverseSeedRef}</span> for {location}? This writes reversal ledger entries and reduces this location stock.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReverseSeedRef(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => { void handleReverseSeed(reverseSeedRef); }}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-60"
              >
                {isSaving ? 'Reversing...' : 'Reverse Seed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeedLocationStock;
