import { clearAuthToken, readAuthToken } from './hardenedStorage';
export type DropdownCollectionMap = Record<string, any[]>;

const DEFAULT_API_BASE_URL = 'http://localhost:4000';

type ResourceRow = Record<string, unknown>;
type DropdownStrategy = {
  fetch: () => Promise<any[] | null>;
  push: (rows: any[]) => Promise<boolean>;
};

const getApiBaseUrl = (): string => {
  const configured = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  const base = configured || DEFAULT_API_BASE_URL;
  return base.replace(/\/+$/, '');
};

export const isDropdownSyncEnabled = (): boolean =>
  !['false', '0', 'off'].includes(String(import.meta.env.VITE_ENABLE_DB_SYNC || '').trim().toLowerCase());

const getToken = (): string => {
  return readAuthToken();
};

const buildHeaders = (includeJsonContentType = false): Record<string, string> => {
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (includeJsonContentType) headers['Content-Type'] = 'application/json';
  return headers;
};

const handle401 = (): void => {
  clearAuthToken();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('atwar:auth:expired'));
  }
};

const toArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);
const toObject = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);
const toBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  return fallback;
};
const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const toIsoOrNull = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
};
const toStatus = (value: unknown): 'ACTIVE' | 'INACTIVE' => (
  String(value || '').trim().toLowerCase() === 'inactive' ? 'INACTIVE' : 'ACTIVE'
);
const normalizePermissionCodes = (value: unknown): string[] => (
  toArray(value).map((code) => String(code || '').trim()).filter(Boolean)
);
const normalizeDropdownRowId = (value: unknown): string => String(value || '').trim();
const numericIdFromUnknown = (value: unknown, fallback: number): number => {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
  const fromText = Number(String(value || '').replace(/[^\d]/g, ''));
  if (Number.isFinite(fromText) && fromText > 0) return Math.floor(fromText);
  return fallback;
};
const request = async (url: string, init?: RequestInit): Promise<Response | null> => {
  try {
    const response = await fetch(url, init);
    if (response.status === 401) {
      handle401();
      return null;
    }
    return response;
  } catch {
    return null;
  }
};

const fetchResourceRawRows = async (resource: string): Promise<ResourceRow[] | null> => {
  const response = await request(
    `${getApiBaseUrl()}/api/data/${encodeURIComponent(resource)}?paginate=false`,
    { method: 'GET', headers: buildHeaders(false) },
  );
  if (!response || !response.ok) return null;
  try {
    const payload = await response.json();
    return toArray(payload?.data).map((row) => toObject(row));
  } catch {
    return null;
  }
};

let dropdownWriteDisabledLogged = false;
const logDropdownWriteDisabled = (): void => {
  if (dropdownWriteDisabledLogged) return;
  dropdownWriteDisabledLogged = true;
  console.warn('[dropdownSync] Write/seed path is disabled. Use dedicated CRUD APIs or Prisma seed scripts.');
};

const fetchRolePermissions = async (roleId: string): Promise<string[]> => {
  const normalizedRoleId = normalizeDropdownRowId(roleId);
  if (!normalizedRoleId) return [];
  const response = await request(
    `${getApiBaseUrl()}/api/data/roles/${encodeURIComponent(normalizedRoleId)}/permissions`,
    { method: 'GET', headers: buildHeaders(false) },
  );
  if (!response || !response.ok) return [];
  try {
    const payload = await response.json();
    return toArray(payload?.permissions)
      .map((row) => {
        const record = toObject(row);
        const code = String(record.code || '').trim();
        return code || String(record.id || '').trim();
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const serializeRole = (row: any, fallbackIndex = 1): ResourceRow | null => {
  const name = String(row?.name || '').trim();
  if (!name) return null;
  const idAsNumber = numericIdFromUnknown(row?.id, fallbackIndex);
  const id = normalizeDropdownRowId(row?.id) || String(idAsNumber);
  const permissions = normalizePermissionCodes(row?.permissions);
  const normalizedRole = {
    ...row,
    id: idAsNumber,
    name,
    description: String(row?.description || '').trim(),
    userCount: toFiniteNumber(row?.userCount, 0),
    permissionsCount: permissions.length > 0 ? permissions.length : toFiniteNumber(row?.permissionsCount, 0),
    isSystem: toBoolean(row?.isSystem, false),
    permissions,
  };
  return {
    id,
    name,
    description: normalizedRole.description || null,
    isSystem: normalizedRole.isSystem,
    meta: normalizedRole,
  };
};

const rolesStrategy: DropdownStrategy = {
  fetch: async () => {
    const rows = await fetchResourceRawRows('roles');
    if (rows === null) return null;
    const normalized = await Promise.all(rows.map(async (row, index) => {
      const source = Object.keys(toObject(row.meta)).length > 0 ? toObject(row.meta) : row;
      const permissionsFromMeta = normalizePermissionCodes(source.permissions);
      const roleId = normalizeDropdownRowId(source.id || row.id);
      const permissions = permissionsFromMeta.length > 0
        ? permissionsFromMeta
        : await fetchRolePermissions(roleId);
      return {
        id: numericIdFromUnknown(source.id || row.id, index + 1),
        name: String(source.name || row.name || '').trim(),
        description: String(source.description || row.description || '').trim(),
        userCount: toFiniteNumber(source.userCount, 0),
        permissionsCount: permissions.length > 0 ? permissions.length : toFiniteNumber(source.permissionsCount, 0),
        isSystem: toBoolean(source.isSystem, toBoolean(row.isSystem, false)),
        permissions: permissions.length > 0 ? permissions : undefined,
      };
    }));
    return normalized.filter((row) => String(row.name || '').trim().length > 0);
  },
  push: async (rows) => {
    void toArray(rows)
      .map((row, index) => serializeRole(row, index + 1))
      .filter((row): row is ResourceRow => !!row);
    logDropdownWriteDisabled();
    return false;
  },
};

const createMetaBackedResourceStrategy = (config: {
  resource: string;
  deserialize: (row: ResourceRow, index: number) => any | null;
  serialize: (row: any, index: number) => ResourceRow | null;
}): DropdownStrategy => ({
  fetch: async () => {
    const rows = await fetchResourceRawRows(config.resource);
    if (rows === null) return null;
    return rows
      .map((row, index) => config.deserialize(row, index))
      .filter((row): row is any => !!row);
  },
  push: async (rows) => {
    void toArray(rows)
      .map((row, index) => config.serialize(row, index))
      .filter((row): row is ResourceRow => !!row);
    logDropdownWriteDisabled();
    return false;
  },
});

const commissionAgentsStrategy = createMetaBackedResourceStrategy({
  resource: 'salesRepresentatives',
  deserialize: (row, index) => {
    const source = Object.keys(toObject(row.meta)).length > 0 ? toObject(row.meta) : row;
    const id = numericIdFromUnknown(source.id || row.id, index + 1);
    const name = String(source.name || row.name || '').trim();
    if (!name) return null;
    return {
      id,
      linkedUserId: String(source.linkedUserId || row.userId || '').trim() || undefined,
      name,
      email: String(source.email || '').trim(),
      contactNo: String(source.contactNo || row.contactNo || '').trim(),
      address: String(source.address || '').trim(),
      commissionPercentage: toFiniteNumber(source.commissionPercentage || row.commissionPercentage, 0),
      isActive: toBoolean(source.isActive, toBoolean(row.isActive, true)),
      prefix: String(source.prefix || '').trim(),
      firstName: String(source.firstName || '').trim(),
      lastName: String(source.lastName || '').trim(),
      createdAt: String(source.createdAt || '').trim() || undefined,
      updatedAt: String(source.updatedAt || '').trim() || undefined,
    };
  },
  serialize: (row, index) => {
    const name = String(row?.name || '').trim();
    if (!name) return null;
    const id = normalizeDropdownRowId(row?.id) || String(index + 1);
    const normalized = {
      ...row,
      id: numericIdFromUnknown(row?.id, index + 1),
      name,
      linkedUserId: String(row?.linkedUserId || '').trim(),
      contactNo: String(row?.contactNo || '').trim(),
      commissionPercentage: toFiniteNumber(row?.commissionPercentage, 0),
      isActive: toBoolean(row?.isActive, true),
    };
    return {
      id,
      userId: normalized.linkedUserId || null,
      name: normalized.name,
      contactNo: normalized.contactNo || null,
      commissionPercentage: normalized.commissionPercentage,
      isActive: normalized.isActive,
      meta: normalized,
    };
  },
});

const printersStrategy = createMetaBackedResourceStrategy({
  resource: 'receiptPrinters',
  deserialize: (row) => {
    const source = Object.keys(toObject(row.meta)).length > 0 ? toObject(row.meta) : row;
    const id = normalizeDropdownRowId(source.id || row.id);
    const name = String(source.name || row.name || '').trim();
    if (!id || !name) return null;
    const connectionTypeRaw = String(source.connectionType || '').trim().toLowerCase();
    return {
      id,
      name,
      connectionType: connectionTypeRaw === 'windows' ? 'Windows' : connectionTypeRaw === 'linux' ? 'Linux' : 'Network',
      capabilityProfile: String(source.capabilityProfile || '').trim() || 'Default',
      charactersPerLine: Math.max(1, Math.floor(toFiniteNumber(source.charactersPerLine || row.charactersPerLine, 42))),
      ipAddress: String(source.ipAddress || '').trim(),
      port: String(source.port || '').trim(),
      path: String(source.path || '').trim(),
    };
  },
  serialize: (row) => {
    const id = normalizeDropdownRowId(row?.id);
    const name = String(row?.name || '').trim();
    if (!id || !name) return null;
    const normalized = {
      ...row,
      id,
      name,
      capabilityProfile: String(row?.capabilityProfile || '').trim() || 'Default',
      charactersPerLine: Math.max(1, Math.floor(toFiniteNumber(row?.charactersPerLine, 42))),
      connectionType: String(row?.connectionType || 'Network').trim() || 'Network',
      ipAddress: String(row?.ipAddress || '').trim(),
      port: String(row?.port || '').trim(),
      path: String(row?.path || '').trim(),
    };
    return {
      id: normalized.id,
      name: normalized.name,
      connection: JSON.stringify({
        type: normalized.connectionType,
        ipAddress: normalized.ipAddress,
        port: normalized.port,
        path: normalized.path,
        capabilityProfile: normalized.capabilityProfile,
      }),
      charactersPerLine: normalized.charactersPerLine,
      paperWidthMm: 80,
      isDefault: false,
      meta: normalized,
    };
  },
});

const invoiceSchemesStrategy = createMetaBackedResourceStrategy({
  resource: 'invoiceSchemes',
  deserialize: (row) => {
    const source = Object.keys(toObject(row.meta)).length > 0 ? toObject(row.meta) : row;
    const id = normalizeDropdownRowId(source.id || row.id);
    const name = String(source.name || row.name || '').trim();
    if (!id || !name) return null;
    return {
      id,
      name,
      prefix: String(source.prefix || row.prefix || '').trim(),
      numberingType: 'Sequential',
      startFrom: Math.max(1, Math.floor(toFiniteNumber(source.startFrom || row.startFrom, 1))),
      numberOfDigits: Math.max(1, Math.floor(toFiniteNumber(source.numberOfDigits || row.digitLength, 4))),
      isDefault: toBoolean(source.isDefault, toBoolean(row.isDefault, false)),
    };
  },
  serialize: (row) => {
    const id = normalizeDropdownRowId(row?.id);
    const name = String(row?.name || '').trim();
    if (!id || !name) return null;
    const normalized = {
      ...row,
      id,
      name,
      prefix: String(row?.prefix || '').trim(),
      numberingType: 'Sequential',
      startFrom: Math.max(1, Math.floor(toFiniteNumber(row?.startFrom, 1))),
      numberOfDigits: Math.max(1, Math.floor(toFiniteNumber(row?.numberOfDigits, 4))),
      isDefault: toBoolean(row?.isDefault, false),
    };
    return {
      id: normalized.id,
      name: normalized.name,
      prefix: normalized.prefix || 'INV-',
      startFrom: normalized.startFrom,
      digitLength: normalized.numberOfDigits,
      isDefault: normalized.isDefault,
      meta: normalized,
    };
  },
});

const invoiceLayoutsStrategy = createMetaBackedResourceStrategy({
  resource: 'invoiceLayouts',
  deserialize: (row) => {
    const source = Object.keys(toObject(row.meta)).length > 0 ? toObject(row.meta) : row;
    const id = normalizeDropdownRowId(source.id || row.id);
    const name = String(source.name || row.name || '').trim();
    if (!id || !name) return null;
    return {
      id,
      name,
      design: String(source.design || '').trim() || 'Classic',
      isDefault: toBoolean(source.isDefault, toBoolean(row.isDefault, false)),
    };
  },
  serialize: (row) => {
    const id = normalizeDropdownRowId(row?.id);
    const name = String(row?.name || '').trim();
    if (!id || !name) return null;
    const normalized = {
      ...row,
      id,
      name,
      design: String(row?.design || '').trim() || 'Classic',
      isDefault: toBoolean(row?.isDefault, false),
    };
    return {
      id: normalized.id,
      name: normalized.name,
      type: 'SALE',
      headerHtml: null,
      footerHtml: null,
      bodyTemplate: null,
      showClientLogo: true,
      isDefault: normalized.isDefault,
      meta: normalized,
    };
  },
});

const barcodeSettingsStrategy = createMetaBackedResourceStrategy({
  resource: 'barcodeSettings',
  deserialize: (row) => {
    const source = Object.keys(toObject(row.meta)).length > 0 ? toObject(row.meta) : row;
    const id = normalizeDropdownRowId(source.id || row.id);
    const name = String(source.name || row.name || '').trim();
    if (!id || !name) return null;
    return {
      id,
      name,
      description: String(source.description || '').trim(),
      isContinuousFeed: toBoolean(source.isContinuousFeed, false),
      additionalTopMargin: toFiniteNumber(source.additionalTopMargin, 0),
      additionalLeftMargin: toFiniteNumber(source.additionalLeftMargin, 0),
      stickerWidth: toFiniteNumber(source.stickerWidth || row.labelWidthMm, 0),
      stickerHeight: toFiniteNumber(source.stickerHeight || row.labelHeightMm, 0),
      paperWidth: toFiniteNumber(source.paperWidth || row.paperWidthMm, 0),
      paperHeight: toFiniteNumber(source.paperHeight || row.paperHeightMm, 0),
      stickersInOneRow: Math.max(1, Math.floor(toFiniteNumber(source.stickersInOneRow || row.labelsPerRow, 1))),
      distanceBetweenRows: toFiniteNumber(source.distanceBetweenRows, 0),
      distanceBetweenColumns: toFiniteNumber(source.distanceBetweenColumns, 0),
      stickersInOneSheet: Math.max(1, Math.floor(toFiniteNumber(source.stickersInOneSheet || row.labelsPerPage, 1))),
      isDefault: toBoolean(source.isDefault, toBoolean(row.isDefault, false)),
    };
  },
  serialize: (row) => {
    const id = normalizeDropdownRowId(row?.id);
    const name = String(row?.name || '').trim();
    if (!id || !name) return null;
    const normalized = {
      ...row,
      id,
      name,
      description: String(row?.description || '').trim(),
      isContinuousFeed: toBoolean(row?.isContinuousFeed, false),
      additionalTopMargin: toFiniteNumber(row?.additionalTopMargin, 0),
      additionalLeftMargin: toFiniteNumber(row?.additionalLeftMargin, 0),
      stickerWidth: toFiniteNumber(row?.stickerWidth, 0),
      stickerHeight: toFiniteNumber(row?.stickerHeight, 0),
      paperWidth: toFiniteNumber(row?.paperWidth, 0),
      paperHeight: toFiniteNumber(row?.paperHeight, 0),
      stickersInOneRow: Math.max(1, Math.floor(toFiniteNumber(row?.stickersInOneRow, 1))),
      distanceBetweenRows: toFiniteNumber(row?.distanceBetweenRows, 0),
      distanceBetweenColumns: toFiniteNumber(row?.distanceBetweenColumns, 0),
      stickersInOneSheet: Math.max(1, Math.floor(toFiniteNumber(row?.stickersInOneSheet, 1))),
      isDefault: toBoolean(row?.isDefault, false),
    };
    return {
      id: normalized.id,
      name: normalized.name,
      paperWidthMm: normalized.paperWidth,
      paperHeightMm: normalized.paperHeight,
      labelWidthMm: normalized.stickerWidth,
      labelHeightMm: normalized.stickerHeight,
      labelsPerRow: normalized.stickersInOneRow,
      labelsPerPage: normalized.stickersInOneSheet,
      isDefault: normalized.isDefault,
      meta: normalized,
    };
  },
});

const customerGroupsStrategy = createMetaBackedResourceStrategy({
  resource: 'customerGroups',
  deserialize: (row) => {
    const source = Object.keys(toObject(row.meta)).length > 0 ? toObject(row.meta) : row;
    const id = normalizeDropdownRowId(source.id || row.id);
    const name = String(source.name || row.name || '').trim();
    if (!id || !name) return null;
    return {
      id,
      name,
      discountPercent: toFiniteNumber(source.discountPercent || row.discountPercent, 0),
      description: String(source.description || '').trim() || undefined,
      sellingPriceGroupId: String(source.sellingPriceGroupId || '').trim() || undefined,
      sellingPriceGroup: String(source.sellingPriceGroup || '').trim() || undefined,
      status: String(source.status || row.status || 'ACTIVE').trim().toLowerCase() === 'inactive' ? 'Inactive' : 'Active',
      calculationPercentage: toFiniteNumber(source.calculationPercentage, 0) || undefined,
    };
  },
  serialize: (row) => {
    const id = normalizeDropdownRowId(row?.id);
    const name = String(row?.name || '').trim();
    if (!id || !name) return null;
    const normalized = {
      ...row,
      id,
      name,
      discountPercent: toFiniteNumber(row?.discountPercent, 0),
      status: String(row?.status || 'Active').trim(),
    };
    return {
      id: normalized.id,
      name: normalized.name,
      discountPercent: normalized.discountPercent,
      status: toStatus(normalized.status),
      meta: normalized,
    };
  },
});

const warrantiesStrategy = createMetaBackedResourceStrategy({
  resource: 'productWarranties',
  deserialize: (row) => {
    const source = Object.keys(toObject(row.meta)).length > 0 ? toObject(row.meta) : row;
    const id = normalizeDropdownRowId(source.id || row.id);
    const name = String(source.name || row.name || '').trim();
    if (!id || !name) return null;
    return {
      id,
      name,
      description: String(source.description || row.description || '').trim(),
      duration: Math.max(0, Math.floor(toFiniteNumber(source.duration, 0))),
      durationUnit: String(source.durationUnit || 'Months').trim() || 'Months',
    };
  },
  serialize: (row) => {
    const id = normalizeDropdownRowId(row?.id);
    const name = String(row?.name || '').trim();
    if (!id || !name) return null;
    const normalized = {
      ...row,
      id,
      name,
      description: String(row?.description || '').trim(),
      duration: Math.max(0, Math.floor(toFiniteNumber(row?.duration, 0))),
      durationUnit: String(row?.durationUnit || 'Months').trim() || 'Months',
    };
    return {
      id: normalized.id,
      name: normalized.name,
      description: normalized.description || null,
      meta: normalized,
    };
  },
});

const productVariationsStrategy = createMetaBackedResourceStrategy({
  resource: 'productVariations',
  deserialize: (row) => {
    const source = Object.keys(toObject(row.meta)).length > 0 ? toObject(row.meta) : row;
    const id = normalizeDropdownRowId(source.id || row.id);
    const name = String(source.name || row.name || '').trim();
    if (!id || !name) return null;
    return {
      id,
      name,
      values: toArray(source.values || row.values).map((entry) => String(entry || '').trim()).filter(Boolean),
    };
  },
  serialize: (row) => {
    const id = normalizeDropdownRowId(row?.id);
    const name = String(row?.name || '').trim();
    if (!id || !name) return null;
    const normalized = {
      ...row,
      id,
      name,
      values: toArray(row?.values).map((entry) => String(entry || '').trim()).filter(Boolean),
    };
    return {
      id: normalized.id,
      name: normalized.name,
      values: normalized.values,
      meta: normalized,
    };
  },
});

const sellingPriceGroupsStrategy = createMetaBackedResourceStrategy({
  resource: 'sellingPriceGroups',
  deserialize: (row) => {
    const source = Object.keys(toObject(row.meta)).length > 0 ? toObject(row.meta) : row;
    const id = normalizeDropdownRowId(source.id || row.id);
    const name = String(source.name || row.name || '').trim();
    if (!id || !name) return null;
    return {
      id,
      name,
      description: String(source.description || row.description || '').trim(),
      payTermDays: Math.max(0, Math.floor(toFiniteNumber(source.payTermDays, 0))),
      payTermUnit: String(source.payTermUnit || 'Days').trim() || 'Days',
      taxRate: toFiniteNumber(source.taxRate, 0),
      discount: toFiniteNumber(source.discount || row.discount, 0),
      priceCalcPercentage: toFiniteNumber(source.priceCalcPercentage || row.priceCalcPercentage, 0),
      status: String(source.status || 'Active').trim() || 'Active',
      applicableProducts: toArray(source.applicableProducts),
    };
  },
  serialize: (row) => {
    const id = normalizeDropdownRowId(row?.id);
    const name = String(row?.name || '').trim();
    if (!id || !name) return null;
    const normalized = {
      ...row,
      id,
      name,
      description: String(row?.description || '').trim(),
      payTermDays: Math.max(0, Math.floor(toFiniteNumber(row?.payTermDays, 0))),
      payTermUnit: String(row?.payTermUnit || 'Days').trim() || 'Days',
      taxRate: toFiniteNumber(row?.taxRate, 0),
      discount: toFiniteNumber(row?.discount, 0),
      priceCalcPercentage: toFiniteNumber(row?.priceCalcPercentage, 0),
      status: String(row?.status || 'Active').trim() || 'Active',
      applicableProducts: toArray(row?.applicableProducts),
    };
    return {
      id: normalized.id,
      name: normalized.name,
      description: normalized.description || null,
      discount: normalized.discount,
      priceCalcPercentage: normalized.priceCalcPercentage,
      meta: normalized,
    };
  },
});

const discountsStrategy = createMetaBackedResourceStrategy({
  resource: 'discounts',
  deserialize: (row) => {
    const source = Object.keys(toObject(row.meta)).length > 0 ? toObject(row.meta) : row;
    const id = normalizeDropdownRowId(source.id || row.id);
    const name = String(source.name || row.name || '').trim();
    if (!id || !name) return null;
    const dbType = String(source.discountType || row.discountType || '').trim().toLowerCase();
    const discountType = dbType === 'fixed' ? 'Fixed' : dbType === 'percentage' ? 'Percentage' : String(source.discountType || '').trim();
    return {
      id,
      name,
      products: String(source.products || '').trim() || 'All',
      productIds: toArray(source.productIds).map((entry) => String(entry || '').trim()).filter(Boolean),
      brand: String(source.brand || '').trim() || 'All',
      category: String(source.category || '').trim() || 'All',
      location: String(source.location || '').trim() || 'All locations',
      priority: String(source.priority || '0'),
      discountType,
      discountAmount: String(source.discountAmount ?? row.discountAmount ?? '').trim(),
      startsAt: String(source.startsAt || row.startsAt || '').trim(),
      endsAt: String(source.endsAt || row.endsAt || '').trim(),
      sellingPriceGroup: String(source.sellingPriceGroup || '').trim() || 'All',
      isActive: toBoolean(source.isActive, toBoolean(row.isActive, true)),
      applyInCustomerGroups: toBoolean(source.applyInCustomerGroups, false),
      selectedGroups: toArray(source.selectedGroups).map((entry) => String(entry || '').trim()).filter(Boolean),
    };
  },
  serialize: (row) => {
    const id = normalizeDropdownRowId(row?.id);
    const name = String(row?.name || '').trim();
    if (!id || !name) return null;
    const rawType = String(row?.discountType || '').trim().toLowerCase();
    const discountType = rawType === 'fixed'
      ? 'FIXED'
      : rawType === 'percentage'
        ? 'PERCENTAGE'
        : null;
    const discountAmount = toFiniteNumber(
      typeof row?.discountAmount === 'string'
        ? String(row.discountAmount).replace(/[^\d.-]/g, '')
        : row?.discountAmount,
      0,
    );
    const normalized = {
      ...row,
      id,
      name,
      discountType: rawType === 'fixed' ? 'Fixed' : rawType === 'percentage' ? 'Percentage' : String(row?.discountType || '').trim(),
      discountAmount: Number.isFinite(discountAmount) ? Number(discountAmount.toFixed(3)) : 0,
      isActive: toBoolean(row?.isActive, true),
    };
    return {
      id: normalized.id,
      name: normalized.name,
      discountType,
      discountAmount: normalized.discountAmount > 0 ? normalized.discountAmount : null,
      startsAt: toIsoOrNull(row?.startsAt),
      endsAt: toIsoOrNull(row?.endsAt),
      isActive: normalized.isActive,
      meta: normalized,
    };
  },
});

const expenseCategoriesStrategy = createMetaBackedResourceStrategy({
  resource: 'expenseCategories',
  deserialize: (row) => {
    const source = Object.keys(toObject(row.meta)).length > 0 ? toObject(row.meta) : row;
    const id = normalizeDropdownRowId(source.id || row.id);
    const name = String(source.name || row.name || '').trim();
    if (!id || !name) return null;
    return {
      id,
      name,
      description: String(source.description || row.description || '').trim() || undefined,
      code: String(source.code || row.code || '').trim() || undefined,
    };
  },
  serialize: (row) => {
    const id = normalizeDropdownRowId(row?.id);
    const name = String(row?.name || '').trim();
    if (!id || !name) return null;
    const normalized = {
      ...row,
      id,
      name,
      description: String(row?.description || '').trim(),
      code: String(row?.code || '').trim(),
    };
    return {
      id: normalized.id,
      name: normalized.name,
      description: normalized.description || null,
      code: normalized.code || null,
      meta: normalized,
    };
  },
});

const RESOURCE_STRATEGIES: Record<string, DropdownStrategy> = {
  roles: rolesStrategy,
  commissionAgents: commissionAgentsStrategy,
  printers: printersStrategy,
  invoiceSchemes: invoiceSchemesStrategy,
  invoiceLayouts: invoiceLayoutsStrategy,
  barcodeSettings: barcodeSettingsStrategy,
  customerGroups: customerGroupsStrategy,
  warranties: warrantiesStrategy,
  productVariations: productVariationsStrategy,
  sellingPriceGroups: sellingPriceGroupsStrategy,
  discounts: discountsStrategy,
  expenseCategories: expenseCategoriesStrategy,
};

export const fetchDropdownCollections = async (keys: string[]): Promise<DropdownCollectionMap> => {
  const normalizedKeys = Array.from(new Set(
    keys
      .map((key) => String(key || '').trim())
      .filter(Boolean),
  ));

  if (normalizedKeys.length === 0) return {};
  if (!isDropdownSyncEnabled() || !getToken()) return {};

  const collections: DropdownCollectionMap = {};

  const strategyKeys = normalizedKeys.filter((key) => Boolean(RESOURCE_STRATEGIES[key]));
  if (strategyKeys.length > 0) {
    await Promise.all(strategyKeys.map(async (key) => {
      const strategy = RESOURCE_STRATEGIES[key];
      const fetched = await strategy.fetch();
      if (fetched !== null) {
        collections[key] = toArray(fetched);
      }
    }));
  }

  return collections;
};

export const pushDropdownCollections = async (collections: DropdownCollectionMap): Promise<boolean> => {
  void collections;
  logDropdownWriteDisabled();
  return false;
};
