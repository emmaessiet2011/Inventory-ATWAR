import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env') });

const prisma = new PrismaClient();

const DEFAULT_INPUT_PATH = path.resolve(process.cwd(), 'tmp', 'price-lists', 'selling-price-lists.json');
const DEFAULT_REPORT_PATH = path.resolve(process.cwd(), 'qa', 'reports', 'ops-price-list-import-summary.json');

const round3 = (value) => Number((Number.isFinite(Number(value)) ? Number(value) : 0).toFixed(3));
const norm = (value) => String(value || '').trim().toLowerCase();
const compact = (value) => norm(value).replace(/[^a-z0-9]/g, '');
const digitsOnly = (value) => String(value || '').replace(/\D+/g, '');
const parseNumberish = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.replace(/,/g, '').replace(/[^\d.+-]/g, '');
  if (!normalized || ['-', '+', '.', '-.', '+.'].includes(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
const toOptionalNonNegative = (value) => {
  const parsed = parseNumberish(value);
  if (parsed === null) return null;
  if (parsed < 0) return null;
  return parsed;
};
const toObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {}
);
const slugify = (value) => (
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
);

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {
    input: DEFAULT_INPUT_PATH,
    report: DEFAULT_REPORT_PATH,
    dryRun: false,
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }
    if (arg === '--input') {
      parsed.input = path.resolve(process.cwd(), args[i + 1] || '');
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

const readJsonFile = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
};

const uniqueById = (rows) => {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
};

const addLookup = (map, key, product) => {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) return;
  if (!map.has(normalizedKey)) map.set(normalizedKey, []);
  map.set(normalizedKey, uniqueById([...map.get(normalizedKey), product]));
};

const getUniqueMatch = (map, key) => {
  const list = map.get(String(key || '').trim()) || [];
  if (list.length === 1) return { product: list[0], ambiguous: false };
  if (list.length > 1) return { product: null, ambiguous: true };
  return { product: null, ambiguous: false };
};

const buildProductLookups = (products) => {
  const byBarcodeDigits = new Map();
  const byNameNorm = new Map();
  const byNameCompact = new Map();

  for (const product of products) {
    const meta = toObject(product.meta);
    const barcodeCandidates = [
      product.sku,
      meta.barcode,
      meta.BARCODE,
      meta.barCode,
      meta.productBarcode,
      meta.product_barcode,
      meta.barcodeNo,
      meta.barcodeNumber,
      meta.upc,
      meta.ean,
      meta.gtin,
      meta.code,
    ];

    for (const candidate of barcodeCandidates) {
      const barcodeDigits = digitsOnly(candidate);
      if (barcodeDigits) addLookup(byBarcodeDigits, barcodeDigits, product);
    }

    const nameNorm = norm(product.name);
    const nameCompact = compact(product.name);
    if (nameNorm) addLookup(byNameNorm, nameNorm, product);
    if (nameCompact) addLookup(byNameCompact, nameCompact, product);
  }

  return { byBarcodeDigits, byNameNorm, byNameCompact };
};

const sheetOverrides = {
  'highest group supermarket': {
    groupName: 'highest group supermarket',
    customerGroupHints: ['supermarkets customers', 'supermarket customers', 'supermarket'],
  },
  'pet shop & veterinary clinic': {
    groupName: 'Pet Shop & Veterinary Clinic',
    customerGroupHints: ['pet food customer group', 'pet food customer', 'pet food'],
  },
};

const resolveSheetConfig = (sheetNameRaw) => {
  const normalized = norm(sheetNameRaw);
  const override = sheetOverrides[normalized];
  if (override) {
    return {
      sheetName: sheetNameRaw,
      groupName: override.groupName,
      customerGroupHints: override.customerGroupHints,
    };
  }
  return {
    sheetName: sheetNameRaw,
    groupName: String(sheetNameRaw || '').trim(),
    customerGroupHints: [],
  };
};

const findCustomerGroupByHints = (customerGroups, hints) => {
  if (!Array.isArray(hints) || hints.length === 0) return null;
  const normalizedHints = hints.map((hint) => norm(hint)).filter(Boolean);
  for (const hint of normalizedHints) {
    const exact = customerGroups.find((group) => norm(group.name) === hint);
    if (exact) return exact;
  }
  for (const hint of normalizedHints) {
    const loose = customerGroups.find((group) => norm(group.name).includes(hint) || hint.includes(norm(group.name)));
    if (loose) return loose;
  }
  return null;
};

const firstNonNegative = (...values) => {
  for (const value of values) {
    const parsed = toOptionalNonNegative(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const clampPercent = (value) => Math.min(100, Math.max(0, Number(value || 0)));

const resolveRowPrice = (row) => firstNonNegative(
  row?.overridePrice,
  row?.groupPrice,
  row?.unitPrice,
  row?.price,
  row?.finalPrice,
  row?.rawPrice,
  row?.['override price'],
  row?.['group price'],
  row?.['unit price'],
  row?.['final price'],
);

const resolveRowDiscount = (row, fallbackDiscount = 0) => {
  const parsed = firstNonNegative(
    row?.overrideDiscount,
    row?.override_discount,
    row?.overrideDiscountPercent,
    row?.override_discount_percent,
    row?.['override discount (%)'],
    row?.['override discount %'],
    row?.['override discount'],
    row?.discount,
    row?.discountPercent,
    row?.discount_percent,
    row?.['discount (%)'],
    row?.['discount %'],
    row?.['discount'],
  );
  if (parsed === null) return round3(clampPercent(fallbackDiscount));
  return round3(clampPercent(parsed));
};

async function main() {
  const { input, report, dryRun } = parseArgs();
  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  const payload = readJsonFile(input);
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error(`Input file is empty or invalid JSON array: ${input}`);
  }

  const [products, existingGroups, customerGroups] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, name: true, sku: true, sellingPrice: true, meta: true },
      orderBy: { name: 'asc' },
    }),
    prisma.sellingPriceGroup.findMany({
      select: { id: true, name: true, description: true, discount: true, priceCalcPercentage: true, meta: true },
      orderBy: { name: 'asc' },
    }),
    prisma.customerGroup.findMany({
      select: { id: true, name: true, discountPercent: true, meta: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const lookups = buildProductLookups(products);
  const existingByNormName = new Map(existingGroups.map((group) => [norm(group.name), group]));

  const nowIso = new Date().toISOString();
  const sheetSummaries = [];
  const upserts = [];
  const customerGroupLinks = [];
  let totalPricedRows = 0;
  let totalMatchedRows = 0;
  let totalUnmatchedRows = 0;
  let totalRowsWithDiscountOverride = 0;

  for (const sheet of payload) {
    const sourceRows = Array.isArray(sheet?.rows) ? sheet.rows : [];
    const config = resolveSheetConfig(sheet?.sheetName || sheet?.fileName || 'Unnamed Sheet');
    const existingGroup = existingByNormName.get(norm(config.groupName));
    const existingMeta = toObject(existingGroup?.meta);
    const defaultDiscount = Number.isFinite(Number(existingGroup?.discount))
      ? Number(existingGroup.discount)
      : 0;
    const targetGroupId = String(existingGroup?.id || `SPG-${slugify(config.groupName) || 'PRICE-GROUP'}`);

    const matchedRulesByProductId = new Map();
    const unmatchedRows = [];
    let sheetPricedRows = 0;
    let sheetMatchedRows = 0;
    let sheetRowsWithDiscountOverride = 0;

    for (const row of sourceRows) {
      const parsedPrice = resolveRowPrice(row);
      if (parsedPrice === null) continue;
      sheetPricedRows += 1;

      const barcodeKey = digitsOnly(row?.barcode);
      const descriptionNorm = norm(row?.description);
      const descriptionCompact = compact(row?.description);

      let match = null;
      let matchedBy = '';
      let ambiguous = false;

      if (barcodeKey) {
        const barcodeMatch = getUniqueMatch(lookups.byBarcodeDigits, barcodeKey);
        if (barcodeMatch.product) {
          match = barcodeMatch.product;
          matchedBy = 'barcode';
        } else if (barcodeMatch.ambiguous) {
          ambiguous = true;
        }
      }

      if (!match && !ambiguous && descriptionNorm) {
        const byName = getUniqueMatch(lookups.byNameNorm, descriptionNorm);
        if (byName.product) {
          match = byName.product;
          matchedBy = 'name';
        } else if (byName.ambiguous) {
          ambiguous = true;
        }
      }

      if (!match && !ambiguous && descriptionCompact) {
        const byCompact = getUniqueMatch(lookups.byNameCompact, descriptionCompact);
        if (byCompact.product) {
          match = byCompact.product;
          matchedBy = 'compact-name';
        } else if (byCompact.ambiguous) {
          ambiguous = true;
        }
      }

      if (!match) {
        unmatchedRows.push({
          barcode: row?.barcode || '',
          description: row?.description || '',
          price: round3(parsedPrice),
          reason: ambiguous ? 'ambiguous-match' : 'no-match',
        });
        continue;
      }

      sheetMatchedRows += 1;
      const resolvedDiscount = resolveRowDiscount(row, defaultDiscount);
      if (resolvedDiscount !== round3(defaultDiscount)) {
        sheetRowsWithDiscountOverride += 1;
      }
      matchedRulesByProductId.set(match.id, {
        id: match.id,
        name: match.name,
        sku: match.sku,
        price: round3(parsedPrice),
        discount: resolvedDiscount,
        matchedBy,
      });
    }

    const applicableProducts = Array.from(matchedRulesByProductId.values()).map((rule) => ({
      id: rule.id,
      name: rule.name,
      sku: rule.sku,
      price: rule.price,
      discount: rule.discount,
    }));

    const payTermDays = Number.isFinite(Number(existingMeta.payTermDays))
      ? Number(existingMeta.payTermDays)
      : 0;
    const payTermUnit = String(existingMeta.payTermUnit || 'Days') === 'Months' ? 'Months' : 'Days';
    const taxRate = Number.isFinite(Number(existingMeta.taxRate)) ? Number(existingMeta.taxRate) : 5;
    const status = String(existingMeta.status || 'Active').toLowerCase() === 'inactive' ? 'Inactive' : 'Active';

    const nextMeta = {
      ...existingMeta,
      payTermDays,
      payTermUnit,
      taxRate: round3(taxRate),
      status,
      applicableProducts,
      importSource: {
        fileName: String(sheet?.fileName || ''),
        sheetName: String(sheet?.sheetName || ''),
        importedAt: nowIso,
        pricedRows: sheetPricedRows,
        matchedRows: sheetMatchedRows,
        unmatchedRows: unmatchedRows.length,
      },
    };

    const upsertPayload = {
      id: targetGroupId,
      name: config.groupName,
      description: String(existingGroup?.description || `Imported from ${sheet?.fileName || config.groupName}`),
      discount: round3(defaultDiscount),
      priceCalcPercentage: Number.isFinite(Number(existingGroup?.priceCalcPercentage))
        ? round3(existingGroup.priceCalcPercentage)
        : 0,
      meta: nextMeta,
    };

    upserts.push(upsertPayload);

    const linkedCustomerGroup = findCustomerGroupByHints(customerGroups, config.customerGroupHints);
    if (linkedCustomerGroup) {
      customerGroupLinks.push({
        customerGroupId: linkedCustomerGroup.id,
        customerGroupName: linkedCustomerGroup.name,
        sellingPriceGroupId: targetGroupId,
        sellingPriceGroupName: config.groupName,
      });
    }

    totalPricedRows += sheetPricedRows;
    totalMatchedRows += sheetMatchedRows;
    totalUnmatchedRows += unmatchedRows.length;
    totalRowsWithDiscountOverride += sheetRowsWithDiscountOverride;

    sheetSummaries.push({
      fileName: sheet?.fileName || '',
      sheetName: sheet?.sheetName || '',
      groupName: config.groupName,
      groupId: targetGroupId,
      pricedRows: sheetPricedRows,
      matchedRows: sheetMatchedRows,
      unmatchedRows: unmatchedRows.length,
      rowsWithDiscountOverride: sheetRowsWithDiscountOverride,
      customerGroupLinked: linkedCustomerGroup
        ? { id: linkedCustomerGroup.id, name: linkedCustomerGroup.name }
        : null,
      unmatchedSample: unmatchedRows.slice(0, 10),
    });
  }

  if (!dryRun) {
    await prisma.$transaction(async (tx) => {
      for (const payloadRow of upserts) {
        await tx.sellingPriceGroup.upsert({
          where: { id: payloadRow.id },
          update: {
            name: payloadRow.name,
            description: payloadRow.description,
            discount: payloadRow.discount,
            priceCalcPercentage: payloadRow.priceCalcPercentage,
            meta: payloadRow.meta,
          },
          create: {
            id: payloadRow.id,
            name: payloadRow.name,
            description: payloadRow.description,
            discount: payloadRow.discount,
            priceCalcPercentage: payloadRow.priceCalcPercentage,
            meta: payloadRow.meta,
          },
        });
      }

      for (const link of customerGroupLinks) {
        const existingGroup = await tx.customerGroup.findUnique({
          where: { id: link.customerGroupId },
          select: { meta: true },
        });
        const existingMeta = toObject(existingGroup?.meta);
        const nextMeta = {
          ...existingMeta,
          sellingPriceGroupId: link.sellingPriceGroupId,
          sellingPriceGroup: link.sellingPriceGroupName,
        };
        await tx.customerGroup.update({
          where: { id: link.customerGroupId },
          data: { meta: nextMeta },
        });
      }
    }, { timeout: 180000 });
  }

  const reportPayload = {
    generatedAt: nowIso,
    dryRun,
    inputFile: input,
    sheetsProcessed: sheetSummaries.length,
    totals: {
      pricedRows: totalPricedRows,
      matchedRows: totalMatchedRows,
      unmatchedRows: totalUnmatchedRows,
      rowsWithDiscountOverride: totalRowsWithDiscountOverride,
      matchRatePercent: totalPricedRows > 0 ? round3((totalMatchedRows / totalPricedRows) * 100) : 0,
      groupsUpserted: upserts.length,
      customerGroupLinksUpdated: customerGroupLinks.length,
    },
    sheets: sheetSummaries,
  };

  const reportDir = path.dirname(report);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(report, `${JSON.stringify(reportPayload, null, 2)}\n`, 'utf8');

  console.log('[ops:import-price-lists] done');
  console.log(JSON.stringify({
    dryRun,
    sheets: sheetSummaries.length,
    groupsUpserted: upserts.length,
    pricedRows: totalPricedRows,
    matchedRows: totalMatchedRows,
    unmatchedRows: totalUnmatchedRows,
    rowsWithDiscountOverride: totalRowsWithDiscountOverride,
    matchRatePercent: reportPayload.totals.matchRatePercent,
    report,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[ops:import-price-lists] failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
