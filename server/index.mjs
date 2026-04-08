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
const sanitizeCollectionKey = (value) =>
  String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);

const sanitizeCoreSnapshot = (input) => {
  const payload = toObject(input);
  return {
    products: toArray(payload.products),
    customers: toArray(payload.customers),
    suppliers: toArray(payload.suppliers),
    sales: toArray(payload.sales),
    payments: toArray(payload.payments),
    users: toArray(payload.users),
    settings: toObject(payload.settings),
    syncedAt: new Date().toISOString(),
  };
};
const hasSnapshotData = (s) =>
  s.products.length > 0 || s.customers.length > 0 || s.suppliers.length > 0 || s.sales.length > 0 || s.payments.length > 0 || s.users.length > 0;

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
  productInventory: { delegate: 'productInventory', idField: 'id', searchFields: ['lotNumber', 'rack', 'row', 'position'], defaultOrderBy: { updatedAt: 'desc' } },
  stockTransfers: { delegate: 'stockTransfer', idField: 'id', searchFields: ['refNo'], defaultOrderBy: { date: 'desc' } },
  stockTransferItems: { delegate: 'stockTransferItem', idField: 'id', searchFields: ['productName', 'sku'], defaultOrderBy: { id: 'asc' } },
  stockAdjustments: { delegate: 'stockAdjustment', idField: 'id', searchFields: ['referenceNo'], defaultOrderBy: { date: 'desc' } },
  stockAdjustmentItems: { delegate: 'stockAdjustmentItem', idField: 'id', searchFields: ['productName', 'sku'], defaultOrderBy: { id: 'asc' } },
  stockLots: { delegate: 'stockLot', idField: 'id', searchFields: ['lotNumber'], defaultOrderBy: { updatedAt: 'desc' } },
  stockLedger: { delegate: 'stockLedger', idField: 'id', searchFields: ['entryType', 'ref', 'party', 'note'], defaultOrderBy: { date: 'desc' } },
  purchases: { delegate: 'purchase', idField: 'id', searchFields: ['refNo'], defaultOrderBy: { date: 'desc' } },
  purchaseItems: { delegate: 'purchaseItem', idField: 'id', searchFields: ['name'], defaultOrderBy: { id: 'asc' } },
  purchaseReturns: { delegate: 'purchaseReturn', idField: 'id', searchFields: ['refNo'], defaultOrderBy: { date: 'desc' } },
  purchaseReturnItems: { delegate: 'purchaseReturnItem', idField: 'id', searchFields: ['name'], defaultOrderBy: { id: 'asc' } },
  sales: { delegate: 'sale', idField: 'id', searchFields: ['invoiceNo'], defaultOrderBy: { date: 'desc' } },
  saleItems: { delegate: 'saleItem', idField: 'id', searchFields: ['name'], defaultOrderBy: { id: 'asc' } },
  saleShippingActivities: { delegate: 'saleShippingActivity', idField: 'id', searchFields: ['action', 'by', 'note'], defaultOrderBy: { date: 'desc' } },
  sellReturns: { delegate: 'sellReturn', idField: 'id', searchFields: ['refNo'], defaultOrderBy: { date: 'desc' } },
  sellReturnItems: { delegate: 'sellReturnItem', idField: 'id', searchFields: ['name'], defaultOrderBy: { id: 'asc' } },
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
  optionCollections: { delegate: 'optionCollection', idField: 'key', searchFields: ['key'], defaultOrderBy: { key: 'asc' } },
  appStateSnapshots: { delegate: 'appStateSnapshot', idField: 'id', searchFields: ['id'], defaultOrderBy: { updatedAt: 'desc' } },
};

const getResource = (key) => RESOURCE_CONFIG[String(key || '').trim()] || null;
const sendPrismaError = (res, error, fallbackMessage) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return res.status(409).json({ ok: false, error: 'Duplicate value', code: error.code });
    if (error.code === 'P2025') return res.status(404).json({ ok: false, error: 'Record not found', code: error.code });
    if (error.code === 'P2003') return res.status(400).json({ ok: false, error: 'Invalid foreign key reference', code: error.code });
    return res.status(400).json({ ok: false, error: error.message, code: error.code });
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
      prisma.$queryRaw`SELECT 1`,
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
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' });
    }

    const user = await prisma.appUser.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user || user.status !== 'ACTIVE' || user.allowLogin === false) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials or account inactive' });
    }

    const { isValid, needsMigration } = await verifyPassword(password, user);
    
    if (!isValid) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials or account inactive' });
    }

    // Migrate password to secure bcrypt hash seamlessly
    if (needsMigration) {
      const newHash = await hashPassword(password);
      await prisma.appUser.update({
        where: { id: user.id },
        data: { passwordHash: newHash, passwordSalt: null, password: null }
      });
    }

    // Update lastLogin
    await prisma.appUser.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    const token = generateToken(user);

    // Send minimal user details, NEVER send passwordHash back
    delete user.passwordHash;
    delete user.passwordSalt;
    delete user.password;
    
    return res.json({ ok: true, token, user });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Login failed' });
  }
});

// Protected routes
app.use('/api/data', requireAuth);
app.use('/api/sync', requireAuth);
app.use('/api/options', requireAuth);
app.use('/api/bootstrap', requireAuth);

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

    const [data, total] = await prisma.$transaction([
      delegate.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        ...(paginate ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
      }),
      delegate.count({ where }),
    ]);

    return res.json({
      ok: true,
      data,
      pagination: {
        page,
        pageSize: paginate ? pageSize : data.length,
        total,
        totalPages: paginate ? Math.max(1, Math.ceil(total / pageSize)) : 1,
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
    const data = await delegate.findUnique({ where: { [cfg.idField]: id } });
    if (!data) return res.status(404).json({ ok: false, error: 'Record not found' });
    return res.json({ ok: true, data });
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

const requireCanDelete = async (req, res, next) => {
  try {
    const roleId = req.user?.roleId;
    if (!roleId) return res.status(403).json({ ok: false, error: 'Role not assigned' });
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    const roleName = String(role?.name || '').trim().toLowerCase();
    if (ROLE_NAMES_ALLOWED_DELETE.some(n => roleName.includes(n))) return next();
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

const normDate = (v) => { const d = new Date(String(v || '')); return Number.isNaN(d.getTime()) ? new Date() : d; };
const normStatus = (v, allowed, fallback) => { const s = String(v || '').trim().toUpperCase(); return allowed.includes(s) ? s : fallback; };

app.put('/api/sync/record/:resource', requireAuth, async (req, res) => {
  const resource = String(req.params.resource || '').trim();
  const raw = toObject(req.body);
  const id = String(raw.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  try {
    switch (resource) {
      case 'products': {
        const d = {
          name: String(raw.name || `Product-${id}`),
          sku: String(raw.sku || raw.name || id),
          type: normStatus(raw.type, ['SINGLE', 'VARIABLE', 'COMBO'], 'SINGLE'),
          packagingType: normStatus(raw.packagingType, ['PIECE', 'PACK', 'CARTON'], 'PIECE'),
          unitsPerPackage: Number(raw.unitsPerPackage || 0) > 0 ? Math.trunc(Number(raw.unitsPerPackage)) : null,
          unitPurchasePrice: Number(raw.unitPurchasePrice || 0),
          sellingPrice: Number(raw.sellingPrice || 0),
          stock: Number(raw.stock || 0),
          meta: raw,
        };
        await prisma.product.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'customers': {
        const d = {
          businessName: String(raw.businessName || raw.name || `Customer-${id}`),
          name: String(raw.name || raw.businessName || `Customer-${id}`),
          email: raw.email ? String(raw.email) : null,
          mobile: raw.mobile ? String(raw.mobile) : null,
          status: normStatus(raw.status, ['ACTIVE', 'INACTIVE'], 'ACTIVE'),
          creditLimit: Number(raw.creditLimit || 0),
          openingBalance: Number(raw.openingBalance || 0),
          advanceBalance: Number(raw.advanceBalance || 0),
          totalSellDue: Number(raw.totalSellDue || 0),
          totalSellReturnDue: Number(raw.totalSellReturnDue || 0),
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
          status: normStatus(raw.status, ['ACTIVE', 'INACTIVE'], 'ACTIVE'),
          openingBalance: Number(raw.openingBalance || 0),
          advanceBalance: Number(raw.advanceBalance || 0),
          totalPurchaseDue: Number(raw.totalPurchaseDue || 0),
          totalReturnDue: Number(raw.totalReturnDue || 0),
          meta: raw,
        };
        await prisma.supplier.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'sales': {
        const d = {
          invoiceNo: String(raw.invoiceNo || `INV-${id}`),
          date: normDate(raw.date),
          status: normStatus(raw.status || raw.saleStatus, ['FINAL', 'DRAFT', 'QUOTATION', 'PROFORMA'], 'FINAL'),
          paymentStatus: normStatus(raw.paymentStatus, ['PAID', 'DUE', 'PARTIAL', 'OVERDUE'], 'DUE'),
          shippingStatus: normStatus(raw.shippingStatus, ['PENDING', 'ORDERED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'], 'PENDING'),
          subTotal: Number(raw.subTotal || 0),
          discountAmount: Number(raw.discountAmount || 0),
          taxAmount: Number(raw.taxAmount || raw.tax || 0),
          shippingCharges: Number(raw.shippingCharges || 0),
          grandTotal: Number(raw.grandTotal || raw.totalAmount || 0),
          totalPaid: Number(raw.totalPaid || 0),
          sellDue: Number(raw.sellDue || 0),
          sellReturnDue: Number(raw.sellReturnDue || 0),
          meta: raw,
        };
        await prisma.sale.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'payments': {
        const d = {
          date: normDate(raw.date),
          contactType: normStatus(raw.contactType, ['CUSTOMER', 'SUPPLIER', 'EXPENSE'], 'CUSTOMER'),
          direction: normStatus(raw.direction || raw.type, ['RECEIVED', 'SENT'], 'RECEIVED'),
          referenceNo: String(raw.referenceNo || raw.refNo || `PAY-${id}`),
          method: String(raw.method || raw.paymentMethod || 'Cash'),
          amount: Number(raw.amount || 0),
          note: raw.note ? String(raw.note) : null,
          meta: raw,
        };
        await prisma.payment.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'users': {
        const d = {
          username: String(raw.username || raw.email || `user-${id}`),
          name: String(raw.name || raw.username || `User-${id}`),
          email: String(raw.email || `user-${id}@local.atwar`),
          mobile: raw.mobile ? String(raw.mobile) : null,
          status: normStatus(raw.status, ['ACTIVE', 'INACTIVE'], 'ACTIVE'),
          commissionPercent: Number(raw.commissionPercent || 0),
          maxDiscountPercent: Number(raw.maxDiscountPercent || 0),
          allowLogin: raw.allowLogin !== false,
          meta: raw,
        };
        await prisma.appUser.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'settings': {
        const d = {
          businessName: String(raw.businessName || 'ATWAR BSS'),
          currency: String(raw.currency || 'OMR'),
          currencySymbol: String(raw.currencySymbol || 'OMR'),
          meta: raw,
        };
        await prisma.appSetting.upsert({ where: { id: 'SETTINGS' }, update: d, create: { id: 'SETTINGS', ...d } });
        break;
      }
      case 'expenses': {
        const d = {
          refNo: String(raw.refNo || raw.referenceNo || `EXP-${id}`),
          date: normDate(raw.date),
          amount: Number(raw.amount || 0),
          tax: Number(raw.tax || 0),
          totalAmount: Number(raw.totalAmount || raw.amount || 0),
          paymentStatus: normStatus(raw.paymentStatus, ['PAID', 'DUE', 'PARTIAL', 'OVERDUE'], 'DUE'),
          paymentDue: Number(raw.paymentDue || raw.totalAmount || raw.amount || 0),
          isRecurring: raw.isRecurring === true,
          isRefund: raw.isRefund === true,
          note: raw.note ? String(raw.note) : null,
          meta: raw,
        };
        await prisma.expense.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'purchases': {
        const d = {
          refNo: String(raw.refNo || raw.referenceNo || `PUR-${id}`),
          date: normDate(raw.date),
          status: normStatus(raw.status, ['RECEIVED', 'PENDING', 'ORDERED', 'DRAFT'], 'PENDING'),
          paymentStatus: normStatus(raw.paymentStatus, ['PAID', 'DUE', 'PARTIAL', 'OVERDUE'], 'DUE'),
          subTotal: Number(raw.subTotal || 0),
          taxAmount: Number(raw.taxAmount || raw.tax || 0),
          discountAmount: Number(raw.discountAmount || 0),
          grandTotal: Number(raw.grandTotal || raw.totalAmount || 0),
          paymentDue: Number(raw.paymentDue || raw.grandTotal || 0),
          note: raw.note ? String(raw.note) : null,
          meta: raw,
        };
        await prisma.purchase.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'sellReturns': {
        const d = {
          refNo: String(raw.refNo || raw.referenceNo || `SR-${id}`),
          date: normDate(raw.date),
          paymentStatus: normStatus(raw.paymentStatus, ['PAID', 'DUE', 'PARTIAL', 'OVERDUE'], 'DUE'),
          subTotal: Number(raw.subTotal || 0),
          discountAmount: Number(raw.discountAmount || 0),
          taxAmount: Number(raw.taxAmount || raw.tax || 0),
          grandTotal: Number(raw.grandTotal || raw.totalAmount || 0),
          totalRefunded: Number(raw.totalRefunded || 0),
          note: raw.note ? String(raw.note) : null,
          meta: raw,
        };
        await prisma.sellReturn.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'purchaseReturns': {
        const d = {
          refNo: String(raw.refNo || raw.referenceNo || `PR-${id}`),
          date: normDate(raw.date),
          paymentStatus: normStatus(raw.paymentStatus, ['PAID', 'DUE', 'PARTIAL', 'OVERDUE'], 'DUE'),
          subTotal: Number(raw.subTotal || 0),
          discountAmount: Number(raw.discountAmount || 0),
          taxAmount: Number(raw.taxAmount || raw.tax || 0),
          grandTotal: Number(raw.grandTotal || raw.totalAmount || 0),
          totalRefunded: Number(raw.totalRefunded || 0),
          note: raw.note ? String(raw.note) : null,
          meta: raw,
        };
        await prisma.purchaseReturn.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'orders': {
        const d = {
          orderNumber: String(raw.orderNumber || raw.refNo || `ORD-${id}`),
          orderDate: normDate(raw.orderDate || raw.date),
          status: normStatus(raw.status, ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'ON_HOLD'], 'PENDING'),
          paymentStatus: normStatus(raw.paymentStatus, ['PAID', 'DUE', 'PARTIAL', 'OVERDUE'], 'DUE'),
          subTotal: Number(raw.subTotal || 0),
          taxAmount: Number(raw.taxAmount || raw.tax || 0),
          discountAmount: Number(raw.discountAmount || 0),
          total: Number(raw.total || raw.grandTotal || raw.totalAmount || 0),
          isApproved: raw.isApproved === true,
          note: raw.note ? String(raw.note) : null,
          meta: raw,
        };
        await prisma.salesOrder.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      case 'activityLogs': {
        const d = {
          userName: String(raw.user || raw.userName || 'System'),
          action: String(raw.action || 'Updated'),
          module: String(raw.module || 'System'),
          description: String(raw.description || ''),
          date: normDate(raw.date),
          ipAddress: raw.ipAddress ? String(raw.ipAddress) : null,
          meta: raw,
        };
        await prisma.activityLog.upsert({ where: { id }, update: d, create: { id, ...d } });
        break;
      }
      default:
        return res.status(400).json({ ok: false, error: `Resource '${resource}' is not supported for atomic sync` });
    }
    return res.json({ ok: true, id, resource });
  } catch (error) {
    return sendPrismaError(res, error, `Failed to sync ${resource} record`);
  }
});

app.delete('/api/sync/record/:resource/:id', requireAuth, requireCanDelete, async (req, res) => {
  const resource = String(req.params.resource || '').trim();
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  try {
    switch (resource) {
      case 'products':        await prisma.product.deleteMany({ where: { id } }); break;
      case 'customers':       await prisma.customer.deleteMany({ where: { id } }); break;
      case 'suppliers':       await prisma.supplier.deleteMany({ where: { id } }); break;
      case 'sales':           await prisma.sale.deleteMany({ where: { id } }); break;
      case 'payments':        await prisma.payment.deleteMany({ where: { id } }); break;
      case 'users':           await prisma.appUser.deleteMany({ where: { id } }); break;
      case 'expenses':        await prisma.expense.deleteMany({ where: { id } }); break;
      case 'purchases':       await prisma.purchase.deleteMany({ where: { id } }); break;
      case 'sellReturns':     await prisma.sellReturn.deleteMany({ where: { id } }); break;
      case 'purchaseReturns': await prisma.purchaseReturn.deleteMany({ where: { id } }); break;
      case 'orders':          await prisma.salesOrder.deleteMany({ where: { id } }); break;
      case 'activityLogs':    await prisma.activityLog.deleteMany({ where: { id } }); break;
      default:
        return res.status(400).json({ ok: false, error: `Resource '${resource}' is not supported for atomic delete` });
    }
    return res.json({ ok: true, deleted: true, id, resource });
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
    const d = {
      referenceNo: String(raw.referenceNo || id),
      customerId,
      date: normDate(raw.date),
      amount: Number(raw.amount || 0),
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
    const d = {
      name: String(raw.name || `Account-${id}`),
      accountNumber: raw.accountNumber ? String(raw.accountNumber) : null,
      balance: Number(raw.balance || 0),
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
  const locationId = String(raw.locationId || '').trim();
  if (!locationId) return res.status(400).json({ ok: false, error: 'locationId is required' });
  try {
    const d = {
      locationId,
      openedAt: normDate(raw.openedAt || raw.openedAt),
      closedAt: raw.closedAt ? normDate(raw.closedAt) : null,
      status: String(raw.status || 'OPEN').toUpperCase() === 'CLOSED' ? 'CLOSED' : 'OPEN',
      cashInHand: Number(raw.cashInHand || 0),
      closingBalance: raw.closingBalance != null ? Number(raw.closingBalance) : null,
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
      amount: Number(raw.amount || 0),
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
  const productId = String(raw.productId || '').trim();
  if (!productId) return res.status(400).json({ ok: false, error: 'productId is required' });
  try {
    const d = {
      productId,
      entryType: String(raw.type || raw.entryType || 'Adjustment'),
      changeQty: Number(raw.change || raw.changeQty || 0),
      newQty: Number(raw.newQty || 0),
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
  const locationId = String(raw.locationId || raw.location || '').trim();
  if (!locationId) return res.status(400).json({ ok: false, error: 'locationId is required' });
  try {
    const d = {
      referenceNo: String(raw.referenceNo || id),
      date: normDate(raw.date),
      locationId,
      adjustmentType: String(raw.adjustmentType || 'NORMAL').toUpperCase() === 'ABNORMAL' ? 'ABNORMAL' : 'NORMAL',
      reason: raw.reason ? String(raw.reason) : null,
      totalAmount: Number(raw.totalAmount || 0),
      totalRecovered: Number(raw.totalRecovered || 0),
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
  const locationFromId = String(raw.locationFromId || raw.locationFrom || '').trim();
  const locationToId = String(raw.locationToId || raw.locationTo || '').trim();
  if (!locationFromId || !locationToId) return res.status(400).json({ ok: false, error: 'locationFromId and locationToId are required' });
  try {
    const d = {
      refNo: String(raw.refNo || id),
      date: normDate(raw.date),
      locationFromId,
      locationToId,
      status: normStatus(raw.status, ['PENDING', 'IN_TRANSIT', 'COMPLETED'], 'PENDING'),
      shippingCharges: Number(raw.shippingCharges || 0),
      totalAmount: Number(raw.totalAmount || 0),
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
  const locationId = String(raw.locationId || raw.location || '').trim();
  if (!productId || !locationId) return res.status(400).json({ ok: false, error: 'productId and locationId are required' });
  try {
    const d = {
      productId,
      locationId,
      lotNumber: String(raw.lotNumber || '--'),
      expiryDate: raw.expiryDate ? normDate(raw.expiryDate) : null,
      unitCost: Number(raw.unitCost || 0),
      qty: Number(raw.qty || 0),
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
//  COLLECTION SNAPSHOT ENDPOINTS
//  Used for resources that don't have a dedicated Prisma model (purchaseReqs,
//  purchaseOrders, contacts). Stores/retrieves the entire array under a key.
//  GET  /api/sync/collection/:key
//  PUT  /api/sync/collection/:key   Body: { data: [...] }
// ────────────────────────��─────────────────────────��──────────────────────────

app.get('/api/sync/collection/:key', requireAuth, async (req, res) => {
  const key = sanitizeCollectionKey(req.params.key);
  if (!key) return res.status(400).json({ ok: false, error: 'key is required' });
  try {
    const record = await prisma.appStateSnapshot.findUnique({ where: { id: `COL_${key}` } });
    const data = (record?.payload && Array.isArray((record.payload).data)) ? (record.payload).data : [];
    return res.json({ ok: true, data });
  } catch (error) {
    return sendPrismaError(res, error, `Failed to fetch collection ${key}`);
  }
});

app.put('/api/sync/collection/:key', requireAuth, async (req, res) => {
  const key = sanitizeCollectionKey(req.params.key);
  if (!key) return res.status(400).json({ ok: false, error: 'key is required' });
  const data = toArray(req.body?.data);
  try {
    await prisma.appStateSnapshot.upsert({
      where: { id: `COL_${key}` },
      update: { payload: { data } },
      create: { id: `COL_${key}`, payload: { data } },
    });
    return res.json({ ok: true, key, count: data.length });
  } catch (error) {
    return sendPrismaError(res, error, `Failed to save collection ${key}`);
  }
});

// ────────────────────────────────────────────────────────────────────��────────
//  LEGACY SNAPSHOT ENDPOINTS (kept for backward-compat; no longer the primary
//  sync path — atomic /api/sync/record endpoints are used instead)
// ───────────────────────────────────────────────────────────────────��─────────

app.get('/api/sync/core', async (_req, res) => {
  try {
    const row = await prisma.appStateSnapshot.findUnique({ where: { id: 'core' } });
    const snapshot = sanitizeCoreSnapshot(row?.payload);
    res.json({ ok: true, hasData: hasSnapshotData(snapshot), data: snapshot, updatedAt: row?.updatedAt || null });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Failed to fetch snapshot' });
  }
});

app.put('/api/sync/core', async (req, res) => {
  try {
    const snapshot = sanitizeCoreSnapshot(req.body);
    const row = await prisma.appStateSnapshot.upsert({
      where: { id: 'core' },
      update: { payload: snapshot },
      create: { id: 'core', payload: snapshot },
    });
    res.json({
      ok: true,
      message: 'Core snapshot saved',
      updatedAt: row.updatedAt,
      counts: {
        products: snapshot.products.length,
        customers: snapshot.customers.length,
        suppliers: snapshot.suppliers.length,
        sales: snapshot.sales.length,
        payments: snapshot.payments.length,
        users: snapshot.users.length,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Failed to save snapshot' });
  }
});

app.get('/api/sync/core/status', async (_req, res) => {
  try {
    const row = await prisma.appStateSnapshot.findUnique({ where: { id: 'core' } });
    const snapshot = sanitizeCoreSnapshot(row?.payload);
    res.json({
      ok: true,
      hasData: hasSnapshotData(snapshot),
      updatedAt: row?.updatedAt || null,
      counts: {
        products: snapshot.products.length,
        customers: snapshot.customers.length,
        suppliers: snapshot.suppliers.length,
        sales: snapshot.sales.length,
        payments: snapshot.payments.length,
        users: snapshot.users.length,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Failed to read snapshot status' });
  }
});

// NOTE: /api/sync/core/materialize has been removed.
// Atomic /api/sync/record/:resource endpoints replaced it — each CRUD
// operation now writes directly to the relational table with no bottleneck.
// The route is kept as a 410 Gone so old clients get a clear error instead
// of a silent hang.
app.post('/api/sync/core/materialize', (_req, res) => {
  res.status(410).json({ ok: false, error: 'materialize endpoint removed — use /api/sync/record/:resource' });
});


app.get('/api/options/bulk', async (req, res) => {
  try {
    const raw = String(req.query.keys || '');
    const keys = Array.from(new Set(raw.split(',').map((key) => sanitizeCollectionKey(key)).filter(Boolean)));
    if (keys.length === 0) return res.json({ ok: true, data: {} });
    const rows = await prisma.optionCollection.findMany({ where: { key: { in: keys } } });
    const rowMap = new Map(rows.map((row) => [row.key, row.payload]));
    const data = {};
    keys.forEach((key) => {
      const value = rowMap.get(key);
      data[key] = Array.isArray(value) ? value : [];
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to fetch option collections',
    });
  }
});

app.put('/api/options/bulk', async (req, res) => {
  try {
    const body = toObject(req.body);
    const incoming = toObject(body.collections);
    const entries = Object.entries(incoming)
      .map(([key, value]) => [sanitizeCollectionKey(key), toArray(value)])
      .filter(([key]) => Boolean(key));
    if (entries.length === 0) return res.json({ ok: true, updated: 0 });
    await prisma.$transaction(entries.map(([key, payload]) =>
      prisma.optionCollection.upsert({
        where: { key },
        update: { payload },
        create: { key, payload },
      })
    ));
    return res.json({ ok: true, updated: entries.length, keys: entries.map(([key]) => key) });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to save option collections',
    });
  }
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
      { id: 'acct-cash', name: 'Cash Account', isSystem: true, isActive: true },
      { id: 'acct-bank', name: 'Bank Account', isSystem: true, isActive: true },
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
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

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
