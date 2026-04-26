import {
  syncDedicatedStrict,
  deleteDedicatedStrict,
  fetchDedicated,
} from './apiClient';

export interface StockLotBalance {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  location: string;
  lotNumber: string;
  expiryDate: string;
  unit: string;
  unitCost: number;
  qty: number;
  updatedAt: string;
}

export interface StockLotAdjustment {
  productId: string;
  productName?: string;
  sku?: string;
  location: string;
  lotNumber?: string;
  expiryDate?: string;
  unit?: string;
  unitCost?: number;
  qtyChange: number;
  updatedAt?: string;
}

const STOCK_LOTS_UPDATED_EVENT = 'app:stock-lots-updated';

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const round3 = (value: number) => Math.round(value * 1000) / 1000;

let stockLotsCache: StockLotBalance[] = [];

const notify = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(STOCK_LOTS_UPDATED_EVENT));
};

const normalizeExpiryDate = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]) - 1;
    const d = Number(iso[3]);
    const dt = new Date(y, m, d);
    if (dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }
    return '';
  }

  const us = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  if (us) {
    const month = Number(us[1]);
    const day = Number(us[2]);
    const year = Number(us[3]);
    const dt = new Date(year, month - 1, day);
    if (dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return '';
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const lotKey = (productId: string, location: string, lotNumber: string, expiryDate: string): string =>
  `${normalize(productId)}@@${normalize(location)}@@${normalize(lotNumber || '--')}@@${normalize(expiryDate)}`;

const parseRows = (raw: unknown): StockLotBalance[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const qty = round3(Number((row as any)?.qty || 0));
      if (!Number.isFinite(qty) || qty <= 0) return null;
      const productId = String((row as any)?.productId || '').trim();
      const location = String((row as any)?.location || '').trim();
      if (!productId || !location) return null;

      const expiryDate = normalizeExpiryDate((row as any)?.expiryDate);
      return {
        id: String((row as any)?.id || lotKey(productId, location, String((row as any)?.lotNumber || '--'), expiryDate)),
        productId,
        productName: String((row as any)?.productName || ''),
        sku: String((row as any)?.sku || ''),
        location,
        lotNumber: String((row as any)?.lotNumber || '--').trim() || '--',
        expiryDate,
        unit: String((row as any)?.unit || ''),
        unitCost: round3(Number((row as any)?.unitCost || 0)),
        qty,
        updatedAt: String((row as any)?.updatedAt || new Date().toISOString()),
      } as StockLotBalance;
    })
    .filter((row): row is StockLotBalance => !!row);
};

export const readStockLotBalances = (): StockLotBalance[] => {
  return stockLotsCache.map((row) => ({ ...row }));
};

export const fetchStockLotsFromDB = async (): Promise<StockLotBalance[]> => {
  const remoteLots = await fetchDedicated<StockLotBalance>('/api/sync/stock-lots');
  stockLotsCache = remoteLots ? parseRows(remoteLots) : [];
  return readStockLotBalances();
};

export const writeStockLotBalances = async (
  rows: StockLotBalance[],
  prevRows?: StockLotBalance[],
): Promise<boolean> => {
  const normalizedRows = parseRows(rows);
  // Sync changed/added rows first
  for (const row of normalizedRows) {
    const saved = await syncDedicatedStrict('/api/sync/stock-lots', row.id, row);
    if (!saved.ok) return false;
  }
  // Delete rows that were removed
  if (prevRows) {
    const nextIds = new Set(normalizedRows.map((row) => row.id));
    for (const previous of prevRows) {
      if (nextIds.has(previous.id)) continue;
      const deleted = await deleteDedicatedStrict('/api/sync/stock-lots', previous.id);
      if (!deleted.ok) return false;
    }
  }
  stockLotsCache = normalizedRows;
  notify();
  return true;
};

/**
 * Bootstrap stock lot balances from DB.
 * Empty DB responses clear local cache so DB remains the source of truth.
 */
export const bootstrapStockLotsFromDB = async (): Promise<void> => {
  await fetchStockLotsFromDB();
};

const compareExpiryAsc = (left: string, right: string): number => {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
};

export const applyStockLotAdjustments = async (
  adjustments: StockLotAdjustment[],
): Promise<boolean> => {
  if (!Array.isArray(adjustments) || adjustments.length === 0) return true;

  const existing = readStockLotBalances();
  const map = new Map<string, StockLotBalance>();
  existing.forEach((row) => {
    map.set(lotKey(row.productId, row.location, row.lotNumber, row.expiryDate), { ...row });
  });

  adjustments.forEach((adj) => {
    const productId = String(adj.productId || '').trim();
    const location = String(adj.location || '').trim();
    const qtyChange = round3(Number(adj.qtyChange || 0));
    if (!productId || !location || !qtyChange) return;

    const lotNumber = String(adj.lotNumber || '').trim() || '--';
    const expiryDate = normalizeExpiryDate(adj.expiryDate);
    const nowIso = String(adj.updatedAt || new Date().toISOString());

    if (qtyChange > 0) {
      const key = lotKey(productId, location, lotNumber, expiryDate);
      const existingRow = map.get(key);
      const nextQty = round3((existingRow?.qty || 0) + qtyChange);
      map.set(key, {
        id: existingRow?.id || key,
        productId,
        productName: String(adj.productName || existingRow?.productName || ''),
        sku: String(adj.sku || existingRow?.sku || ''),
        location,
        lotNumber,
        expiryDate,
        unit: String(adj.unit || existingRow?.unit || ''),
        unitCost: round3(Number(adj.unitCost ?? existingRow?.unitCost ?? 0)),
        qty: nextQty,
        updatedAt: nowIso,
      });
      return;
    }

    let toConsume = Math.abs(qtyChange);
    const candidates = Array.from(map.values())
      .filter((row) => normalize(row.productId) === normalize(productId) && normalize(row.location) === normalize(location) && row.qty > 0)
      .sort((a, b) => {
        const aExact = (expiryDate && normalize(a.expiryDate) === normalize(expiryDate) ? 1 : 0)
          + (lotNumber !== '--' && normalize(a.lotNumber) === normalize(lotNumber) ? 1 : 0);
        const bExact = (expiryDate && normalize(b.expiryDate) === normalize(expiryDate) ? 1 : 0)
          + (lotNumber !== '--' && normalize(b.lotNumber) === normalize(lotNumber) ? 1 : 0);
        if (aExact !== bExact) return bExact - aExact;
        const expiryCompare = compareExpiryAsc(a.expiryDate, b.expiryDate);
        if (expiryCompare !== 0) return expiryCompare;
        return normalize(a.lotNumber).localeCompare(normalize(b.lotNumber));
      });

    candidates.forEach((row) => {
      if (toConsume <= 0) return;
      const key = lotKey(row.productId, row.location, row.lotNumber, row.expiryDate);
      const current = map.get(key);
      if (!current || current.qty <= 0) return;
      const used = Math.min(current.qty, toConsume);
      const nextQty = round3(current.qty - used);
      toConsume = round3(toConsume - used);
      if (nextQty <= 0.0001) {
        map.delete(key);
      } else {
        map.set(key, { ...current, qty: nextQty, updatedAt: nowIso });
      }
    });
  });

  const nextRows = Array.from(map.values())
    .filter((row) => row.qty > 0.0001 && row.productId && row.location)
    .sort((a, b) => {
      const byProduct = normalize(a.productName).localeCompare(normalize(b.productName));
      if (byProduct !== 0) return byProduct;
      const byLocation = normalize(a.location).localeCompare(normalize(b.location));
      if (byLocation !== 0) return byLocation;
      const byExpiry = compareExpiryAsc(a.expiryDate, b.expiryDate);
      if (byExpiry !== 0) return byExpiry;
      return normalize(a.lotNumber).localeCompare(normalize(b.lotNumber));
    });
  return writeStockLotBalances(nextRows, existing);
};
