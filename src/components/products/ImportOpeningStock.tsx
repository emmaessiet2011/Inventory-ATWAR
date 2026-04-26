import React, { useState, useRef } from 'react';
import { Download, Upload, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import type { Product } from '@/context/GlobalContext';
import { applyStockLotAdjustments } from '@/utils/stockLots';
import { appendStockLedgerEntries, bootstrapStockTransfersFromDB, readStockLedger } from '@/utils/stockTransfers';

type StockColumnKey = 'sku' | 'location' | 'quantity' | 'unitCost' | 'lotNumber' | 'expiryDate';

interface ColumnDefinition {
  num: number;
  key: StockColumnKey;
  name: string;
  required: boolean;
  instruction: string;
  aliases?: string[];
}

interface ParsedRow {
  rowNum: number;
  sku: string;
  location: string;
  quantity: number;
  unitCost: number;
  lotNumber: string;
  expiryDate: string;
  matchedProductId?: string;
  matchedProductName?: string;
  error?: string;
  warning?: string;
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

const columns: ColumnDefinition[] = [
  { num: 1, key: 'sku', name: 'SKU', required: true, instruction: 'Product SKU (must match an existing product)' },
  { num: 2, key: 'location', name: 'Location', required: true, instruction: 'Name of the business location' },
  { num: 3, key: 'quantity', name: 'Quantity', required: true, instruction: 'Opening stock quantity (numbers only)' },
  { num: 4, key: 'unitCost', name: 'Unit Cost (Before Tax)', required: true, instruction: 'Unit cost before tax (numbers only)', aliases: ['Unit Cost'] },
  { num: 5, key: 'lotNumber', name: 'Lot Number', required: false, instruction: 'Lot number of the stock' },
  { num: 6, key: 'expiryDate', name: 'Expiry Date', required: false, instruction: 'Format: mm-dd-yyyy or yyyy-mm-dd' },
];

const parseCSVLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
};

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeHeader = (value: string) => normalizeText(value.replace(/^\uFEFF/, '')).toLowerCase();
const round3 = (value: number) => Math.round(value * 1000) / 1000;

const resolveHeaderIndexes = (headerCells: string[]): Partial<Record<StockColumnKey, number>> => {
  const normalizedHeaders = headerCells.map(normalizeHeader);
  const resolved: Partial<Record<StockColumnKey, number>> = {};
  columns.forEach((col) => {
    const aliases = [col.name, ...(col.aliases || [])].map(normalizeHeader);
    const idx = normalizedHeaders.findIndex(h => aliases.includes(h));
    if (idx >= 0) resolved[col.key] = idx;
  });
  return resolved;
};

const appendWarning = (base: string | undefined, next: string) => (base ? `${base}; ${next}` : next);
const buildImportDedupKey = (row: Pick<ParsedRow, 'sku' | 'location' | 'quantity' | 'unitCost' | 'lotNumber' | 'expiryDate'>) => (
  [
    normalizeText(row.sku).toLowerCase(),
    normalizeText(row.location).toLowerCase(),
    round3(Number(row.quantity) || 0).toFixed(3),
    round3(Number(row.unitCost) || 0).toFixed(3),
    normalizeText(row.lotNumber).toLowerCase(),
    normalizeText(row.expiryDate),
  ].join('|')
);

const normalizeExpiryDate = (raw: string): { value: string; error?: string } => {
  const input = normalizeText(raw);
  if (!input) return { value: '' };

  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      return { value: '', error: `Invalid Expiry Date "${raw}"` };
    }
    return { value: `${iso[1]}-${iso[2]}-${iso[3]}` };
  }

  const us = input.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (us) {
    const month = Number(us[1]);
    const day = Number(us[2]);
    const year = Number(us[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      return { value: '', error: `Invalid Expiry Date "${raw}"` };
    }
    return { value: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
  }

  return { value: '', error: `Invalid Expiry Date "${raw}". Use mm-dd-yyyy or yyyy-mm-dd` };
};

type Step = 'upload' | 'preview' | 'done';

const ImportOpeningStock: React.FC = () => {
  const { products, updateProduct, locations, currentUser } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importResults, setImportResults] = useState<{ updated: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setStep('upload');
      setParsedRows([]);
      setImportResults(null);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = columns.map(c => c.name);
    const defaultLocation = locations[0]?.name || 'Main Store';
    const exampleRows = products.slice(0, 5).map(p => (
      [p.sku, defaultLocation, '10', p.unitPurchasePrice.toFixed(3), '', ''].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ));
    if (exampleRows.length === 0) {
      exampleRows.push(`"SKU-EXAMPLE","${defaultLocation}","10","5.000","",""`);
    }
    const csv = [headers.join(','), ...exampleRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'opening_stock_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleParseFile = () => {
    if (!selectedFile) return;
    const reader = new FileReader();
    reader.onerror = () => {
      addNotification({ type: 'error', title: 'Read Error', message: 'Unable to read the selected file.' });
    };
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        addNotification({ type: 'error', title: 'Empty File', message: 'No data rows found.' });
        return;
      }

      const headerCells = parseCSVLine(lines[0]).map(c => normalizeText(c));
      const headerIndexes = resolveHeaderIndexes(headerCells);
      const missingRequiredHeaders = columns
        .filter(col => col.required && headerIndexes[col.key] === undefined)
        .map(col => col.name);
      if (missingRequiredHeaders.length > 0) {
        addNotification({
          type: 'error',
          title: 'Invalid Template',
          message: `Missing required column(s): ${missingRequiredHeaders.join(', ')}`,
        });
        return;
      }

      const productBySku = new Map<string, { id: string; name: string }>();
      products.forEach((p) => productBySku.set(p.sku.toLowerCase(), { id: p.id, name: p.name }));
      const locationNameMap = new Map<string, string>();
      locations.forEach((loc) => locationNameMap.set(loc.name.toLowerCase(), loc.name));

      const rows: ParsedRow[] = [];

      for (let i = 1; i < lines.length; i += 1) {
        const cells = parseCSVLine(lines[i]);
        const get = (key: StockColumnKey) => {
          const idx = headerIndexes[key];
          return idx === undefined ? '' : normalizeText(cells[idx] || '');
        };

        const sku = get('sku');
        const locationInput = get('location');
        const quantityRaw = get('quantity');
        const unitCostRaw = get('unitCost');
        const lotNumber = get('lotNumber');
        const expiryRaw = get('expiryDate');
        const quantity = Number(quantityRaw);
        const unitCost = Number(unitCostRaw);
        const resolvedLocation = locationNameMap.get(locationInput.toLowerCase()) || locationInput;
        const normalizedExpiry = normalizeExpiryDate(expiryRaw);

        let error: string | undefined;
        let warning: string | undefined;
        let matchedProductId: string | undefined;
        let matchedProductName: string | undefined;

        if (!sku) error = 'SKU is required';
        else if (!locationInput) error = 'Location is required';
        else if (!locationNameMap.has(locationInput.toLowerCase())) error = `Location "${locationInput}" not found`;
        else if (!Number.isFinite(quantity)) error = `Invalid Quantity "${quantityRaw}"`;
        else if (quantity <= 0) error = 'Quantity must be > 0';
        else if (!Number.isFinite(unitCost)) error = `Invalid Unit Cost "${unitCostRaw}"`;
        else if (unitCost < 0) error = 'Unit Cost must be >= 0';
        else if (normalizedExpiry.error) error = normalizedExpiry.error;
        else {
          const matched = productBySku.get(sku.toLowerCase());
          if (!matched) {
            error = `SKU "${sku}" not found`;
          } else {
            matchedProductId = matched.id;
            matchedProductName = matched.name;
            if (unitCost === 0) {
              warning = appendWarning(warning, 'Unit cost is 0');
            }
          }
        }

        rows.push({
          rowNum: i,
          sku,
          location: resolvedLocation,
          quantity: Number.isFinite(quantity) ? quantity : 0,
          unitCost: Number.isFinite(unitCost) ? unitCost : 0,
          lotNumber,
          expiryDate: normalizedExpiry.value,
          matchedProductId,
          matchedProductName,
          error,
          warning,
        });
      }
      setParsedRows(rows);
      setStep('preview');
    };
    reader.readAsText(selectedFile);
  };

  const handleConfirmImport = async () => {
    const validRows = parsedRows
      .filter(r => !r.error && r.matchedProductId)
      .sort((a, b) => a.rowNum - b.rowNum);
    if (validRows.length === 0) {
      addNotification({ type: 'error', title: 'No Valid Rows', message: 'There are no valid rows to import.' });
      return;
    }

    await bootstrapStockTransfersFromDB().catch(() => {});
    const ledger = readStockLedger();
    const existingImportKeys = new Set(
      ledger
        .filter(entry => entry.type === 'Opening Stock Import')
        .map(entry => {
          const note = String(entry.note || '');
          const match = note.match(/\[IMPKEY:([^\]]+)\]/);
          return match ? match[1] : '';
        })
        .filter(Boolean),
    );
    const batchKeys = new Set<string>();
    const dedupedRows = validRows.filter((row) => {
      const key = buildImportDedupKey(row);
      if (existingImportKeys.has(key) || batchKeys.has(key)) return false;
      batchKeys.add(key);
      return true;
    });
    const duplicateRowsSkipped = validRows.length - dedupedRows.length;
    if (dedupedRows.length === 0) {
      setImportResults({ updated: 0, skipped: parsedRows.length });
      setStep('done');
      addNotification({
        type: 'warning',
        title: 'Duplicate Import Skipped',
        message: 'All valid rows in this file already exist in stock import history.',
      });
      return;
    }

    const productMap = new Map<string, Product>(products.map(p => [p.id, p] as [string, Product]));
    const aggregate = new Map<string, {
      qty: number;
      value: number;
      latestLot?: string;
      latestExpiry?: string;
      latestLocation?: string;
    }>();

    dedupedRows.forEach((row) => {
      const productId = row.matchedProductId as string;
      const current = aggregate.get(productId) || { qty: 0, value: 0 };
      current.qty += row.quantity;
      current.value += row.quantity * row.unitCost;
      if (row.lotNumber) current.latestLot = row.lotNumber;
      if (row.expiryDate) current.latestExpiry = row.expiryDate;
      if (row.location) current.latestLocation = row.location;
      aggregate.set(productId, current);
    });

    let updated = 0;
    const runningQtyByProduct = new Map<string, number>();
    for (const [productId, agg] of aggregate.entries()) {
      const product = productMap.get(productId);
      if (!product) continue;
      const currentStock = Number(product.stock) || 0;
      const currentCost = Number(product.unitPurchasePrice) || 0;
      const nextStock = round3(currentStock + agg.qty);
      const nextCost = nextStock > 0
        ? round3(((currentStock * currentCost) + agg.value) / nextStock)
        : currentCost;

      const updatedProduct = await updateProduct({
        ...product,
        stock: nextStock,
        openingStock: round3((Number(product.openingStock) || 0) + agg.qty),
        unitPurchasePrice: nextCost,
        lotNumber: agg.latestLot || product.lotNumber,
        expiryDate: agg.latestExpiry || product.expiryDate,
        openingStockLocation: agg.latestLocation || product.openingStockLocation || product.businessLocation,
      });
      if (!updatedProduct.ok) {
        throw new Error(updatedProduct.error || `Unable to update product stock for ${product.name}.`);
      }
      runningQtyByProduct.set(productId, currentStock);
      updated += 1;
    }

    const now = Date.now();
    const newLedgerEntries: StockLedgerEntry[] = [];
    dedupedRows.forEach((row, index) => {
      const productId = row.matchedProductId as string;
      const startQty = runningQtyByProduct.get(productId) ?? 0;
      const nextQty = round3(startQty + row.quantity);
      runningQtyByProduct.set(productId, nextQty);
      const dedupKey = buildImportDedupKey(row);
      newLedgerEntries.push({
        id: `STK-IMP-${now}-${index}`,
        productId,
        type: 'Opening Stock Import',
        change: round3(row.quantity),
        newQty: nextQty,
        date: new Date().toISOString(),
        ref: row.lotNumber || `IMP-OPEN-${now}-${row.rowNum}`,
        party: currentUser?.name || 'System',
        location: row.location,
        note: `Imported via Opening Stock CSV [IMPKEY:${dedupKey}]`,
      });
    });
    const ledgerSaved = await appendStockLedgerEntries(newLedgerEntries);
    if (!ledgerSaved) {
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: 'Unable to save imported opening-stock ledger entries in Postgres.',
      });
      return;
    }

    const lotsSaved = await applyStockLotAdjustments(
      dedupedRows.map((row) => {
        const product = productMap.get(row.matchedProductId as string);
        return {
          productId: row.matchedProductId as string,
          productName: product?.name || row.matchedProductName || '',
          sku: row.sku,
          location: row.location,
          lotNumber: row.lotNumber,
          expiryDate: row.expiryDate,
          unit: product?.unit || '',
          unitCost: row.unitCost,
          qtyChange: row.quantity,
          updatedAt: new Date().toISOString(),
        };
      }),
    );
    if (!lotsSaved) {
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: 'Unable to save imported stock lot balances in Postgres.',
      });
      return;
    }

    setImportResults({ updated, skipped: parsedRows.length - dedupedRows.length });
    setStep('done');
    addNotification({
      type: 'success',
      title: 'Stock Updated',
      message: `${updated} product(s) stock updated successfully. ${parsedRows.length - dedupedRows.length} row(s) skipped${duplicateRowsSkipped > 0 ? ` (${duplicateRowsSkipped} duplicate row(s))` : ''}.`,
    });
  };

  const handleReset = () => {
    setSelectedFile(null);
    setStep('upload');
    setParsedRows([]);
    setImportResults(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const validCount = parsedRows.filter(r => !r.error).length;
  const errorCount = parsedRows.filter(r => !!r.error).length;

  return (
    <div className="space-y-8 animate-fade-in pb-20 max-w-[1600px] mx-auto">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Import Opening Stock</h2>
        <p className="text-slate-500 mt-2">Update opening stock for existing products via CSV file.</p>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>

        {step !== 'done' && (
          <>
            <div className="flex flex-col md:flex-row gap-6 mb-8 items-start border-b border-slate-100 pb-8">
              <div className="w-full md:w-1/2 space-y-3">
                <label className="text-sm font-bold text-slate-900 uppercase tracking-wide">File To Import:</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer">
                    <span className="px-6 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-sm flex items-center gap-2">
                      <Upload size={16} /> Choose File
                    </span>
                    <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} accept=".csv" />
                  </label>
                  <span className="text-sm text-slate-500 italic">{selectedFile ? selectedFile.name : 'No file chosen'}</span>
                </div>
                {selectedFile && <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold"><CheckCircle2 size={14} /> Ready to parse</div>}
              </div>

              <div className="w-full md:w-1/2 flex justify-end items-end gap-3 pt-6">
                {step === 'upload' && (
                  <button
                    onClick={handleParseFile}
                    disabled={!selectedFile}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Parse & Preview
                  </button>
                )}
                {step === 'preview' && (
                  <>
                    <button onClick={handleReset} className="px-6 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                      Reset
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      disabled={validCount === 0}
                      className="px-8 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Apply Stock ({validCount} rows)
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mb-10 flex gap-4">
              <button onClick={handleDownloadTemplate} className="px-6 py-3 bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-600 transition-all flex items-center gap-2 active:scale-95">
                <Download size={16} /> Download template file
              </button>
            </div>
          </>
        )}

        {step === 'done' && importResults && (
          <div className="text-center py-16">
            <CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={56} />
            <h3 className="text-2xl font-black text-slate-900 mb-2">Stock Update Complete!</h3>
            <div className="flex justify-center gap-8 mt-6">
              <div className="text-center">
                <div className="text-3xl font-black text-emerald-600">{importResults.updated}</div>
                <div className="text-xs font-bold text-slate-500 uppercase mt-1">Updated</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-rose-500">{importResults.skipped}</div>
                <div className="text-xs font-bold text-slate-500 uppercase mt-1">Skipped</div>
              </div>
            </div>
            <button onClick={handleReset} className="mt-10 px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all">
              Import More
            </button>
          </div>
        )}

        {step === 'preview' && parsedRows.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-4">
              <h3 className="text-base font-bold text-slate-800">Preview ({parsedRows.length} rows)</h3>
              {validCount > 0 && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">{validCount} valid</span>}
              {errorCount > 0 && <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold">{errorCount} errors</span>}
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-3">#</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">SKU</th>
                    <th className="px-3 py-3">Matched Product</th>
                    <th className="px-3 py-3">Location</th>
                    <th className="px-3 py-3">Qty to Add</th>
                    <th className="px-3 py-3">Unit Cost</th>
                    <th className="px-3 py-3">Lot</th>
                    <th className="px-3 py-3">Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map(row => (
                    <tr key={row.rowNum} className={row.error ? 'bg-rose-50' : 'hover:bg-slate-50'}>
                      <td className="px-3 py-2 text-slate-400">{row.rowNum}</td>
                      <td className="px-3 py-2">
                        {row.error
                          ? <span className="flex items-center gap-1 text-rose-600 font-bold"><AlertCircle size={12} />{row.error}</span>
                          : row.warning
                          ? <span className="flex items-center gap-1 text-amber-600 font-bold"><AlertCircle size={12} />{row.warning}</span>
                          : <span className="flex items-center gap-1 text-emerald-600 font-bold"><CheckCircle2 size={12} />Ready</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-700">{row.sku}</td>
                      <td className="px-3 py-2 font-bold text-slate-800">{row.matchedProductName || '--'}</td>
                      <td className="px-3 py-2 text-slate-600">{row.location}</td>
                      <td className="px-3 py-2 font-bold text-emerald-700">+{row.quantity}</td>
                      <td className="px-3 py-2">{row.unitCost.toFixed(3)}</td>
                      <td className="px-3 py-2 text-slate-500">{row.lotNumber || '--'}</td>
                      <td className="px-3 py-2 text-slate-500">{row.expiryDate || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 'upload' && (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 mb-10 flex gap-4 items-start">
              <Info className="text-blue-500 shrink-0" size={24} />
              <div className="text-sm text-blue-800 leading-relaxed">
                <p className="font-bold mb-1">Important Notes:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Opening stock can only be imported for existing products (matched by SKU).</li>
                  <li>The quantity will be <strong>added</strong> to the current stock level.</li>
                  <li>Location must match exactly with existing system locations.</li>
                </ul>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden border-slate-200">
              <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-800">Instructions</h3>
                <p className="text-sm text-slate-500 mt-1">Columns must be in the following order.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white text-xs uppercase text-slate-500 font-extrabold border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 w-32">Col #</th>
                      <th className="px-6 py-4 w-64">Column Name</th>
                      <th className="px-6 py-4">Instruction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {columns.map((col) => (
                      <tr key={col.key} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-slate-400 font-mono font-medium">{col.num}</td>
                        <td className="px-6 py-4 font-bold text-slate-700">
                          {col.name}
                          {col.required && <span className="text-[10px] text-red-500 font-bold ml-1 italic">(Required)</span>}
                          {!col.required && <span className="text-[10px] text-slate-400 font-normal ml-1 italic">(Optional)</span>}
                        </td>
                        <td className="px-6 py-4 text-slate-600 whitespace-pre-wrap leading-relaxed text-xs font-medium">{col.instruction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportOpeningStock;
