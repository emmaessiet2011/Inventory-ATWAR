import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env'), override: true });

const prisma = new PrismaClient();

const DEFAULT_REPORT_PATH = path.resolve(process.cwd(), 'qa', 'reports', 'ops-merge-location-duplicate-products.json');

const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
const round3 = (value) => Math.round((Number(value) || 0) * 1000) / 1000;
const toObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {}
);
const asArray = (value) => (Array.isArray(value) ? value.map(String).filter(Boolean) : []);

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {
    apply: false,
    report: DEFAULT_REPORT_PATH,
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--apply') {
      parsed.apply = true;
      continue;
    }
    if (arg === '--report') {
      parsed.report = path.resolve(process.cwd(), args[i + 1] || '');
      i += 1;
    }
  }
  return parsed;
};

const isWarehouseLocationText = (value) => {
  const text = normalize(value);
  return (
    text.includes('bl0001') ||
    text.includes('warehouse') ||
    text.includes('atwar al mustaqbal') ||
    text.includes('cr:1450968') ||
    text.includes('cr 1450968') ||
    text.includes('1450968')
  );
};

const productLocationName = (product) => {
  const meta = toObject(product.meta);
  return String(meta.businessLocation || meta.location || product.businessLocation || '').trim();
};

const isWarehouseProduct = (product) => isWarehouseLocationText(`${product.id} ${productLocationName(product)}`);

const inventoryKey = (productId, locationId) => `${String(productId)}@@${String(locationId)}`;
const lotKey = (locationId, lotNumber, expiryDate) => (
  `${String(locationId)}@@${normalize(lotNumber || '--')}@@${expiryDate ? new Date(expiryDate).toISOString() : ''}`
);

const groupBySku = (products) => {
  const groups = new Map();
  products.forEach((product) => {
    const sku = normalize(product.sku);
    if (!sku) return;
    groups.set(sku, [...(groups.get(sku) || []), product]);
  });
  return groups;
};

const mergeMeta = (master, duplicate, duplicateLocation) => {
  const masterMeta = toObject(master.meta);
  const duplicateMeta = toObject(duplicate.meta);
  const availableLocationIds = new Set([
    ...asArray(masterMeta.availableLocationIds),
    ...asArray(duplicateMeta.availableLocationIds),
  ]);
  const availableLocations = new Set([
    ...asArray(masterMeta.availableLocations),
    ...asArray(duplicateMeta.availableLocations),
  ]);
  if (duplicateLocation?.id) availableLocationIds.add(duplicateLocation.id);
  if (duplicateLocation?.name) availableLocations.add(duplicateLocation.name);

  return {
    ...masterMeta,
    availableLocationIds: Array.from(availableLocationIds),
    availableLocations: Array.from(availableLocations),
    duplicateLocationProductsMergedAt: new Date().toISOString(),
  };
};

async function mergeInventory(tx, duplicate, master, duplicateLocation, summary) {
  const duplicateInventory = await tx.productInventory.findMany({ where: { productId: duplicate.id } });
  const seen = new Set();

  for (const row of duplicateInventory) {
    seen.add(inventoryKey(row.productId, row.locationId));
    const existing = await tx.productInventory.findUnique({
      where: { productId_locationId: { productId: master.id, locationId: row.locationId } },
    });
    if (existing) {
      await tx.productInventory.update({
        where: { id: existing.id },
        data: {
          stock: round3(Number(existing.stock) + Number(row.stock)),
          unitCost: existing.unitCost ?? row.unitCost,
          meta: { ...toObject(existing.meta), mergedDuplicateInventoryIds: [...asArray(toObject(existing.meta).mergedDuplicateInventoryIds), row.id] },
        },
      });
      await tx.productInventory.delete({ where: { id: row.id } });
      summary.inventoryRowsMerged += 1;
    } else {
      await tx.productInventory.update({
        where: { id: row.id },
        data: {
          productId: master.id,
          meta: { ...toObject(row.meta), mergedFromProductId: duplicate.id },
        },
      });
      summary.inventoryRowsReassigned += 1;
    }
  }

  const duplicateStock = round3(Number(duplicate.stock || 0));
  if (duplicateStock > 0 && duplicateLocation?.id) {
    const key = inventoryKey(master.id, duplicateLocation.id);
    if (!seen.has(key)) {
      const existing = await tx.productInventory.findUnique({
        where: { productId_locationId: { productId: master.id, locationId: duplicateLocation.id } },
      });
      if (existing) {
        await tx.productInventory.update({
          where: { id: existing.id },
          data: { stock: round3(Number(existing.stock) + duplicateStock) },
        });
      } else {
        await tx.productInventory.create({
          data: {
            id: `PINV-MERGE-${duplicate.id}-${duplicateLocation.id}`.slice(0, 191),
            productId: master.id,
            locationId: duplicateLocation.id,
            stock: duplicateStock,
            unitCost: duplicate.unitPurchasePrice,
            meta: {
              source: 'duplicate-product-merge',
              mergedFromProductId: duplicate.id,
              locationName: duplicateLocation.name,
            },
          },
        });
      }
      summary.duplicateProductStockMovedToInventory += duplicateStock;
    }
  }
}

async function mergeLots(tx, duplicate, master, summary) {
  const duplicateLots = await tx.stockLot.findMany({ where: { productId: duplicate.id } });
  for (const row of duplicateLots) {
    const existing = await tx.stockLot.findFirst({
      where: {
        productId: master.id,
        locationId: row.locationId,
        lotNumber: row.lotNumber,
        expiryDate: row.expiryDate,
      },
    });
    if (existing) {
      await tx.stockLot.update({
        where: { id: existing.id },
        data: {
          qty: round3(Number(existing.qty) + Number(row.qty)),
          meta: { ...toObject(existing.meta), mergedDuplicateLotIds: [...asArray(toObject(existing.meta).mergedDuplicateLotIds), row.id] },
        },
      });
      await tx.stockLot.delete({ where: { id: row.id } });
      summary.stockLotsMerged += 1;
    } else {
      await tx.stockLot.update({
        where: { id: row.id },
        data: {
          productId: master.id,
          meta: { ...toObject(row.meta), mergedFromProductId: duplicate.id },
        },
      });
      summary.stockLotsReassigned += 1;
    }
  }
}

async function updateReferences(tx, duplicateId, masterId, summary) {
  const nullableModels = [
    'purchaseItem',
    'purchaseReturnItem',
    'saleItem',
    'sellReturnItem',
    'salesOrderItem',
    'stockTransferItem',
    'stockAdjustmentItem',
  ];
  for (const model of nullableModels) {
    const result = await tx[model].updateMany({
      where: { productId: duplicateId },
      data: { productId: masterId },
    });
    summary.referencesUpdated[model] = (summary.referencesUpdated[model] || 0) + result.count;
  }

  const ledger = await tx.stockLedger.updateMany({
    where: { productId: duplicateId },
    data: { productId: masterId },
  });
  summary.referencesUpdated.stockLedger = (summary.referencesUpdated.stockLedger || 0) + ledger.count;
}

async function main() {
  const { apply, report } = parseArgs();
  const [products, locations] = await Promise.all([
    prisma.product.findMany({ orderBy: [{ sku: 'asc' }, { id: 'asc' }] }),
    prisma.location.findMany({ select: { id: true, name: true, isActive: true } }),
  ]);
  const locationByName = new Map(locations.map((location) => [normalize(location.name), location]));
  const groups = Array.from(groupBySku(products).values()).filter((group) => group.length > 1);
  const reportRows = [];
  const summary = {
    mode: apply ? 'apply' : 'preview',
    duplicateSkuGroups: groups.length,
    groupsMerged: 0,
    productsDeleted: 0,
    inventoryRowsMerged: 0,
    inventoryRowsReassigned: 0,
    duplicateProductStockMovedToInventory: 0,
    stockLotsMerged: 0,
    stockLotsReassigned: 0,
    referencesUpdated: {},
    skipped: [],
  };

  for (const group of groups) {
    const master = group.find(isWarehouseProduct);
    if (!master) {
      summary.skipped.push({
        sku: group[0]?.sku || '',
        reason: 'No ATWAR warehouse/master product found',
        products: group.map((product) => ({ id: product.id, name: product.name, location: productLocationName(product) })),
      });
      continue;
    }
    const duplicates = group.filter((product) => product.id !== master.id);
    reportRows.push({
      sku: master.sku,
      master: { id: master.id, name: master.name, location: productLocationName(master), stock: Number(master.stock) },
      duplicates: duplicates.map((product) => ({
        id: product.id,
        name: product.name,
        location: productLocationName(product),
        stock: Number(product.stock),
      })),
    });

    if (!apply) continue;

    await prisma.$transaction(async (tx) => {
      for (const duplicate of duplicates) {
        const duplicateLocation = locationByName.get(normalize(productLocationName(duplicate)));
        await mergeInventory(tx, duplicate, master, duplicateLocation, summary);
        await mergeLots(tx, duplicate, master, summary);
        await updateReferences(tx, duplicate.id, master.id, summary);
        await tx.product.update({
          where: { id: master.id },
          data: { meta: mergeMeta(master, duplicate, duplicateLocation) },
        });
        await tx.product.delete({ where: { id: duplicate.id } });
        summary.productsDeleted += 1;
      }
      summary.groupsMerged += 1;
    }, { timeout: 120_000 });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    ...summary,
    plannedMerges: reportRows,
  };
  fs.mkdirSync(path.dirname(report), { recursive: true });
  fs.writeFileSync(report, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
