import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const toArray = (value) => (Array.isArray(value) ? value : []);
const toObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const toDate = (value, fallback = new Date()) => {
  const parsed = new Date(String(value || ''));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};
const toOptionalDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const sanitizeId = (value, fallback) => String(value || fallback || '').trim();
const slug = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const permissionId = (code) => `perm_${slug(code).slice(0, 100) || 'auto'}`;
const statusToDb = (value) => String(value || '').trim().toLowerCase() === 'inactive' ? 'INACTIVE' : 'ACTIVE';

const readOption = async (key) => {
  const row = await prisma.optionCollection.findUnique({ where: { key } });
  return toArray(row?.payload);
};

const clearOption = async (key) => {
  await prisma.optionCollection.upsert({
    where: { key },
    update: { payload: [] },
    create: { key, payload: [] },
  });
};

const readCollection = async (key) => {
  const row = await prisma.appStateSnapshot.findUnique({ where: { id: `COL_${key}` } });
  return toArray(toObject(row?.payload).data);
};

const clearCollection = async (key) => {
  await prisma.appStateSnapshot.upsert({
    where: { id: `COL_${key}` },
    update: { payload: { data: [] } },
    create: { id: `COL_${key}`, payload: { data: [] } },
  });
};

const migrateRows = async (key, rows, migrate) => {
  if (rows.length === 0) return 0;
  let count = 0;
  for (const row of rows) {
    const migrated = await migrate(toObject(row), count, row);
    if (migrated) count += 1;
  }
  if (count > 0) console.log(`${key}: migrated ${count}`);
  return count;
};

const migrateOptions = async () => {
  const totals = {};

  totals.roles = await migrateRows('roles', await readOption('roles'), async (row, index) => {
    const name = String(row.name || '').trim();
    if (!name) return false;
    const id = sanitizeId(row.id, index + 1);
    const permissions = toArray(row.permissions).map((entry) => String(entry || '').trim()).filter(Boolean);
    await prisma.role.upsert({
      where: { id },
      update: {
        name,
        description: String(row.description || '').trim(),
        isSystem: row.isSystem === true,
        meta: { ...row, id: Number(row.id) || index + 1, permissions },
      },
      create: {
        id,
        name,
        description: String(row.description || '').trim(),
        isSystem: row.isSystem === true,
        meta: { ...row, id: Number(row.id) || index + 1, permissions },
      },
    });
    for (const code of permissions) {
      const [moduleNameRaw, labelRaw] = code.includes('::') ? code.split('::') : ['', code];
      await prisma.permission.upsert({
        where: { id: permissionId(code) },
        update: {
          code,
          label: String(labelRaw || code).trim(),
          module: String(moduleNameRaw || '').trim() || null,
        },
        create: {
          id: permissionId(code),
          code,
          label: String(labelRaw || code).trim(),
          module: String(moduleNameRaw || '').trim() || null,
        },
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: id, permissionId: permissionId(code) } },
        update: {},
        create: { roleId: id, permissionId: permissionId(code) },
      });
    }
    return true;
  });

  totals.commissionAgents = await migrateRows('commissionAgents', await readOption('commissionAgents'), async (row, index) => {
    const name = String(row.name || '').trim();
    if (!name) return false;
    const id = sanitizeId(row.id, index + 1);
    await prisma.salesRepresentative.upsert({
      where: { id },
      update: {
        userId: String(row.linkedUserId || '').trim() || null,
        name,
        contactNo: String(row.contactNo || '').trim() || null,
        commissionPercentage: toNumber(row.commissionPercentage),
        isActive: row.isActive !== false,
        meta: row,
      },
      create: {
        id,
        userId: String(row.linkedUserId || '').trim() || null,
        name,
        contactNo: String(row.contactNo || '').trim() || null,
        commissionPercentage: toNumber(row.commissionPercentage),
        isActive: row.isActive !== false,
        meta: row,
      },
    });
    return true;
  });

  totals.printers = await migrateRows('printers', await readOption('printers'), async (row) => {
    const id = sanitizeId(row.id);
    const name = String(row.name || '').trim();
    if (!id || !name) return false;
    await prisma.receiptPrinter.upsert({
      where: { id },
      update: {
        name,
        charactersPerLine: Math.trunc(toNumber(row.charactersPerLine, 42)),
        paperWidthMm: 80,
        isDefault: row.isDefault === true,
        meta: row,
      },
      create: {
        id,
        name,
        charactersPerLine: Math.trunc(toNumber(row.charactersPerLine, 42)),
        paperWidthMm: 80,
        isDefault: row.isDefault === true,
        meta: row,
      },
    });
    return true;
  });

  totals.invoiceSchemes = await migrateRows('invoiceSchemes', await readOption('invoiceSchemes'), async (row) => {
    const id = sanitizeId(row.id);
    const name = String(row.name || '').trim();
    if (!id || !name) return false;
    await prisma.invoiceScheme.upsert({
      where: { id },
      update: {
        name,
        prefix: String(row.prefix || 'INV-'),
        startFrom: Math.max(1, Math.trunc(toNumber(row.startFrom, 1))),
        digitLength: Math.max(1, Math.trunc(toNumber(row.numberOfDigits, 4))),
        isDefault: row.isDefault === true,
        meta: row,
      },
      create: {
        id,
        name,
        prefix: String(row.prefix || 'INV-'),
        startFrom: Math.max(1, Math.trunc(toNumber(row.startFrom, 1))),
        digitLength: Math.max(1, Math.trunc(toNumber(row.numberOfDigits, 4))),
        isDefault: row.isDefault === true,
        meta: row,
      },
    });
    return true;
  });

  totals.invoiceLayouts = await migrateRows('invoiceLayouts', await readOption('invoiceLayouts'), async (row) => {
    const id = sanitizeId(row.id);
    const name = String(row.name || '').trim();
    if (!id || !name) return false;
    await prisma.invoiceLayout.upsert({
      where: { id },
      update: { name, type: 'SALE', isDefault: row.isDefault === true, meta: row },
      create: { id, name, type: 'SALE', isDefault: row.isDefault === true, meta: row },
    });
    return true;
  });

  totals.barcodeSettings = await migrateRows('barcodeSettings', await readOption('barcodeSettings'), async (row) => {
    const id = sanitizeId(row.id);
    const name = String(row.name || '').trim();
    if (!id || !name) return false;
    await prisma.barcodeSetting.upsert({
      where: { id },
      update: {
        name,
        paperWidthMm: toNumber(row.paperWidth, 210),
        paperHeightMm: toNumber(row.paperHeight, 297),
        labelWidthMm: toNumber(row.stickerWidth, 50),
        labelHeightMm: toNumber(row.stickerHeight, 25),
        labelsPerRow: Math.max(1, Math.trunc(toNumber(row.stickersInOneRow, 1))),
        labelsPerPage: Math.max(1, Math.trunc(toNumber(row.stickersInOneSheet, 1))),
        isDefault: row.isDefault === true,
        meta: row,
      },
      create: {
        id,
        name,
        paperWidthMm: toNumber(row.paperWidth, 210),
        paperHeightMm: toNumber(row.paperHeight, 297),
        labelWidthMm: toNumber(row.stickerWidth, 50),
        labelHeightMm: toNumber(row.stickerHeight, 25),
        labelsPerRow: Math.max(1, Math.trunc(toNumber(row.stickersInOneRow, 1))),
        labelsPerPage: Math.max(1, Math.trunc(toNumber(row.stickersInOneSheet, 1))),
        isDefault: row.isDefault === true,
        meta: row,
      },
    });
    return true;
  });

  totals.customerGroups = await migrateRows('customerGroups', await readOption('customerGroups'), async (row) => {
    const id = sanitizeId(row.id);
    const name = String(row.name || '').trim();
    if (!id || !name) return false;
    await prisma.customerGroup.upsert({
      where: { id },
      update: { name, discountPercent: toNumber(row.discountPercent), status: statusToDb(row.status), meta: row },
      create: { id, name, discountPercent: toNumber(row.discountPercent), status: statusToDb(row.status), meta: row },
    });
    return true;
  });

  totals.locations = await migrateRows('locations', await readOption('locations'), async (row) => {
    const id = sanitizeId(row.id);
    const name = String(row.name || '').trim();
    if (!id || !name) return false;
    await prisma.location.upsert({
      where: { id },
      update: {
        name,
        city: String(row.city || '').trim() || null,
        state: String(row.state || '').trim() || null,
        country: String(row.country || '').trim() || null,
        mobile: String(row.mobile || '').trim() || null,
        email: String(row.email || '').trim() || null,
        isActive: row.isActive !== false,
        meta: row,
      },
      create: {
        id,
        name,
        city: String(row.city || '').trim() || null,
        state: String(row.state || '').trim() || null,
        country: String(row.country || '').trim() || null,
        mobile: String(row.mobile || '').trim() || null,
        email: String(row.email || '').trim() || null,
        isActive: row.isActive !== false,
        meta: row,
      },
    });
    return true;
  });

  totals.taxRates = await migrateRows('taxRates', await readOption('taxRates'), async (row) => {
    const id = sanitizeId(row.id);
    const name = String(row.name || '').trim();
    if (!id || !name) return false;
    const type = String(row.type || '').trim().toLowerCase() === 'inclusive' ? 'INCLUSIVE' : 'EXCLUSIVE';
    await prisma.taxRate.upsert({
      where: { id },
      update: {
        name,
        rate: toNumber(row.rate),
        type,
        description: String(row.description || '').trim() || null,
        meta: row,
      },
      create: {
        id,
        name,
        rate: toNumber(row.rate),
        type,
        description: String(row.description || '').trim() || null,
        meta: row,
      },
    });
    return true;
  });

  totals.productCategories = await migrateRows('productCategories', await readOption('productCategories'), async (row) => {
    const id = sanitizeId(row.id);
    const name = String(row.name || '').trim();
    if (!id || !name) return false;
    await prisma.productCategory.upsert({
      where: { id },
      update: {
        name,
        code: String(row.code || '').trim() || null,
        description: String(row.description || '').trim() || null,
        meta: row,
      },
      create: {
        id,
        name,
        code: String(row.code || '').trim() || null,
        description: String(row.description || '').trim() || null,
        meta: row,
      },
    });
    return true;
  });

  totals.productBrands = await migrateRows('productBrands', await readOption('productBrands'), async (row) => {
    const id = sanitizeId(row.id);
    const name = String(row.name || '').trim();
    if (!id || !name) return false;
    await prisma.productBrand.upsert({
      where: { id },
      update: { name, note: String(row.note || '').trim() || null, meta: row },
      create: { id, name, note: String(row.note || '').trim() || null, meta: row },
    });
    return true;
  });

  totals.productUnits = await migrateRows('productUnits', await readOption('productUnits'), async (row) => {
    const id = sanitizeId(row.id);
    const name = String(row.name || '').trim();
    if (!id || !name) return false;
    await prisma.productUnit.upsert({
      where: { id },
      update: {
        name,
        shortName: String(row.shortName || row.name || id),
        allowDecimal: row.allowDecimal === true,
        meta: row,
      },
      create: {
        id,
        name,
        shortName: String(row.shortName || row.name || id),
        allowDecimal: row.allowDecimal === true,
        meta: row,
      },
    });
    return true;
  });

  totals.warranties = await migrateRows('warranties', await readOption('warranties'), async (row) => {
    const id = sanitizeId(row.id);
    const name = String(row.name || '').trim();
    if (!id || !name) return false;
    await prisma.productWarranty.upsert({
      where: { id },
      update: { name, description: String(row.description || '').trim() || null, meta: row },
      create: { id, name, description: String(row.description || '').trim() || null, meta: row },
    });
    return true;
  });

  totals.productVariations = await migrateRows('productVariations', await readOption('productVariations'), async (row) => {
    const id = sanitizeId(row.id);
    const name = String(row.name || '').trim();
    if (!id || !name) return false;
    const values = toArray(row.values).map((entry) => String(entry || '').trim()).filter(Boolean);
    await prisma.productVariation.upsert({
      where: { id },
      update: { name, values, meta: row },
      create: { id, name, values, meta: row },
    });
    return true;
  });

  totals.sellingPriceGroups = await migrateRows('sellingPriceGroups', await readOption('sellingPriceGroups'), async (row) => {
    const id = sanitizeId(row.id);
    const name = String(row.name || '').trim();
    if (!id || !name) return false;
    await prisma.sellingPriceGroup.upsert({
      where: { id },
      update: {
        name,
        description: String(row.description || '').trim() || null,
        discount: toNumber(row.discount),
        priceCalcPercentage: toNumber(row.priceCalcPercentage),
        meta: row,
      },
      create: {
        id,
        name,
        description: String(row.description || '').trim() || null,
        discount: toNumber(row.discount),
        priceCalcPercentage: toNumber(row.priceCalcPercentage),
        meta: row,
      },
    });
    return true;
  });

  totals.discounts = await migrateRows('discounts', await readOption('discounts'), async (row) => {
    const id = sanitizeId(row.id);
    const name = String(row.name || '').trim();
    if (!id || !name) return false;
    const type = String(row.discountType || '').trim().toLowerCase();
    await prisma.discount.upsert({
      where: { id },
      update: {
        name,
        discountType: type === 'fixed' ? 'FIXED' : type === 'percentage' ? 'PERCENTAGE' : null,
        discountAmount: toNumber(String(row.discountAmount || '').replace(/[^\d.-]/g, '')),
        startsAt: toOptionalDate(row.startsAt),
        endsAt: toOptionalDate(row.endsAt),
        isActive: row.isActive !== false,
        meta: row,
      },
      create: {
        id,
        name,
        discountType: type === 'fixed' ? 'FIXED' : type === 'percentage' ? 'PERCENTAGE' : null,
        discountAmount: toNumber(String(row.discountAmount || '').replace(/[^\d.-]/g, '')),
        startsAt: toOptionalDate(row.startsAt),
        endsAt: toOptionalDate(row.endsAt),
        isActive: row.isActive !== false,
        meta: row,
      },
    });
    return true;
  });

  totals.expenseCategories = await migrateRows('expenseCategories', await readOption('expenseCategories'), async (row) => {
    const id = sanitizeId(row.id);
    const name = String(row.name || '').trim();
    if (!id || !name) return false;
    await prisma.expenseCategory.upsert({
      where: { id },
      update: { name, description: String(row.description || '').trim() || null, code: String(row.code || '').trim() || null },
      create: { id, name, description: String(row.description || '').trim() || null, code: String(row.code || '').trim() || null },
    });
    return true;
  });

  for (const [key, count] of Object.entries(totals)) {
    if (count > 0) await clearOption(key);
  }
};

const migrateCollections = async () => {
  const purchaseReqs = await readCollection('purchaseRequisitions');
  const purchaseOrders = await readCollection('purchaseOrders');
  const contactRows = await readCollection('contacts');
  const paymentAccountTypes = await readCollection('paymentAccountTypes');
  const variationRows = await readCollection('productVariations');

  const migratedReqs = await migrateRows('COL_purchaseRequisitions', purchaseReqs, async (row) => {
    const id = sanitizeId(row.id);
    if (!id) return false;
    await prisma.purchaseRequisition.upsert({
      where: { id },
      update: {
        referenceNo: String(row.referenceNo || row.refNo || `REQ-${id}`),
        date: toDate(row.date),
        location: String(row.location || '').trim() || null,
        supplier: String(row.supplier || '').trim() || null,
        supplierId: String(row.supplierId || '').trim() || null,
        status: String(row.status || 'Pending'),
        addedBy: String(row.addedBy || '').trim() || null,
        brand: String(row.brand || '').trim() || null,
        category: String(row.category || '').trim() || null,
        requiredByDate: toOptionalDate(row.requiredByDate),
        note: String(row.note || '').trim() || null,
        items: toArray(row.items),
        meta: row,
      },
      create: {
        id,
        referenceNo: String(row.referenceNo || row.refNo || `REQ-${id}`),
        date: toDate(row.date),
        location: String(row.location || '').trim() || null,
        supplier: String(row.supplier || '').trim() || null,
        supplierId: String(row.supplierId || '').trim() || null,
        status: String(row.status || 'Pending'),
        addedBy: String(row.addedBy || '').trim() || null,
        brand: String(row.brand || '').trim() || null,
        category: String(row.category || '').trim() || null,
        requiredByDate: toOptionalDate(row.requiredByDate),
        note: String(row.note || '').trim() || null,
        items: toArray(row.items),
        meta: row,
      },
    });
    return true;
  });

  const migratedOrders = await migrateRows('COL_purchaseOrders', purchaseOrders, async (row) => {
    const id = sanitizeId(row.id);
    if (!id) return false;
    await prisma.purchaseOrder.upsert({
      where: { id },
      update: {
        referenceNo: String(row.referenceNo || row.refNo || `PO-${id}`),
        orderDate: toDate(row.orderDate || row.date),
        supplierId: String(row.supplierId || '').trim() || null,
        supplierName: String(row.supplierName || '').trim() || null,
        supplierAddress: String(row.supplierAddress || '').trim() || null,
        location: String(row.location || '').trim() || null,
        deliveryDate: toOptionalDate(row.deliveryDate),
        payTermValue: String(row.payTermValue || '').trim() || null,
        payTermType: String(row.payTermType || '').trim() || null,
        attachDocumentName: String(row.attachDocumentName || '').trim() || null,
        purchaseRequisitionId: String(row.purchaseRequisitionId || '').trim() || null,
        purchaseRequisitionRef: String(row.purchaseRequisitionRef || '').trim() || null,
        items: toArray(row.items),
        shippingDetails: String(row.shippingDetails || '').trim() || null,
        shippingAddress: String(row.shippingAddress || '').trim() || null,
        shippingCharges: toNumber(row.shippingCharges),
        shippingStatus: String(row.shippingStatus || '').trim() || null,
        deliveredTo: String(row.deliveredTo || '').trim() || null,
        shippingDocumentName: String(row.shippingDocumentName || '').trim() || null,
        additionalExpenses: toNumber(row.additionalExpenses),
        additionalNotes: String(row.additionalNotes || '').trim() || null,
        totalItems: Math.trunc(toNumber(row.totalItems)),
        netTotalAmount: toNumber(row.netTotalAmount),
        orderTotal: toNumber(row.orderTotal),
        status: String(row.status || 'Draft'),
        addedBy: String(row.addedBy || '').trim() || null,
        meta: row,
      },
      create: {
        id,
        referenceNo: String(row.referenceNo || row.refNo || `PO-${id}`),
        orderDate: toDate(row.orderDate || row.date),
        supplierId: String(row.supplierId || '').trim() || null,
        supplierName: String(row.supplierName || '').trim() || null,
        supplierAddress: String(row.supplierAddress || '').trim() || null,
        location: String(row.location || '').trim() || null,
        deliveryDate: toOptionalDate(row.deliveryDate),
        payTermValue: String(row.payTermValue || '').trim() || null,
        payTermType: String(row.payTermType || '').trim() || null,
        attachDocumentName: String(row.attachDocumentName || '').trim() || null,
        purchaseRequisitionId: String(row.purchaseRequisitionId || '').trim() || null,
        purchaseRequisitionRef: String(row.purchaseRequisitionRef || '').trim() || null,
        items: toArray(row.items),
        shippingDetails: String(row.shippingDetails || '').trim() || null,
        shippingAddress: String(row.shippingAddress || '').trim() || null,
        shippingCharges: toNumber(row.shippingCharges),
        shippingStatus: String(row.shippingStatus || '').trim() || null,
        deliveredTo: String(row.deliveredTo || '').trim() || null,
        shippingDocumentName: String(row.shippingDocumentName || '').trim() || null,
        additionalExpenses: toNumber(row.additionalExpenses),
        additionalNotes: String(row.additionalNotes || '').trim() || null,
        totalItems: Math.trunc(toNumber(row.totalItems)),
        netTotalAmount: toNumber(row.netTotalAmount),
        orderTotal: toNumber(row.orderTotal),
        status: String(row.status || 'Draft'),
        addedBy: String(row.addedBy || '').trim() || null,
        meta: row,
      },
    });
    return true;
  });

  const migratedContacts = await migrateRows('COL_contacts', contactRows, async (row) => {
    const type = String(row.type || '').trim().toLowerCase();
    const id = sanitizeId(row.contactId || row.id);
    const name = String(row.name || row.businessName || '').trim();
    if (!id || !name) return false;
    if (type === 'supplier') {
      await prisma.supplier.upsert({
        where: { id },
        update: {
          businessName: String(row.businessName || name),
          name,
          email: String(row.email || '').trim() || null,
          mobile: String(row.mobile || '').trim() || null,
          taxNumber: String(row.taxNumber || '').trim() || null,
          openingBalance: toNumber(row.balance),
          totalPurchaseDue: toNumber(row.balance),
          status: statusToDb(row.status),
          meta: row,
        },
        create: {
          id,
          businessName: String(row.businessName || name),
          name,
          email: String(row.email || '').trim() || null,
          mobile: String(row.mobile || '').trim() || null,
          taxNumber: String(row.taxNumber || '').trim() || null,
          openingBalance: toNumber(row.balance),
          totalPurchaseDue: toNumber(row.balance),
          status: statusToDb(row.status),
          meta: row,
        },
      });
      return true;
    }
    await prisma.customer.upsert({
      where: { id },
      update: {
        businessName: String(row.businessName || name),
        name,
        email: String(row.email || '').trim() || null,
        mobile: String(row.mobile || '').trim() || null,
        taxNumber: String(row.taxNumber || '').trim() || null,
        creditLimit: toNumber(row.creditLimit),
        openingBalance: toNumber(row.balance),
        totalSellDue: toNumber(row.balance),
        status: statusToDb(row.status),
        meta: row,
      },
      create: {
        id,
        businessName: String(row.businessName || name),
        name,
        email: String(row.email || '').trim() || null,
        mobile: String(row.mobile || '').trim() || null,
        taxNumber: String(row.taxNumber || '').trim() || null,
        creditLimit: toNumber(row.creditLimit),
        openingBalance: toNumber(row.balance),
        totalSellDue: toNumber(row.balance),
        status: statusToDb(row.status),
        meta: row,
      },
    });
    return true;
  });

  const migratedTypes = await migrateRows('COL_paymentAccountTypes', paymentAccountTypes, async (_row, _index, nameRaw) => {
    const name = String(nameRaw || '').trim();
    if (!name) return false;
    const id = `PAT-${slug(name) || 'type'}`;
    await prisma.paymentAccountType.upsert({
      where: { id },
      update: { name, isActive: true, isSystem: ['cash', 'bank'].includes(name.toLowerCase()) },
      create: { id, name, isActive: true, isSystem: ['cash', 'bank'].includes(name.toLowerCase()) },
    });
    return true;
  });

  const migratedVariations = await migrateRows('COL_productVariations', variationRows, async (row) => {
    const id = sanitizeId(row.id);
    const name = String(row.name || '').trim();
    if (!id || !name) return false;
    const values = toArray(row.values).map((entry) => String(entry || '').trim()).filter(Boolean);
    await prisma.productVariation.upsert({
      where: { id },
      update: { name, values, meta: row },
      create: { id, name, values, meta: row },
    });
    return true;
  });

  if (migratedReqs > 0) await clearCollection('purchaseRequisitions');
  if (migratedOrders > 0) await clearCollection('purchaseOrders');
  if (migratedContacts > 0) await clearCollection('contacts');
  if (migratedTypes > 0) await clearCollection('paymentAccountTypes');
  if (migratedVariations > 0) await clearCollection('productVariations');
};

const purgeLegacyStores = async () => {
  const deletedOptions = await prisma.optionCollection.deleteMany();
  const deletedSnapshots = await prisma.appStateSnapshot.deleteMany();
  console.log(`Purged legacy stores: optionCollections=${deletedOptions.count}, appStateSnapshots=${deletedSnapshots.count}`);
};

const ensureSystemDefaults = async () => {
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
  console.log(`Ensured system defaults: paymentAccountTypes=${accountTypes.length}`);
};

try {
  await migrateOptions();
  await migrateCollections();
  await ensureSystemDefaults();
  await purgeLegacyStores();
  console.log('Legacy Postgres storage migration complete.');
} finally {
  await prisma.$disconnect();
}
