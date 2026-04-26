import React, { useRef, useState } from 'react';
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';

type RowStatus = 'changed' | 'unchanged' | 'not_found' | 'invalid' | 'duplicate';

interface ParsedRow {
  sourceRow: number;
  id: string;
  name: string;
  sku: string;
  newPurchasePrice: number;
  newSellingPrice: number;
  oldPurchasePrice: number;
  oldSellingPrice: number;
  matched: boolean;
  changed: boolean;
  status: RowStatus;
  message?: string;
  productType?: 'Single' | 'Variable' | 'Combo';
}

interface ColumnMap {
  id: number;
  name: number;
  sku: number;
  purchase: number;
  selling: number;
}

const FALLBACK_COLUMN_MAP: ColumnMap = { id: 0, name: 1, sku: 2, purchase: 3, selling: 4 };

const normalizeText = (value: string) => value.trim().toLowerCase();
const normalizeSku = (value: string) => normalizeText(value);
const normalizeHeader = (value: string) => normalizeText(value).replace(/[^a-z0-9]/g, '');

const HEADER_ALIASES = {
  id: ['id', 'productid'],
  name: ['productname', 'name'],
  sku: ['sku', 'productsku'],
  purchase: ['purchasepriceexctax', 'purchaseprice', 'unitpurchaseprice', 'costprice'],
  selling: ['sellingpriceexctax', 'sellingprice', 'defaultsellingprice', 'unitsellingprice'],
};

const round3 = (value: number) => Math.round(value * 1000);
const isDifferent3 = (a: number, b: number) => round3(a) !== round3(b);

const resolveHeaderMap = (columns: string[]): ColumnMap | null => {
  const normalized = columns.map(normalizeHeader);
  const findIndex = (aliases: string[]) => normalized.findIndex(col => aliases.includes(col));

  const id = findIndex(HEADER_ALIASES.id);
  const sku = findIndex(HEADER_ALIASES.sku);
  const purchase = findIndex(HEADER_ALIASES.purchase);
  const selling = findIndex(HEADER_ALIASES.selling);
  const name = findIndex(HEADER_ALIASES.name);

  if (id < 0 || sku < 0 || purchase < 0 || selling < 0) return null;

  return {
    id,
    sku,
    purchase,
    selling,
    name: name >= 0 ? name : 1,
  };
};

const normalizeNumericInput = (value: string): string => {
  const stripped = value
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^\d,.\-]/g, '');
  if (!stripped) return '';

  const hasComma = stripped.includes(',');
  const hasDot = stripped.includes('.');

  if (hasComma && hasDot) {
    // Use the right-most symbol as decimal separator, other one as thousands separator.
    if (stripped.lastIndexOf(',') > stripped.lastIndexOf('.')) {
      return stripped.replace(/\./g, '').replace(',', '.');
    }
    return stripped.replace(/,/g, '');
  }

  if (hasComma) {
    const commaParts = stripped.split(',');
    if (commaParts.length === 2 && commaParts[1].length <= 3) {
      return `${commaParts[0]}.${commaParts[1]}`;
    }
    return stripped.replace(/,/g, '');
  }

  if (hasDot) {
    const dotParts = stripped.split('.');
    if (dotParts.length > 2) {
      const decimalPart = dotParts.pop() || '';
      return `${dotParts.join('')}.${decimalPart}`;
    }
  }

  return stripped;
};

const parsePrice = (value: string): number => {
  const normalized = normalizeNumericInput(value);
  if (!normalized) return Number.NaN;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const statusBadge = (status: RowStatus) => {
  if (status === 'changed') {
    return <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Update</span>;
  }
  if (status === 'unchanged') {
    return <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Same</span>;
  }
  if (status === 'duplicate') {
    return <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Duplicate</span>;
  }
  if (status === 'invalid') {
    return <span className="text-[10px] font-bold uppercase bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Invalid</span>;
  }
  return <span className="text-[10px] font-bold uppercase bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Not Found</span>;
};

const UpdatePrice: React.FC = () => {
  const { products, updateProduct, formatCurrency } = useGlobalContext();
  const { addNotification } = useNotifications();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [applied, setApplied] = useState(false);

  const fmt = (value: number) => formatCurrency(value);

  const diff = (oldValue: number, newValue: number) => {
    if (newValue > oldValue) {
      return <span className="text-emerald-600 font-bold text-xs">+{(newValue - oldValue).toFixed(3)}</span>;
    }
    if (newValue < oldValue) {
      return <span className="text-red-500 font-bold text-xs">-{(oldValue - newValue).toFixed(3)}</span>;
    }
    return <span className="text-slate-400 text-xs">0.000</span>;
  };

  // Export
  const handleExport = () => {
    if (products.length === 0) {
      addNotification({ title: 'No Products', message: 'There are no products to export.', type: 'warning' });
      return;
    }

    const esc = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const headers = ['ID', 'Product Name', 'SKU', 'Purchase Price (Exc. Tax)', 'Selling Price (Exc. Tax)'];
    const rows = products.map(p => [
      esc(String(p.id)),
      esc(p.name),
      esc(p.sku),
      Number(p.unitPurchasePrice || 0).toFixed(3),
      Number(p.sellingPrice || 0).toFixed(3),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-prices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    addNotification({ title: 'Exported', message: `${products.length} products exported to CSV.`, type: 'success' });
  };

  // Parse CSV
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
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
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }

    result.push(current);
    return result;
  };

  const parseCSV = (text: string) => {
    try {
      const rawLines = text.split(/\r?\n/);
      if (rawLines.every(line => !line.trim())) {
        setParseError('File appears to be empty.');
        return;
      }

      const firstLineCols = parseCsvLine(rawLines[0] || '');
      const detectedHeaderMap = resolveHeaderMap(firstLineCols);
      const hasHeader = detectedHeaderMap !== null;
      const columnMap = detectedHeaderMap || FALLBACK_COLUMN_MAP;
      const startIdx = hasHeader ? 1 : 0;
      const requiredMaxIndex = Math.max(columnMap.id, columnMap.sku, columnMap.purchase, columnMap.selling);
      const rows: ParsedRow[] = [];

      for (let i = startIdx; i < rawLines.length; i += 1) {
        const sourceRow = i + 1;
        const line = rawLines[i];
        if (!line || !line.trim()) continue;

        const cols = parseCsvLine(line);
        const readCol = (index: number) => (index >= 0 && index < cols.length ? cols[index].trim() : '');

        if (cols.length <= requiredMaxIndex) {
          rows.push({
            sourceRow,
            id: '',
            name: '',
            sku: '',
            newPurchasePrice: 0,
            newSellingPrice: 0,
            oldPurchasePrice: 0,
            oldSellingPrice: 0,
            matched: false,
            changed: false,
            status: 'invalid',
            message: `Expected at least ${requiredMaxIndex + 1} columns.`,
          });
          continue;
        }

        const csvId = readCol(columnMap.id);
        const csvName = readCol(columnMap.name).replace(/^"|"$/g, '');
        const csvSku = readCol(columnMap.sku);
        const purchaseRaw = readCol(columnMap.purchase);
        const sellingRaw = readCol(columnMap.selling);
        const newPurchasePrice = parsePrice(purchaseRaw);
        const newSellingPrice = parsePrice(sellingRaw);

        if (!Number.isFinite(newPurchasePrice) || !Number.isFinite(newSellingPrice)) {
          rows.push({
            sourceRow,
            id: csvId,
            name: csvName || '(Unknown)',
            sku: csvSku,
            newPurchasePrice: 0,
            newSellingPrice: 0,
            oldPurchasePrice: 0,
            oldSellingPrice: 0,
            matched: false,
            changed: false,
            status: 'invalid',
            message: 'Purchase and selling prices must be valid numbers.',
          });
          continue;
        }

        if (newPurchasePrice < 0 || newSellingPrice < 0) {
          rows.push({
            sourceRow,
            id: csvId,
            name: csvName || '(Unknown)',
            sku: csvSku,
            newPurchasePrice,
            newSellingPrice,
            oldPurchasePrice: 0,
            oldSellingPrice: 0,
            matched: false,
            changed: false,
            status: 'invalid',
            message: 'Negative prices are not allowed.',
          });
          continue;
        }

        const normalizedId = normalizeText(csvId);
        const normalizedCsvSku = normalizeSku(csvSku);
        const product = (normalizedId
          ? products.find(p => normalizeText(p.id) === normalizedId)
          : undefined) || (normalizedCsvSku
            ? products.find(p => normalizeSku(p.sku) === normalizedCsvSku)
            : undefined);

        if (!product) {
          rows.push({
            sourceRow,
            id: csvId,
            name: csvName || '(Unknown)',
            sku: csvSku,
            newPurchasePrice,
            newSellingPrice,
            oldPurchasePrice: 0,
            oldSellingPrice: 0,
            matched: false,
            changed: false,
            status: 'not_found',
            message: 'No product matched by ID or SKU.',
          });
          continue;
        }

        const changed = isDifferent3(product.unitPurchasePrice, newPurchasePrice) ||
          isDifferent3(product.sellingPrice, newSellingPrice);

        rows.push({
          sourceRow,
          id: product.id,
          name: product.name,
          sku: product.sku,
          newPurchasePrice,
          newSellingPrice,
          oldPurchasePrice: product.unitPurchasePrice,
          oldSellingPrice: product.sellingPrice,
          matched: true,
          changed,
          status: changed ? 'changed' : 'unchanged',
          productType: product.type,
          message: product.type !== 'Single' && changed
            ? 'Variable/Combo product: only base prices will be updated.'
            : '',
        });
      }

      if (rows.length === 0) {
        setParseError('No data rows found. Check your CSV content.');
        addNotification({ title: 'Parse Error', message: 'No data rows found in the uploaded CSV.', type: 'error' });
        return;
      }

      const seenProductIds = new Set<string>();
      const dedupedRows = rows.map(row => {
        if (!row.matched) return row;
        if (!seenProductIds.has(row.id)) {
          seenProductIds.add(row.id);
          return row;
        }
        return {
          ...row,
          status: 'duplicate' as RowStatus,
          message: 'Duplicate row for the same product. Keep only one row per product.',
        };
      });

      setParsedRows(dedupedRows);
      setParseError('');
      setApplied(false);

      if (!hasHeader) {
        addNotification({
          title: 'Header Not Detected',
          message: 'CSV header was not recognized. Using default column order: ID, Name, SKU, Purchase, Selling.',
          type: 'info',
        });
      }
    } catch {
      setParseError('Failed to parse file. Please use the exported CSV format.');
      setParsedRows([]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setParsedRows([]);
    setParseError('');
    setApplied(false);

    if (!selected) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      parseCSV(text || '');
    };
    reader.readAsText(selected);
  };

  // Apply Changes
  const handleApply = async () => {
    const toUpdate = parsedRows.filter(row => row.status === 'changed');
    if (toUpdate.length === 0) {
      addNotification({ title: 'No Changes', message: 'No valid price changes detected.', type: 'info' });
      return;
    }

    let updatedCount = 0;
    for (const row of toUpdate) {
      const existing = products.find(p => p.id === row.id);
      if (!existing) continue;
      const result = await updateProduct({
        ...existing,
        unitPurchasePrice: row.newPurchasePrice,
        sellingPrice: row.newSellingPrice,
      });
      if (!result.ok) continue;
      updatedCount += 1;
    }

    setApplied(true);
    addNotification({ title: 'Prices Updated', message: `${updatedCount} product(s) updated successfully.`, type: 'success' });

    const nonSingleUpdates = toUpdate.filter(row => row.productType !== 'Single').length;
    if (nonSingleUpdates > 0) {
      addNotification({
        title: 'Note',
        message: `${nonSingleUpdates} Variable/Combo product(s) were updated at base product level only.`,
        type: 'warning',
      });
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setParseError('');
    setApplied(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const changedCount = parsedRows.filter(row => row.status === 'changed').length;
  const unchangedCount = parsedRows.filter(row => row.status === 'unchanged').length;
  const notFoundCount = parsedRows.filter(row => row.status === 'not_found').length;
  const invalidCount = parsedRows.filter(row => row.status === 'invalid').length;
  const duplicateCount = parsedRows.filter(row => row.status === 'duplicate').length;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 p-6 md:p-10 text-white shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-2">
            Update <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Price</span>
          </h2>
          <p className="text-slate-400 text-base md:text-lg font-light max-w-xl">
            Bulk update product prices via CSV export / import. {products.length} products in catalog.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 md:p-8">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <Download size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Export Prices</h3>
                <p className="text-sm text-slate-500">Download current price list as CSV</p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                Downloads all <strong>{products.length}</strong> products with their current purchase and selling prices.
                Edit the file then re-upload to apply bulk changes.
              </p>
              <div className="text-xs text-slate-400 font-mono bg-white border border-slate-200 rounded-lg p-3 mb-4 overflow-x-auto whitespace-nowrap">
                ID, Product Name, SKU, Purchase Price (Exc. Tax), Selling Price (Exc. Tax)
              </div>
              <button
                onClick={handleExport}
                className="w-full py-4 bg-white border-2 border-blue-100 text-blue-600 rounded-xl font-bold hover:bg-blue-50 hover:border-blue-200 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <FileSpreadsheet size={20} />
                Export Product Prices ({products.length})
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                <Upload size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Import Changes</h3>
                <p className="text-sm text-slate-500">Upload modified price list</p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
              <label className="block text-sm font-bold text-slate-700">Select CSV File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2.5 file:px-4
                  file:rounded-xl file:border-0
                  file:text-sm file:font-bold
                  file:bg-purple-50 file:text-purple-700
                  hover:file:bg-purple-100
                  transition-all cursor-pointer"
              />
              {file && (
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200">
                  <FileSpreadsheet size={14} className="text-purple-500" />
                  <span className="font-medium truncate">{file.name}</span>
                  <span className="ml-auto text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              )}
              {parseError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                  <AlertCircle size={14} /> {parseError}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 p-6 bg-amber-50 rounded-2xl border border-amber-100">
          <div className="flex items-start gap-4">
            <Info className="text-amber-600 shrink-0 mt-1" size={22} />
            <div className="space-y-2">
              <h4 className="font-bold text-amber-900">Instructions</h4>
              <ul className="space-y-1.5 text-sm text-amber-800">
                {[
                  'Click "Export Product Prices" to download the current price list as a CSV.',
                  'Edit the Purchase Price and Selling Price columns in Excel/Google Sheets.',
                  'Keep ID and SKU columns intact for reliable matching.',
                  'Save as CSV (.csv) and upload using the file selector above.',
                  'Review per-row status/errors, then click "Apply Changes".',
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">{index + 1}</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {parsedRows.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
          <div className="px-8 py-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Import Preview</h3>
              <div className="flex flex-wrap gap-3 mt-1 text-xs font-bold">
                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{changedCount} changes</span>
                <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{unchangedCount} unchanged</span>
                {notFoundCount > 0 && <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{notFoundCount} not found</span>}
                {invalidCount > 0 && <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{invalidCount} invalid</span>}
                {duplicateCount > 0 && <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{duplicateCount} duplicate</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
              >
                <X size={14} /> Clear
              </button>
              {!applied && changedCount > 0 && (
                <button
                  onClick={handleApply}
                  className="flex items-center gap-1.5 px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-900/20"
                >
                  <CheckCircle2 size={14} /> Apply {changedCount} Change{changedCount !== 1 ? 's' : ''}
                </button>
              )}
              {applied && (
                <span className="flex items-center gap-1.5 px-6 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm border border-emerald-200">
                  <CheckCircle2 size={14} /> Applied
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Row</th>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3">SKU</th>
                  <th className="px-6 py-3 text-center">Old Purchase</th>
                  <th className="px-6 py-3 text-center">New Purchase</th>
                  <th className="px-6 py-3 text-center">Old Selling</th>
                  <th className="px-6 py-3 text-center">New Selling</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.map((row, index) => {
                  const rowBg =
                    row.status === 'changed' ? 'bg-emerald-50/30' :
                      row.status === 'unchanged' ? '' :
                        row.status === 'duplicate' ? 'bg-amber-50/40' : 'bg-red-50/40';

                  return (
                    <tr key={`${row.sourceRow}-${row.id || row.sku || index}`} className={`transition-colors ${rowBg}`}>
                      <td className="px-6 py-3 font-mono text-xs text-slate-500">#{row.sourceRow}</td>
                      <td className="px-6 py-3">
                        <span className="font-medium text-slate-800 text-sm">{row.name || '(Unknown)'}</span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="font-mono text-xs text-slate-500">{row.sku || '--'}</span>
                      </td>
                      <td className="px-6 py-3 text-center text-slate-500 font-mono text-xs">
                        {row.matched ? fmt(row.oldPurchasePrice) : '--'}
                      </td>
                      <td className="px-6 py-3 text-center font-mono text-xs">
                        {row.status === 'invalid' ? '--' : (
                          <>
                            <span className={row.matched && isDifferent3(row.newPurchasePrice, row.oldPurchasePrice) ? 'font-bold text-slate-900' : 'text-slate-500'}>
                              {fmt(row.newPurchasePrice)}
                            </span>
                            {row.matched && <div>{diff(row.oldPurchasePrice, row.newPurchasePrice)}</div>}
                          </>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center text-slate-500 font-mono text-xs">
                        {row.matched ? fmt(row.oldSellingPrice) : '--'}
                      </td>
                      <td className="px-6 py-3 text-center font-mono text-xs">
                        {row.status === 'invalid' ? '--' : (
                          <>
                            <span className={row.matched && isDifferent3(row.newSellingPrice, row.oldSellingPrice) ? 'font-bold text-slate-900' : 'text-slate-500'}>
                              {fmt(row.newSellingPrice)}
                            </span>
                            {row.matched && <div>{diff(row.oldSellingPrice, row.newSellingPrice)}</div>}
                          </>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center">{statusBadge(row.status)}</td>
                      <td className="px-6 py-3 text-xs text-slate-500">{row.message || '--'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdatePrice;
