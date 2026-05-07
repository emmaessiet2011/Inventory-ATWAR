import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env') });

const prisma = new PrismaClient();

const DEFAULT_FROM_TERM = 'CR:1450968';
const DEFAULT_TARGET_TERM = 'CR:1450968';
const DEFAULT_REPORT_PATH = path.resolve(process.cwd(), 'qa', 'reports', 'ops-move-products-location-summary.json');

const normalize = (value) => String(value || '').trim().toLowerCase();
const toObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {}
);
const round3 = (value) => Number((Number(value) || 0).toFixed(3));

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {
    from: DEFAULT_FROM_TERM,
    target: DEFAULT_TARGET_TERM,
    dryRun: false,
    report: DEFAULT_REPORT_PATH,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }
    if (arg === '--from') {
      parsed.from = String(args[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (arg === '--target') {
      parsed.target = String(args[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (arg === '--report') {
      parsed.report = path.resolve(process.cwd(), args[i + 1] || '');
      i += 1;
      continue;
    }
  }

  return parsed;
};

const resolveLocation = (locations, term, label) => {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) throw new Error(`${label} location term is empty`);

  const exact = locations.find((loc) => normalize(loc.name) === normalizedTerm);
  if (exact) return exact;

  const contains = locations.find((loc) => normalize(loc.name).includes(normalizedTerm));
  if (contains) return contains;

  throw new Error(`${label} location not found for term "${term}"`);
};

const moveRackDetail = (meta, fromLocationId, toLocationId) => {
  const rackDetails = (
    meta.locationRackDetails &&
    typeof meta.locationRackDetails === 'object' &&
    !Array.isArray(meta.locationRackDetails)
  )
    ? { ...meta.locationRackDetails }
    : null;

  if (!rackDetails) return { changed: false, value: undefined };
  if (!fromLocationId || !toLocationId || fromLocationId === toLocationId) return { changed: false, value: rackDetails };

  const fromEntry = rackDetails[fromLocationId];
  if (!fromEntry) return { changed: false, value: rackDetails };

  const next = { ...rackDetails };
  if (!next[toLocationId]) next[toLocationId] = fromEntry;
  delete next[fromLocationId];
  return { changed: true, value: next };
};

async function main() {
  const { from, target, dryRun, report } = parseArgs();
  const nowIso = new Date().toISOString();

  const locations = await prisma.location.findMany({
    select: { id: true, name: true, isActive: true },
    orderBy: { name: 'asc' },
  });

  const fromLocation = resolveLocation(locations, from, 'Source');
  const targetLocation = resolveLocation(locations, target, 'Target');
  const sameLocation = fromLocation.id === targetLocation.id;

  const [
    allProducts,
    fromInventoryRows,
    fromLotRows,
  ] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, name: true, sku: true, meta: true },
      orderBy: { sku: 'asc' },
    }),
    sameLocation
      ? Promise.resolve([])
      : prisma.productInventory.findMany({
        where: { locationId: fromLocation.id },
        select: {
          id: true,
          productId: true,
          locationId: true,
          stock: true,
          unitCost: true,
          rack: true,
          row: true,
          position: true,
          lotNumber: true,
          expiryDate: true,
          meta: true,
        },
      }),
    sameLocation
      ? Promise.resolve([])
      : prisma.stockLot.findMany({
        where: { locationId: fromLocation.id },
        select: {
          id: true,
          productId: true,
          locationId: true,
          lotNumber: true,
          expiryDate: true,
          unitCost: true,
          qty: true,
          meta: true,
        },
      }),
  ]);

  const productPreview = [];
  const productUpdates = [];

  for (const product of allProducts) {
    const meta = toObject(product.meta);
    const { changed: movedRackDetail, value: nextRackDetails } = moveRackDetail(meta, fromLocation.id, targetLocation.id);
    const nextMeta = {
      ...meta,
      businessLocation: targetLocation.name,
      location: targetLocation.name,
      openingStockLocation: targetLocation.name,
      ...(nextRackDetails ? { locationRackDetails: nextRackDetails } : {}),
    };

    const changed = (
      String(meta.businessLocation || '').trim() !== targetLocation.name ||
      String(meta.location || '').trim() !== targetLocation.name ||
      String(meta.openingStockLocation || '').trim() !== targetLocation.name ||
      movedRackDetail
    );

    if (changed) {
      productUpdates.push({ id: product.id, meta: nextMeta });
      if (productPreview.length < 20) {
        productPreview.push({
          id: product.id,
          sku: product.sku,
          name: product.name,
          fromBusinessLocation: String(meta.businessLocation || '').trim(),
          toBusinessLocation: targetLocation.name,
        });
      }
    }
  }

  let inventoryMoved = 0;
  let inventoryMerged = 0;
  let lotsMoved = 0;
  let lotsMerged = 0;

  if (!dryRun) {
    await prisma.$transaction(async (tx) => {
      for (const row of productUpdates) {
        await tx.product.update({
          where: { id: row.id },
          data: { meta: row.meta },
        });
      }

      if (!sameLocation) {
        for (const inv of fromInventoryRows) {
          const existingTarget = await tx.productInventory.findUnique({
            where: {
              productId_locationId: {
                productId: inv.productId,
                locationId: targetLocation.id,
              },
            },
            select: {
              id: true,
              stock: true,
              unitCost: true,
              rack: true,
              row: true,
              position: true,
              lotNumber: true,
              expiryDate: true,
              meta: true,
            },
          });

          if (!existingTarget) {
            await tx.productInventory.update({
              where: { id: inv.id },
              data: { locationId: targetLocation.id },
            });
            inventoryMoved += 1;
            continue;
          }

          const mergedMeta = {
            ...toObject(existingTarget.meta),
            movedFromLocation: fromLocation.name,
            mergedAt: nowIso,
          };

          await tx.productInventory.update({
            where: { id: existingTarget.id },
            data: {
              stock: round3(Number(existingTarget.stock || 0) + Number(inv.stock || 0)),
              unitCost: existingTarget.unitCost ?? inv.unitCost,
              rack: existingTarget.rack || inv.rack || null,
              row: existingTarget.row || inv.row || null,
              position: existingTarget.position || inv.position || null,
              lotNumber: existingTarget.lotNumber || inv.lotNumber || null,
              expiryDate: existingTarget.expiryDate || inv.expiryDate || null,
              meta: mergedMeta,
            },
          });

          await tx.productInventory.delete({ where: { id: inv.id } });
          inventoryMerged += 1;
        }

        for (const lot of fromLotRows) {
          const existingTargetLot = await tx.stockLot.findFirst({
            where: {
              productId: lot.productId,
              locationId: targetLocation.id,
              lotNumber: lot.lotNumber,
              expiryDate: lot.expiryDate ?? null,
            },
            select: {
              id: true,
              qty: true,
              unitCost: true,
              meta: true,
            },
          });

          if (!existingTargetLot) {
            await tx.stockLot.update({
              where: { id: lot.id },
              data: { locationId: targetLocation.id },
            });
            lotsMoved += 1;
            continue;
          }

          const mergedMeta = {
            ...toObject(existingTargetLot.meta),
            movedFromLocation: fromLocation.name,
            mergedAt: nowIso,
          };

          await tx.stockLot.update({
            where: { id: existingTargetLot.id },
            data: {
              qty: round3(Number(existingTargetLot.qty || 0) + Number(lot.qty || 0)),
              unitCost: existingTargetLot.unitCost ?? lot.unitCost,
              meta: mergedMeta,
            },
          });

          await tx.stockLot.delete({ where: { id: lot.id } });
          lotsMerged += 1;
        }
      }
    }, { timeout: 180000 });
  }

  const [verifyProducts, verifyInventoryOld, verifyInventoryTarget, verifyLotsOld, verifyLotsTarget] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, meta: true },
    }),
    sameLocation ? Promise.resolve(0) : prisma.productInventory.count({ where: { locationId: fromLocation.id } }),
    prisma.productInventory.count({ where: { locationId: targetLocation.id } }),
    sameLocation ? Promise.resolve(0) : prisma.stockLot.count({ where: { locationId: fromLocation.id } }),
    prisma.stockLot.count({ where: { locationId: targetLocation.id } }),
  ]);

  const productsAtTarget = verifyProducts.filter((product) => {
    const meta = toObject(product.meta);
    return String(meta.businessLocation || '').trim() === targetLocation.name;
  }).length;

  const productsStillAtSource = verifyProducts.filter((product) => {
    const meta = toObject(product.meta);
    return normalize(meta.businessLocation).includes(normalize(from));
  }).length;

  const summary = {
    generatedAt: nowIso,
    dryRun,
    source: { id: fromLocation.id, name: fromLocation.name },
    target: { id: targetLocation.id, name: targetLocation.name },
    totals: {
      productsTotal: allProducts.length,
      productsUpdated: productUpdates.length,
      productsAtTarget,
      productsStillAtSource,
      inventorySourceRowsBefore: fromInventoryRows.length,
      inventoryMoved,
      inventoryMerged,
      inventorySourceRowsAfter: verifyInventoryOld,
      inventoryTargetRowsAfter: verifyInventoryTarget,
      stockLotSourceRowsBefore: fromLotRows.length,
      stockLotMoved: lotsMoved,
      stockLotMerged: lotsMerged,
      stockLotSourceRowsAfter: verifyLotsOld,
      stockLotTargetRowsAfter: verifyLotsTarget,
    },
    preview: {
      firstProducts: productPreview,
    },
  };

  const reportDir = path.dirname(report);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(report, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log('[ops:move-products-location] complete');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`[ops:move-products-location] report: ${report}`);
}

main()
  .catch((error) => {
    console.error('[ops:move-products-location] failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
