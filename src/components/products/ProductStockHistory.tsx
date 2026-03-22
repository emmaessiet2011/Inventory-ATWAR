import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  FileText,
  FileSpreadsheet,
  Printer,
  Columns,
  ChevronDown,
  Search,
  Download
} from 'lucide-react';
import { Product, useGlobalContext } from '@/context/GlobalContext';
import { printDocument } from '@/utils/printUtils';

interface ProductStockHistoryProps {
  isOpen?: boolean;
  onClose?: () => void;
  product: Product | null;
  pageMode?: boolean;
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

interface HistoryRow {
  id: string;
  type: string;
  change: number;
  newQty?: number;
  date: string;
  ref: string;
  party: string;
  location?: string;
  note?: string;
}

type ColKey = 'type' | 'change' | 'newQty' | 'date' | 'ref' | 'party' | 'location' | 'note';

const STOCK_LEDGER_KEY = 'app_product_stock_ledger_v1';

const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase();

const readStockLedger = (): StockLedgerEntry[] => {
  try {
    const raw = localStorage.getItem(STOCK_LEDGER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const toCsvCell = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;

const formatDateTime = (value: string): string => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d
    .toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    .replace(',', '');
};

const ProductStockHistory: React.FC<ProductStockHistoryProps> = ({ isOpen = true, onClose, product, pageMode = false }) => {
  const { sales, sellReturns, purchases, purchaseReturns, locations, settings, currentUser } = useGlobalContext();
  const visible = pageMode ? !!product : (isOpen && !!product);
  const handleClose = () => {
    onClose?.();
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [showColMenu, setShowColMenu] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<ColKey[]>(['location', 'note']);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const productId = String(product?.id || '').trim();
  const productSku = String(product?.sku || 'product').trim() || 'product';
  const productName = String(product?.name || '').trim();
  const productLocation = String(product?.businessLocation || '').trim();

  const rows = useMemo<HistoryRow[]>(() => {
    if (!product) return [];

    const normalizedProductId = normalize(productId);
    const normalizedProductSku = normalize(productSku);
    const normalizedProductName = normalize(productName);
    const matchesProduct = (itemId: unknown, itemName: unknown) => {
      const normalizedItemId = normalize(itemId);
      if (normalizedItemId) {
        if (normalizedItemId === normalizedProductId || normalizedItemId === normalizedProductSku) return true;
      }
      const normalizedItemName = normalize(itemName);
      return !!normalizedItemName && normalizedItemName === normalizedProductName;
    };
    const toTimestamp = (value: string) => {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const ledgerRows = readStockLedger()
      .filter(r => r.productId === productId)
      .map(r => ({
        id: r.id,
        type: r.type,
        change: Number(r.change) || 0,
        newQty: Number(r.newQty),
        date: r.date,
        ref: r.ref,
        party: r.party,
        location: r.location,
        note: r.note,
      }));

    const saleRows: HistoryRow[] = sales
      .filter(s => (s.status || s.saleStatus) === 'Final')
      .flatMap((sale) =>
        (sale.items || [])
          .filter(item => matchesProduct(item.id, item.name))
          .map((item, idx) => ({
            id: `SALE-${sale.id}-${idx}`,
            type: 'Sell',
            change: -(Number(item.qty) || 0),
            date: sale.date || '',
            ref: sale.invoiceNo || sale.id,
            party: sale.customerName || String(sale.customerId),
            location: sale.location || productLocation,
            note: sale.sellNote || '',
          }))
      );

    const sellReturnRows: HistoryRow[] = sellReturns.flatMap((sellReturn) =>
      (sellReturn.items || [])
        .filter(item => matchesProduct(item.productId, item.productName))
        .map((item, idx) => ({
          id: `SRET-${sellReturn.id}-${idx}`,
          type: 'Sell Return',
          change: Number(item.qty) || 0,
          date: sellReturn.date || '',
          ref: sellReturn.referenceNo || sellReturn.id,
          party: sellReturn.customerName || String(sellReturn.customerId || ''),
          location: sellReturn.location || productLocation,
          note: sellReturn.note || '',
        }))
    );

    const purchaseRows: HistoryRow[] = purchases
      .filter(purchase => purchase.status === 'Received')
      .flatMap((purchase) =>
        (purchase.items || [])
          .filter(item => matchesProduct(item.id, item.name))
          .map((item, idx) => ({
            id: `PUR-${purchase.id}-${idx}`,
            type: 'Purchase',
            change: Number(item.qty) || 0,
            date: purchase.date || '',
            ref: purchase.refNo || purchase.id,
            party: purchase.supplier || '',
            location: purchase.location || productLocation,
            note: purchase.notes || purchase.shippingDetails || '',
          }))
      );

    const purchaseReturnRows: HistoryRow[] = purchaseReturns.flatMap((purchaseReturn) =>
      (purchaseReturn.items || [])
        .filter(item => matchesProduct(item.productId, item.productName))
        .map((item, idx) => ({
          id: `PRET-${purchaseReturn.id}-${idx}`,
          type: 'Purchase Return',
          change: -(Number(item.quantity) || 0),
          date: purchaseReturn.date || '',
          ref: purchaseReturn.referenceNo || purchaseReturn.id,
          party: purchaseReturn.supplierName || '',
          location: purchaseReturn.location || productLocation,
          note: '',
        }))
    );

    return [...ledgerRows, ...purchaseRows, ...purchaseReturnRows, ...saleRows, ...sellReturnRows]
      .sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date));
  }, [product, productId, productSku, productName, productLocation, sales, sellReturns, purchases, purchaseReturns]);

  const filteredRows = useMemo(() => {
    const q = normalize(searchTerm);
    return rows.filter((r) => {
      if (selectedLocation !== 'all' && (r.location || '') !== selectedLocation) return false;
      if (!q) return true;
      const hay = [r.type, r.ref, r.party, r.note, r.location].map(normalize);
      return hay.some(v => v.includes(q));
    });
  }, [rows, searchTerm, selectedLocation]);

  const totals = useMemo(() => filteredRows.reduce((acc, row) => {
    if (row.change > 0) acc.in += row.change;
    if (row.change < 0) acc.out += Math.abs(row.change);
    return acc;
  }, { in: 0, out: 0 }), [filteredRows]);

  const movementSummary = useMemo(() => (
    filteredRows.reduce((acc, row) => {
      const rowType = normalize(row.type);
      const qty = Math.abs(Number(row.change) || 0);
      if (!qty) return acc;

      if (rowType === 'purchase') acc.totalPurchase += qty;
      if (rowType === 'opening stock' || rowType === 'opening stock import') acc.openingStock += qty;
      if (rowType === 'sell return') acc.totalSellReturn += qty;
      if (rowType === 'stock transfer in' || rowType === 'stock transfer reversal in') acc.stockTransferIn += qty;

      if (rowType === 'sell') acc.totalSold += qty;
      if (rowType === 'stock adjustment' && Number(row.change) < 0) acc.totalStockAdjustment += qty;
      if (rowType === 'purchase return') acc.totalPurchaseReturn += qty;
      if (rowType === 'stock transfer out' || rowType === 'stock transfer reversal out') acc.stockTransferOut += qty;

      return acc;
    }, {
      totalPurchase: 0,
      openingStock: 0,
      totalSellReturn: 0,
      stockTransferIn: 0,
      totalSold: 0,
      totalStockAdjustment: 0,
      totalPurchaseReturn: 0,
      stockTransferOut: 0,
    })
  ), [filteredRows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedLocation, rowsPerPage]);

  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * rowsPerPage;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);
  const showingStart = totalRows === 0 ? 0 : startIndex + 1;
  const showingEnd = totalRows === 0 ? 0 : startIndex + paginatedRows.length;

  const toggleCol = (col: ColKey) => {
    setHiddenCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const exportCSV = () => {
    const headers = ['Type', 'Change', 'New Qty', 'Date', 'Reference', 'Party', 'Location', 'Note'];
    const lines = filteredRows.map(r => [
      toCsvCell(r.type),
      toCsvCell(r.change.toFixed(3)),
      toCsvCell(r.newQty != null ? r.newQty.toFixed(3) : '--'),
      toCsvCell(formatDateTime(r.date)),
      toCsvCell(r.ref),
      toCsvCell(r.party),
      toCsvCell(r.location || ''),
      toCsvCell(r.note || ''),
    ].join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-stock-history-${productSku}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const headers = ['Type', 'Change', 'New Qty', 'Date', 'Reference', 'Party', 'Location', 'Note'];
    const lines = filteredRows.map(r => [
      r.type,
      r.change.toFixed(3),
      r.newQty != null ? r.newQty.toFixed(3) : '--',
      formatDateTime(r.date),
      r.ref,
      r.party,
      r.location || '',
      r.note || '',
    ].join('\t'));
    const tsv = [headers.join('\t'), ...lines].join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-stock-history-${productSku}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintHistory = () => {
    printDocument({
      title: 'Product Stock History',
      subtitle: `Product: ${productName} (${productSku})${selectedLocation === 'all' ? '' : ` | Location: ${selectedLocation}`}`,
      businessName: settings?.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings?.address || '',
      printedBy: currentUser?.name || '',
      columns: [
        { label: 'Type', width: '90px' },
        { label: 'Quantity Change', width: '95px', align: 'right' },
        { label: 'New Quantity', width: '95px', align: 'right' },
        { label: 'Date', width: '95px' },
        { label: 'Reference No', width: '110px' },
        { label: 'Customer/Supplier Information' },
      ],
      rows: filteredRows.map((row) => [
        row.type || '--',
        Number(row.change || 0).toFixed(3),
        row.newQty != null ? Number(row.newQty).toFixed(3) : '--',
        formatDateTime(row.date),
        row.ref || '--',
        row.party || '--',
      ]),
      stats: [
        { label: 'Total Rows', value: String(filteredRows.length), color: 'blue' },
        { label: 'Qty In', value: `${totals.in.toFixed(3)} ${product.unit || ''}`.trim(), color: 'green' },
        { label: 'Qty Out', value: `${totals.out.toFixed(3)} ${product.unit || ''}`.trim(), color: 'rose' },
        { label: 'Current Stock', value: `${Number(product.stock || 0).toFixed(3)} ${product.unit || ''}`.trim(), color: 'slate' },
      ],
    });
  };

  if (!visible || !product) return null;

  return (
    <div className={pageMode ? 'space-y-4 animate-fade-in pb-20' : 'fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm p-3'}>
      <div className={`${pageMode ? 'bg-slate-100 w-full rounded-xl border border-slate-300 shadow-sm overflow-hidden flex flex-col min-h-[calc(100vh-10rem)]' : 'bg-slate-100 w-full h-full rounded-xl border border-slate-300 shadow-xl overflow-hidden flex flex-col'}`}>
        <div className="px-4 py-3 border-b border-slate-300 bg-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Product stock history</h3>
          <button onClick={handleClose} className="text-slate-500 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="p-3 overflow-auto space-y-3 text-[11px]">
          <div className="rounded border border-slate-300 bg-slate-100 p-3 space-y-2">
            <div className="font-medium text-slate-700">{productName} ({productSku})</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 font-semibold text-slate-700">Product:</label>
                <select className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded" value={productId} disabled>
                  <option value={productId}>{productName} - {productSku}</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 font-semibold text-slate-700">Business Location:</label>
                <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded">
                  <option value="all">All locations</option>
                  {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-300 bg-slate-100 p-3">
            <div className="font-medium text-slate-700 mb-2">{productName} ({productSku})</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <div className="font-semibold text-slate-700">Quantities In</div>
                <div className="flex justify-between"><span>Total Purchase</span><span>{movementSummary.totalPurchase.toFixed(3)} {product.unit}</span></div>
                <div className="flex justify-between"><span>Opening Stock</span><span>{movementSummary.openingStock.toFixed(3)} {product.unit}</span></div>
                <div className="flex justify-between"><span>Total Sell Return</span><span>{movementSummary.totalSellReturn.toFixed(3)} {product.unit}</span></div>
                <div className="flex justify-between"><span>Stock Transfers (In)</span><span>{movementSummary.stockTransferIn.toFixed(3)} {product.unit}</span></div>
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-slate-700">Quantities Out</div>
                <div className="flex justify-between"><span>Total Sold</span><span>{movementSummary.totalSold.toFixed(3)} {product.unit}</span></div>
                <div className="flex justify-between"><span>Total Stock Adjustment</span><span>{movementSummary.totalStockAdjustment.toFixed(3)} {product.unit}</span></div>
                <div className="flex justify-between"><span>Total Purchase Return</span><span>{movementSummary.totalPurchaseReturn.toFixed(3)} {product.unit}</span></div>
                <div className="flex justify-between"><span>Stock Transfers (Out)</span><span>{movementSummary.stockTransferOut.toFixed(3)} {product.unit}</span></div>
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-slate-700">Totals</div>
                <div className="flex justify-between font-bold"><span>Current stock</span><span>{Number(product.stock || 0).toFixed(3)} {product.unit}</span></div>
                <div className="flex justify-between"><span>Qty In</span><span>{totals.in.toFixed(3)} {product.unit}</span></div>
                <div className="flex justify-between"><span>Qty Out</span><span>{totals.out.toFixed(3)} {product.unit}</span></div>
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-300 bg-white overflow-hidden">
            <div className="p-2 border-b border-slate-200 flex flex-col lg:flex-row gap-2 lg:items-center lg:justify-between print:hidden">
              <div className="flex items-center gap-2">
                <span>Show</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(Number(e.target.value) || 25)}
                  className="px-2 py-1 border border-slate-300 rounded bg-white"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>entries</span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <button onClick={exportCSV} className="px-2 py-1 border border-slate-300 rounded text-[10px] font-semibold flex items-center gap-1"><FileText size={10} /> Export CSV</button>
                <button onClick={exportExcel} className="px-2 py-1 border border-slate-300 rounded text-[10px] font-semibold flex items-center gap-1"><FileSpreadsheet size={10} /> Export Excel</button>
                <button onClick={handlePrintHistory} className="px-2 py-1 border border-slate-300 rounded text-[10px] font-semibold flex items-center gap-1"><Printer size={10} /> Print</button>
                <button onClick={() => setShowColMenu(v => !v)} className="px-2 py-1 border border-slate-300 rounded text-[10px] font-semibold flex items-center gap-1"><Columns size={10} /> Column visibility <ChevronDown size={10} /></button>
                <button onClick={handlePrintHistory} className="px-2 py-1 border border-slate-300 rounded text-[10px] font-semibold flex items-center gap-1"><Download size={10} /> Export PDF</button>
              </div>
              <div className="relative w-full lg:w-56">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-7 pr-2 py-1 border border-slate-300 rounded text-[11px]" placeholder="Search..." />
              </div>
            </div>

            {showColMenu && (
              <div className="p-2 border-b border-slate-200 bg-slate-50 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] print:hidden">
                {([
                  { key: 'type', label: 'Type' },
                  { key: 'change', label: 'Quantity change' },
                  { key: 'newQty', label: 'New Quantity' },
                  { key: 'date', label: 'Date' },
                  { key: 'ref', label: 'Reference No' },
                  { key: 'party', label: 'Customer/Supplier information' },
                  { key: 'location', label: 'Location' },
                  { key: 'note', label: 'Note' },
                ] as { key: ColKey; label: string }[]).map(col => (
                  <label key={col.key} className="flex items-center gap-1">
                    <input type="checkbox" checked={!hiddenCols.includes(col.key)} onChange={() => toggleCol(col.key)} />
                    {col.label}
                  </label>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-[11px]">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr>
                    {!hiddenCols.includes('type') && <th className="px-3 py-2 text-left font-semibold">Type</th>}
                    {!hiddenCols.includes('change') && <th className="px-3 py-2 text-left font-semibold">Quantity change</th>}
                    {!hiddenCols.includes('newQty') && <th className="px-3 py-2 text-left font-semibold">New Quantity</th>}
                    {!hiddenCols.includes('date') && <th className="px-3 py-2 text-left font-semibold">Date</th>}
                    {!hiddenCols.includes('ref') && <th className="px-3 py-2 text-left font-semibold">Reference No</th>}
                    {!hiddenCols.includes('party') && <th className="px-3 py-2 text-left font-semibold">Customer/Supplier information</th>}
                    {!hiddenCols.includes('location') && <th className="px-3 py-2 text-left font-semibold">Location</th>}
                    {!hiddenCols.includes('note') && <th className="px-3 py-2 text-left font-semibold">Note</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map(row => (
                    <tr key={row.id} className="border-b border-slate-100">
                      {!hiddenCols.includes('type') && <td className="px-3 py-1.5">{row.type}</td>}
                      {!hiddenCols.includes('change') && <td className={`px-3 py-1.5 font-bold ${row.change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{row.change.toFixed(3)}</td>}
                      {!hiddenCols.includes('newQty') && <td className="px-3 py-1.5">{row.newQty != null ? row.newQty.toFixed(3) : '--'}</td>}
                      {!hiddenCols.includes('date') && <td className="px-3 py-1.5">{formatDateTime(row.date)}</td>}
                      {!hiddenCols.includes('ref') && <td className="px-3 py-1.5 font-mono">{row.ref}</td>}
                      {!hiddenCols.includes('party') && <td className="px-3 py-1.5">{row.party || '--'}</td>}
                      {!hiddenCols.includes('location') && <td className="px-3 py-1.5">{row.location || '--'}</td>}
                      {!hiddenCols.includes('note') && <td className="px-3 py-1.5">{row.note || '--'}</td>}
                    </tr>
                  ))}
                  {paginatedRows.length === 0 && (
                    <tr>
                      <td className="px-3 py-8 text-center text-slate-400 italic" colSpan={8}>No stock history rows found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-2 border-t border-slate-200 flex items-center justify-between text-[11px] print:hidden">
              <div>Showing {showingStart} to {showingEnd} of {totalRows} entries</div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="px-2 py-1 border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-2 py-1 bg-blue-600 text-white rounded">{safeCurrentPage}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="px-2 py-1 border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductStockHistory;
