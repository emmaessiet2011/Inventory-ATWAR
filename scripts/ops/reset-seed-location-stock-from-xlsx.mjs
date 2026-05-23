import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env'), override: true });

const prisma = new PrismaClient();

const DEFAULT_LOCATION_TERM = 'Kennol Workshop';
const DEFAULT_REPORT_PATH = path.resolve(process.cwd(), 'qa', 'reports', 'ops-reset-seed-location-stock-summary.json');

const normalize = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const normalizeKey = (value) => normalize(value).replace(/[^a-z0-9]/g, '');
const round3 = (value) => Math.round((Number(value) || 0) * 1000) / 1000;
const nowStamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const toObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {});

const parseNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').trim();
  if (!text) return 0;
  const parsed = Number(text.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {
    file: '',
    sheet: '',
    location: DEFAULT_LOCATION_TERM,
    actor: 'System',
    ref: '',
    apply: false,
    report: DEFAULT_REPORT_PATH,
    failOnMissingSku: true,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--apply') {
      parsed.apply = true;
      continue;
    }
    if (arg === '--file') {
      parsed.file = String(args[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (arg === '--sheet') {
      parsed.sheet = String(args[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (arg === '--location') {
      parsed.location = String(args[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (arg === '--actor') {
      parsed.actor = String(args[i + 1] || '').trim() || 'System';
      i += 1;
      continue;
    }
    if (arg === '--ref') {
      parsed.ref = String(args[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (arg === '--report') {
      parsed.report = path.resolve(process.cwd(), args[i + 1] || '');
      i += 1;
      continue;
    }
    if (arg === '--allow-missing-sku') {
      parsed.failOnMissingSku = false;
      continue;
    }
  }

  return parsed;
};

const resolveLocation = (locations, term) => {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) throw new Error('Location term is required.');

  const exact = locations.find((row) => normalize(row.name) === normalizedTerm);
  if (exact) return exact;

  const contains = locations.find((row) => normalize(row.name).includes(normalizedTerm));
  if (contains) return contains;

  throw new Error(`Location not found for "${term}".`);
};

const selectSheetName = (workbook, preferredSheet) => {
  if (preferredSheet) {
    const direct = workbook.SheetNames.find((name) => normalize(name) === normalize(preferredSheet));
    if (direct) return direct;
    throw new Error(`Sheet "${preferredSheet}" was not found in workbook.`);
  }
  if (!Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
    throw new Error('Workbook has no sheets.');
  }
  return workbook.SheetNames[0];
};

const detectColumnKey = (rowKeys, matchers) => {
  const keyByNorm = new Map(rowKeys.map((key) => [normalizeKey(key), key]));
  for (const matcher of matchers) {
    for (const [normKey, rawKey] of keyByNorm.entries()) {
      if (matcher(normKey, rawKey)) return rawKey;
    }
  }
  return '';
};

const productLooksWarehouseMaster = (product) => {
  const meta = toObject(product.meta);
  const text = normalize(`${product.id || ''} ${meta.businessLocation || ''} ${meta.location || ''}`);
  return (
    text.includes('bl0001') ||
    text.includes('warehouse') ||
    text.includes('atwar al mustaqbal') ||
    text.includes('1450968')
  );
};

const includeLocationVisibility = (product, location) => {
  const meta = toObject(product.meta);
  const existingIds = Array.isArray(meta.availableLocationIds) ? meta.availableLocationIds.map(String) : [];
  const existingNames = Array.isArray(meta.availableLocations) ? meta.availableLocations.map(String) : [];
  const idSet = new Set(existingIds.filter(Boolean));
  const nameSet = new Set(existingNames.filter(Boolean));

  idSet.add(location.id);
  nameSet.add(location.name);

  if (idSet.size === 1 && nameSet.size === 1) {
    idSet.add('BL0001');
    nameSet.add('Warehouse');
    nameSet.add('atwar al mustaqbal');
  }

  const nextMeta = {
    ...meta,
    availableLocationIds: Array.from(idSet),
    availableLocations: Array.from(nameSet),
  };
  const changed = JSON.stringify(meta.availableLocationIds || []) !== JSON.stringify(nextMeta.availableLocationIds)
    || JSON.stringify(meta.availableLocations || []) !== JSON.stringify(nextMeta.availableLocations);

  return { changed, meta: nextMeta };
};

async function main() {
  const args = parseArgs();
  if (!args.file) throw new Error('Missing required argument: --file <path-to-xlsx>');

  const absoluteFile = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(absoluteFile)) throw new Error(`File not found: ${absoluteFile}`);

  const workbook = XLSX.readFile(absoluteFile, { cellDates: true });
  const sheetName = selectSheetName(workbook, args.sheet);
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  if (rows.length === 0) throw new Error('Worksheet has no data rows.');

  const rowKeys = Object.keys(rows[0] || {});
  const skuKey = detectColumnKey(rowKeys, [
    (norm) => norm === 'sku',
    (norm) => norm.includes('sku'),
  ]);
  const qtyKey = detectColumnKey(rowKeys, [
    (norm) => norm === 'currentstock',
    (norm) => norm === 'stock',
    (norm) => norm === 'quantity',
    (norm) => norm.includes('currentstock'),
    (norm) => norm.includes('quantity'),
    (norm) => norm.includes('stock'),
  ]);
  const nameKey = detectColumnKey(rowKeys, [
    (norm) => norm === 'name',
    (norm) => norm.includes('productname'),
    (norm) => norm.includes('name'),
  ]);

  if (!skuKey) throw new Error('Unable to detect SKU column in sheet.');
  if (!qtyKey) throw new Error('Unable to detect stock/quantity column in sheet.');

  const desiredBySku = new Map();
  const duplicateSkus = [];
  const lineItems = [];

  rows.forEach((row, index) => {
    const sku = String(row[skuKey] || '').trim();
    if (!sku) return;
    const skuNorm = normalize(sku);
    const qty = round3(parseNumber(row[qtyKey]));
    const name = nameKey ? String(row[nameKey] || '').trim() : '';
    if (desiredBySku.has(skuNorm)) {
      duplicateSkus.push({ sku, row: index + 2 });
      return;
    }
    desiredBySku.set(skuNorm, { sku, qty, name, row: index + 2 });
    lineItems.push({ sku, qty, name, row: index + 2 });
  });

  if (duplicateSkus.length > 0) {
    throw new Error(`Duplicate SKU(s) in file: ${duplicateSkus.map((row) => `${row.sku} (row ${row.row})`).join(', ')}`);
  }
  if (lineItems.length === 0) {
    throw new Error('No valid SKU rows found in sheet.');
  }

  const [locations, products] = await Promise.all([
    prisma.location.findMany({ select: { id: true, name: true, isActive: true } }),
    prisma.product.findMany({
      select: { id: true, sku: true, name: true, unitPurchasePrice: true, meta: true },
    }),
  ]);

  const location = resolveLocation(locations, args.location);

  const productsBySku = new Map();
  const productsByName = new Map();
  products.forEach((product) => {
    const key = normalize(product.sku);
    if (!key) return;
    productsBySku.set(key, [...(productsBySku.get(key) || []), product]);
    const nameKey = normalize(product.name);
    if (nameKey) {
      productsByName.set(nameKey, [...(productsByName.get(nameKey) || []), product]);
    }
  });

  const missingSkus = [];
  const ambiguousSkus = [];
  const desiredByProductId = new Map();

  desiredBySku.forEach((payload, skuNorm) => {
    let matches = productsBySku.get(skuNorm) || [];
    if (matches.length === 0 && payload.name) {
      const byName = productsByName.get(normalize(payload.name)) || [];
      matches = byName;
    }
    if (matches.length === 0) {
      missingSkus.push(payload);
      return;
    }

    let selected = null;
    if (matches.length === 1) {
      selected = matches[0];
    } else {
      const warehouseMatches = matches.filter(productLooksWarehouseMaster);
      if (warehouseMatches.length === 1) {
        selected = warehouseMatches[0];
      } else if (payload.name) {
        const nameExact = matches.filter((row) => normalize(row.name) === normalize(payload.name));
        if (nameExact.length === 1) selected = nameExact[0];
      }
    }

    if (!selected) {
      ambiguousSkus.push({
        sku: payload.sku,
        row: payload.row,
        productIds: matches.map((row) => row.id),
      });
      return;
    }

    desiredByProductId.set(selected.id, {
      productId: selected.id,
      productName: selected.name,
      sku: selected.sku,
      qty: payload.qty,
      unitCost: round3(Number(selected.unitPurchasePrice || 0)),
      row: payload.row,
    });
  });

  if (ambiguousSkus.length > 0) {
    throw new Error(
      `Ambiguous SKU mapping found: ${ambiguousSkus.map((row) => `${row.sku} (row ${row.row}) -> ${row.productIds.join(', ')}`).join(' | ')}`,
    );
  }
  if (args.failOnMissingSku && missingSkus.length > 0) {
    throw new Error(`SKU(s) not found in products: ${missingSkus.map((row) => `${row.sku} (row ${row.row})`).join(', ')}`);
  }

  const currentInventory = await prisma.productInventory.findMany({
    where: { locationId: location.id },
    select: {
      id: true,
      productId: true,
      locationId: true,
      stock: true,
      unitCost: true,
    },
  });

  const inventoryByProductId = new Map(currentInventory.map((row) => [row.productId, row]));
  const nowIso = new Date().toISOString();
  const refNo = args.ref || `SEED-${normalize(location.name).replace(/[^a-z0-9]+/g, '-').toUpperCase()}-${nowStamp()}`;
  const note = `Reset + seed location stock from ${path.basename(absoluteFile)} (${sheetName})`;

  const createRows = [];
  const updateRows = [];
  const zeroRows = [];
  const ledgerRows = [];
  const visibilityUpdates = [];
  let sequence = 0;

  const makeId = (prefix) => `${prefix}-${Date.now()}-${sequence += 1}`;

  desiredByProductId.forEach((target) => {
    const existing = inventoryByProductId.get(target.productId);
    const desiredQty = round3(target.qty);
    const prevQty = round3(Number(existing?.stock || 0));
    const delta = round3(desiredQty - prevQty);

    if (existing) {
      if (delta !== 0) {
        updateRows.push({
          id: existing.id,
          productId: target.productId,
          sku: target.sku,
          productName: target.productName,
          previousQty: prevQty,
          nextQty: desiredQty,
          unitCost: existing.unitCost ?? target.unitCost,
        });
        ledgerRows.push({
          id: makeId('STK-SEED'),
          productId: target.productId,
          locationId: location.id,
          entryType: 'Opening Balance',
          changeQty: delta,
          newQty: desiredQty,
          date: new Date(nowIso),
          ref: refNo,
          party: args.actor,
          note,
          meta: { source: 'ops-reset-seed-location-stock-from-xlsx', sku: target.sku, row: target.row },
        });
      }
    } else if (desiredQty > 0) {
      const id = makeId('PINV');
      createRows.push({
        id,
        productId: target.productId,
        locationId: location.id,
        stock: desiredQty,
        unitCost: target.unitCost,
      });
      ledgerRows.push({
        id: makeId('STK-SEED'),
        productId: target.productId,
        locationId: location.id,
        entryType: 'Opening Balance',
        changeQty: desiredQty,
        newQty: desiredQty,
        date: new Date(nowIso),
        ref: refNo,
        party: args.actor,
        note,
        meta: { source: 'ops-reset-seed-location-stock-from-xlsx', sku: target.sku, row: target.row },
      });
    }

    if (desiredQty > 0) {
      const product = products.find((row) => row.id === target.productId);
      if (product) {
        const visibility = includeLocationVisibility(product, location);
        if (visibility.changed) {
          visibilityUpdates.push({ id: product.id, meta: visibility.meta });
        }
      }
    }
  });

  const seededProductIds = new Set(desiredByProductId.keys());
  currentInventory.forEach((row) => {
    if (seededProductIds.has(row.productId)) return;
    const prevQty = round3(Number(row.stock || 0));
    if (prevQty === 0) return;
    zeroRows.push({
      id: row.id,
      productId: row.productId,
      previousQty: prevQty,
      nextQty: 0,
    });
    ledgerRows.push({
      id: makeId('STK-SEED'),
      productId: row.productId,
      locationId: location.id,
      entryType: 'Opening Balance',
      changeQty: round3(-prevQty),
      newQty: 0,
      date: new Date(nowIso),
      ref: refNo,
      party: args.actor,
      note,
      meta: { source: 'ops-reset-seed-location-stock-from-xlsx', action: 'zero-missing' },
    });
  });

  if (args.apply) {
    await prisma.$transaction(async (tx) => {
      for (const row of createRows) {
        await tx.productInventory.create({ data: row });
      }
      for (const row of updateRows) {
        await tx.productInventory.update({
          where: { id: row.id },
          data: { stock: row.nextQty, unitCost: row.unitCost ?? undefined },
        });
      }
      for (const row of zeroRows) {
        await tx.productInventory.update({
          where: { id: row.id },
          data: { stock: 0 },
        });
      }
      if (ledgerRows.length > 0) {
        await tx.stockLedger.createMany({ data: ledgerRows });
      }
      for (const row of visibilityUpdates) {
        await tx.product.update({
          where: { id: row.id },
          data: { meta: row.meta },
        });
      }
    }, { timeout: 180_000 });
  }

  const report = {
    generatedAt: nowIso,
    mode: args.apply ? 'apply' : 'preview',
    file: absoluteFile,
    sheet: sheetName,
    ref: refNo,
    location: { id: location.id, name: location.name },
    totals: {
      rowsInFile: lineItems.length,
      rowsMatchedToProducts: desiredByProductId.size,
      missingSkus: missingSkus.length,
      createRows: createRows.length,
      updateRows: updateRows.length,
      zeroRows: zeroRows.length,
      ledgerRows: ledgerRows.length,
      visibilityUpdates: visibilityUpdates.length,
    },
    missingSkus: missingSkus.map((row) => ({ sku: row.sku, row: row.row })),
    preview: {
      createRows: createRows.slice(0, 20),
      updateRows: updateRows.slice(0, 20),
      zeroRows: zeroRows.slice(0, 20),
    },
  };

  fs.mkdirSync(path.dirname(args.report), { recursive: true });
  fs.writeFileSync(args.report, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('[ops:reset-seed-location-stock-from-xlsx] complete');
  console.log(JSON.stringify(report, null, 2));
  console.log(`[ops:reset-seed-location-stock-from-xlsx] report: ${args.report}`);
}

main()
  .catch((error) => {
    console.error('[ops:reset-seed-location-stock-from-xlsx] failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
