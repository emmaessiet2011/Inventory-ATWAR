import fs from 'node:fs';
import path from 'node:path';
import { listFilesRecursive, repoRoot } from './fs-utils.mjs';

const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const rel = (filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/');

const srcRoot = path.join(repoRoot, 'src');
const serverPath = path.join(repoRoot, 'server', 'index.mjs');
const apiClientPath = path.join(srcRoot, 'utils', 'apiClient.ts');

const failures = [];
const addFailure = (message) => failures.push(message);

const serverText = read(serverPath);
const apiClientText = read(apiClientPath);

const extractCaseBlock = (resource) => {
  const startToken = `case '${resource}': {`;
  const start = serverText.indexOf(startToken);
  if (start < 0) return '';
  const end = serverText.indexOf('\n        break;', start);
  if (end < 0) return serverText.slice(start);
  return serverText.slice(start, end);
};

const assertContainsAll = (label, block, expectedTokens) => {
  if (!block) {
    addFailure(`[mapper] Missing switch case for ${label}`);
    return;
  }
  for (const token of expectedTokens) {
    if (!block.includes(token)) {
      addFailure(`[mapper] ${label} missing token '${token}'`);
    }
  }
};

// --- 1) Ensure old snapshot endpoints remain disabled ---
if (!serverText.includes("app.get('/api/sync/collection/:key'") || !serverText.includes('sendLegacySnapshotGone')) {
  addFailure("[endpoint] Legacy /api/sync/collection endpoints are expected to stay disabled (410).");
}

// --- 2) Ensure API fetch path merges canonical row + meta ---
if (!apiClientText.includes('return ({ ...row, ...(meta as Record<string, unknown>) } as T);')) {
  addFailure('[apiClient] apiFetchAll must merge DB row + meta snapshot to avoid field loss.');
}

// --- 3) Validate critical generic /api/sync/record mapper coverage ---
const requiredMapperTokens = {
  products: [
    'name:',
    'sku:',
    'type:',
    'categoryId',
    'brandId',
    'unitId',
    'warrantyId',
    'taxRateId',
    'packagingType:',
    'unitsPerPackage:',
    'unitPurchasePrice:',
    'sellingPrice:',
    'stock:',
    'alertQuantity:',
    'image:',
  ],
  customers: [
    'businessName:',
    'name:',
    'email:',
    'mobile:',
    'taxNumber:',
    'customerGroupId',
    'status:',
    'creditLimit:',
    'openingBalance:',
    'advanceBalance:',
    'totalSellDue:',
    'totalSellReturnDue:',
  ],
  suppliers: [
    'businessName:',
    'name:',
    'email:',
    'mobile:',
    'taxNumber:',
    'status:',
    'openingBalance:',
    'advanceBalance:',
    'totalPurchaseDue:',
    'totalReturnDue:',
  ],
  sales: [
    'customerId',
    'locationId',
    'taxRateId',
    'paymentAccountId',
    'addedById',
    'salesRepresentativeId',
    'deliveryPersonId',
    'status:',
    'paymentStatus:',
    'shippingStatus:',
    'subTotal:',
    'discountAmount:',
    'taxAmount:',
    'shippingCharges:',
    'grandTotal:',
    'totalPaid:',
    'sellDue:',
    'sellReturnDue:',
  ],
  payments: [
    'customerId',
    'supplierId',
    'expenseId',
    'locationId',
    'accountId',
    'date:',
    'contactType:',
    'direction:',
    'referenceNo:',
    'method:',
    'amount:',
  ],
  users: [
    'username:',
    'name:',
    'email:',
    'roleId',
    'locationId',
    'mobile:',
    'status:',
    'commissionPercent:',
    'maxDiscountPercent:',
    'allowLogin:',
  ],
  expenses: [
    'categoryId',
    'locationId',
    'taxRateId',
    'paymentAccountId',
    'addedById',
    'amount:',
    'tax:',
    'totalAmount:',
    'paymentStatus:',
    'paymentDue:',
  ],
  purchases: [
    'supplierId',
    'locationId',
    'taxRateId',
    'addedById',
    'status:',
    'paymentStatus:',
    'subTotal:',
    'taxAmount:',
    'discountAmount:',
    'grandTotal:',
    'paymentDue:',
  ],
  sellReturns: [
    'saleId',
    'customerId',
    'locationId',
    'paymentStatus:',
    'subTotal:',
    'discountAmount:',
    'taxAmount:',
    'grandTotal:',
    'totalRefunded:',
  ],
  purchaseReturns: [
    'purchaseId',
    'supplierId',
    'locationId',
    'paymentStatus:',
    'subTotal:',
    'discountAmount:',
    'taxAmount:',
    'grandTotal:',
    'totalRefunded:',
  ],
  orders: [
    'customerId',
    'locationId',
    'addedById',
    'approvedById',
    'deliveryDate:',
    'status:',
    'paymentStatus:',
    'orderType:',
    'subTotal:',
    'taxAmount:',
    'discountAmount:',
    'total:',
    'isApproved:',
  ],
  locations: [
    'name:',
    'city:',
    'state:',
    'country:',
    'mobile:',
    'email:',
    'isActive:',
    'invoiceSchemeId',
    'invoiceLayoutPosId',
    'invoiceLayoutSaleId',
    'receiptPrinterId',
  ],
  settings: [
    'businessName:',
    'currency:',
    'currencySymbol:',
    'currencyPrecision:',
    'quantityPrecision:',
    'salesInvoicePrefix:',
    'purchasePrefix:',
    'quotationPrefix:',
    'paymentPrefix:',
    'stockTransferPrefix:',
    'stockAdjustmentPrefix:',
    'sellReturnPrefix:',
    'defaultSalePaymentMethod:',
    'defaultPurchasePaymentMethod:',
    'themeColor:',
  ],
};

for (const [resource, tokens] of Object.entries(requiredMapperTokens)) {
  assertContainsAll(`/api/sync/record/${resource}`, extractCaseBlock(resource), tokens);
}

// --- 4) Validate dedicated mapper coverage ---
const dedicatedBlocks = [
  {
    label: '/api/sync/field-payments/:id',
    anchor: "app.put('/api/sync/field-payments/:id'",
    tokens: ['referenceNo:', 'customerId', 'locationId', 'accountId', 'date:', 'amount:', 'method:', 'status:', 'note:'],
  },
  {
    label: '/api/sync/payment-accounts/:id',
    anchor: "app.put('/api/sync/payment-accounts/:id'",
    tokens: ['name:', 'locationId', 'typeId', 'accountNumber:', 'balance:', 'status:', 'isSystem:'],
  },
  {
    label: '/api/sync/register-sessions/:id',
    anchor: "app.put('/api/sync/register-sessions/:id'",
    tokens: ['locationId', 'openedById', 'closedById', 'openedAt:', 'closedAt:', 'status:', 'cashInHand:', 'closingBalance:'],
  },
  {
    label: '/api/sync/register-transactions/:id',
    anchor: "app.put('/api/sync/register-transactions/:id'",
    tokens: ['sessionId', 'date:', 'transactionType:', 'amount:', 'method:', 'invoiceNo:', 'note:'],
  },
  {
    label: '/api/sync/stock-ledger/:id',
    anchor: "app.put('/api/sync/stock-ledger/:id'",
    tokens: ['productId', 'saleId', 'locationId', 'entryType:', 'changeQty:', 'newQty:', 'date:', 'ref:', 'party:', 'note:'],
  },
  {
    label: '/api/sync/stock-adjustments/:id',
    anchor: "app.put('/api/sync/stock-adjustments/:id'",
    tokens: ['referenceNo:', 'date:', 'locationId', 'adjustmentType:', 'reason:', 'totalAmount:', 'totalRecovered:'],
  },
  {
    label: '/api/sync/stock-transfers/:id',
    anchor: "app.put('/api/sync/stock-transfers/:id'",
    tokens: ['refNo:', 'date:', 'locationFromId', 'locationToId', 'status:', 'shippingCharges:', 'totalAmount:', 'note:'],
  },
  {
    label: '/api/sync/stock-lots/:id',
    anchor: "app.put('/api/sync/stock-lots/:id'",
    tokens: ['productId', 'locationId', 'lotNumber:', 'expiryDate:', 'unitCost:', 'qty:'],
  },
];

for (const item of dedicatedBlocks) {
  const start = serverText.indexOf(item.anchor);
  if (start < 0) {
    addFailure(`[dedicated] Missing endpoint ${item.label}`);
    continue;
  }
  const end = serverText.indexOf('\napp.', start + item.anchor.length);
  const block = end < 0 ? serverText.slice(start) : serverText.slice(start, end);
  for (const token of item.tokens) {
    if (!block.includes(token)) {
      addFailure(`[dedicated] ${item.label} missing token '${token}'`);
    }
  }
}

// --- 5) Detect business-data localStorage writes ---
const allowedStoragePatterns = [
  /atwar_auth_token/,
  /AUTH_REMEMBER_ME_STORAGE_KEY/,
  /AUTH_PERSISTENT_STORAGE_KEY/,
  /AUTH_SESSION_STORAGE_KEY/,
  /REMEMBER_IDENTIFIER_KEY/,
  /app_customer_custom_columns/,
  /app_supplier_custom_columns/,
  /CHEQUE_REMINDER_KEY/,
  /atwar_notification_seen_activity_ids/,
  /viewsStorageKey/,
  /stickyStorageKey/,
  /seenActivityStorageKey/,
];
const allowedStorageFileSuffixes = [
  'src/components/dashboard/Dashboard.tsx',
  'src/context/NotificationContext.tsx',
];

const srcFiles = listFilesRecursive(srcRoot, (filePath) => /\.(ts|tsx)$/.test(filePath));
for (const filePath of srcFiles) {
  const content = read(filePath);
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.includes('localStorage.setItem') && !line.includes('sessionStorage.setItem')) continue;
    const fileKey = rel(filePath);
    if (allowedStorageFileSuffixes.some((suffix) => fileKey.endsWith(suffix))) continue;
    const isAllowed = allowedStoragePatterns.some((pattern) => pattern.test(line));
    if (!isAllowed) {
      addFailure(`[storage] Potential business local storage write at ${fileKey}:${i + 1}`);
    }
  }
}

if (failures.length > 0) {
  console.error('\nPostgres integrity audit failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Postgres integrity audit passed.');
