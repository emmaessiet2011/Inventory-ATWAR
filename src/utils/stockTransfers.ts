import { Product } from '../context/GlobalContext';
import {
  syncDedicatedStrict,
  deleteDedicatedStrict,
  fetchDedicated,
} from './apiClient';

export type StockTransferStatus = 'Pending' | 'In Transit' | 'Completed';

export interface StockTransferItem {
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  unit?: string;
  unitCost?: number;
}

export interface StockTransferRecord {
  id: string;
  date: string;
  refNo: string;
  locationFrom: string;
  locationTo: string;
  status: StockTransferStatus;
  shippingCharges: number;
  totalAmount: number;
  notes: string;
  items: StockTransferItem[];
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockLedgerEntry {
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

export interface StockTransferSimulationResult {
  productsAfter: Product[];
  ledgerEntries: StockLedgerEntry[];
}

export interface StockLedgerAppendResult {
  ok: boolean;
  status: number;
  error?: string;
  failedEntryId?: string;
}

const STOCK_TRANSFERS_UPDATED_EVENT = 'app:stock-transfers-updated';
const STOCK_LEDGER_UPDATED_EVENT = 'app:stock-ledger-updated';

const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();
const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const toIsoDate = (value: string): string => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
};
const skuLocationKey = (sku: unknown, location: unknown): string => `${normalize(sku)}@@${normalize(location)}`;

let stockTransfersCache: StockTransferRecord[] = [];
let stockLedgerCache: StockLedgerEntry[] = [];

const notify = (eventName: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(eventName));
};

const normalizeTransferRows = (raw: unknown): StockTransferRecord[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const items = Array.isArray((row as any)?.items)
        ? (row as any).items
            .map((item: any) => ({
              productId: String(item?.productId || ''),
              productName: String(item?.productName || ''),
              sku: String(item?.sku || ''),
              qty: round3(Number(item?.qty || 0)),
              unit: String(item?.unit || ''),
              unitCost: round3(Number(item?.unitCost || 0)),
            }))
            .filter((item: StockTransferItem) => item.qty > 0 && item.productId)
        : [];
      return {
        id: String((row as any)?.id || ''),
        date: String((row as any)?.date || ''),
        refNo: String((row as any)?.refNo || ''),
        locationFrom: String((row as any)?.locationFrom || ''),
        locationTo: String((row as any)?.locationTo || ''),
        status: (String((row as any)?.status || 'Pending') as StockTransferStatus),
        shippingCharges: round3(Number((row as any)?.shippingCharges || 0)),
        totalAmount: round3(Number((row as any)?.totalAmount || 0)),
        notes: String((row as any)?.notes || ''),
        items,
        addedBy: String((row as any)?.addedBy || 'System'),
        createdAt: String((row as any)?.createdAt || ''),
        updatedAt: String((row as any)?.updatedAt || ''),
      } as StockTransferRecord;
    })
    .filter((row: StockTransferRecord) => row.id);
};

const normalizeLedgerRows = (raw: unknown): StockLedgerEntry[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry: any) => ({
      id: String(entry?.id || ''),
      productId: String(entry?.productId || ''),
      type: String(entry?.type || ''),
      change: round3(Number(entry?.change || 0)),
      newQty: round3(Number(entry?.newQty || 0)),
      date: String(entry?.date || ''),
      ref: String(entry?.ref || ''),
      party: String(entry?.party || ''),
      location: String(entry?.location || ''),
      note: String(entry?.note || ''),
    }))
    .filter((entry: StockLedgerEntry) => entry.id && entry.productId);
};

export const readStockTransfers = (): StockTransferRecord[] => {
  return stockTransfersCache.map((row) => ({ ...row, items: [...(row.items || [])] }));
};

export const fetchStockTransfersFromDB = async (): Promise<StockTransferRecord[]> => {
  const remoteTransfers = await fetchDedicated<StockTransferRecord>('/api/sync/stock-transfers');
  stockTransfersCache = remoteTransfers ? normalizeTransferRows(remoteTransfers) : [];
  return readStockTransfers();
};

export const writeStockTransfers = async (
  rows: StockTransferRecord[],
  changedId?: string,
  deletedId?: string,
): Promise<boolean> => {
  const normalizedRows = normalizeTransferRows(rows);
  if (deletedId) {
    const deleted = await deleteDedicatedStrict('/api/sync/stock-transfers', deletedId);
    if (!deleted.ok) return false;
  } else if (changedId) {
    const record = normalizedRows.find((r) => r.id === changedId);
    if (record) {
      const saved = await syncDedicatedStrict('/api/sync/stock-transfers', record.id, record);
      if (!saved.ok) return false;
    }
  } else {
    for (const record of normalizedRows) {
      const saved = await syncDedicatedStrict('/api/sync/stock-transfers', record.id, record);
      if (!saved.ok) return false;
    }
  }
  stockTransfersCache = normalizedRows;
  notify(STOCK_TRANSFERS_UPDATED_EVENT);
  return true;
};

export const readStockLedger = (): StockLedgerEntry[] => {
  return stockLedgerCache.map((entry) => ({ ...entry }));
};

export const fetchStockLedgerFromDB = async (): Promise<StockLedgerEntry[]> => {
  const remoteLedger = await fetchDedicated<StockLedgerEntry>('/api/sync/stock-ledger');
  stockLedgerCache = remoteLedger ? normalizeLedgerRows(remoteLedger) : [];
  return readStockLedger();
};

const extractSyncError = (raw?: string): string => {
  const text = String(raw || '').trim();
  if (!text) return 'Unknown Postgres sync error.';
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && parsed.error) {
      return String(parsed.error);
    }
  } catch {
    // Keep original text when body is not JSON.
  }
  return text;
};

export const appendStockLedgerEntriesStrict = async (
  entries: StockLedgerEntry[],
): Promise<StockLedgerAppendResult> => {
  if (entries.length === 0) return { ok: true, status: 200 };
  const normalizedEntries = normalizeLedgerRows(entries);
  for (const entry of normalizedEntries) {
    const saved = await syncDedicatedStrict('/api/sync/stock-ledger', entry.id, entry);
    if (!saved.ok) {
      return {
        ok: false,
        status: saved.status,
        error: extractSyncError(saved.error),
        failedEntryId: entry.id,
      };
    }
  }
  const next = [...readStockLedger(), ...normalizedEntries];
  stockLedgerCache = normalizeLedgerRows(next);
  notify(STOCK_LEDGER_UPDATED_EVENT);
  return { ok: true, status: 200 };
};

export const appendStockLedgerEntries = async (entries: StockLedgerEntry[]): Promise<boolean> => {
  const result = await appendStockLedgerEntriesStrict(entries);
  return result.ok;
};

/**
 * Bootstrap stock transfer + stock ledger state from DB.
 * If DB returns empty arrays, local cache is explicitly cleared to avoid stale browser-only data.
 */
export const bootstrapStockTransfersFromDB = async (): Promise<void> => {
  await Promise.all([
    fetchStockTransfersFromDB(),
    fetchStockLedgerFromDB(),
  ]);
};

export const makeNextStockTransferRef = (prefix: string, rows: StockTransferRecord[]) => {
  const normalizedPrefix = String(prefix || 'ST').trim() || 'ST';
  const re = new RegExp(`^${normalizedPrefix}-?(\\d+)$`, 'i');
  const next = rows.reduce((max, row) => {
    const m = String(row.refNo || '').trim().match(re);
    if (!m) return max;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0) + 1;
  return `${normalizedPrefix}-${String(next).padStart(4, '0')}`;
};

interface SimulateParams {
  transfer: StockTransferRecord;
  direction: 1 | -1;
  products: Product[];
  generateId: (prefix: string) => string;
  actorName: string;
  notePrefix?: string;
}

export const simulateStockTransfer = ({
  transfer,
  direction,
  products,
  generateId,
  actorName,
  notePrefix,
}: SimulateParams): StockTransferSimulationResult => {
  const productById = new Map<string, Product>();
  const skuLocToId = new Map<string, string>();
  const originalIds = products.map((p) => p.id);

  products.forEach((product) => {
    productById.set(product.id, { ...product });
    skuLocToId.set(skuLocationKey(product.sku, product.businessLocation), product.id);
  });

  const transferDate = toIsoDate(transfer.date);
  const now = Date.now();
  const ledgerEntries: StockLedgerEntry[] = [];
  let ledgerSeq = 0;

  const getSourceProduct = (item: StockTransferItem): Product => {
    const idMatch = item.productId ? productById.get(item.productId) : undefined;
    if (idMatch && normalize(idMatch.businessLocation) === normalize(transfer.locationFrom)) return idMatch;
    const fallbackId = skuLocToId.get(skuLocationKey(item.sku, transfer.locationFrom));
    if (fallbackId) {
      const fallback = productById.get(fallbackId);
      if (fallback) return fallback;
    }
    throw new Error(`Source product not found for SKU "${item.sku}" at "${transfer.locationFrom}".`);
  };

  const getTargetProduct = (item: StockTransferItem): Product => {
    const key = skuLocationKey(item.sku, transfer.locationTo);
    const targetId = skuLocToId.get(key);
    if (targetId) {
      const target = productById.get(targetId);
      if (target) return target;
    }
    throw new Error(
      `Target product not found for SKU "${item.sku}" at "${transfer.locationTo}". ` +
      'Transfer can only move stock to a destination where the product already exists.',
    );
  };

  (transfer.items || []).forEach((item, index) => {
    const qty = round3(Number(item.qty || 0));
    if (!qty) return;
    const source = getSourceProduct(item);
    const deltaOut = round3(-qty * direction);
    const sourceNext = round3(Number(source.stock || 0) + deltaOut);
    if (sourceNext < -0.0001) {
      throw new Error(`Insufficient stock for "${source.name}" at "${transfer.locationFrom}".`);
    }
    source.stock = Math.max(0, sourceNext);

    const target = getTargetProduct(item);
    const deltaIn = round3(qty * direction);
    const targetNext = round3(Number(target.stock || 0) + deltaIn);
    if (targetNext < -0.0001) {
      throw new Error(`Insufficient stock at target "${transfer.locationTo}" for SKU "${item.sku}".`);
    }
    target.stock = Math.max(0, targetNext);

    const transferNote = `${notePrefix ? `${notePrefix}: ` : ''}${transfer.locationFrom} -> ${transfer.locationTo}`;
    const outType = deltaOut < 0 ? 'Stock Transfer Out' : 'Stock Transfer Reversal In';
    const inType = deltaIn > 0 ? 'Stock Transfer In' : 'Stock Transfer Reversal Out';
    ledgerEntries.push({
      id: `STK-TR-${now}-${index}-${ledgerSeq += 1}`,
      productId: source.id,
      type: outType,
      change: deltaOut,
      newQty: source.stock,
      date: transferDate,
      ref: transfer.refNo,
      party: actorName || 'System',
      location: transfer.locationFrom,
      note: transferNote,
    });
    ledgerEntries.push({
      id: `STK-TR-${now}-${index}-${ledgerSeq += 1}`,
      productId: target.id,
      type: inType,
      change: deltaIn,
      newQty: target.stock,
      date: transferDate,
      ref: transfer.refNo,
      party: actorName || 'System',
      location: transfer.locationTo,
      note: transferNote,
    });
  });

  const productsAfter: Product[] = [
    ...originalIds
      .map((id) => productById.get(id))
      .filter((product): product is Product => !!product),
  ];

  return { productsAfter, ledgerEntries };
};

