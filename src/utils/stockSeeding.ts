import { Product } from '../context/GlobalContext';
import {
  ProductLocationInventory,
  inventoryKey,
  syncChangedLocationInventoryStrict,
} from './stockLocationInventory';
import {
  StockLedgerEntry,
  appendStockLedgerEntriesStrict,
  syncChangedProductsStrict,
} from './stockTransfers';

export interface SeedLocationStockItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost?: number;
}

export interface SeedLocationStockParams {
  location: string;
  locationId: string;
  items: SeedLocationStockItem[];
  products: Product[];
  inventoryRows: ProductLocationInventory[];
  generateId: (prefix: string) => string;
  actorName: string;
  ref: string;
  date: string;
}

export interface SeedLocationStockResult {
  productsAfter: Product[];
  inventoryAfter: ProductLocationInventory[];
  ledgerEntries: StockLedgerEntry[];
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
}

export interface ReverseSeedStockParams {
  seedRef: string;
  location: string;
  locationId: string;
  products: Product[];
  inventoryRows: ProductLocationInventory[];
  existingLedgerEntries: StockLedgerEntry[];
  generateId: (prefix: string) => string;
  actorName: string;
  date: string;
}

export interface ReverseSeedStockResult {
  inventoryAfter: ProductLocationInventory[];
  ledgerEntries: StockLedgerEntry[];
  reversedCount: number;
  totalReversedQty: number;
}

const normalize = (value: unknown): string => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const skuLocationKey = (sku: unknown, location: unknown): string => `${normalize(sku)}@@${normalize(location)}`;
const productLooksWarehouseMaster = (product: Product): boolean => {
  const joined = normalize(`${product.id || ''} ${product.businessLocation || ''}`);
  return (
    joined.includes('bl0001') ||
    joined.includes('warehouse') ||
    joined.includes('atwar al mustaqbal') ||
    joined.includes('1450968')
  );
};

const toIsoDate = (value: string): string => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
};

const findDuplicateSkuLocation = (products: Product[]): { sku: string; location: string } | null => {
  const seen = new Map<string, Product>();
  for (const product of products) {
    const key = skuLocationKey(product.sku, product.businessLocation);
    if (!normalize(product.sku) || !normalize(product.businessLocation)) continue;
    const existing = seen.get(key);
    if (existing && existing.id !== product.id) {
      return {
        sku: String(product.sku || existing.sku || '').trim(),
        location: String(product.businessLocation || existing.businessLocation || '').trim(),
      };
    }
    seen.set(key, product);
  }
  return null;
};

export const simulateSeedLocationStock = ({
  location,
  locationId,
  items,
  products,
  inventoryRows,
  generateId,
  actorName,
  ref,
  date,
}: SeedLocationStockParams): SeedLocationStockResult => {
  const cleanLocation = String(location || '').trim();
  if (!cleanLocation) throw new Error('Select a location before seeding stock.');
  const cleanLocationId = String(locationId || '').trim();
  if (!cleanLocationId) throw new Error('Selected location does not have a database ID.');
  if (duplicate) {
    throw new Error(`Duplicate product rows found for SKU "${duplicate.sku}" at "${duplicate.location}". Merge duplicates before seeding.`);
  }

  const productById = new Map(products.map((product) => [product.id, { ...product }]));
  const productsBySku = new Map<string, Product[]>();
  products.forEach((product) => {
    const skuKey = normalize(product.sku);
    if (!skuKey) return;
    productsBySku.set(skuKey, [...(productsBySku.get(skuKey) || []), product]);
  });
  const inventoryByKey = new Map<string, ProductLocationInventory>();
  const inventoryIds = inventoryRows.map((row) => row.id);
  const createdInventoryIds: string[] = [];

  inventoryRows.forEach((row) => {
    const key = inventoryKey(row.productId, row.locationId);
    const existing = inventoryByKey.get(key);
    if (existing && existing.id !== row.id) {
      throw new Error(`Duplicate inventory rows found for product "${row.productId}" at this location. Merge duplicates before seeding.`);
    }
    inventoryByKey.set(key, { ...row });
  });

  const now = Date.now();
  const ledgerDate = toIsoDate(date);
  const ledgerEntries: StockLedgerEntry[] = [];
  let ledgerSeq = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  const usedSkus = new Set<string>();

  items.forEach((item, index) => {
    const sku = String(item.sku || '').trim();
    const skuKey = normalize(sku);
    const desiredQty = round3(Number(item.quantity || 0));
    if (!skuKey || desiredQty < 0 || !Number.isFinite(desiredQty)) return;
    if (usedSkus.has(skuKey)) {
      throw new Error(`SKU "${sku}" appears more than once in this seed batch.`);
    }
    usedSkus.add(skuKey);

    const skuMatches = productsBySku.get(skuKey) || [];
    const warehouseMatch = skuMatches.find(productLooksWarehouseMaster);
    const selectedMatch = productById.get(item.productId);
    if (!warehouseMatch && !selectedMatch && skuMatches.length > 1) {
      throw new Error(`SKU "${sku}" has multiple product rows and no warehouse master product. Merge duplicates before seeding.`);
    }
    const source = warehouseMatch
      ? productById.get(warehouseMatch.id)
      : selectedMatch || (skuMatches.length === 1 ? productById.get(skuMatches[0].id) : undefined);
    if (!source) {
      throw new Error(`Product not found for SKU "${sku}".`);
    }

    const targetKey = inventoryKey(source.id, cleanLocationId);
    const existingTarget = inventoryByKey.get(targetKey);
    const visibilityIds = Array.isArray(source.availableLocationIds) ? source.availableLocationIds : [];
    const visibilityNames = Array.isArray(source.availableLocations) ? source.availableLocations : [];
    
    const newVisibilityIds = [...visibilityIds, cleanLocationId];
    const newVisibilityNames = [...visibilityNames, cleanLocation];
    
    if (visibilityIds.length === 0 && visibilityNames.length === 0) {
      if (source.businessLocation) {
        newVisibilityNames.push(source.businessLocation);
      }
      // Ensure it's never accidentally hidden from the default warehouse
      newVisibilityIds.push('BL0001');
      newVisibilityNames.push('Warehouse', 'atwar al mustaqbal');
    }
    
    source.availableLocationIds = Array.from(new Set(newVisibilityIds.filter(Boolean)));
    source.availableLocations = Array.from(new Set(newVisibilityNames.filter(Boolean)));
    productById.set(source.id, source);

    let previousQty = 0;
    let delta = 0;
    let existingTargetExists = false;

    const target: ProductLocationInventory = existingTarget || {
      id: generateId('PINV'),
      productId: source.id,
      locationId: cleanLocationId,
      locationName: cleanLocation,
      stock: 0,
      unitCost: round3(Number(source.unitPurchasePrice || 0)),
    };

    previousQty = round3(Number(target.stock || 0));
    delta = round3(desiredQty - previousQty);

    target.stock = desiredQty;
    if (Number.isFinite(Number(item.unitCost || 0)) && Number(item.unitCost || 0) > 0) {
      target.unitCost = round3(Number(item.unitCost || 0));
    }

    existingTargetExists = !!existingTarget;

    if (!existingTarget) {
      inventoryByKey.set(targetKey, target);
      createdInventoryIds.push(target.id);
      createdCount += 1;
    } else if (delta !== 0) {
      inventoryByKey.set(targetKey, target);
      updatedCount += 1;
    } else {
      inventoryByKey.set(targetKey, target);
      unchangedCount += 1;
    }

    if (delta !== 0 || !existingTargetExists) {
      ledgerEntries.push({
        id: `STK-SEED-${now}-${index}-${ledgerSeq += 1}`,
        productId: source.id,
        productName: source.name || item.productName || '',
        sku: source.sku || item.sku || '',
        type: 'Opening Balance',
        change: delta,
        newQty: desiredQty,
        date: ledgerDate,
        ref,
        party: actorName || 'System',
        location: cleanLocation,
        note: `Seed location stock for ${cleanLocation}`,
      });
    }
  });

  return {
    productsAfter: products.map((product) => productById.get(product.id) || product),
    inventoryAfter: [
      ...inventoryIds
        .map((id) => Array.from(inventoryByKey.values()).find((row) => row.id === id))
        .filter((row): row is ProductLocationInventory => !!row),
      ...createdInventoryIds
        .map((id) => Array.from(inventoryByKey.values()).find((row) => row.id === id))
        .filter((row): row is ProductLocationInventory => !!row),
    ],
    ledgerEntries,
    createdCount,
    updatedCount,
    unchangedCount,
  };
};

export const applySeedLocationStockStrict = async (
  result: SeedLocationStockResult,
  previousProducts: Product[],
  previousInventoryRows: ProductLocationInventory[],
) => {
  const ledgerSaved = await appendStockLedgerEntriesStrict(result.ledgerEntries);
  if (!ledgerSaved.ok) {
    const detail = ledgerSaved.error || `HTTP ${ledgerSaved.status || 0}`;
    throw new Error(`Unable to save seed stock ledger entries in Postgres. ${detail}`);
  }

  const inventorySaved = await syncChangedLocationInventoryStrict(result.inventoryAfter, previousInventoryRows);
  if (!inventorySaved.ok) {
    const detail = inventorySaved.error || `HTTP ${inventorySaved.status || 0}`;
    throw new Error(`Unable to save seeded location inventory in Postgres. ${detail}`);
  }

  const productsSaved = await syncChangedProductsStrict(result.productsAfter, previousProducts);
  if (!productsSaved.ok) {
    const detail = productsSaved.error || `HTTP ${productsSaved.status || 0}`;
    throw new Error(`Unable to save seeded product visibility in Postgres. ${detail}`);
  }
};

export const simulateReverseSeedLocationStock = ({
  seedRef,
  location,
  locationId,
  products,
  inventoryRows,
  existingLedgerEntries,
  generateId,
  actorName,
  date,
}: ReverseSeedStockParams): ReverseSeedStockResult => {
  const cleanRef = String(seedRef || '').trim();
  const cleanLocation = String(location || '').trim();
  const cleanLocationId = String(locationId || '').trim();
  if (!cleanRef) throw new Error('Select a seed reference to reverse.');
  if (!cleanLocation || !cleanLocationId) throw new Error('Selected location is missing.');

  const productById = new Map(products.map((product) => [product.id, product]));
  const inventoryByKey = new Map<string, ProductLocationInventory>();
  const inventoryIds = inventoryRows.map((row) => row.id);
  inventoryRows.forEach((row) => {
    inventoryByKey.set(inventoryKey(row.productId, row.locationId), { ...row });
  });

  const seedEntries = existingLedgerEntries.filter((entry) => (
    normalize(entry.ref) === normalize(cleanRef) &&
    normalize(entry.location) === normalize(cleanLocation) &&
    normalize(entry.type) === normalize('Opening Balance')
  ));
  if (seedEntries.length === 0) {
    throw new Error(`No opening seed ledger entries found for "${cleanRef}" at "${cleanLocation}".`);
  }

  const alreadyReversed = existingLedgerEntries.some((entry) => (
    normalize(entry.location) === normalize(cleanLocation) &&
    normalize(entry.type) === normalize('Opening Balance Reversal') &&
    normalize(entry.note).includes(normalize(`Reverse seed ${cleanRef}`))
  ));
  if (alreadyReversed) {
    throw new Error(`Seed "${cleanRef}" has already been reversed.`);
  }

  const ledgerDate = toIsoDate(date);
  const ledgerEntries: StockLedgerEntry[] = [];
  let totalReversedQty = 0;

  seedEntries.forEach((entry, index) => {
    const product = productById.get(entry.productId);
    if (!product) {
      throw new Error(`Product not found for seed ledger entry "${cleanRef}".`);
    }
    const key = inventoryKey(entry.productId, cleanLocationId);
    const inventory = inventoryByKey.get(key);
    if (!inventory) {
      throw new Error(`Location inventory not found for SKU "${product.sku}" at "${cleanLocation}".`);
    }

    const reversalQty = round3(-Number(entry.change || 0));
    const nextStock = round3(Number(inventory.stock || 0) + reversalQty);
    if (nextStock < -0.0001) {
      throw new Error(`Cannot reverse "${product.name}". Only ${Number(inventory.stock || 0).toFixed(3)} remains at ${cleanLocation}.`);
    }
    inventory.stock = Math.max(0, nextStock);
    inventoryByKey.set(key, inventory);
    totalReversedQty = round3(totalReversedQty + Math.abs(reversalQty));

    ledgerEntries.push({
      id: generateId('STK-SEED-REV') || `STK-SEED-REV-${Date.now()}-${index}`,
      productId: product.id,
      productName: product.name || entry.productName || '',
      sku: product.sku || entry.sku || '',
      type: 'Opening Balance Reversal',
      change: reversalQty,
      newQty: inventory.stock,
      date: ledgerDate,
      ref: `REV-${cleanRef}`,
      party: actorName || 'System',
      location: cleanLocation,
      note: `Reverse seed ${cleanRef}`,
    });
  });

  const allInventory = Array.from(inventoryByKey.values());
  return {
    inventoryAfter: inventoryIds
      .map((id) => allInventory.find((row) => row.id === id))
      .filter((row): row is ProductLocationInventory => !!row),
    ledgerEntries,
    reversedCount: ledgerEntries.length,
    totalReversedQty,
  };
};

export const applyReverseSeedLocationStockStrict = async (
  result: ReverseSeedStockResult,
  previousInventoryRows: ProductLocationInventory[],
) => {
  const ledgerSaved = await appendStockLedgerEntriesStrict(result.ledgerEntries);
  if (!ledgerSaved.ok) {
    const detail = ledgerSaved.error || `HTTP ${ledgerSaved.status || 0}`;
    throw new Error(`Unable to save reverse seed ledger entries in Postgres. ${detail}`);
  }

  const inventorySaved = await syncChangedLocationInventoryStrict(result.inventoryAfter, previousInventoryRows);
  if (!inventorySaved.ok) {
    const detail = inventorySaved.error || `HTTP ${inventorySaved.status || 0}`;
    throw new Error(`Unable to save reversed location inventory in Postgres. ${detail}`);
  }
};
