import 'dotenv/config';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { PrismaClient, Prisma } from '@prisma/client';
import { generateToken, verifyPassword, requireAuth, hashPassword } from './auth.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '.env'), override: false });
} catch {}

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';
const frontendOrigin = String(process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

app.use(cors({ origin: frontendOrigin.length > 0 ? frontendOrigin : true, credentials: true }));
app.use(express.json({ limit: '20mb' }));

const toArray = (v) => (Array.isArray(v) ? v : []);
const toObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const parseJson = (raw, fallback) => {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};
const parseIntSafe = (v, fallback, min = 1, max = 1000) => {
  const n = Number.parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};
const toFiniteNumber = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const normalized = trimmed.replace(/,/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const toOptionalFiniteNumber = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = toFiniteNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
};
const normalizePolicyText = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const isEngineOilCategory = (category) => normalizePolicyText(category).includes('engine oil');
const resolveSaleLocationCategoryPolicy = (locationName) => {
  const normalizedLocation = normalizePolicyText(locationName);
  if (!normalizedLocation) return { mode: 'allow_all' };
  const compactLocation = normalizedLocation.replace(/\s+/g, '');
  if (normalizedLocation.includes('kennol workshop')) return { mode: 'only_engine_oil' };
  const isO2Petshop = normalizedLocation.includes('o2 pet shop') || compactLocation.includes('o2petshop');
  const isBarkaOrMowalah = normalizedLocation.includes('barka') || normalizedLocation.includes('mowalah');
  if (isO2Petshop && isBarkaOrMowalah) return { mode: 'exclude_engine_oil' };
  return { mode: 'allow_all' };
};
const isProductAllowedBySaleLocationPolicy = (categoryName, policyMode) => {
  if (policyMode === 'allow_all') return true;
  const isEngineOil = isEngineOilCategory(categoryName);
  if (policyMode === 'only_engine_oil') return isEngineOil;
  return !isEngineOil;
};
const extractSaleItems = (raw) => {
  const directItems = toArray(raw.items);
  if (directItems.length > 0) return directItems;
  const nestedMeta = toObject(raw.meta);
  return toArray(nestedMeta.items);
};
const CRITICAL_ADMIN_EMAIL = 'admin@atwar.com';
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const isCriticalAdminEmail = (value) => normalizeEmail(value) === CRITICAL_ADMIN_EMAIL;
const isUserLoginEnabled = (user) =>
  String(user?.status || '').trim().toUpperCase() === 'ACTIVE' &&
  user?.allowLogin !== false;
const resolveUserRoleLabel = (user) => {
  const meta = toObject(user?.meta);
  const relationRoleName = String(toObject(user?.role).name || '').trim();
  const directRole = typeof user?.role === 'string' ? user.role : '';
  return String(
    directRole
    || relationRoleName
    || user?.roleName
    || user?.userRole
    || meta.role
    || meta.roleName
    || meta.userRole
    || '',
  ).trim();
};
const serializeAppUser = (user) => {
  const role = resolveUserRoleLabel(user);
  const meta = toObject(user?.meta);
  return {
    ...user,
    role,
    roleName: role,
    userRole: role,
    meta: {
      ...meta,
      ...(role ? { role, roleName: role, userRole: role } : {}),
    },
  };
};
const SALE_ARCHIVE_KEYS = ['deletedAt', 'archivedAt', 'deletedBy', 'deletedById'];
const isArchivedSaleRecord = (sale) => {
  const meta = toObject(sale?.meta);
  return SALE_ARCHIVE_KEYS.some((key) => String(meta[key] || '').trim());
};
const serializeSaleRecord = (sale) => {
  const meta = toObject(sale?.meta);
  const locationName = String(sale?.location?.name || meta.location || meta.businessLocation || '').trim();
  const addedByName = String(sale?.addedBy?.name || sale?.addedBy?.username || meta.addedBy || '').trim();
  const addedById = String(sale?.addedById || meta.addedById || '').trim();
  return {
    ...sale,
    location: locationName,
    addedBy: addedByName || undefined,
    addedById: addedById || undefined,
    meta: {
      ...meta,
      ...(locationName ? { location: locationName } : {}),
      ...(addedByName ? { addedBy: addedByName } : {}),
      ...(addedById ? { addedById } : {}),
    },
  };
};
const compactSaleAuditSnapshot = (sale) => {
  const meta = toObject(sale?.meta);
  return {
    id: sale?.id,
    invoiceNo: sale?.invoiceNo,
    date: sale?.date,
    locationId: sale?.locationId,
    location: sale?.location?.name || meta.location || meta.businessLocation || null,
    addedById: sale?.addedById || meta.addedById || null,
    addedBy: sale?.addedBy?.name || sale?.addedBy?.username || meta.addedBy || null,
    customerId: sale?.customerId || meta.customerId || null,
    customerName: sale?.customer?.businessName || sale?.customer?.name || meta.customerName || null,
    status: sale?.status,
    paymentStatus: sale?.paymentStatus,
    grandTotal: sale?.grandTotal,
    totalPaid: sale?.totalPaid,
    sellDue: sale?.sellDue,
    totalItems: Array.isArray(sale?.items) ? sale.items.length : meta.totalItems,
  };
};
const archiveSaleRecord = async (id, req) => {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      location: { select: { id: true, name: true } },
      addedBy: { select: { id: true, name: true, username: true, email: true } },
      customer: { select: { id: true, businessName: true, name: true } },
      items: { select: { id: true } },
    },
  });
  if (!sale) return null;

  const now = new Date().toISOString();
  const currentMeta = toObject(sale.meta);
  const actorId = String(req.user?.id || '').trim() || null;
  let actorName = String(req.user?.username || req.user?.email || '').trim();
  if (actorId) {
    const actor = await prisma.appUser.findUnique({
      where: { id: actorId },
      select: { name: true, username: true, email: true },
    }).catch(() => null);
    actorName = String(actor?.name || actor?.username || actor?.email || actorName || 'System').trim();
  }

  const archiveMeta = {
    ...currentMeta,
    archived: true,
    archivedAt: currentMeta.archivedAt || now,
    deletedAt: currentMeta.deletedAt || now,
    deletedById: currentMeta.deletedById || actorId,
    deletedBy: currentMeta.deletedBy || actorName || 'System',
    deleteMode: 'archived',
    archiveSnapshot: currentMeta.archiveSnapshot || compactSaleAuditSnapshot(sale),
  };

  await prisma.sale.update({
    where: { id },
    data: { meta: archiveMeta },
  });
  return { sale, meta: archiveMeta };
};

const enforceCriticalAdminStatus = async (userId) => {
  const id = String(userId || '').trim();
  if (!id) return null;
  try {
    return await prisma.appUser.update({
      where: { id },
      data: { status: 'ACTIVE', allowLogin: true },
    });
  } catch {
    return null;
  }
};
const RESOURCE_CONFIG = {
  users: { delegate: 'appUser', idField: 'id', searchFields: ['name', 'email', 'username'], defaultOrderBy: { updatedAt: 'desc' } },
  roles: { delegate: 'role', idField: 'id', searchFields: ['name'], defaultOrderBy: { name: 'asc' } },
  permissions: { delegate: 'permission', idField: 'id', searchFields: ['code', 'label', 'module'], defaultOrderBy: { module: 'asc' } },
  locations: { delegate: 'location', idField: 'id', searchFields: ['name', 'city'], defaultOrderBy: { name: 'asc' } },
  customers: { delegate: 'customer', idField: 'id', searchFields: ['businessName', 'name', 'mobile'], defaultOrderBy: { updatedAt: 'desc' } },
  suppliers: { delegate: 'supplier', idField: 'id', searchFields: ['businessName', 'name', 'mobile'], defaultOrderBy: { updatedAt: 'desc' } },
  products: { delegate: 'product', idField: 'id', searchFields: ['name', 'sku'], defaultOrderBy: { updatedAt: 'desc' } },
  productCategories: { delegate: 'productCategory', idField: 'id', searchFields: ['name'], defaultOrderBy: { name: 'asc' } },
  productBrands: { delegate: 'productBrand', idField: 'id', searchFields: ['name'], defaultOrderBy: { name: 'asc' } },
  productUnits: { delegate: 'productUnit', idField: 'id', searchFields: ['name', 'shortName'], defaultOrderBy: { name: 'asc' } },
  productWarranties: { delegate: 'productWarranty', idField: 'id', searchFields: ['name'], defaultOrderBy: { name: 'asc' } },
  productVariations: { delegate: 'productVariation', idField: 'id', searchFields: ['name'], defaultOrderBy: { name: 'asc' } },
  productInventory: { delegate: 'productInventory', idField: 'id', searchFields: ['lotNumber', 'rack', 'row', 'position'], defaultOrderBy: { updatedAt: 'desc' } },
  stockTransfers: { delegate: 'stockTransfer', idField: 'id', searchFields: ['refNo'], defaultOrderBy: { date: 'desc' } },
  stockTransferItems: { delegate: 'stockTransferItem', idField: 'id', searchFields: ['productName', 'sku'], defaultOrderBy: { id: 'asc' } },
  stockAdjustments: { delegate: 'stockAdjustment', idField: 'id', searchFields: ['referenceNo'], defaultOrderBy: { date: 'desc' } },
  stockAdjustmentItems: { delegate: 'stockAdjustmentItem', idField: 'id', searchFields: ['productName', 'sku'], defaultOrderBy: { id: 'asc' } },
  stockLots: { delegate: 'stockLot', idField: 'id', searchFields: ['lotNumber'], defaultOrderBy: { updatedAt: 'desc' } },
  stockLedger: { delegate: 'stockLedger', idField: 'id', searchFields: ['entryType', 'ref', 'party', 'note'], defaultOrderBy: { date: 'desc' } },
  purchases: { delegate: 'purchase', idField: 'id', searchFields: ['refNo'], defaultOrderBy: { date: 'desc' } },
  purchaseItems: { delegate: 'purchaseItem', idField: 'id', searchFields: ['name'], defaultOrderBy: { id: 'asc' } },
  purchaseRequisitions: { delegate: 'purchaseRequisition', idField: 'id', searchFields: ['referenceNo', 'supplier', 'location'], defaultOrderBy: { date: 'desc' } },
  purchaseOrders: { delegate: 'purchaseOrder', idField: 'id', searchFields: ['referenceNo', 'supplierName', 'location'], defaultOrderBy: { orderDate: 'desc' } },
  purchaseReturns: { delegate: 'purchaseReturn', idField: 'id', searchFields: ['refNo'], defaultOrderBy: { date: 'desc' } },
  purchaseReturnItems: { delegate: 'purchaseReturnItem', idField: 'id', searchFields: ['name'], defaultOrderBy: { id: 'asc' } },
  sales: { delegate: 'sale', idField: 'id', searchFields: ['invoiceNo'], defaultOrderBy: { date: 'desc' } },
  saleItems: { delegate: 'saleItem', idField: 'id', searchFields: ['name'], defaultOrderBy: { id: 'asc' } },
  saleShippingActivities: { delegate: 'saleShippingActivity', idField: 'id', searchFields: ['action', 'by', 'note'], defaultOrderBy: { date: 'desc' } },
  sellReturns: { delegate: 'sellReturn', idField: 'id', searchFields: ['refNo'], defaultOrderBy: { date: 'desc' } },
  sellReturnItems: { delegate: 'sellReturnItem', idField: 'id', searchFields: ['name'], defaultOrderBy: { id: 'asc' } },
  // Keep both keys for backward compatibility with existing frontend calls.
  orders: { delegate: 'salesOrder', idField: 'id', searchFields: ['orderNumber'], defaultOrderBy: { orderDate: 'desc' } },
  salesOrders: { delegate: 'salesOrder', idField: 'id', searchFields: ['orderNumber'], defaultOrderBy: { orderDate: 'desc' } },
  salesOrderItems: { delegate: 'salesOrderItem', idField: 'id', searchFields: ['name'], defaultOrderBy: { id: 'asc' } },
  salesRepresentatives: { delegate: 'salesRepresentative', idField: 'id', searchFields: ['name', 'contactNo'], defaultOrderBy: { name: 'asc' } },
  discounts: { delegate: 'discount', idField: 'id', searchFields: ['name'], defaultOrderBy: { startsAt: 'desc' } },
  payments: { delegate: 'payment', idField: 'id', searchFields: ['referenceNo', 'method'], defaultOrderBy: { date: 'desc' } },
  paymentAllocations: { delegate: 'paymentAllocation', idField: 'id', searchFields: ['invoiceNo'], defaultOrderBy: { id: 'asc' } },
  fieldPayments: { delegate: 'fieldPayment', idField: 'id', searchFields: ['referenceNo'], defaultOrderBy: { date: 'desc' } },
  fieldPaymentAllocations: { delegate: 'fieldPaymentAllocation', idField: 'id', searchFields: ['invoiceNo'], defaultOrderBy: { id: 'asc' } },
  paymentAccounts: { delegate: 'paymentAccount', idField: 'id', searchFields: ['name', 'accountNumber'], defaultOrderBy: { name: 'asc' } },
  paymentAccountTypes: { delegate: 'paymentAccountType', idField: 'id', searchFields: ['name'], defaultOrderBy: { name: 'asc' } },
  paymentAccountTransactions: { delegate: 'paymentAccountTransaction', idField: 'id', searchFields: ['refType', 'refId', 'note'], defaultOrderBy: { date: 'desc' } },
  expenses: { delegate: 'expense', idField: 'id', searchFields: ['refNo'], defaultOrderBy: { date: 'desc' } },
  expenseCategories: { delegate: 'expenseCategory', idField: 'id', searchFields: ['name'], defaultOrderBy: { name: 'asc' } },
  notifications: { delegate: 'notification', idField: 'id', searchFields: ['title', 'message'], defaultOrderBy: { timestamp: 'desc' } },
  activityLogs: { delegate: 'activityLog', idField: 'id', searchFields: ['module', 'description'], defaultOrderBy: { date: 'desc' } },
  registerSessions: { delegate: 'registerSession', idField: 'id', searchFields: ['status'], defaultOrderBy: { openedAt: 'desc' } },
  registerTransactions: { delegate: 'registerTransaction', idField: 'id', searchFields: ['transactionType', 'method', 'invoiceNo', 'note'], defaultOrderBy: { date: 'desc' } },
  settings: { delegate: 'appSetting', idField: 'id', singletonId: 'SETTINGS', searchFields: ['businessName', 'currency'], defaultOrderBy: { updatedAt: 'desc' } },
  currencies: { delegate: 'currency', idField: 'code', searchFields: ['code', 'name'], defaultOrderBy: { code: 'asc' } },
  taxRates: { delegate: 'taxRate', idField: 'id', searchFields: ['name'], defaultOrderBy: { name: 'asc' } },
  locationPaymentMethods: { delegate: 'locationPaymentMethod', idField: 'id', searchFields: ['name', 'accountNameSnapshot'], defaultOrderBy: { name: 'asc' } },
  invoiceSchemes: { delegate: 'invoiceScheme', idField: 'id', searchFields: ['name', 'prefix'], defaultOrderBy: { name: 'asc' } },
  invoiceLayouts: { delegate: 'invoiceLayout', idField: 'id', searchFields: ['name'], defaultOrderBy: { name: 'asc' } },
  barcodeSettings: { delegate: 'barcodeSetting', idField: 'id', searchFields: ['name'], defaultOrderBy: { updatedAt: 'desc' } },
  receiptPrinters: { delegate: 'receiptPrinter', idField: 'id', searchFields: ['name'], defaultOrderBy: { name: 'asc' } },
  customerGroups: { delegate: 'customerGroup', idField: 'id', searchFields: ['name'], defaultOrderBy: { name: 'asc' } },
  sellingPriceGroups: { delegate: 'sellingPriceGroup', idField: 'id', searchFields: ['name'], defaultOrderBy: { name: 'asc' } },
  customFieldDefinitions: { delegate: 'customFieldDefinition', idField: 'id', searchFields: ['key', 'label'], defaultOrderBy: { sortOrder: 'asc' } },
  customFieldValues: { delegate: 'customFieldValue', idField: 'id', searchFields: ['entityId', 'valueText'], defaultOrderBy: { updatedAt: 'desc' } },
  helpCenterCategories: { delegate: 'helpCenterCategory', idField: 'id', searchFields: ['name'], defaultOrderBy: { sortOrder: 'asc' } },
  helpCenterArticles: { delegate: 'helpCenterArticle', idField: 'id', searchFields: ['title', 'slug'], defaultOrderBy: { sortOrder: 'asc' } },
  chequeReminders: { delegate: 'chequeReminder', idField: 'id', searchFields: ['contactName', 'chequeNo', 'bankName', 'notes'], defaultOrderBy: { chequeDate: 'asc' } },
};

const getResource = (key) => RESOURCE_CONFIG[String(key || '').trim()] || null;
const sendPrismaError = (res, error, fallbackMessage) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return res.status(409).json({ ok: false, error: 'Duplicate value', code: error.code });
    if (error.code === 'P2025') return res.status(404).json({ ok: false, error: 'Record not found', code: error.code });
    if (error.code === 'P2003') return res.status(400).json({ ok: false, error: 'Invalid foreign key reference', code: error.code });
    return res.status(400).json({ ok: false, error: error.message, code: error.code });
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ ok: false, error: error.message });
  }
  return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : fallbackMessage });
};

app.get('/healthz', (_req, res) => {
  res.status(200).json({
    ok: true,
    status: 'up',
    serverTime: new Date().toISOString(),
  });
});

app.get('/api/health', async (_req, res) => {
  const timeoutMs = Number(process.env.HEALTH_DB_TIMEOUT_MS || 1500);
  try {
    await Promise.race([
      prisma.$executeRaw`SELECT 1`,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`DB ping timeout after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    return res.status(200).json({
      ok: true,
      status: 'up',
      db: 'connected',
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    // Keep this endpoint fast and non-blocking so platform health checks do not stall deploy.
    return res.status(200).json({
      ok: true,
      status: 'degraded',
      db: 'disconnected',
      serverTime: new Date().toISOString(),
      reason: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    const identifier = String(email || '').trim();
    const passwordRaw = String(password || '');
    const passwordTrimmed = passwordRaw.trim();
    if (!identifier || !passwordRaw) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' });
    }

    // Accept login by email or username, case-insensitive.
    // This prevents lockouts for accounts created with mixed-case email values.
    let user = await prisma.appUser.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { email: { equals: identifier, mode: 'insensitive' } },
          { username: { equals: identifier, mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      include: { role: { select: { name: true, isSystem: true } } },
    });

    if (user && isCriticalAdminEmail(user.email) && !isUserLoginEnabled(user)) {
      const repaired = await enforceCriticalAdminStatus(user.id);
      if (repaired) user = repaired;
    }

    if (!user || !isUserLoginEnabled(user)) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials or account inactive' });
    }

    // Backward-compat: older sync builds may have stored credential fields only in `meta`.
    // Use them for verification and repair canonical columns after successful login.
    const userMeta = toObject(user.meta);
    const fallbackPasswordHash = String(userMeta.passwordHash || '').trim();
    const fallbackPasswordSalt = String(userMeta.passwordSalt || '').trim();
    const fallbackPlainPassword = String(userMeta.password || '').trim();
    const loginUser = {
      ...user,
      passwordHash: String(user.passwordHash || '').trim() || fallbackPasswordHash || undefined,
      passwordSalt: String(user.passwordSalt || '').trim() || fallbackPasswordSalt || undefined,
      password: fallbackPlainPassword || undefined,
    };

    let authResult = await verifyPassword(passwordRaw, loginUser);
    if (!authResult.isValid && passwordTrimmed && passwordTrimmed !== passwordRaw) {
      authResult = await verifyPassword(passwordTrimmed, loginUser);
    }

    if (!authResult.isValid) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials or account inactive' });
    }

    // Heal missing credential columns from fallback meta values.
    if ((!user.passwordHash || !user.passwordSalt) && (fallbackPasswordHash || fallbackPasswordSalt)) {
      await prisma.appUser.update({
        where: { id: user.id },
        data: {
          passwordHash: fallbackPasswordHash || user.passwordHash || null,
          passwordSalt: fallbackPasswordSalt || user.passwordSalt || null,
        },
      });
    }

    // Migrate password to secure bcrypt hash seamlessly
    if (authResult.needsMigration) {
      const sourcePassword = passwordTrimmed || passwordRaw;
      const newHash = await hashPassword(sourcePassword);
      await prisma.appUser.update({
        where: { id: user.id },
        data: { passwordHash: newHash, passwordSalt: null }
      });
    }

    // Update lastLogin
    await prisma.appUser.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    const token = generateToken(user, { rememberMe: rememberMe === true });

    // Send minimal user details, NEVER send passwordHash back
    const safeUser = serializeAppUser(user);
    delete safeUser.passwordHash;
    delete safeUser.passwordSalt;
    delete safeUser.password;

    return res.json({ ok: true, token, user: safeUser });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Login failed' });
  }
});

// Protected routes
const requireActiveSessionUser = async (req, res, next) => {
  try {
    const userId = String(req.user?.id || '').trim();
    if (!userId) return res.status(401).json({ ok: false, error: 'Authentication required' });

    const account = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true, allowLogin: true },
    });
    if (!account) return res.status(401).json({ ok: false, error: 'Account not found' });

    if (isCriticalAdminEmail(account.email) && !isUserLoginEnabled(account)) {
      const repaired = await enforceCriticalAdminStatus(account.id);
      if (repaired) return next();
    }

    if (!isUserLoginEnabled(account)) {
      return res.status(401).json({ ok: false, error: 'Account inactive or login disabled' });
    }
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Authentication check failed' });
  }
};

app.use('/api/data', requireAuth, requireActiveSessionUser);
app.use('/api/sync', requireAuth, requireActiveSessionUser);
app.use('/api/options', requireAuth, requireActiveSessionUser);
app.use('/api/bootstrap', requireAuth, requireActiveSessionUser);

app.get('/api/data/resources', (_req, res) => {
  const resources = Object.entries(RESOURCE_CONFIG).map(([key, cfg]) => ({
    key,
    idField: cfg.idField,
    delegate: cfg.delegate,
    singletonId: cfg.singletonId || null,
    searchFields: cfg.searchFields || [],
  }));
  res.json({ ok: true, total: resources.length, resources });
});

app.get('/api/data/status', async (_req, res) => {
  try {
    const [users, products, customers, suppliers, sales, payments, purchases, expenses] = await prisma.$transaction([
      prisma.appUser.count(),
      prisma.product.count(),
      prisma.customer.count(),
      prisma.supplier.count(),
      prisma.sale.count(),
      prisma.payment.count(),
      prisma.purchase.count(),
      prisma.expense.count(),
    ]);
    res.json({ ok: true, counts: { users, products, customers, suppliers, sales, payments, purchases, expenses } });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to fetch data status');
  }
});

app.get('/api/data/roles/:roleId/permissions', async (req, res) => {
  try {
    const roleId = String(req.params.roleId || '').trim();
    if (!roleId) return res.status(400).json({ ok: false, error: 'roleId is required' });
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: { links: { include: { permission: true } } },
    });
    if (!role) return res.status(404).json({ ok: false, error: 'Role not found' });
    return res.json({ ok: true, roleId, permissions: role.links.map((link) => link.permission) });
  } catch (error) {
    return sendPrismaError(res, error, 'Failed to fetch role permissions');
  }
});

app.put('/api/data/roles/:roleId/permissions', async (req, res) => {
  try {
    const roleId = String(req.params.roleId || '').trim();
    const permissionIds = Array.from(new Set(
      toArray(req.body?.permissionIds).map((id) => String(id || '').trim()).filter(Boolean),
    ));
    if (!roleId) return res.status(400).json({ ok: false, error: 'roleId is required' });
    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
          skipDuplicates: true,
        });
      }
    });
    return res.json({ ok: true, roleId, permissionsUpdated: permissionIds.length });
  } catch (error) {
    return sendPrismaError(res, error, 'Failed to update role permissions');
  }
});

app.get('/api/data/:resource', async (req, res) => {
  const cfg = getResource(req.params.resource);
  if (!cfg) return res.status(404).json({ ok: false, error: 'Unknown resource' });
  try {
    const delegate = prisma[cfg.delegate];
    const page = parseIntSafe(req.query.page, 1, 1, 100000);
    const pageSize = parseIntSafe(req.query.pageSize, 25, 1, 500);
    const paginate = String(req.query.paginate || 'true').toLowerCase() !== 'false';
    const sortBy = String(req.query.sortBy || cfg.idField).trim();
    const sortDir = String(req.query.sortDir || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const search = String(req.query.q || '').trim();
    const baseWhere = toObject(parseJson(req.query.where, {}));
    const where = search && Array.isArray(cfg.searchFields) && cfg.searchFields.length > 0
      ? (Object.keys(baseWhere).length > 0
        ? { AND: [baseWhere, { OR: cfg.searchFields.map((field) => ({ [field]: { contains: search, mode: 'insensitive' } })) }] }
        : { OR: cfg.searchFields.map((field) => ({ [field]: { contains: search, mode: 'insensitive' } })) })
      : baseWhere;

    const findManyArgs = {
      where,
      orderBy: { [sortBy]: sortDir },
      ...(paginate ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
    };
    if (cfg.delegate === 'appUser') {
      findManyArgs.include = {
        role: { select: { name: true, isSystem: true } },
        location: { select: { id: true, name: true } },
      };
    } else if (cfg.delegate === 'sale') {
      findManyArgs.include = {
        location: { select: { id: true, name: true } },
        addedBy: { select: { id: true, name: true, username: true, email: true } },
      };
    }
    const [data, total] = await prisma.$transaction([
      delegate.findMany(findManyArgs),
      delegate.count({ where }),
    ]);
    const includeArchivedSales = String(req.query.includeArchived || req.query.includeDeleted || '').trim().toLowerCase() === 'true';
    const visibleData = cfg.delegate === 'sale' && !includeArchivedSales
      ? data.filter((row) => !isArchivedSaleRecord(row))
      : data;
    const normalizedData = cfg.delegate === 'appUser'
      ? visibleData.map((row) => serializeAppUser(row))
      : cfg.delegate === 'sale'
        ? visibleData.map((row) => serializeSaleRecord(row))
      : visibleData;

    return res.json({
      ok: true,
      data: normalizedData,
      pagination: {
        page,
        pageSize: paginate ? pageSize : normalizedData.length,
        total: cfg.delegate === 'sale' && !includeArchivedSales ? normalizedData.length : total,
        totalPages: paginate ? Math.max(1, Math.ceil((cfg.delegate === 'sale' && !includeArchivedSales ? normalizedData.length : total) / pageSize)) : 1,
      },
    });
  } catch (error) {
    return sendPrismaError(res, error, 'Failed to fetch records');
  }
});

app.get('/api/data/:resource/:id', async (req, res) => {
  const cfg = getResource(req.params.resource);
  if (!cfg) return res.status(404).json({ ok: false, error: 'Unknown resource' });
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ ok: false, error: `${cfg.idField} is required` });
    const delegate = prisma[cfg.delegate];
    const findUniqueArgs = { where: { [cfg.idField]: id } };
    if (cfg.delegate === 'appUser') {
      findUniqueArgs.include = {
        role: { select: { name: true, isSystem: true } },
        location: { select: { id: true, name: true } },
      };
    } else if (cfg.delegate === 'sale') {
      findUniqueArgs.include = {
        location: { select: { id: true, name: true } },
        addedBy: { select: { id: true, name: true, username: true, email: true } },
      };
    }
    const data = await delegate.findUnique(findUniqueArgs);
    if (!data) return res.status(404).json({ ok: false, error: 'Record not found' });
    if (cfg.delegate === 'sale' && isArchivedSaleRecord(data) && String(req.query.includeArchived || req.query.includeDeleted || '').trim().toLowerCase() !== 'true') {
      return res.status(404).json({ ok: false, error: 'Record archived' });
    }
    const normalizedData = cfg.delegate === 'appUser'
      ? serializeAppUser(data)
      : cfg.delegate === 'sale'
        ? serializeSaleRecord(data)
        : data;
    return res.json({ ok: true, data: normalizedData });
  } catch (error) {
    return sendPrismaError(res, error, 'Failed to fetch record');
  }
});

app.post('/api/data/:resource', async (req, res) => {
  const cfg = getResource(req.params.resource);
  if (!cfg) return res.status(404).json({ ok: false, error: 'Unknown resource' });
  try {
    const delegate = prisma[cfg.delegate];
    const payload = toObject(req.body?.data ?? req.body);
    if (cfg.delegate === 'appUser' && isCriticalAdminEmail(payload.email)) {
      payload.status = 'ACTIVE';
      payload.allowLogin = true;
      payload.email = normalizeEmail(payload.email);
    }
    if (cfg.singletonId && !payload[cfg.idField]) payload[cfg.idField] = cfg.singletonId;
    if (!payload[cfg.idField] && cfg.idField === 'id') payload.id = randomUUID();
    const data = await delegate.create({ data: payload });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return sendPrismaError(res, error, 'Failed to create record');
  }
});

app.post('/api/data/:resource/bulk-upsert', async (req, res) => {
  const cfg = getResource(req.params.resource);
  if (!cfg) return res.status(404).json({ ok: false, error: 'Unknown resource' });
  try {
    const rows = toArray(req.body?.rows).map((row) => toObject(row));
    if (rows.length === 0) return res.json({ ok: true, processed: 0 });
    const delegate = prisma[cfg.delegate];
    await prisma.$transaction(rows.map((row) => {
      const entry = { ...row };
      if (cfg.delegate === 'appUser' && isCriticalAdminEmail(entry.email)) {
        entry.status = 'ACTIVE';
        entry.allowLogin = true;
        entry.email = normalizeEmail(entry.email);
      }
      if (cfg.singletonId && !entry[cfg.idField]) entry[cfg.idField] = cfg.singletonId;
      if (!entry[cfg.idField] && cfg.idField === 'id') entry.id = randomUUID();
      const idValue = entry[cfg.idField];
      const updateData = { ...entry };
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData[cfg.idField];
      return delegate.upsert({
        where: { [cfg.idField]: idValue },
        create: entry,
        update: updateData,
      });
    }));
    return res.json({ ok: true, processed: rows.length });
  } catch (error) {
    return sendPrismaError(res, error, 'Failed to bulk upsert');
  }
});

app.put('/api/data/:resource/:id', async (req, res) => {
  const cfg = getResource(req.params.resource);
  if (!cfg) return res.status(404).json({ ok: false, error: 'Unknown resource' });
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ ok: false, error: `${cfg.idField} is required` });
    const delegate = prisma[cfg.delegate];
    const data = toObject(req.body?.data ?? req.body);
    if (cfg.delegate === 'appUser') {
      const existing = await prisma.appUser.findUnique({ where: { id }, select: { email: true } });
      const willBeCriticalAdmin = isCriticalAdminEmail(existing?.email) || isCriticalAdminEmail(data.email);
      if (willBeCriticalAdmin) {
        data.status = 'ACTIVE';
        data.allowLogin = true;
        data.email = normalizeEmail(data.email || existing?.email);
      }
    }
    delete data.createdAt;
    delete data.updatedAt;
    delete data[cfg.idField];
    const updated = await delegate.update({ where: { [cfg.idField]: id }, data });
    return res.json({ ok: true, data: updated });
  } catch (error) {
    return sendPrismaError(res, error, 'Failed to update record');
  }
});

app.delete('/api/data/:resource/:id', async (req, res) => {
  const cfg = getResource(req.params.resource);
  if (!cfg) return res.status(404).json({ ok: false, error: 'Unknown resource' });
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ ok: false, error: `${cfg.idField} is required` });
    const delegate = prisma[cfg.delegate];
    if (cfg.delegate === 'appUser') {
      const user = await prisma.appUser.findUnique({ where: { id }, select: { email: true } });
      if (user && isCriticalAdminEmail(user.email)) {
        return res.status(400).json({ ok: false, error: 'Critical admin user cannot be deleted' });
      }
    }
    if (cfg.delegate === 'sale') {
      const archived = await archiveSaleRecord(id, req);
      if (!archived) return res.status(404).json({ ok: false, error: 'Record not found' });
      return res.json({ ok: true, deleted: true, archived: true, id });
    }
    await delegate.delete({ where: { [cfg.idField]: id } });
    return res.json({ ok: true, deleted: true, id });
  } catch (error) {
    return sendPrismaError(res, error, 'Failed to delete record');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  ROLE ENFORCEMENT
//  requireCanDelete(resource) → allows only Admin/Manager/CEO to delete
//  critical records. Other roles get 403 Forbidden.
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_NAMES_ALLOWED_DELETE = ['admin', 'ceo', 'manager'];

const normalizeRoleName = (value) => String(value || '').trim().toLowerCase();
const isDeleteRoleAllowed = (roleName, isSystem = false) => {
  if (isSystem) return true;
  const normalized = normalizeRoleName(roleName);
  if (!normalized) return false;
  return ROLE_NAMES_ALLOWED_DELETE.some((allowed) =>
    normalized === allowed || normalized.includes(allowed),
  );
};
const roleNameFromMeta = (meta) => {
  const m = toObject(meta);
  return normalizeRoleName(m.role || m.roleName || m.userRole || '');
};

const requireCanDelete = async (req, res, next) => {
  try {
    const tokenEmail = String(req.user?.email || '').trim();
    if (isCriticalAdminEmail(tokenEmail)) return next();

    const tokenRoleName = normalizeRoleName(req.user?.role || req.user?.roleName || req.user?.userRole);
    if (isDeleteRoleAllowed(tokenRoleName)) return next();

    const roleId = String(req.user?.roleId || '').trim();
    if (roleId) {
      const linkedRole = await prisma.role.findUnique({
        where: { id: roleId },
        select: { name: true, isSystem: true },
      });
      if (isDeleteRoleAllowed(linkedRole?.name, linkedRole?.isSystem === true)) return next();
    }

    const userId = String(req.user?.id || '').trim();
    if (userId) {
      const account = await prisma.appUser.findUnique({
        where: { id: userId },
        select: {
          email: true,
          roleId: true,
          role: { select: { name: true, isSystem: true } },
          meta: true,
        },
      });
      if (isCriticalAdminEmail(account?.email)) return next();
      if (isDeleteRoleAllowed(account?.role?.name, account?.role?.isSystem === true)) return next();
      if (isDeleteRoleAllowed(roleNameFromMeta(account?.meta))) return next();

      const fallbackRoleId = String(account?.roleId || '').trim();
      if (fallbackRoleId && fallbackRoleId !== roleId) {
        const fallbackRole = await prisma.role.findUnique({
          where: { id: fallbackRoleId },
          select: { name: true, isSystem: true },
        });
        if (isDeleteRoleAllowed(fallbackRole?.name, fallbackRole?.isSystem === true)) return next();
      }
    }

    return res.status(403).json({ ok: false, error: 'Insufficient permissions to delete this record' });
  } catch {
    return res.status(500).json({ ok: false, error: 'Permission check failed' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  ATOMIC RECORD SYNC  (replaces the giant snapshot overwrite)
//  PUT  /api/sync/record/:resource   → upsert one record with field mapping
//  DELETE /api/sync/record/:resource/:id → delete one record
// ─────────────────────────────────────────────────────────────────────────────

const canManageUserPreferences = async (req, targetUserId) => {
  const normalizedTargetUserId = String(targetUserId || '').trim();
  if (!normalizedTargetUserId) return false;

  const actorUserId = String(req.user?.id || '').trim();
  if (actorUserId && actorUserId === normalizedTargetUserId) return true;

  const tokenEmail = String(req.user?.email || '').trim();
  if (isCriticalAdminEmail(tokenEmail)) return true;

  const tokenRoleName = normalizeRoleName(req.user?.role || req.user?.roleName || req.user?.userRole);
  if (isDeleteRoleAllowed(tokenRoleName)) return true;

  if (!actorUserId) return false;
  const actorAccount = await prisma.appUser.findUnique({
    where: { id: actorUserId },
    select: {
      email: true,
      role: { select: { name: true, isSystem: true } },
      meta: true,
    },
  });
  if (!actorAccount) return false;
  if (isCriticalAdminEmail(actorAccount.email)) return true;
  if (isDeleteRoleAllowed(actorAccount.role?.name, actorAccount.role?.isSystem === true)) return true;
  if (isDeleteRoleAllowed(roleNameFromMeta(actorAccount.meta))) return true;
  return false;
};

app.get('/api/users/:id/preferences', requireAuth, requireActiveSessionUser, async (req, res) => {
  try {
    const targetUserId = String(req.params.id || '').trim();
    if (!targetUserId) return res.status(400).json({ ok: false, error: 'User id is required' });

    const allowed = await canManageUserPreferences(req, targetUserId);
    if (!allowed) return res.status(403).json({ ok: false, error: 'Insufficient permissions to view user preferences' });

    const account = await prisma.appUser.findUnique({
      where: { id: targetUserId },
      select: { id: true, meta: true },
    });
    if (!account) return res.status(404).json({ ok: false, error: 'User not found' });

    const meta = toObject(account.meta);
    const preferences = toObject(meta.preferences);
    return res.json({ ok: true, userId: targetUserId, preferences });
  } catch (error) {
    return sendPrismaError(res, error, 'Failed to fetch user preferences');
  }
});

app.put('/api/users/:id/preferences', requireAuth, requireActiveSessionUser, async (req, res) => {
  try {
    const targetUserId = String(req.params.id || '').trim();
    if (!targetUserId) return res.status(400).json({ ok: false, error: 'User id is required' });

    const allowed = await canManageUserPreferences(req, targetUserId);
    if (!allowed) return res.status(403).json({ ok: false, error: 'Insufficient permissions to update user preferences' });

    const mode = String(req.body?.mode || 'merge').trim().toLowerCase();
    const requestedPreferences = toObject(req.body?.preferences);

    const account = await prisma.appUser.findUnique({
      where: { id: targetUserId },
      select: { id: true, meta: true },
    });
    if (!account) return res.status(404).json({ ok: false, error: 'User not found' });

    const currentMeta = toObject(account.meta);
    const currentPreferences = toObject(currentMeta.preferences);
    const nextPreferences = mode === 'replace'
      ? requestedPreferences
      : { ...currentPreferences, ...requestedPreferences };
    const nextMeta = { ...currentMeta, preferences: nextPreferences };

    await prisma.appUser.update({
      where: { id: targetUserId },
      data: { meta: nextMeta },
    });

    return res.json({ ok: true, userId: targetUserId, preferences: nextPreferences });
  } catch (error) {
    return sendPrismaError(res, error, 'Failed to update user preferences');
  }
});

const normDate = (v) => { const d = new Date(String(v || '')); return Number.isNaN(d.getTime()) ? new Date() : d; };
const normOptionalDate = (v) => {
  const raw = String(v || '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};
const normStatus = (v, allowed, fallback) => { const s = String(v || '').trim().toUpperCase(); return allowed.includes(s) ? s : fallback; };
const normOptionalString = (v) => {
  const s = String(v || '').trim();
  return s ? s : null;
};
const isLookupPlaceholder = (v) => {
  const normalized = String(v || '').trim().toLowerCase();
  return (
    normalized === '' ||
    normalized === '--' ||
    normalized === '-' ||
    normalized === 'none' ||
    normalized === 'n/a' ||
    normalized === 'na' ||
    normalized === 'null'
  );
};
const resolveLookupId = async (delegate, explicitId, nameCandidates = [], nameFields = ['name']) => {
  const id = normOptionalString(explicitId);
  if (id) {
    const byId = await delegate.findUnique({ where: { id }, select: { id: true } });
    if (byId?.id) return byId.id;
  }
  for (const candidate of toArray(nameCandidates)) {
    if (isLookupPlaceholder(candidate)) continue;
    const value = String(candidate).trim();
    const byName = await delegate.findFirst({
      where: {
        OR: nameFields.map((field) => ({
          [field]: { equals: value, mode: 'insensitive' },
        })),
      },
      select: { id: true },
    });
    if (byName?.id) return byName.id;
  }
  return null;
};

const deriveLocationInvoicePrefix = (locationName) => {
  const name = String(locationName || '').trim();
  const normalized = name.toLowerCase();
  if (normalized.includes('kennol')) return 'KEN-';
  if (normalized.includes('barka')) return 'BAR-';
  if (normalized.includes('mowalah') || normalized.includes('muwalah')) return 'MOW-';
  if (normalized.includes('atwar')) return 'ATW-';

  const letters = name
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.replace(/[^a-z0-9]/gi, ''))
    .join('')
    .slice(0, 3)
    .toUpperCase();
  return `${letters || 'LOC'}-`;
};

const generateNextSaleInvoiceNo = async (locationName) => {
  const year = new Date().getFullYear();
  const prefix = deriveLocationInvoicePrefix(locationName);
  const rows = await prisma.sale.findMany({
    where: { invoiceNo: { startsWith: `${prefix}${year}-`, mode: 'insensitive' } },
    select: { invoiceNo: true },
  });
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedPrefix}${year}-(\\d+)$`, 'i');
  let maxSerial = 0;
  rows.forEach((row) => {
    const match = String(row.invoiceNo || '').trim().match(pattern);
    if (!match) return;
    const serial = Number(match[1]);
    if (Number.isFinite(serial)) maxSerial = Math.max(maxSerial, serial);
  });
  return `${prefix}${year}-${String(maxSerial + 1).padStart(4, '0')}`;
};

app.put('/api/sync/record/:resource', requireAuth, async (req, res) => {
  const resource = String(req.params.resource || '').trim();
  const raw = toObject(req.body);
  let id = String(raw.id || '').trim();
  // Singleton settings record may arrive without id from older clients.
  // Force canonical id to keep Postgres as source of truth.
  if (!id && resource === 'settings') {
    id = 'SETTINGS';
  }
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  let responseData = null;
  try {
    switch (resource) {
      case 'products': {
        const [categoryId, brandId, unitId, warrantyId, taxRateId] = await Promise.all([
          resolveLookupId(prisma.productCategory, raw.categoryId, [raw.category]),
          resolveLookupId(prisma.productBrand, raw.brandId, [raw.brand]),
          resolveLookupId(prisma.productUnit, raw.unitId, [raw.unit], ['name', 'shortName']),
          resolveLookupId(prisma.productWarranty, raw.warrantyId, [raw.warranty]),
          resolveLookupId(prisma.taxRate, raw.taxRateId, [raw.tax, raw.taxName]),
        ]);
        const rawImageCandidate =
          raw.image ??
          raw.imageLink ??
          raw.imageUrl ??
          raw.imageURL ??
          raw.productImage ??
          raw.productImageUrl ??
          raw.productImageURL;
        const imageValue = normOptionalString(rawImageCandidate);
        const normalizedMeta = { ...raw };
        if (imageValue) {
          normalizedMeta.image = imageValue;
        }
        const d = {
          name: String(raw.name || `Product-${id}`).trim(),
          sku: String(raw.sku || raw.name || id).trim(),
          type: normStatus(raw.type, ['SINGLE', 'VARIABLE', 'COMBO'], 'SINGLE'),
          categoryId,
          brandId,
          unitId,
          warrantyId,
          taxRateId,
          packagingType: normStatus(raw.packagingType, ['PIECE', 'PACK', 'CARTON'], 'PIECE'),
          unitsPerPackage: toFiniteNumber(raw.unitsPerPackage, 0) > 0 ? Math.trunc(toFiniteNumber(raw.unitsPerPackage, 0)) : null,
          unitPurchasePrice: toFiniteNumber(raw.unitPurchasePrice, 0),
          sellingPrice: toFiniteNumber(raw.sellingPrice, 0),
          stock: toFiniteNumber(raw.stock, 0),
          fractionalSaleEnabled: raw.fractionalSaleEnabled === true,
          baseUnitName: normOptionalString(raw.baseUnitName),
          containerUnitName: normOptionalString(raw.containerUnitName),
          containerSize: toFiniteNumber(raw.containerSize, 0),
          fractionalPricePremium: toFiniteNumber(raw.fractionalPricePremium, 0),
          fractionalUnitPrice: toFiniteNumber(raw.fractionalUnitPrice, 0),
          alertQuantity: toFiniteNumber(raw.alertQuantity, 0) > 0 ? Math.trunc(toFiniteNumber(raw.alertQuantity, 0)) : null,
          image: imageValue,
          meta: normalizedMeta,
        };
        await prisma.product.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'productCategories': {
        const d = {
          name: String(raw.name || `Category-${id}`),
          code: raw.code ? String(raw.code) : null,
          description: raw.description ? String(raw.description) : null,
          meta: raw,
        };
        await prisma.productCategory.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'productBrands': {
        const d = {
          name: String(raw.name || `Brand-${id}`),
          note: raw.note ? String(raw.note) : null,
          meta: raw,
        };
        await prisma.productBrand.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'productUnits': {
        const d = {
          name: String(raw.name || `Unit-${id}`),
          shortName: String(raw.shortName || raw.name || id),
          allowDecimal: raw.allowDecimal === true,
          meta: raw,
        };
        await prisma.productUnit.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'productWarranties': {
        const d = {
          name: String(raw.name || `Warranty-${id}`),
          description: raw.description ? String(raw.description) : null,
          meta: raw,
        };
        await prisma.productWarranty.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'productVariations': {
        const d = {
          name: String(raw.name || `Variation-${id}`),
          values: toArray(raw.values),
          meta: raw,
        };
        await prisma.productVariation.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'productInventory': {
        const productId = String(raw.productId || '').trim();
        const locationId = String(raw.locationId || '').trim();
        if (!productId || !locationId) {
          return res.status(400).json({ ok: false, error: 'productId and locationId are required' });
        }
        const d = {
          productId,
          locationId,
          stock: toFiniteNumber(raw.stock, 0),
          unitCost: raw.unitCost === undefined || raw.unitCost === null ? null : toFiniteNumber(raw.unitCost, 0),
          rack: normOptionalString(raw.rack),
          row: normOptionalString(raw.row),
          position: normOptionalString(raw.position),
          lotNumber: normOptionalString(raw.lotNumber),
          expiryDate: raw.expiryDate ? normDate(raw.expiryDate) : null,
          meta: raw,
        };
        await prisma.productInventory.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'customers': {
        const customerGroupId = await resolveLookupId(
          prisma.customerGroup,
          raw.customerGroupId,
          [raw.customerGroup],
        );
        const d = {
          businessName: String(raw.businessName || raw.name || `Customer-${id}`),
          name: String(raw.name || raw.businessName || `Customer-${id}`),
          email: raw.email ? String(raw.email) : null,
          mobile: raw.mobile ? String(raw.mobile) : null,
          taxNumber: normOptionalString(raw.taxNumber),
          customerGroupId,
          status: normStatus(raw.status, ['ACTIVE', 'INACTIVE'], 'ACTIVE'),
          creditLimit: toFiniteNumber(raw.creditLimit, 0),
          openingBalance: toFiniteNumber(raw.openingBalance, 0),
          advanceBalance: toFiniteNumber(raw.advanceBalance, 0),
          totalSellDue: toFiniteNumber(raw.totalSellDue, 0),
          totalSellReturnDue: toFiniteNumber(raw.totalSellReturnDue, 0),
          meta: raw,
        };
        await prisma.customer.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'suppliers': {
        const d = {
          businessName: String(raw.businessName || raw.name || `Supplier-${id}`),
          name: String(raw.name || raw.businessName || `Supplier-${id}`),
          email: raw.email ? String(raw.email) : null,
          mobile: raw.mobile ? String(raw.mobile) : null,
          taxNumber: normOptionalString(raw.taxNumber),
          status: normStatus(raw.status, ['ACTIVE', 'INACTIVE'], 'ACTIVE'),
          openingBalance: toFiniteNumber(raw.openingBalance, 0),
          advanceBalance: toFiniteNumber(raw.advanceBalance, 0),
          totalPurchaseDue: toFiniteNumber(raw.totalPurchaseDue, 0),
          totalReturnDue: toFiniteNumber(raw.totalReturnDue, 0),
          meta: raw,
        };
        await prisma.supplier.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'sales': {
        const [
          customerId,
          locationId,
          taxRateId,
          paymentAccountId,
          addedById,
          salesRepresentativeId,
          deliveryPersonId,
        ] = await Promise.all([
          resolveLookupId(prisma.customer, raw.customerId, [raw.customerName, raw.customer, raw.contactName], ['businessName', 'name', 'mobile']),
          resolveLookupId(prisma.location, raw.locationId, [raw.location, raw.businessLocation], ['name']),
          resolveLookupId(prisma.taxRate, raw.taxRateId, [raw.tax, raw.taxName], ['name']),
          resolveLookupId(prisma.paymentAccount, raw.paymentAccountId || raw.accountId, [raw.account, raw.paymentAccount], ['name', 'accountNumber']),
          resolveLookupId(prisma.appUser, raw.addedById, [raw.addedBy], ['name', 'username', 'email']),
          resolveLookupId(prisma.salesRepresentative, raw.salesRepresentativeId || raw.salesRepId, [raw.salesRepName, raw.salesRep], ['name', 'contactNo']),
          resolveLookupId(prisma.appUser, raw.deliveryPersonId || raw.driverId, [raw.deliveryPerson, raw.driver], ['name', 'username', 'email']),
        ]);
        let resolvedLocationName = String(raw.location || raw.businessLocation || '').trim();
        if (!resolvedLocationName && locationId) {
          const locationRecord = await prisma.location.findUnique({
            where: { id: locationId },
            select: { name: true },
          });
          resolvedLocationName = String(locationRecord?.name || '').trim();
        }
        const saleLocationPolicy = resolveSaleLocationCategoryPolicy(resolvedLocationName);
        if (saleLocationPolicy.mode !== 'allow_all') {
          const saleItems = extractSaleItems(raw);
          if (saleItems.length > 0) {
            const requestedProductIds = Array.from(
              new Set(
                saleItems
                  .map((item) => String(item?.productId || item?.id || '').trim())
                  .filter(Boolean)
              )
            );
            const productRows = requestedProductIds.length > 0
              ? await prisma.product.findMany({
                  where: { id: { in: requestedProductIds } },
                  select: {
                    id: true,
                    name: true,
                    meta: true,
                    category: { select: { name: true } },
                  },
                })
              : [];
            const productById = new Map(productRows.map((row) => [String(row.id), row]));
            const blockedProducts = Array.from(
              new Set(
                saleItems
                  .map((item) => {
                    const productId = String(item?.productId || item?.id || '').trim();
                    const itemName = String(item?.name || '').trim();
                    const productRecord = productId ? productById.get(productId) : null;
                    const productMeta = toObject(productRecord?.meta);
                    const categoryName = String(
                      productRecord?.category?.name ||
                      productMeta.category ||
                      productMeta.categoryName ||
                      ''
                    ).trim();
                    if (!productRecord && saleLocationPolicy.mode === 'only_engine_oil') {
                      return itemName || productId || 'Unknown product';
                    }
                    const isAllowed = isProductAllowedBySaleLocationPolicy(categoryName, saleLocationPolicy.mode);
                    if (isAllowed) return null;
                    return itemName || productRecord?.name || productId || 'Unknown product';
                  })
                  .filter(Boolean)
              )
            );
            if (blockedProducts.length > 0) {
              const locationLabel = resolvedLocationName || 'Selected location';
              const ruleMessage = saleLocationPolicy.mode === 'only_engine_oil'
                ? `${locationLabel} can only sell Engine Oil category products.`
                : `${locationLabel} cannot sell Engine Oil category products.`;
              return res.status(400).json({
                ok: false,
                error: `${ruleMessage} Remove: ${blockedProducts.slice(0, 5).join(', ')}${blockedProducts.length > 5 ? ' ...' : ''}`,
              });
            }
          }
        }
        const taxAmountCandidate = raw.taxAmount ?? raw.tax;
        const normalizedStatus = normStatus(raw.status || raw.saleStatus, ['FINAL', 'DRAFT', 'QUOTATION', 'PROFORMA'], 'FINAL');
        let normalizedInvoiceNo = String(raw.invoiceNo || `INV-${id}`).trim();
        const existingSaleById = await prisma.sale.findUnique({
          where: { id },
          select: { id: true, invoiceNo: true, addedById: true, meta: true },
        });
        if (!existingSaleById && normalizedStatus === 'FINAL') {
          normalizedInvoiceNo = await generateNextSaleInvoiceNo(resolvedLocationName);
        }
        const d = {
          invoiceNo: normalizedInvoiceNo,
          date: normDate(raw.date),
          customerId,
          locationId,
          taxRateId,
          paymentAccountId,
          addedById,
          salesRepresentativeId,
          deliveryPersonId,
          status: normalizedStatus,
          paymentStatus: normStatus(raw.paymentStatus, ['PAID', 'DUE', 'PARTIAL', 'OVERDUE'], 'DUE'),
          shippingStatus: normStatus(raw.shippingStatus, ['PENDING', 'ORDERED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'], 'PENDING'),
          subTotal: toFiniteNumber(raw.subTotal, 0),
          discountAmount: toFiniteNumber(raw.discountAmount, 0),
          taxAmount: toFiniteNumber(taxAmountCandidate, 0),
          shippingCharges: toFiniteNumber(raw.shippingCharges, 0),
          grandTotal: toFiniteNumber(raw.grandTotal ?? raw.totalAmount, 0),
          totalPaid: toFiniteNumber(raw.totalPaid, 0),
          sellDue: toFiniteNumber(raw.sellDue, 0),
          sellReturnDue: toFiniteNumber(raw.sellReturnDue, 0),
          meta: { ...raw, invoiceNo: normalizedInvoiceNo },
        };
        const existingSaleByInvoiceNo = await prisma.sale.findUnique({
          where: { invoiceNo: normalizedInvoiceNo },
          select: { id: true, locationId: true, addedById: true, meta: true },
        });
        if (existingSaleById?.addedById && !d.addedById) {
          d.addedById = existingSaleById.addedById;
          d.meta = {
            ...toObject(d.meta),
            addedById: existingSaleById.addedById,
            addedBy: toObject(existingSaleById.meta).addedBy || toObject(d.meta).addedBy,
          };
        }

        if (existingSaleByInvoiceNo && existingSaleByInvoiceNo.id !== id) {
          return res.status(409).json({
            ok: false,
            error: `Invoice number ${normalizedInvoiceNo} already belongs to another sale. Create a new invoice number instead of reusing it.`,
            code: 'P2002',
          });
        } else {
          let savedSale = null;
          try {
            savedSale = await prisma.sale.upsert({ where: { id }, update: d, create: { id, ...d } });
          } catch (error) {
            const duplicateInvoice = error?.code === 'P2002'
              && Array.isArray(error?.meta?.target)
              && error.meta.target.includes('invoiceNo');
            if (!duplicateInvoice) throw error;
            if (existingSaleById || normalizedStatus !== 'FINAL') {
              const winner = await prisma.sale.findUnique({
                where: { invoiceNo: normalizedInvoiceNo },
                select: { id: true },
              });
              if (!winner || winner.id === id) throw error;
              return res.status(409).json({
                ok: false,
                error: `Invoice number ${normalizedInvoiceNo} already belongs to another sale. Create a new invoice number instead of reusing it.`,
                code: 'P2002',
              });
            }
            const retryInvoiceNo = await generateNextSaleInvoiceNo(resolvedLocationName);
            const retryData = {
              ...d,
              invoiceNo: retryInvoiceNo,
              meta: { ...toObject(d.meta), invoiceNo: retryInvoiceNo },
            };
            savedSale = await prisma.sale.upsert({ where: { id }, update: retryData, create: { id, ...retryData } });
          }
          responseData = savedSale
            ? serializeSaleRecord(await prisma.sale.findUnique({
                where: { id: savedSale.id },
                include: {
                  location: { select: { id: true, name: true } },
                  addedBy: { select: { id: true, name: true, username: true, email: true } },
                },
              }))
            : null;
        }
        break;
      }
      case 'payments': {
        const [customerId, supplierId, expenseId, locationId, accountId] = await Promise.all([
          resolveLookupId(prisma.customer, raw.customerId || raw.contactId, [raw.contactName, raw.customerName], ['businessName', 'name', 'mobile']),
          resolveLookupId(prisma.supplier, raw.supplierId, [raw.contactName, raw.supplierName], ['businessName', 'name', 'mobile']),
          resolveLookupId(prisma.expense, raw.expenseId, [raw.refNo, raw.referenceNo], ['refNo']),
          resolveLookupId(prisma.location, raw.locationId, [raw.location, raw.businessLocation], ['name']),
          resolveLookupId(prisma.paymentAccount, raw.accountId || raw.paymentAccountId, [raw.account, raw.paymentAccount], ['name', 'accountNumber']),
        ]);
        const d = {
          date: normDate(raw.date),
          contactType: normStatus(raw.contactType, ['CUSTOMER', 'SUPPLIER', 'EXPENSE'], 'CUSTOMER'),
          direction: normStatus(raw.direction || raw.type, ['RECEIVED', 'SENT'], 'RECEIVED'),
          customerId,
          supplierId,
          expenseId,
          locationId,
          accountId,
          referenceNo: String(raw.referenceNo || raw.refNo || `PAY-${id}`),
          method: String(raw.method || raw.paymentMethod || 'Cash'),
          amount: toFiniteNumber(raw.amount, 0),
          note: raw.note ? String(raw.note) : null,
          meta: raw,
        };
        await prisma.payment.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'users': {
        const existingUser = raw.email
          ? null
          : await prisma.appUser.findUnique({ where: { id }, select: { email: true } });
        const normalizedEmail = normalizeEmail(raw.email || existingUser?.email || `user-${id}@local.atwar`);
        const isCriticalAdmin = isCriticalAdminEmail(normalizedEmail);
        const [roleId, locationId] = await Promise.all([
          resolveLookupId(prisma.role, raw.roleId, [raw.role, raw.roleName], ['name']),
          resolveLookupId(prisma.location, raw.locationId, [raw.businessLocation, raw.location], ['name']),
        ]);
        const linkedRole = roleId
          ? await prisma.role.findUnique({ where: { id: roleId }, select: { name: true } })
          : null;
        const resolvedRoleLabel = String(
          linkedRole?.name
          || raw.role
          || raw.roleName
          || raw.userRole
          || '',
        ).trim();
        const normalizedMeta = {
          ...raw,
          email: normalizedEmail,
          role: resolvedRoleLabel || raw.role || raw.roleName || raw.userRole || '',
          roleName: resolvedRoleLabel || raw.roleName || raw.role || raw.userRole || '',
          userRole: resolvedRoleLabel || raw.userRole || raw.roleName || raw.role || '',
          ...(isCriticalAdmin ? { status: 'Active', allowLogin: true } : {}),
        };
        const updatePayload = {
          username: String(raw.username || normalizedEmail || `user-${id}`),
          name: String(raw.name || raw.username || `User-${id}`),
          email: normalizedEmail,
          roleId,
          locationId,
          mobile: raw.mobile ? String(raw.mobile) : null,
          status: isCriticalAdmin ? 'ACTIVE' : normStatus(raw.status, ['ACTIVE', 'INACTIVE'], 'ACTIVE'),
          commissionPercent: toFiniteNumber(raw.commissionPercent, 0),
          maxDiscountPercent: toFiniteNumber(raw.maxDiscountPercent, 0),
          allowLogin: isCriticalAdmin ? true : raw.allowLogin !== false,
          meta: normalizedMeta,
        };
        // Keep credentials in dedicated columns used by /api/auth/login.
        // Only override when frontend explicitly sends a value.
        if (Object.prototype.hasOwnProperty.call(raw, 'passwordHash')) {
          const normalizedHash = String(raw.passwordHash || '').trim();
          updatePayload.passwordHash = normalizedHash || null;
        }
        if (Object.prototype.hasOwnProperty.call(raw, 'passwordSalt')) {
          const normalizedSalt = String(raw.passwordSalt || '').trim();
          updatePayload.passwordSalt = normalizedSalt || null;
        }

        await prisma.appUser.upsert({
          where: { id },
          update: updatePayload,
          create: { id, ...updatePayload },
        });
        break;
      }
      case 'settings': {
        const d = {
          businessName: String(raw.businessName || 'ATWAR BSS'),
          currency: String(raw.currency || 'OMR'),
          currencySymbol: String(raw.currencySymbol || 'OMR'),
          currencyPrecision: parseIntSafe(raw.currencyPrecision, 3, 0, 6),
          quantityPrecision: parseIntSafe(raw.quantityPrecision, 3, 0, 6),
          salesInvoicePrefix: String(raw.salesInvoicePrefix || raw.salePrefix || 'INV'),
          purchasePrefix: String(raw.purchasePrefix || 'PO'),
          quotationPrefix: String(raw.quotationPrefix || 'QT'),
          paymentPrefix: String(raw.paymentPrefix || 'PAY'),
          stockTransferPrefix: String(raw.stockTransferPrefix || 'ST'),
          stockAdjustmentPrefix: String(raw.stockAdjustmentPrefix || 'SA'),
          sellReturnPrefix: String(raw.sellReturnPrefix || 'CN'),
          defaultSalePaymentMethod: String(raw.defaultSalePaymentMethod || 'Cash'),
          defaultPurchasePaymentMethod: String(raw.defaultPurchasePaymentMethod || 'Cash'),
          themeColor: String(raw.themeColor || 'default'),
          meta: raw,
        };
        await prisma.appSetting.upsert({ where: { id: 'SETTINGS' }, update: d, create: { id: 'SETTINGS', ...d } });
        break;
      }
      case 'taxRates': {
        const d = {
          name: String(raw.name || `Tax-${id}`),
          rate: toFiniteNumber(raw.rate, 0),
          type: normStatus(raw.type, ['INCLUSIVE', 'EXCLUSIVE'], 'EXCLUSIVE'),
          description: raw.description ? String(raw.description) : null,
          meta: raw,
        };
        await prisma.taxRate.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'customerGroups': {
        const d = {
          name: String(raw.name || `Group-${id}`),
          discountPercent: toFiniteNumber(raw.discountPercent ?? raw.calculationPercentage, 0),
          status: normStatus(raw.status, ['ACTIVE', 'INACTIVE'], 'ACTIVE'),
          meta: raw,
        };
        await prisma.customerGroup.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'sellingPriceGroups': {
        const d = {
          name: String(raw.name || `Price Group-${id}`),
          description: raw.description ? String(raw.description) : null,
          discount: toOptionalFiniteNumber(raw.discount),
          priceCalcPercentage: toOptionalFiniteNumber(raw.priceCalcPercentage ?? raw.calculationPercentage),
          meta: raw,
        };
        await prisma.sellingPriceGroup.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'discounts': {
        const rawDiscountType = String(raw.discountType || '').trim().toUpperCase();
        const d = {
          name: String(raw.name || `Discount-${id}`),
          discountType: rawDiscountType === 'FIXED' ? 'FIXED' : rawDiscountType === 'PERCENTAGE' ? 'PERCENTAGE' : null,
          discountAmount: toOptionalFiniteNumber(String(raw.discountAmount ?? '').replace(/[^\d.-]/g, '')),
          startsAt: normOptionalDate(raw.startsAt),
          endsAt: normOptionalDate(raw.endsAt),
          isActive: raw.isActive !== false,
          meta: raw,
        };
        await prisma.discount.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'expenseCategories': {
        const d = {
          name: String(raw.name || `Expense Category-${id}`),
          description: raw.description ? String(raw.description) : null,
          code: raw.code ? String(raw.code) : null,
          meta: raw,
        };
        await prisma.expenseCategory.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'expenses': {
        const [categoryId, locationId, taxRateId, paymentAccountId, addedById] = await Promise.all([
          resolveLookupId(prisma.expenseCategory, raw.categoryId, [raw.category], ['name']),
          resolveLookupId(prisma.location, raw.locationId, [raw.location], ['name']),
          resolveLookupId(prisma.taxRate, raw.taxRateId, [raw.taxName, raw.taxRate], ['name']),
          resolveLookupId(prisma.paymentAccount, raw.paymentAccountId || raw.accountId, [raw.paymentAccount, raw.account], ['name', 'accountNumber']),
          resolveLookupId(prisma.appUser, raw.addedById, [raw.addedBy], ['name', 'username', 'email']),
        ]);
        const d = {
          refNo: String(raw.refNo || raw.referenceNo || `EXP-${id}`),
          date: normDate(raw.date),
          categoryId,
          locationId,
          taxRateId,
          paymentAccountId,
          addedById,
          amount: toFiniteNumber(raw.amount, 0),
          tax: toFiniteNumber(raw.tax, 0),
          totalAmount: toFiniteNumber(raw.totalAmount ?? raw.amount, 0),
          paymentStatus: normStatus(raw.paymentStatus, ['PAID', 'DUE', 'PARTIAL', 'OVERDUE'], 'DUE'),
          paymentDue: toFiniteNumber(raw.paymentDue ?? raw.totalAmount ?? raw.amount, 0),
          isRecurring: raw.isRecurring === true,
          isRefund: raw.isRefund === true,
          note: raw.note ? String(raw.note) : null,
          meta: raw,
        };
        await prisma.expense.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'purchases': {
        const [supplierId, locationId, taxRateId, addedById] = await Promise.all([
          resolveLookupId(prisma.supplier, raw.supplierId, [raw.supplierName, raw.supplier], ['businessName', 'name', 'mobile']),
          resolveLookupId(prisma.location, raw.locationId, [raw.location, raw.businessLocation], ['name']),
          resolveLookupId(prisma.taxRate, raw.taxRateId, [raw.taxName, raw.taxRate], ['name']),
          resolveLookupId(prisma.appUser, raw.addedById, [raw.addedBy], ['name', 'username', 'email']),
        ]);
        const purchaseTaxCandidate = raw.taxAmount ?? raw.tax;
        const d = {
          refNo: String(raw.refNo || raw.referenceNo || `PUR-${id}`),
          date: normDate(raw.date),
          supplierId,
          locationId,
          taxRateId,
          addedById,
          status: normStatus(raw.status, ['RECEIVED', 'PENDING', 'ORDERED'], 'PENDING'),
          paymentStatus: normStatus(raw.paymentStatus, ['PAID', 'DUE', 'PARTIAL', 'OVERDUE'], 'DUE'),
          subTotal: toFiniteNumber(raw.subTotal, 0),
          taxAmount: toFiniteNumber(purchaseTaxCandidate, 0),
          discountAmount: toFiniteNumber(raw.discountAmount, 0),
          grandTotal: toFiniteNumber(raw.grandTotal ?? raw.totalAmount, 0),
          paymentDue: toFiniteNumber(raw.paymentDue ?? raw.grandTotal, 0),
          note: raw.note ? String(raw.note) : null,
          meta: raw,
        };
        await prisma.purchase.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'purchaseRequisitions': {
        const d = {
          referenceNo: String(raw.referenceNo || raw.refNo || `REQ-${id}`),
          date: normDate(raw.date),
          location: raw.location ? String(raw.location) : null,
          supplier: raw.supplier ? String(raw.supplier) : null,
          supplierId: raw.supplierId ? String(raw.supplierId) : null,
          status: String(raw.status || 'Pending'),
          addedBy: raw.addedBy ? String(raw.addedBy) : null,
          brand: raw.brand ? String(raw.brand) : null,
          category: raw.category ? String(raw.category) : null,
          requiredByDate: normOptionalDate(raw.requiredByDate),
          note: raw.note ? String(raw.note) : null,
          items: toArray(raw.items),
          meta: raw,
        };
        await prisma.purchaseRequisition.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'purchaseOrders': {
        const d = {
          referenceNo: String(raw.referenceNo || raw.refNo || `PO-${id}`),
          orderDate: normDate(raw.orderDate || raw.date),
          supplierId: raw.supplierId ? String(raw.supplierId) : null,
          supplierName: raw.supplierName ? String(raw.supplierName) : null,
          supplierAddress: raw.supplierAddress ? String(raw.supplierAddress) : null,
          location: raw.location ? String(raw.location) : null,
          deliveryDate: normOptionalDate(raw.deliveryDate),
          payTermValue: raw.payTermValue ? String(raw.payTermValue) : null,
          payTermType: raw.payTermType ? String(raw.payTermType) : null,
          attachDocumentName: raw.attachDocumentName ? String(raw.attachDocumentName) : null,
          purchaseRequisitionId: raw.purchaseRequisitionId ? String(raw.purchaseRequisitionId) : null,
          purchaseRequisitionRef: raw.purchaseRequisitionRef ? String(raw.purchaseRequisitionRef) : null,
          items: toArray(raw.items),
          shippingDetails: raw.shippingDetails ? String(raw.shippingDetails) : null,
          shippingAddress: raw.shippingAddress ? String(raw.shippingAddress) : null,
          shippingCharges: toFiniteNumber(raw.shippingCharges, 0),
          shippingStatus: raw.shippingStatus ? String(raw.shippingStatus) : null,
          deliveredTo: raw.deliveredTo ? String(raw.deliveredTo) : null,
          shippingDocumentName: raw.shippingDocumentName ? String(raw.shippingDocumentName) : null,
          additionalExpenses: toFiniteNumber(raw.additionalExpenses, 0),
          additionalNotes: raw.additionalNotes ? String(raw.additionalNotes) : null,
          totalItems: Math.trunc(toFiniteNumber(raw.totalItems, 0)),
          netTotalAmount: toFiniteNumber(raw.netTotalAmount, 0),
          orderTotal: toFiniteNumber(raw.orderTotal, 0),
          status: String(raw.status || 'Draft'),
          addedBy: raw.addedBy ? String(raw.addedBy) : null,
          meta: raw,
        };
        await prisma.purchaseOrder.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'sellReturns': {
        const [saleId, customerId, locationId] = await Promise.all([
          resolveLookupId(prisma.sale, raw.saleId || raw.parentSaleId, [raw.parentInvoiceNo, raw.invoiceNo], ['invoiceNo']),
          resolveLookupId(prisma.customer, raw.customerId, [raw.customerName, raw.customer], ['businessName', 'name', 'mobile']),
          resolveLookupId(prisma.location, raw.locationId, [raw.location, raw.businessLocation], ['name']),
        ]);
        const sellReturnTaxCandidate = raw.taxAmount ?? raw.tax;
        const d = {
          refNo: String(raw.refNo || raw.referenceNo || `SR-${id}`),
          date: normDate(raw.date),
          saleId,
          customerId,
          locationId,
          paymentStatus: normStatus(raw.paymentStatus, ['PAID', 'DUE', 'PARTIAL', 'OVERDUE'], 'DUE'),
          subTotal: toFiniteNumber(raw.subTotal, 0),
          discountAmount: toFiniteNumber(raw.discountAmount, 0),
          taxAmount: toFiniteNumber(sellReturnTaxCandidate, 0),
          grandTotal: toFiniteNumber(raw.grandTotal ?? raw.totalAmount, 0),
          totalRefunded: toFiniteNumber(raw.totalRefunded, 0),
          note: raw.note ? String(raw.note) : null,
          meta: raw,
        };
        await prisma.sellReturn.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'purchaseReturns': {
        const [purchaseId, supplierId, locationId] = await Promise.all([
          resolveLookupId(prisma.purchase, raw.purchaseId || raw.parentPurchaseId, [raw.parentPurchaseRef, raw.refNo], ['refNo']),
          resolveLookupId(prisma.supplier, raw.supplierId, [raw.supplierName, raw.supplier], ['businessName', 'name', 'mobile']),
          resolveLookupId(prisma.location, raw.locationId, [raw.location, raw.businessLocation], ['name']),
        ]);
        const purchaseReturnTaxCandidate = raw.taxAmount ?? raw.tax;
        const d = {
          refNo: String(raw.refNo || raw.referenceNo || `PR-${id}`),
          date: normDate(raw.date),
          purchaseId,
          supplierId,
          locationId,
          paymentStatus: normStatus(raw.paymentStatus, ['PAID', 'DUE', 'PARTIAL', 'OVERDUE'], 'DUE'),
          subTotal: toFiniteNumber(raw.subTotal, 0),
          discountAmount: toFiniteNumber(raw.discountAmount, 0),
          taxAmount: toFiniteNumber(purchaseReturnTaxCandidate, 0),
          grandTotal: toFiniteNumber(raw.grandTotal ?? raw.totalAmount, 0),
          totalRefunded: toFiniteNumber(raw.totalRefunded, 0),
          note: raw.note ? String(raw.note) : null,
          meta: raw,
        };
        await prisma.purchaseReturn.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'orders': {
        const [customerId, locationId, addedById, approvedById] = await Promise.all([
          resolveLookupId(prisma.customer, raw.customerId, [raw.customerName, raw.customer], ['businessName', 'name', 'mobile']),
          resolveLookupId(prisma.location, raw.locationId, [raw.location, raw.businessLocation], ['name']),
          resolveLookupId(prisma.appUser, raw.addedById, [raw.addedBy], ['name', 'username', 'email']),
          resolveLookupId(prisma.appUser, raw.approvedById, [raw.approvedBy], ['name', 'username', 'email']),
        ]);
        const orderTaxCandidate = raw.taxAmount ?? raw.tax;
        const d = {
          orderNumber: String(raw.orderNumber || raw.refNo || `ORD-${id}`),
          orderDate: normDate(raw.orderDate || raw.date),
          customerId,
          locationId,
          addedById,
          approvedById,
          deliveryDate: normOptionalDate(raw.deliveryDate),
          status: normStatus(raw.status, ['PENDING', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'], 'PENDING'),
          paymentStatus: normStatus(raw.paymentStatus, ['PAID', 'DUE', 'PARTIAL', 'OVERDUE'], 'DUE'),
          orderType: normStatus(raw.orderType, ['PAID', 'CREDIT'], 'CREDIT'),
          subTotal: toFiniteNumber(raw.subTotal, 0),
          taxAmount: toFiniteNumber(orderTaxCandidate, 0),
          discountAmount: toFiniteNumber(raw.discountAmount, 0),
          total: toFiniteNumber(raw.total ?? raw.grandTotal ?? raw.totalAmount, 0),
          isApproved: raw.isApproved === true,
          note: raw.note ? String(raw.note) : null,
          meta: raw,
        };
        await prisma.salesOrder.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'activityLogs': {
        const rawMeta = toObject(raw.meta);
        const d = {
          userName: String(raw.user || raw.userName || 'System'),
          action: String(raw.action || 'Updated'),
          module: String(raw.module || 'System'),
          description: String(raw.description || ''),
          date: normDate(raw.date),
          ipAddress: raw.ipAddress ? String(raw.ipAddress) : null,
          meta: { ...raw, ...rawMeta },
        };
        await prisma.activityLog.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'locations': {
        const [invoiceSchemeId, invoiceLayoutPosId, invoiceLayoutSaleId, receiptPrinterId] = await Promise.all([
          resolveLookupId(prisma.invoiceScheme, raw.invoiceSchemeId, [raw.invoiceScheme], ['name', 'prefix']),
          resolveLookupId(prisma.invoiceLayout, raw.invoiceLayoutPosId, [raw.invoiceLayoutPos], ['name']),
          resolveLookupId(prisma.invoiceLayout, raw.invoiceLayoutSaleId, [raw.invoiceLayoutSale], ['name']),
          resolveLookupId(prisma.receiptPrinter, raw.receiptPrinterId, [raw.receiptPrinter], ['name']),
        ]);
        const d = {
          name: String(raw.name || `Location-${id}`),
          city: raw.city ? String(raw.city) : null,
          state: raw.state ? String(raw.state) : null,
          country: raw.country ? String(raw.country) : null,
          mobile: raw.mobile ? String(raw.mobile) : null,
          email: raw.email ? String(raw.email) : null,
          isActive: raw.isActive !== false,
          invoiceSchemeId,
          invoiceLayoutPosId,
          invoiceLayoutSaleId,
          receiptPrinterId,
          meta: raw,
        };
        await prisma.location.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'roles': {
        const d = {
          name: String(raw.name || `Role-${id}`),
          description: String(raw.description || ''),
          isSystem: raw.isSystem === true,
          meta: raw,
        };
        await prisma.role.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'commissionAgents': {
        const userId = await resolveLookupId(
          prisma.appUser,
          raw.userId || raw.linkedUserId,
          [raw.name, raw.email, raw.username],
          ['name', 'email', 'username'],
        );
        const d = {
          userId,
          name: String(raw.name || `Agent-${id}`),
          contactNo: normOptionalString(raw.contactNo || raw.mobile || raw.phone),
          commissionPercentage: toFiniteNumber(raw.commissionPercentage ?? raw.commissionPercent, 0),
          isActive: raw.isActive !== false,
          meta: raw,
        };
        await prisma.salesRepresentative.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'invoiceSchemes': {
        const d = {
          name: String(raw.name || `Scheme-${id}`),
          prefix: String(raw.prefix || 'INV-'),
          startFrom: parseIntSafe(raw.startFrom, 1, 1, 1_000_000),
          digitLength: parseIntSafe(raw.numberOfDigits ?? raw.digitLength, 4, 1, 16),
          isDefault: raw.isDefault === true,
          meta: raw,
        };
        if (d.isDefault) {
          await prisma.$transaction(async (tx) => {
            await tx.invoiceScheme.updateMany({ data: { isDefault: false } });
            await tx.invoiceScheme.upsert({ where: { id }, update: d, create: { id, ...d } });
          });
        } else {
          await prisma.invoiceScheme.upsert({ where: { id }, update: d, create: { id, ...d } });
        }
        break;
      }
      case 'invoiceLayouts': {
        const layoutType = normStatus(
          raw.type || raw.layoutType || (String(raw.design || '').toLowerCase().includes('pos') ? 'POS' : 'SALE'),
          ['SALE', 'POS'],
          'SALE',
        );
        const d = {
          name: String(raw.name || `Layout-${id}`),
          type: layoutType,
          headerHtml: normOptionalString(raw.headerHtml),
          footerHtml: normOptionalString(raw.footerHtml),
          bodyTemplate: (raw.bodyTemplate && typeof raw.bodyTemplate === 'object') ? raw.bodyTemplate : null,
          showClientLogo: raw.showClientLogo !== false,
          isDefault: raw.isDefault === true,
          meta: raw,
        };
        if (d.isDefault) {
          await prisma.$transaction(async (tx) => {
            await tx.invoiceLayout.updateMany({ data: { isDefault: false } });
            await tx.invoiceLayout.upsert({ where: { id }, update: d, create: { id, ...d } });
          });
        } else {
          await prisma.invoiceLayout.upsert({ where: { id }, update: d, create: { id, ...d } });
        }
        break;
      }
      case 'receiptPrinters': {
        const d = {
          name: String(raw.name || `Printer-${id}`),
          connection: normOptionalString(raw.connection || raw.connectionType),
          charactersPerLine: parseIntSafe(raw.charactersPerLine, 48, 16, 120),
          paperWidthMm: parseIntSafe(raw.paperWidthMm ?? raw.paperWidth, 80, 40, 200),
          isDefault: raw.isDefault === true,
          meta: raw,
        };
        if (d.isDefault) {
          await prisma.$transaction(async (tx) => {
            await tx.receiptPrinter.updateMany({ data: { isDefault: false } });
            await tx.receiptPrinter.upsert({ where: { id }, update: d, create: { id, ...d } });
          });
        } else {
          await prisma.receiptPrinter.upsert({ where: { id }, update: d, create: { id, ...d } });
        }
        break;
      }
      case 'barcodeSettings': {
        const d = {
          name: String(raw.name || `Barcode-${id}`),
          paperWidthMm: toFiniteNumber(raw.paperWidthMm ?? raw.paperWidth, 210),
          paperHeightMm: toFiniteNumber(raw.paperHeightMm ?? raw.paperHeight, 297),
          labelWidthMm: toFiniteNumber(raw.labelWidthMm ?? raw.stickerWidth, 50),
          labelHeightMm: toFiniteNumber(raw.labelHeightMm ?? raw.stickerHeight, 25),
          labelsPerRow: parseIntSafe(raw.labelsPerRow ?? raw.stickersInOneRow, 4, 1, 100),
          labelsPerPage: parseIntSafe(raw.labelsPerPage ?? raw.stickersInOneSheet, 40, 1, 5000),
          isDefault: raw.isDefault === true,
          meta: raw,
        };
        if (d.isDefault) {
          await prisma.$transaction(async (tx) => {
            await tx.barcodeSetting.updateMany({ data: { isDefault: false } });
            await tx.barcodeSetting.upsert({ where: { id }, update: d, create: { id, ...d } });
          });
        } else {
          await prisma.barcodeSetting.upsert({ where: { id }, update: d, create: { id, ...d } });
        }
        break;
      }
      default:
        return res.status(400).json({ ok: false, error: `Resource '${resource}' is not supported for atomic sync` });
    }
    return res.json({ ok: true, id, resource, data: responseData });
  } catch (error) {
    console.error(`[sync/record] Failed resource=${resource} id=${id}`, error);
    return sendPrismaError(res, error, `Failed to sync ${resource} record`);
  }
});

app.post('/api/sync/customer-payment', requireAuth, async (req, res) => {
  const raw = toObject(req.body);
  const id = String(raw.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  try {
    const [customerId, locationId, accountId] = await Promise.all([
      resolveLookupId(prisma.customer, raw.customerId || raw.contactId, [raw.contactName, raw.customerName], ['businessName', 'name', 'mobile']),
      resolveLookupId(prisma.location, raw.locationId, [raw.location, raw.businessLocation], ['name']),
      resolveLookupId(prisma.paymentAccount, raw.accountId || raw.paymentAccountId, [raw.account, raw.paymentAccount], ['name', 'accountNumber']),
    ]);
    if (!customerId) {
      return res.status(400).json({ ok: false, error: 'Customer not found for payment' });
    }

    const amount = toFiniteNumber(raw.amount, 0);
    if (amount <= 0) {
      return res.status(400).json({ ok: false, error: 'Payment amount must be greater than zero' });
    }

    const paymentData = {
      date: normDate(raw.date),
      contactType: 'CUSTOMER',
      direction: normStatus(raw.direction || raw.type, ['RECEIVED', 'SENT'], 'RECEIVED'),
      customerId,
      supplierId: null,
      expenseId: null,
      locationId,
      accountId,
      referenceNo: String(raw.referenceNo || raw.refNo || `PAY-${id}`),
      method: String(raw.method || raw.paymentMethod || 'Cash'),
      amount,
      note: raw.note ? String(raw.note) : null,
      meta: {
        ...raw,
        id,
        contactId: raw.contactId || customerId,
        contactType: 'Customer',
        type: raw.type === 'sent' ? 'sent' : 'received',
      },
    };

    const result = await prisma.$transaction(async (tx) => {
      const savedPayment = await tx.payment.upsert({
        where: { id },
        update: paymentData,
        create: { id, ...paymentData },
      });

      const [saleRows, paymentRows, customerRow] = await Promise.all([
        tx.sale.findMany({
          where: { customerId, status: 'FINAL' },
          orderBy: [{ date: 'asc' }, { invoiceNo: 'asc' }],
        }),
        tx.payment.findMany({
          where: { customerId, contactType: 'CUSTOMER', direction: 'RECEIVED' },
          orderBy: [{ date: 'asc' }, { referenceNo: 'asc' }],
        }),
        tx.customer.findUnique({ where: { id: customerId } }),
      ]);

      const workingSales = saleRows.map((sale) => {
        const grandTotal = Number(toFiniteNumber(sale.grandTotal, 0).toFixed(3));
        return {
          ...sale,
          grandTotalNumber: grandTotal,
          totalPaidNumber: 0,
          sellDueNumber: grandTotal,
          paymentStatusValue: grandTotal <= 0.001 ? 'PAID' : 'DUE',
        };
      });
      const saleIndexById = new Map(workingSales.map((sale, index) => [String(sale.id), index]));
      const currentPaymentAllocations = [];
      let unallocatedReceived = 0;

      for (const payment of paymentRows) {
        let remaining = Number(toFiniteNumber(payment.amount, 0).toFixed(3));
        if (remaining <= 0) continue;
        const meta = toObject(payment.meta);
        const linkedInvoices = toArray(meta.linkedInvoices)
          .map((invoiceNo) => String(invoiceNo || '').trim())
          .filter(Boolean);
        const linkedSet = new Set(linkedInvoices);
        const strictLinkedAllocation = meta.strictLinkedAllocation === true && linkedSet.size > 0;
        const dueIndexes = workingSales
          .map((sale, index) => ({ sale, index }))
          .filter(({ sale }) => sale.sellDueNumber > 0.0005);
        const prioritized = linkedSet.size === 0
          ? dueIndexes
          : strictLinkedAllocation
            ? dueIndexes.filter(({ sale }) => linkedSet.has(String(sale.invoiceNo || '').trim()))
            : [
                ...dueIndexes.filter(({ sale }) => linkedSet.has(String(sale.invoiceNo || '').trim())),
                ...dueIndexes.filter(({ sale }) => !linkedSet.has(String(sale.invoiceNo || '').trim())),
              ];

        for (const { sale, index } of prioritized) {
          if (remaining <= 0) break;
          const settled = Math.min(remaining, sale.sellDueNumber);
          if (settled <= 0) continue;
          remaining = Number(Math.max(0, remaining - settled).toFixed(3));
          const nextPaid = Number((sale.totalPaidNumber + settled).toFixed(3));
          const nextDue = Number(Math.max(0, sale.sellDueNumber - settled).toFixed(3));
          workingSales[index] = {
            ...sale,
            totalPaidNumber: nextPaid,
            sellDueNumber: nextDue,
            paymentStatusValue: nextDue <= 0.001 ? 'PAID' : 'PARTIAL',
          };
          if (payment.id === id) {
            currentPaymentAllocations.push({
              saleId: sale.id,
              invoiceNo: sale.invoiceNo,
              amount: Number(settled.toFixed(3)),
            });
          }
        }
        unallocatedReceived = Number((unallocatedReceived + remaining).toFixed(3));
      }

      const updatedSales = [];
      for (const sale of workingSales) {
        const existingIndex = saleIndexById.get(String(sale.id));
        const existingSale = typeof existingIndex === 'number' ? saleRows[existingIndex] : null;
        if (!existingSale) continue;
        const existingPaid = Number(toFiniteNumber(existingSale.totalPaid, 0).toFixed(3));
        const existingDue = Number(toFiniteNumber(existingSale.sellDue, 0).toFixed(3));
        const existingStatus = String(existingSale.paymentStatus || 'DUE');
        if (
          Math.abs(existingPaid - sale.totalPaidNumber) <= 0.0005 &&
          Math.abs(existingDue - sale.sellDueNumber) <= 0.0005 &&
          existingStatus === sale.paymentStatusValue
        ) {
          continue;
        }
        const existingMeta = toObject(existingSale.meta);
        const frontendStatus =
          sale.paymentStatusValue === 'PAID'
            ? 'Paid'
            : sale.paymentStatusValue === 'PARTIAL'
              ? 'Partial'
              : 'Due';
        const nextMeta = {
          ...existingMeta,
          totalPaid: sale.totalPaidNumber,
          sellDue: sale.sellDueNumber,
          paymentStatus: frontendStatus,
        };
        const updated = await tx.sale.update({
          where: { id: sale.id },
          data: {
            totalPaid: sale.totalPaidNumber,
            sellDue: sale.sellDueNumber,
            paymentStatus: sale.paymentStatusValue,
            meta: nextMeta,
          },
        });
        updatedSales.push({ ...nextMeta, ...updated });
      }

      await tx.paymentAllocation.deleteMany({ where: { paymentId: id } });
      if (currentPaymentAllocations.length > 0) {
        await tx.paymentAllocation.createMany({
          data: currentPaymentAllocations.map((allocation, index) => ({
            id: `alloc-${id}-${index + 1}`,
            paymentId: id,
            saleId: allocation.saleId,
            invoiceNo: allocation.invoiceNo,
            amount: allocation.amount,
          })),
          skipDuplicates: true,
        });
      }

      const totalSellDue = Number(
        workingSales.reduce((sum, sale) => sum + sale.sellDueNumber, 0).toFixed(3),
      );
      if (customerRow) {
        const customerMeta = toObject(customerRow.meta);
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalSellDue,
            advanceBalance: unallocatedReceived,
            meta: {
              ...customerMeta,
              totalSellDue,
              advanceBalance: unallocatedReceived,
            },
          },
        });
      }

      const savedMeta = toObject(savedPayment.meta);
      return {
        payment: { ...savedMeta, ...savedPayment },
        sales: updatedSales,
        allocations: currentPaymentAllocations,
        totalSellDue,
        advanceBalance: unallocatedReceived,
      };
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return sendPrismaError(res, error, 'Failed to save customer payment');
  }
});

app.delete('/api/sync/record/:resource/:id', requireAuth, requireCanDelete, async (req, res) => {
  const resource = String(req.params.resource || '').trim();
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  try {
    switch (resource) {
      case 'products':        await prisma.product.deleteMany({ where: { id } }); break;
      case 'productCategories': await prisma.productCategory.deleteMany({ where: { id } }); break;
      case 'productBrands':   await prisma.productBrand.deleteMany({ where: { id } }); break;
      case 'productUnits':    await prisma.productUnit.deleteMany({ where: { id } }); break;
      case 'productWarranties': await prisma.productWarranty.deleteMany({ where: { id } }); break;
      case 'productVariations': await prisma.productVariation.deleteMany({ where: { id } }); break;
      case 'customers':       await prisma.customer.deleteMany({ where: { id } }); break;
      case 'suppliers':       await prisma.supplier.deleteMany({ where: { id } }); break;
      case 'sales': {
        const archived = await archiveSaleRecord(id, req);
        if (!archived) return res.status(404).json({ ok: false, error: 'Record not found' });
        break;
      }
      case 'payments':        await prisma.payment.deleteMany({ where: { id } }); break;
      case 'users': {
        const user = await prisma.appUser.findUnique({ where: { id }, select: { email: true } });
        if (user && isCriticalAdminEmail(user.email)) {
          return res.status(400).json({ ok: false, error: 'Critical admin user cannot be deleted' });
        }
        await prisma.appUser.deleteMany({ where: { id } });
        break;
      }
      case 'expenses':        await prisma.expense.deleteMany({ where: { id } }); break;
      case 'purchases':       await prisma.purchase.deleteMany({ where: { id } }); break;
      case 'purchaseRequisitions': await prisma.purchaseRequisition.deleteMany({ where: { id } }); break;
      case 'purchaseOrders':   await prisma.purchaseOrder.deleteMany({ where: { id } }); break;
      case 'sellReturns':     await prisma.sellReturn.deleteMany({ where: { id } }); break;
      case 'purchaseReturns': await prisma.purchaseReturn.deleteMany({ where: { id } }); break;
      case 'orders':          await prisma.salesOrder.deleteMany({ where: { id } }); break;
      case 'activityLogs':    await prisma.activityLog.deleteMany({ where: { id } }); break;
      case 'locations':       await prisma.location.deleteMany({ where: { id } }); break;
      case 'taxRates':        await prisma.taxRate.deleteMany({ where: { id } }); break;
      case 'customerGroups':  await prisma.customerGroup.deleteMany({ where: { id } }); break;
      case 'sellingPriceGroups': await prisma.sellingPriceGroup.deleteMany({ where: { id } }); break;
      case 'discounts':       await prisma.discount.deleteMany({ where: { id } }); break;
      case 'expenseCategories': await prisma.expenseCategory.deleteMany({ where: { id } }); break;
      case 'roles':           await prisma.role.deleteMany({ where: { id } }); break;
      case 'commissionAgents': await prisma.salesRepresentative.deleteMany({ where: { id } }); break;
      case 'invoiceSchemes':  await prisma.invoiceScheme.deleteMany({ where: { id } }); break;
      case 'invoiceLayouts':  await prisma.invoiceLayout.deleteMany({ where: { id } }); break;
      case 'receiptPrinters': await prisma.receiptPrinter.deleteMany({ where: { id } }); break;
      case 'barcodeSettings': await prisma.barcodeSetting.deleteMany({ where: { id } }); break;
      default:
        return res.status(400).json({ ok: false, error: `Resource '${resource}' is not supported for atomic delete` });
    }
    return res.json({ ok: true, deleted: true, archived: resource === 'sales', id, resource });
  } catch (error) {
    return sendPrismaError(res, error, `Failed to delete ${resource} record`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  ATOMIC STOCK DELTA
//  POST /api/sync/stock-delta   Body: { productId, delta }
//  Uses Prisma's atomic increment so concurrent requests from different users
//  never race and overwrite each other's stock changes.
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/sync/stock-delta', requireAuth, async (req, res) => {
  const { productId, delta } = toObject(req.body);
  const id = String(productId || '').trim();
  const d = Number(delta);
  if (!id) return res.status(400).json({ ok: false, error: 'productId is required' });
  if (!Number.isFinite(d) || d === 0) return res.status(400).json({ ok: false, error: 'delta must be a non-zero finite number' });

  try {
    // Atomic increment — PostgreSQL serialises concurrent updates on the same row
    const updated = await prisma.product.update({
      where: { id },
      data: { stock: { increment: d } },
    });
    // Keep the meta JSON consistent with the new stock value
    if (updated.meta && typeof updated.meta === 'object') {
      await prisma.product.update({
        where: { id },
        data: { meta: { ...updated.meta, stock: updated.stock } },
      });
    }
    return res.json({ ok: true, id, newStock: updated.stock });
  } catch (error) {
    return sendPrismaError(res, error, 'Failed to apply stock delta');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  FIELD PAYMENTS  — full CRUD to DB
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/sync/field-payments', requireAuth, async (_req, res) => {
  try {
    const rows = await prisma.fieldPayment.findMany({ orderBy: { date: 'desc' } });
    return res.json({ ok: true, data: rows.map(r => r.meta ?? r) });
  } catch (error) { return sendPrismaError(res, error, 'Failed to fetch field payments'); }
});

app.put('/api/sync/field-payments/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
  const raw = toObject(req.body);
  const customerId = String(raw.customerId || '').trim();
  if (!customerId) return res.status(400).json({ ok: false, error: 'customerId is required' });
  try {
    const [locationId, accountId] = await Promise.all([
      resolveLookupId(prisma.location, raw.locationId, [raw.location, raw.businessLocation], ['name']),
      resolveLookupId(prisma.paymentAccount, raw.accountId || raw.paymentAccountId, [raw.account, raw.paymentAccount], ['name', 'accountNumber']),
    ]);
    const d = {
      referenceNo: String(raw.referenceNo || id),
      customerId,
      locationId,
      accountId,
      date: normDate(raw.date),
      amount: toFiniteNumber(raw.amount, 0),
      method: String(raw.method || 'Cash'),
      status: String(raw.status || 'PENDING').toUpperCase() === 'APPROVED' ? 'APPROVED' : 'PENDING',
      note: raw.note ? String(raw.note) : null,
      meta: raw,
    };
    await prisma.fieldPayment.upsert({ where: { id }, update: d, create: { id, ...d } });
    return res.json({ ok: true, id });
  } catch (error) { return sendPrismaError(res, error, 'Failed to save field payment'); }
});

app.delete('/api/sync/field-payments/:id', requireAuth, requireCanDelete, async (req, res) => {
  const id = String(req.params.id || '').trim();
  try {
    await prisma.fieldPayment.deleteMany({ where: { id } });
    return res.json({ ok: true, deleted: true, id });
  } catch (error) { return sendPrismaError(res, error, 'Failed to delete field payment'); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PAYMENT ACCOUNTS  — full CRUD to DB
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/sync/payment-accounts', requireAuth, async (_req, res) => {
  try {
    const rows = await prisma.paymentAccount.findMany({ orderBy: { name: 'asc' } });
    return res.json({ ok: true, data: rows.map(r => r.meta ?? r) });
  } catch (error) { return sendPrismaError(res, error, 'Failed to fetch payment accounts'); }
});

app.put('/api/sync/payment-accounts/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
  const raw = toObject(req.body);
  try {
    const [locationId, typeId] = await Promise.all([
      resolveLookupId(prisma.location, raw.locationId, [raw.location, raw.businessLocation], ['name']),
      resolveLookupId(prisma.paymentAccountType, raw.typeId, [raw.typeName, raw.type], ['name']),
    ]);
    const d = {
      name: String(raw.name || `Account-${id}`),
      locationId,
      typeId,
      accountNumber: raw.accountNumber ? String(raw.accountNumber) : null,
      balance: toFiniteNumber(raw.balance, 0),
      status: String(raw.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      isSystem: raw.system === true || raw.isSystem === true,
      meta: raw,
    };
    await prisma.paymentAccount.upsert({ where: { id }, update: d, create: { id, ...d } });
    return res.json({ ok: true, id });
  } catch (error) { return sendPrismaError(res, error, 'Failed to save payment account'); }
});

app.delete('/api/sync/payment-accounts/:id', requireAuth, requireCanDelete, async (req, res) => {
  const id = String(req.params.id || '').trim();
  try {
    await prisma.paymentAccount.deleteMany({ where: { id } });
    return res.json({ ok: true, deleted: true, id });
  } catch (error) { return sendPrismaError(res, error, 'Failed to delete payment account'); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  REGISTER SESSIONS + TRANSACTIONS  — full CRUD to DB
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/sync/register-sessions', requireAuth, async (_req, res) => {
  try {
    const rows = await prisma.registerSession.findMany({ orderBy: { openedAt: 'desc' } });
    return res.json({ ok: true, data: rows.map(r => r.meta ?? r) });
  } catch (error) { return sendPrismaError(res, error, 'Failed to fetch register sessions'); }
});

app.put('/api/sync/register-sessions/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
  const raw = toObject(req.body);
  const locationId = await resolveLookupId(prisma.location, raw.locationId, [raw.location, raw.businessLocation], ['name']);
  if (!locationId) return res.status(400).json({ ok: false, error: 'locationId is required' });
  try {
    const [openedById, closedById] = await Promise.all([
      resolveLookupId(prisma.appUser, raw.openedById, [raw.openedBy], ['name', 'username', 'email']),
      resolveLookupId(prisma.appUser, raw.closedById, [raw.closedBy], ['name', 'username', 'email']),
    ]);
    const d = {
      locationId,
      openedById,
      closedById,
      openedAt: normDate(raw.openedAt || raw.openedAt),
      closedAt: raw.closedAt ? normDate(raw.closedAt) : null,
      status: String(raw.status || 'OPEN').toUpperCase() === 'CLOSED' ? 'CLOSED' : 'OPEN',
      cashInHand: toFiniteNumber(raw.cashInHand, 0),
      closingBalance: toOptionalFiniteNumber(raw.closingBalance),
      meta: raw,
    };
    await prisma.registerSession.upsert({ where: { id }, update: d, create: { id, ...d } });
    return res.json({ ok: true, id });
  } catch (error) { return sendPrismaError(res, error, 'Failed to save register session'); }
});

app.get('/api/sync/register-transactions', requireAuth, async (_req, res) => {
  try {
    const rows = await prisma.registerTransaction.findMany({ orderBy: { date: 'desc' } });
    return res.json({ ok: true, data: rows.map(r => r.meta ?? r) });
  } catch (error) { return sendPrismaError(res, error, 'Failed to fetch register transactions'); }
});

app.put('/api/sync/register-transactions/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
  const raw = toObject(req.body);
  const sessionId = String(raw.sessionId || '').trim();
  if (!sessionId) return res.status(400).json({ ok: false, error: 'sessionId is required' });
  try {
    const d = {
      sessionId,
      date: normDate(raw.date),
      transactionType: String(raw.type || raw.transactionType || 'sale'),
      amount: toFiniteNumber(raw.amount, 0),
      method: raw.method ? String(raw.method) : null,
      invoiceNo: raw.invoiceNo ? String(raw.invoiceNo) : null,
      note: raw.note ? String(raw.note) : null,
      meta: raw,
    };
    await prisma.registerTransaction.upsert({ where: { id }, update: d, create: { id, ...d } });
    return res.json({ ok: true, id });
  } catch (error) { return sendPrismaError(res, error, 'Failed to save register transaction'); }
});

app.delete('/api/sync/register-transactions/:id', requireAuth, requireCanDelete, async (req, res) => {
  const id = String(req.params.id || '').trim();
  try {
    await prisma.registerTransaction.deleteMany({ where: { id } });
    return res.json({ ok: true, deleted: true, id });
  } catch (error) { return sendPrismaError(res, error, 'Failed to delete register transaction'); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  STOCK LEDGER  — append-only, bulk upsert
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/sync/stock-ledger', requireAuth, async (_req, res) => {
  try {
    const rows = await prisma.stockLedger.findMany({ orderBy: { date: 'desc' } });
    return res.json({ ok: true, data: rows.map(r => r.meta ?? r) });
  } catch (error) { return sendPrismaError(res, error, 'Failed to fetch stock ledger'); }
});

app.put('/api/sync/stock-ledger/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
  const raw = toObject(req.body);
  let productId = String(raw.productId || '').trim();
  if (!productId) return res.status(400).json({ ok: false, error: 'productId is required' });
  try {
    const productExists = await prisma.product.findFirst({
      where: {
        OR: [
          { id: productId },
          ...(raw.sku ? [{ sku: { equals: String(raw.sku), mode: 'insensitive' } }] : []),
          ...(raw.productName ? [{ name: { equals: String(raw.productName), mode: 'insensitive' } }] : []),
        ],
      },
      select: { id: true, name: true, sku: true },
    });
    if (!productExists) {
      const label = [raw.sku, raw.productName, raw.ref].filter(Boolean).join(' / ') || productId;
      return res.status(400).json({ ok: false, error: `Product not found for stock ledger entry: ${label}` });
    }
    productId = productExists.id;
    const [saleId, locationId] = await Promise.all([
      resolveLookupId(prisma.sale, raw.saleId || raw.parentSaleId, [raw.invoiceNo, raw.ref], ['invoiceNo']),
      resolveLookupId(prisma.location, raw.locationId, [raw.location, raw.businessLocation], ['name']),
    ]);
    const d = {
      productId,
      saleId,
      locationId,
      entryType: String(raw.type || raw.entryType || 'Adjustment'),
      changeQty: toFiniteNumber(raw.change ?? raw.changeQty, 0),
      newQty: toFiniteNumber(raw.newQty, 0),
      date: normDate(raw.date),
      ref: String(raw.ref || id),
      party: String(raw.party || 'System'),
      note: raw.note ? String(raw.note) : null,
      meta: raw,
    };
    await prisma.stockLedger.upsert({ where: { id }, update: d, create: { id, ...d } });
    return res.json({ ok: true, id });
  } catch (error) { return sendPrismaError(res, error, 'Failed to save stock ledger entry'); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  STOCK ADJUSTMENTS  — full CRUD to DB
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/sync/stock-adjustments', requireAuth, async (_req, res) => {
  try {
    const rows = await prisma.stockAdjustment.findMany({ orderBy: { date: 'desc' } });
    return res.json({ ok: true, data: rows.map(r => r.meta ?? r) });
  } catch (error) { return sendPrismaError(res, error, 'Failed to fetch stock adjustments'); }
});

app.put('/api/sync/stock-adjustments/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
  const raw = toObject(req.body);
  const locationId = await resolveLookupId(prisma.location, raw.locationId, [raw.location, raw.businessLocation], ['name']);
  if (!locationId) return res.status(400).json({ ok: false, error: 'locationId is required' });
  try {
    const d = {
      referenceNo: String(raw.referenceNo || id),
      date: normDate(raw.date),
      locationId,
      adjustmentType: ['ABNORMAL', 'DAMAGE'].includes(String(raw.adjustmentType || 'NORMAL').toUpperCase()) ? 'ABNORMAL' : 'NORMAL',
      reason: raw.reason ? String(raw.reason) : null,
      totalAmount: toFiniteNumber(raw.totalAmount, 0),
      totalRecovered: toFiniteNumber(raw.totalRecovered, 0),
      meta: raw,
    };
    await prisma.stockAdjustment.upsert({ where: { id }, update: d, create: { id, ...d } });
    return res.json({ ok: true, id });
  } catch (error) { return sendPrismaError(res, error, 'Failed to save stock adjustment'); }
});

app.delete('/api/sync/stock-adjustments/:id', requireAuth, requireCanDelete, async (req, res) => {
  const id = String(req.params.id || '').trim();
  try {
    await prisma.stockAdjustment.deleteMany({ where: { id } });
    return res.json({ ok: true, deleted: true, id });
  } catch (error) { return sendPrismaError(res, error, 'Failed to delete stock adjustment'); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  STOCK TRANSFERS  — full CRUD to DB
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/sync/stock-transfers', requireAuth, async (_req, res) => {
  try {
    const rows = await prisma.stockTransfer.findMany({ orderBy: { date: 'desc' } });
    return res.json({ ok: true, data: rows.map(r => r.meta ?? r) });
  } catch (error) { return sendPrismaError(res, error, 'Failed to fetch stock transfers'); }
});

app.put('/api/sync/stock-transfers/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
  const raw = toObject(req.body);
  const [locationFromId, locationToId] = await Promise.all([
    resolveLookupId(prisma.location, raw.locationFromId, [raw.locationFrom], ['name']),
    resolveLookupId(prisma.location, raw.locationToId, [raw.locationTo], ['name']),
  ]);
  if (!locationFromId || !locationToId) return res.status(400).json({ ok: false, error: 'locationFromId and locationToId are required' });
  try {
    const d = {
      refNo: String(raw.refNo || id),
      date: normDate(raw.date),
      locationFromId,
      locationToId,
      status: normStatus(raw.status, ['PENDING', 'IN_TRANSIT', 'COMPLETED'], 'PENDING'),
      shippingCharges: toFiniteNumber(raw.shippingCharges, 0),
      totalAmount: toFiniteNumber(raw.totalAmount, 0),
      note: raw.notes ? String(raw.notes) : (raw.note ? String(raw.note) : null),
      meta: raw,
    };
    await prisma.stockTransfer.upsert({ where: { id }, update: d, create: { id, ...d } });
    return res.json({ ok: true, id });
  } catch (error) { return sendPrismaError(res, error, 'Failed to save stock transfer'); }
});

app.delete('/api/sync/stock-transfers/:id', requireAuth, requireCanDelete, async (req, res) => {
  const id = String(req.params.id || '').trim();
  try {
    await prisma.stockTransfer.deleteMany({ where: { id } });
    return res.json({ ok: true, deleted: true, id });
  } catch (error) { return sendPrismaError(res, error, 'Failed to delete stock transfer'); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  STOCK LOTS  — upsert by id
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/sync/stock-lots', requireAuth, async (_req, res) => {
  try {
    const rows = await prisma.stockLot.findMany();
    return res.json({ ok: true, data: rows.map(r => r.meta ?? r) });
  } catch (error) { return sendPrismaError(res, error, 'Failed to fetch stock lots'); }
});

app.put('/api/sync/stock-lots/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
  const raw = toObject(req.body);
  const productId = String(raw.productId || '').trim();
  const locationId = await resolveLookupId(prisma.location, raw.locationId, [raw.location, raw.businessLocation], ['name']);
  if (!productId || !locationId) return res.status(400).json({ ok: false, error: 'productId and locationId are required' });
  try {
    const d = {
      productId,
      locationId,
      lotNumber: String(raw.lotNumber || '--'),
      expiryDate: raw.expiryDate ? normDate(raw.expiryDate) : null,
      unitCost: toFiniteNumber(raw.unitCost, 0),
      qty: toFiniteNumber(raw.qty, 0),
      meta: raw,
    };
    await prisma.stockLot.upsert({ where: { id }, update: d, create: { id, ...d } });
    return res.json({ ok: true, id });
  } catch (error) { return sendPrismaError(res, error, 'Failed to save stock lot'); }
});

app.delete('/api/sync/stock-lots/:id', requireAuth, requireCanDelete, async (req, res) => {
  const id = String(req.params.id || '').trim();
  try {
    await prisma.stockLot.deleteMany({ where: { id } });
    return res.json({ ok: true, deleted: true, id });
  } catch (error) { return sendPrismaError(res, error, 'Failed to delete stock lot'); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  LEGACY SNAPSHOT ENDPOINTS DISABLED
//  Business data must use typed PostgreSQL tables through /api/data/* or
//  /api/sync/record/*, never snapshot blobs.
// ────────────────────────��─────────────────────────��──────────────────────────

const sendLegacySnapshotGone = (res, replacement = '/api/data/:resource') =>
  res.status(410).json({
    ok: false,
    error: `Legacy snapshot storage has been disabled. Use ${replacement} so PostgreSQL tables remain the source of truth.`,
  });

app.get('/api/sync/collection/:key', requireAuth, (_req, res) => {
  return sendLegacySnapshotGone(res);
});

app.put('/api/sync/collection/:key', requireAuth, (_req, res) => {
  return sendLegacySnapshotGone(res);
});

// ────────────────────────────────────────────────────────────────────��────────
//  LEGACY SNAPSHOT ENDPOINTS (kept for backward-compat; no longer the primary
//  sync path — atomic /api/sync/record endpoints are used instead)
// ───────────────────────────────────────────────────────────────────��─────────

app.get('/api/sync/core', (_req, res) => {
  return sendLegacySnapshotGone(res, '/api/data/:resource');
});

app.put('/api/sync/core', (_req, res) => {
  return sendLegacySnapshotGone(res, '/api/sync/record/:resource');
});

app.get('/api/sync/core/status', (_req, res) => {
  return sendLegacySnapshotGone(res, '/api/data/:resource');
});

// NOTE: /api/sync/core/materialize has been removed.
// Atomic /api/sync/record/:resource endpoints replaced it — each CRUD
// operation now writes directly to the relational table with no bottleneck.
// The route is kept as a 410 Gone so old clients get a clear error instead
// of a silent hang.
app.post('/api/sync/core/materialize', (_req, res) => {
  res.status(410).json({ ok: false, error: 'materialize endpoint removed — use /api/sync/record/:resource' });
});


app.get('/api/options/bulk', (_req, res) => {
  return sendLegacySnapshotGone(res, '/api/data/:resource');
});

app.put('/api/options/bulk', (_req, res) => {
  return sendLegacySnapshotGone(res, '/api/data/:resource/bulk-upsert');
});

app.post('/api/bootstrap/defaults', async (_req, res) => {
  try {
    await prisma.appSetting.upsert({
      where: { id: 'SETTINGS' },
      update: {},
      create: {
        id: 'SETTINGS',
        businessName: 'ATWAR BSS',
        currency: 'OMR',
        currencySymbol: 'OMR',
      },
    });
    const currencies = [
      { code: 'OMR', name: 'Omani Rial', symbol: 'OMR', precision: 3, isDefault: true },
      { code: 'USD', name: 'US Dollar', symbol: '$', precision: 2, isDefault: false },
      { code: 'EUR', name: 'Euro', symbol: 'EUR', precision: 2, isDefault: false },
      { code: 'GBP', name: 'British Pound', symbol: 'GBP', precision: 2, isDefault: false },
      { code: 'AED', name: 'UAE Dirham', symbol: 'AED', precision: 2, isDefault: false },
    ];
    await prisma.$transaction(currencies.map((currency) =>
      prisma.currency.upsert({ where: { code: currency.code }, update: currency, create: currency })
    ));
    const accountTypes = [
      { id: 'PAT-cash', name: 'Cash', isSystem: true, isActive: true },
      { id: 'PAT-bank', name: 'Bank', isSystem: true, isActive: true },
    ];
    await prisma.$transaction(accountTypes.map((type) =>
      prisma.paymentAccountType.upsert({
        where: { id: type.id },
        update: { name: type.name, isSystem: type.isSystem, isActive: type.isActive },
        create: type,
      })
    ));
    return res.json({ ok: true, message: 'Default records ensured' });
  } catch (error) {
    return sendPrismaError(res, error, 'Failed to bootstrap defaults');
  }
});

// Serve React frontend static files (built by `npm run build`)
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath, {
  // Fingerprinted assets can be cached aggressively.
  maxAge: '365d',
  index: false,
}));
app.get('*', (_req, res) => {
  // Always revalidate HTML so clients pick up new bundle filenames quickly.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.sendFile(path.join(distPath, 'index.html'));
});

const ensureCriticalAdminAtBoot = async () => {
  try {
    const admin = await prisma.appUser.findFirst({
      where: { email: { equals: CRITICAL_ADMIN_EMAIL, mode: 'insensitive' } },
      select: { id: true, status: true, allowLogin: true },
    });
    if (admin && !isUserLoginEnabled(admin)) {
      await enforceCriticalAdminStatus(admin.id);
    }
  } catch (error) {
    console.error('[ATWAR BSS API] failed to enforce critical admin status at boot', error);
  }
};

const backfillProductImageColumnFromMeta = async () => {
  try {
    const rows = await prisma.product.findMany({
      select: { id: true, image: true, meta: true },
      where: { OR: [{ image: null }, { image: '' }] },
    });
    if (!rows.length) return;
    const updates = [];
    for (const row of rows) {
      const meta = toObject(row.meta);
      const metaImage = normOptionalString(
        meta.image ??
        meta.imageLink ??
        meta.imageUrl ??
        meta.imageURL ??
        meta.productImage ??
        meta.productImageUrl ??
        meta.productImageURL,
      );
      if (!metaImage) continue;
      updates.push(
        prisma.product.update({
          where: { id: row.id },
          data: {
            image: metaImage,
            meta: { ...meta, image: metaImage },
          },
        }),
      );
    }
    if (updates.length > 0) {
      await prisma.$transaction(updates);
      console.log(`[ATWAR BSS API] backfilled image column for ${updates.length} product(s) from meta`);
    }
  } catch (error) {
    console.error('[ATWAR BSS API] product image backfill failed at boot', error);
  }
};

await ensureCriticalAdminAtBoot();
await backfillProductImageColumnFromMeta();

console.log(`[ATWAR BSS API] booting with Node ${process.version} on ${host}:${port}`);
const server = app.listen(port, host, () => {
  console.log(`[ATWAR BSS API] running at http://${host}:${port}`);
});
server.on('error', (error) => {
  console.error('[ATWAR BSS API] failed to start listener', error);
  process.exit(1);
});

const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
