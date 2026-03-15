import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { Product, useGlobalContext } from '../src/context/GlobalContext';
import { useNotifications } from '../src/context/NotificationContext';
import { applyStockLotAdjustments } from '../src/utils/stockLots';

interface AddOpeningStockProps {
  isOpen?: boolean;
  onClose?: () => void;
  product: Product | null;
  pageMode?: boolean;
}

interface StockEntry {
  id: string;
  quantity: number;
  unitCost: number;
  expDate: string;
  lotNumber: string;
  date: string;
  note: string;
}

interface StockLedgerEntry {
  id: string;
  productId: string;
  type: string;
  change: number;
  newQty: number;
  date: string;
  ref: string;
  party: string;
  location?: string;
  note?: string;
}

const STOCK_LEDGER_KEY = 'app_product_stock_ledger_v1';

const readStockLedger = (): StockLedgerEntry[] => {
  try {
    const raw = localStorage.getItem(STOCK_LEDGER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeStockLedger = (rows: StockLedgerEntry[]) => {
  localStorage.setItem(STOCK_LEDGER_KEY, JSON.stringify(rows));
};

const createDefaultRow = (): StockEntry => ({
  id: Date.now().toString(),
  quantity: 0,
  unitCost: 0,
  expDate: '',
  lotNumber: '',
  date: new Date().toISOString().slice(0, 16),
  note: '',
});

const AddOpeningStock: React.FC<AddOpeningStockProps> = ({ isOpen = true, onClose, product, pageMode = false }) => {
  const { updateProduct, currentUser, formatCurrency } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [entries, setEntries] = useState<StockEntry[]>([createDefaultRow()]);
  const visible = pageMode ? !!product : (isOpen && !!product);
  const handleClose = () => {
    onClose?.();
  };

  useEffect(() => {
    if (visible) {
      setEntries([createDefaultRow()]);
    }
  }, [visible, product?.id]);

  const handleAddRow = () => setEntries(prev => [...prev, createDefaultRow()]);
  const handleRemoveRow = (id: string) => setEntries(prev => prev.filter(e => e.id !== id));

  const handleChange = (id: string, field: keyof StockEntry, value: string) => {
    setEntries(prev => prev.map((e) => {
      if (e.id !== id) return e;
      if (field === 'quantity' || field === 'unitCost') {
        const parsed = parseFloat(value);
        return { ...e, [field]: Number.isFinite(parsed) ? parsed : 0 };
      }
      return { ...e, [field]: value };
    }));
  };

  const totalAmount = useMemo(
    () => entries.reduce((sum, entry) => sum + ((entry.quantity || 0) * (entry.unitCost || 0)), 0),
    [entries]
  );

  if (!visible || !product) return null;

  const handleSave = () => {
    const validRows = entries.filter(r => (r.quantity || 0) > 0);
    if (validRows.length === 0) {
      addNotification({ title: 'Validation Error', message: 'Enter at least one row with quantity greater than zero.', type: 'error' });
      return;
    }

    const currentStock = Number(product.stock) || 0;
    const addedQty = validRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
    const addedValue = validRows.reduce((sum, r) => sum + ((Number(r.quantity) || 0) * (Number(r.unitCost) || 0)), 0);
    const nextStock = Number((currentStock + addedQty).toFixed(3));

    const currentValue = currentStock * (Number(product.unitPurchasePrice) || 0);
    const nextUnitCost = nextStock > 0 ? Number(((currentValue + addedValue) / nextStock).toFixed(3)) : Number(product.unitPurchasePrice) || 0;

    const getRowTime = (row: typeof validRows[number]) => {
      const parsed = row.date ? new Date(row.date).getTime() : 0;
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const latestLotRow = validRows
      .filter(row => row.lotNumber.trim())
      .reduce<typeof validRows[number] | null>((latest, row) => {
        if (!latest) return row;
        return getRowTime(row) >= getRowTime(latest) ? row : latest;
      }, null);
    const latestExpRow = validRows
      .filter(row => row.expDate.trim())
      .reduce<typeof validRows[number] | null>((latest, row) => {
        if (!latest) return row;
        return getRowTime(row) >= getRowTime(latest) ? row : latest;
      }, null);
    const latestLot = latestLotRow?.lotNumber?.trim();
    const latestExp = latestExpRow?.expDate?.trim();

    updateProduct({
      ...product,
      stock: nextStock,
      unitPurchasePrice: nextUnitCost,
      lotNumber: latestLot || product.lotNumber,
      expiryDate: latestExp || product.expiryDate,
      openingStock: Number(((product.openingStock || 0) + addedQty).toFixed(3)),
      openingStockLocation: product.businessLocation || product.openingStockLocation,
    });

    const ledger = readStockLedger();
    let runningQty = currentStock;
    validRows.forEach((row, idx) => {
      runningQty = Number((runningQty + (Number(row.quantity) || 0)).toFixed(3));
      ledger.push({
        id: `STK-OPEN-${Date.now()}-${idx}`,
        productId: product.id,
        type: 'Opening Stock',
        change: Number((Number(row.quantity) || 0).toFixed(3)),
        newQty: runningQty,
        date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
        ref: row.lotNumber?.trim() || `OPEN-${Date.now().toString().slice(-6)}`,
        party: currentUser?.name || 'System',
        location: product.businessLocation,
        note: row.note?.trim() || '',
      });
    });
    writeStockLedger(ledger);

    applyStockLotAdjustments(
      validRows.map((row) => ({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        location: product.businessLocation || product.openingStockLocation || '',
        lotNumber: row.lotNumber,
        expiryDate: row.expDate,
        unit: product.unit || '',
        unitCost: Number(row.unitCost) || Number(product.unitPurchasePrice) || 0,
        qtyChange: Number(row.quantity) || 0,
        updatedAt: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
      })),
    );

    addNotification({
      title: 'Stock Saved',
      message: `${addedQty.toFixed(3)} ${product.unit} added to "${product.name}".`,
      type: 'success',
    });
    handleClose();
  };

  return (
    <div className={pageMode ? 'space-y-4 animate-fade-in pb-20' : 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm'}>
      <div className={`${pageMode ? 'bg-white w-full rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[calc(100vh-10rem)]' : 'bg-white w-full max-w-6xl rounded-2xl border border-slate-200 shadow-xl max-h-[90vh] overflow-hidden flex flex-col'}`}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900">Add Opening Stock</h3>
            <p className="text-sm text-slate-500 mt-1">
              {product.name} ({product.sku}) - {product.businessLocation || 'No location'}
            </p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead className="bg-slate-50 border-y border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left">Quantity</th>
                <th className="px-3 py-2 text-left">Unit Cost</th>
                <th className="px-3 py-2 text-left">Expiry Date</th>
                <th className="px-3 py-2 text-left">Lot Number</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Note</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
                <th className="px-3 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={entry.id} className="border-b border-slate-100">
                  <td className="px-3 py-2"><input type="number" min="0" step="0.001" value={entry.quantity} onChange={(e) => handleChange(entry.id, 'quantity', e.target.value)} className="w-full px-2 py-1 rounded border border-slate-200" /></td>
                  <td className="px-3 py-2"><input type="number" min="0" step="0.001" value={entry.unitCost} onChange={(e) => handleChange(entry.id, 'unitCost', e.target.value)} className="w-full px-2 py-1 rounded border border-slate-200" /></td>
                  <td className="px-3 py-2"><input type="date" value={entry.expDate} onChange={(e) => handleChange(entry.id, 'expDate', e.target.value)} className="w-full px-2 py-1 rounded border border-slate-200" /></td>
                  <td className="px-3 py-2"><input type="text" value={entry.lotNumber} onChange={(e) => handleChange(entry.id, 'lotNumber', e.target.value)} className="w-full px-2 py-1 rounded border border-slate-200" /></td>
                  <td className="px-3 py-2"><input type="datetime-local" value={entry.date} onChange={(e) => handleChange(entry.id, 'date', e.target.value)} className="w-full px-2 py-1 rounded border border-slate-200" /></td>
                  <td className="px-3 py-2"><input type="text" value={entry.note} onChange={(e) => handleChange(entry.id, 'note', e.target.value)} className="w-full px-2 py-1 rounded border border-slate-200" /></td>
                  <td className="px-3 py-2 text-right font-bold">{formatCurrency((entry.quantity || 0) * (entry.unitCost || 0))}</td>
                  <td className="px-3 py-2 text-center">
                    {index === 0 ? (
                      <button onClick={handleAddRow} className="p-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700"><Plus size={14} /></button>
                    ) : (
                      <button onClick={() => handleRemoveRow(entry.id)} className="p-1.5 rounded bg-rose-50 text-rose-600 hover:bg-rose-100"><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-y border-slate-200">
              <tr>
                <td colSpan={6} className="px-3 py-3 text-right font-bold text-slate-600">Total</td>
                <td className="px-3 py-3 text-right font-black text-indigo-700">{formatCurrency(totalAmount)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={handleClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold flex items-center gap-2">
            <Save size={14} /> Save Stock Entry
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddOpeningStock;
