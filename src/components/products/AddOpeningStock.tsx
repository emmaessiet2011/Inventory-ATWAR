import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Save, Lock, Calendar, FileText } from 'lucide-react';
import { Product, useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { applyStockLotAdjustments } from '@/utils/stockLots';
import { appendStockLedgerEntriesStrict, fetchStockLedgerFromDB, deleteStockLedgerEntry, StockLedgerEntry } from '@/utils/stockTransfers';
import { fetchDedicated } from '@/utils/apiClient';

interface AddOpeningStockProps {
  isOpen?: boolean;
  onClose?: () => void;
  product: Product | null;
  pageMode?: boolean;
}

interface StockEntry {
  id: string;
  isNew: boolean;
  originalQty: number;
  type: string;
  quantity: number;
  unitCost: number;
  expDate: string;
  lotNumber: string;
  date: string;
  note: string;
}

interface StockLotBalance {
  id: string;
  productId: string;
  location: string;
  lotNumber: string;
  expiryDate: string;
  unitCost: number;
  qty: number;
}

const createDefaultRow = (): StockEntry => ({
  id: Date.now().toString(),
  isNew: true,
  originalQty: 0,
  type: 'Opening Stock',
  quantity: 0,
  unitCost: 0,
  expDate: '',
  lotNumber: '',
  date: new Date().toISOString().slice(0, 16),
  note: '',
});

const AddOpeningStock: React.FC<AddOpeningStockProps> = ({ isOpen = true, onClose, product, pageMode = false }) => {
  const { updateProduct, currentUser, formatCurrency, generateId, locations } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [deletedIds, setDeletedIds] = useState<StockEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const visible = pageMode ? !!product : (isOpen && !!product);

  useEffect(() => {
    if (product && !selectedLocation) {
      setSelectedLocation(product.businessLocation || product.openingStockLocation || (locations[0]?.name || ''));
    }
  }, [product, selectedLocation, locations]);

  const handleClose = () => {
    onClose?.();
  };

  useEffect(() => {
    if (visible && product?.id && selectedLocation) {
      const loadLedger = async () => {
        setLoading(true);
        try {
          const [ledger, lots] = await Promise.all([
            fetchStockLedgerFromDB(),
            fetchDedicated<StockLotBalance>('/api/sync/stock-lots').then(res => res || [])
          ]);
          
          const productLedger = ledger.filter(e => 
            e.productId === product.id && 
            e.location === selectedLocation
          );
          
          const mappedEntries: StockEntry[] = productLedger.map(e => {
            const lotMatch = lots.find(l => l.productId === product.id && l.location === selectedLocation && l.lotNumber === e.ref);
            return {
              id: e.id,
              isNew: false,
              originalQty: e.change,
              type: e.type || 'Opening Stock',
              quantity: e.change,
              unitCost: lotMatch ? lotMatch.unitCost : Number(product.unitPurchasePrice || 0),
              expDate: lotMatch?.expiryDate ? new Date(lotMatch.expiryDate).toISOString().split('T')[0] : '',
              lotNumber: (e.ref && e.ref.startsWith('OPEN-')) ? '' : (e.ref || ''),
              date: new Date(e.date).toISOString().slice(0, 16),
              note: e.note || '',
            };
          });

          setEntries([createDefaultRow(), ...mappedEntries]);
          setDeletedIds([]);
        } catch (e) {
          console.error(e);
        }
        setLoading(false);
      };
      loadLedger();
    } else if (visible) {
      setEntries([createDefaultRow()]);
      setDeletedIds([]);
    }
  }, [visible, product?.id, selectedLocation]);

  const handleAddRow = () => setEntries(prev => [createDefaultRow(), ...prev]);
  const handleRemoveRow = (row: StockEntry) => {
    if (!row.isNew) setDeletedIds(prev => [...prev, row]);
    setEntries(prev => prev.filter(e => e.id !== row.id));
  };

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

  const handleSave = async () => {
    const validRows = entries.filter(r => r.isNew ? (r.quantity || 0) !== 0 : true);
    
    let netAddedQty = 0;
    let netAddedValue = 0;

    const ledgerPayload: StockLedgerEntry[] = [];
    const lotPayload: any[] = [];

    // Process Active/Modified Rows
    for (const row of validRows) {
       if (row.type !== 'Opening Stock') continue; 
       
       const diff = row.isNew ? (Number(row.quantity) || 0) : ((Number(row.quantity) || 0) - row.originalQty);
       netAddedQty += diff;
       netAddedValue += (diff * (Number(row.unitCost) || 0));
       
       ledgerPayload.push({
         id: row.isNew ? generateId('STK') : row.id,
         productId: product.id,
         type: 'Opening Stock',
         change: Number(row.quantity), 
         newQty: 0,
         date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
         ref: row.lotNumber?.trim() || (row.isNew ? `OPEN-${Date.now().toString().slice(-6)}` : row.id),
         party: currentUser?.name || 'System',
         location: selectedLocation,
         note: row.note?.trim() || '',
       });
       
       if (diff !== 0 || row.isNew) {
           lotPayload.push({
             productId: product.id,
             productName: product.name,
             sku: product.sku,
             location: selectedLocation,
             lotNumber: row.lotNumber?.trim() || (row.isNew ? `OPEN-${Date.now().toString().slice(-6)}` : row.id),
             expiryDate: row.expDate,
             unit: product.unit || '',
             unitCost: Number(row.unitCost) || Number(product.unitPurchasePrice) || 0,
             qtyChange: diff,
             updatedAt: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
           });
       }
    }

    // Process Deletions
    for (const origRow of deletedIds) {
       if (origRow.type === 'Opening Stock') {
          netAddedQty -= origRow.originalQty;
          netAddedValue -= (origRow.originalQty * (Number(origRow.unitCost) || 0));
          await deleteStockLedgerEntry(origRow.id);
          lotPayload.push({
             productId: product.id,
             productName: product.name,
             sku: product.sku,
             location: selectedLocation,
             lotNumber: origRow.lotNumber?.trim() || origRow.id,
             expiryDate: origRow.expDate,
             unit: product.unit || '',
             unitCost: Number(origRow.unitCost) || Number(product.unitPurchasePrice) || 0,
             qtyChange: -origRow.originalQty, 
             updatedAt: new Date().toISOString(),
          });
       }
    }

    // Update Product Stock Target
    const currentStock = Number(product.stock) || 0;
    const nextStock = Number((currentStock + netAddedQty).toFixed(3));
    const currentValue = currentStock * (Number(product.unitPurchasePrice) || 0);
    const nextUnitCost = nextStock > 0 ? Number(((currentValue + netAddedValue) / nextStock).toFixed(3)) : Number(product.unitPurchasePrice) || 0;

    const productUpdateResult = await updateProduct({
      ...product,
      stock: nextStock,
      unitPurchasePrice: nextUnitCost,
      openingStock: Number(((product.openingStock || 0) + netAddedQty).toFixed(3)),
    });

    if (!productUpdateResult.ok) {
      addNotification({
        title: 'Save Failed',
        message: productUpdateResult.error || `Unable to update product ${product.name}.`,
        type: 'error',
      });
      return;
    }

    // Save Location Inventory
    const locName = selectedLocation;
    const normalize = (v: unknown) => String(v || '').trim().toLowerCase();
    const locMatch = locations.find(l => normalize(l.name) === normalize(locName) || normalize(l.id) === normalize(locName));
    const locationId = locMatch ? locMatch.id : locName;
    const locationName = locMatch ? locMatch.name : locName;

    if (locationId) {
      try {
        const { fetchLocationInventoryFromDB, syncChangedLocationInventoryStrict } = await import('@/utils/stockLocationInventory');
        const allInventory = await fetchLocationInventoryFromDB();
        const existingKey = `${normalize(product.id)}@@${normalize(locationId)}`;
        const existing = allInventory.find(row => `${normalize(row.productId)}@@${normalize(row.locationId)}` === existingKey);

        const targetInventory = existing ? { ...existing } : {
          id: generateId('PINV'),
          productId: product.id,
          locationId: locationId,
          locationName: locationName,
          stock: 0,
          unitCost: Number(product.unitPurchasePrice || 0),
        };

        const prevInventory = existing ? [{ ...existing }] : [];
        targetInventory.stock = Math.max(0, Number((Number(targetInventory.stock || 0) + netAddedQty).toFixed(3)));
        targetInventory.unitCost = nextUnitCost;

        const invSaved = await syncChangedLocationInventoryStrict([targetInventory], prevInventory);
        if (invSaved.ok) {
           window.dispatchEvent(new Event('app:location-inventory-updated'));
        } else {
          throw new Error('Unable to sync location inventory');
        }
      } catch (err) {
        addNotification({
          title: 'Location Inventory Warning',
          message: 'Product stock was updated but we could not apply it to the specific location immediately. It may take a moment to sync.',
          type: 'error',
        });
      }
    }

    // Save Ledger
    if (ledgerPayload.length > 0) {
      const ledgerSaved = await appendStockLedgerEntriesStrict(ledgerPayload);
      if (!ledgerSaved.ok) {
        addNotification({
          title: 'Save Failed',
          message: 'Unable to save stock ledger entries in Postgres.',
          type: 'error',
        });
        return;
      }
    }

    // Save Lots
    if (lotPayload.length > 0) {
      const lotSaved = await applyStockLotAdjustments(lotPayload);
      if (!lotSaved) {
        addNotification({
          title: 'Save Failed',
          message: 'Unable to save stock lot balances in Postgres.',
          type: 'error',
        });
        return;
      }
    }

    addNotification({
      title: 'Stock Updated',
      message: `Stock entries for "${product.name}" have been updated successfully.`,
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
              Manage initial inventory levels for <span className="font-bold text-indigo-700">{product.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="text-sm border border-slate-200 rounded px-3 py-1.5 min-w-[200px]"
            >
              <option value="">-- Select Location --</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.name}>{loc.name}</option>
              ))}
            </select>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-auto relative min-h-[300px]">
          {loading && (
             <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm">
                <span className="font-bold text-slate-500">Loading ledger...</span>
             </div>
          )}
          <table className="w-full text-sm min-w-[1000px] border-separate border-spacing-y-4">
            <thead className="text-slate-400 text-xs font-black uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left w-[20%]">Product Details</th>
                <th className="px-3 py-2 text-left w-[15%]">Quantity</th>
                <th className="px-3 py-2 text-left w-[15%]">Unit Cost</th>
                <th className="px-3 py-2 text-left w-[15%]">Expiry / Lot</th>
                <th className="px-3 py-2 text-right w-[10%]">Subtotal</th>
                <th className="px-3 py-2 text-left w-[15%]">Date Entry</th>
                <th className="px-3 py-2 text-left w-[10%]">Notes</th>
                <th className="px-3 py-2 text-center w-[5%]"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const isOpening = entry.type === 'Opening Stock';
                return (
                <tr key={entry.id} className="bg-white shadow-sm ring-1 ring-slate-100 rounded-xl">
                  <td className="px-3 py-4 align-top rounded-l-xl">
                    <div className="font-bold text-slate-900">{product.name}</div>
                    <div className="text-xs text-slate-400 mt-1 bg-slate-50 inline-block px-1.5 py-0.5 rounded">{product.sku}</div>
                    {!isOpening && <div className="text-xs text-amber-600 mt-2 font-bold">{entry.type}</div>}
                  </td>
                  <td className="px-3 py-4 align-top relative">
                    <div className="relative flex items-center">
                      <input 
                        type="number" 
                        step="0.001" 
                        value={entry.quantity} 
                        onChange={(e) => handleChange(entry.id, 'quantity', e.target.value)} 
                        className="w-full pl-3 pr-16 py-2 rounded-lg border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100" 
                        disabled={!isOpening}
                      />
                      <span className="absolute right-3 text-xs font-bold text-slate-400 pointer-events-none">{product.unit || 'Pcs'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-4 align-top">
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-slate-500 font-bold pointer-events-none">$</span>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.001" 
                        value={entry.unitCost} 
                        onChange={(e) => handleChange(entry.id, 'unitCost', e.target.value)} 
                        className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-300 disabled:bg-slate-50 disabled:text-slate-400" 
                        disabled={!isOpening}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-4 align-top space-y-2">
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input 
                        type="date" 
                        value={entry.expDate} 
                        onChange={(e) => handleChange(entry.id, 'expDate', e.target.value)} 
                        className="w-full pl-8 pr-2 py-2 rounded-lg border border-slate-200 text-xs outline-none focus:border-indigo-300 disabled:bg-slate-50 disabled:text-slate-400" 
                        disabled={!isOpening}
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-bold">#</span>
                      <input 
                        type="text" 
                        placeholder="Lot Number"
                        value={entry.lotNumber} 
                        onChange={(e) => handleChange(entry.id, 'lotNumber', e.target.value)} 
                        className="w-full pl-8 pr-2 py-2 rounded-lg border border-slate-200 text-xs outline-none focus:border-indigo-300 disabled:bg-slate-50 disabled:text-slate-400" 
                        disabled={!isOpening}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-4 align-top text-right pt-6">
                    <span className="font-black text-slate-900">{formatCurrency((entry.quantity || 0) * (entry.unitCost || 0)).replace('$', '')}</span>
                  </td>
                  <td className="px-3 py-4 align-top">
                    <input 
                      type="datetime-local" 
                      value={entry.date} 
                      onChange={(e) => handleChange(entry.id, 'date', e.target.value)} 
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs outline-none focus:border-indigo-300 disabled:bg-slate-50 disabled:text-slate-400" 
                      disabled={!isOpening}
                    />
                  </td>
                  <td className="px-3 py-4 align-top">
                    <div className="relative">
                      <FileText size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Add optional notes here..."
                        value={entry.note} 
                        onChange={(e) => handleChange(entry.id, 'note', e.target.value)} 
                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-xs outline-none focus:border-indigo-300 disabled:bg-slate-50 disabled:text-slate-400" 
                        disabled={!isOpening}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-4 align-top text-center pt-5 rounded-r-xl">
                    {entry.isNew ? (
                      <button onClick={handleAddRow} className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors"><Plus size={16} /></button>
                    ) : (
                      isOpening ? (
                        <button onClick={() => handleRemoveRow(entry)} className="p-2 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"><Trash2 size={16} /></button>
                      ) : (
                        <div className="p-2 inline-flex rounded-full bg-slate-100 text-slate-400"><Lock size={16} /></div>
                      )
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="text-lg font-bold text-slate-600">
            Total Value: <span className="font-black text-indigo-700">{formatCurrency(totalAmount)}</span>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={handleClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-white transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-sm transition-all active:scale-95">
              <Save size={16} /> Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddOpeningStock;
