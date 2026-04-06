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

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'connected', serverTime: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ ok: false, db: 'disconnected', error: error instanceof Error ? error.message : 'Unknown database error' });
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
      case 'products':  await prisma.product.deleteMany({ where: { id } }); break;
      case 'customers': await prisma.customer.deleteMany({ where: { id } }); break;
      case 'suppliers': await prisma.supplier.deleteMany({ where: { id } }); break;
      case 'sales':     await prisma.sale.deleteMany({ where: { id } }); break;
      case 'payments':  await prisma.payment.deleteMany({ where: { id } }); break;
      case 'users':     await prisma.appUser.deleteMany({ where: { id } }); break;
      default:
        return res.status(400).json({ ok: false, error: `Resource '${resource}' is not supported for atomic delete` });
    }
    return res.json({ ok: true, deleted: true, id, resource });
  } catch (error) {
    return sendPrismaError(res, error, `Failed to delete ${resource} record`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  LEGACY SNAPSHOT ENDPOINTS (kept for backward-compat; no longer the primary
//  sync path — atomic /api/sync/record endpoints are used instead)
// ─────────────────────────────────────────────────────────────────────────────

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

app.listen(port, () => {
  console.log(`[ATWAR BSS API] running at http://localhost:${port}`);
});

const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
