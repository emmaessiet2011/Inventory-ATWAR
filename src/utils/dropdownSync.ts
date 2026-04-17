export type DropdownCollectionMap = Record<string, any[]>;

const DEFAULT_API_BASE_URL = 'http://localhost:4000';
const AUTH_TOKEN_KEY = 'atwar_auth_token';
const STRICT_RESOURCE_MAP: Record<
  string,
  { resource: string; serialize: (row: any) => Record<string, unknown> | null }
> = {
  customerGroups: {
    resource: 'customerGroups',
    serialize: (row) => {
      const id = String(row?.id || '').trim();
      const name = String(row?.name || '').trim();
      if (!id || !name) return null;
      const discountPercent = Number(row?.discountPercent);
      const statusRaw = String(row?.status || 'Active').trim().toLowerCase();
      return {
        id,
        name,
        discountPercent: Number.isFinite(discountPercent) ? discountPercent : 0,
        status: statusRaw === 'inactive' ? 'INACTIVE' : 'ACTIVE',
        meta: row,
      };
    },
  },
  sellingPriceGroups: {
    resource: 'sellingPriceGroups',
    serialize: (row) => {
      const id = String(row?.id || '').trim();
      const name = String(row?.name || '').trim();
      if (!id || !name) return null;
      const discount = Number(row?.discount);
      const priceCalcPercentage = Number(row?.priceCalcPercentage);
      return {
        id,
        name,
        description: String(row?.description || '').trim() || null,
        discount: Number.isFinite(discount) ? discount : 0,
        priceCalcPercentage: Number.isFinite(priceCalcPercentage) ? priceCalcPercentage : 0,
        meta: row,
      };
    },
  },
};

const getApiBaseUrl = (): string => {
  const configured = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  const base = configured || DEFAULT_API_BASE_URL;
  return base.replace(/\/+$/, '');
};

export const isDropdownSyncEnabled = (): boolean =>
  !['false', '0', 'off'].includes(String(import.meta.env.VITE_ENABLE_DB_SYNC || '').trim().toLowerCase());

const getToken = (): string => {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
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
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('atwar:auth:expired'));
  }
};

const mapMetaRows = (value: unknown): any[] => {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    if (row && typeof row === 'object' && (row as Record<string, unknown>).meta && typeof (row as Record<string, unknown>).meta === 'object') {
      return (row as Record<string, unknown>).meta;
    }
    return row;
  });
};

const fetchResourceRows = async (resource: string): Promise<any[] | null> => {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/data/${encodeURIComponent(resource)}?paginate=false`,
      {
        method: 'GET',
        headers: buildHeaders(false),
      },
    );
    if (response.status === 401) {
      handle401();
      return null;
    }
    if (!response.ok) return null;
    const payload = await response.json();
    return mapMetaRows(payload?.data);
  } catch {
    return null;
  }
};

const fetchOptionCollections = async (keys: string[]): Promise<DropdownCollectionMap | null> => {
  if (keys.length === 0) return {};
  try {
    const params = new URLSearchParams({ keys: keys.join(',') });
    const response = await fetch(`${getApiBaseUrl()}/api/options/bulk?${params.toString()}`, {
      method: 'GET',
      headers: buildHeaders(false),
    });
    if (response.status === 401) {
      handle401();
      return null;
    }
    if (!response.ok) return null;
    const payload = await response.json();
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
    const collections: DropdownCollectionMap = {};
    keys.forEach((key) => {
      collections[key] = Array.isArray(data[key]) ? data[key] : [];
    });
    return collections;
  } catch {
    return null;
  }
};

const getRowId = (row: any): string => {
  const direct = String(row?.id || '').trim();
  if (direct) return direct;
  return String(row?.meta?.id || '').trim();
};

const syncStrictResourceCollection = async (
  key: string,
  rows: any[],
): Promise<boolean> => {
  const strictCfg = STRICT_RESOURCE_MAP[key];
  if (!strictCfg) return true;

  const serializedRows = (Array.isArray(rows) ? rows : [])
    .map((row) => strictCfg.serialize(row))
    .filter((row): row is Record<string, unknown> => !!row);

  const desiredIds = new Set(
    serializedRows
      .map((row) => String(row.id || '').trim())
      .filter(Boolean),
  );

  const existingRows = await fetchResourceRows(strictCfg.resource);
  if (existingRows === null) return false;
  const existingIds = new Set(
    existingRows
      .map((row) => getRowId(row))
      .filter(Boolean),
  );

  try {
    const upsertResponse = await fetch(
      `${getApiBaseUrl()}/api/data/${encodeURIComponent(strictCfg.resource)}/bulk-upsert`,
      {
        method: 'POST',
        headers: buildHeaders(true),
        body: JSON.stringify({ rows: serializedRows }),
      },
    );
    if (upsertResponse.status === 401) {
      handle401();
      return false;
    }
    if (!upsertResponse.ok) return false;

    const idsToDelete = Array.from(existingIds).filter((id) => !desiredIds.has(id));
    if (idsToDelete.length === 0) return true;

    const deleteResults = await Promise.all(
      idsToDelete.map(async (id) => {
        const response = await fetch(
          `${getApiBaseUrl()}/api/data/${encodeURIComponent(strictCfg.resource)}/${encodeURIComponent(id)}`,
          {
            method: 'DELETE',
            headers: buildHeaders(false),
          },
        );
        if (response.status === 401) {
          handle401();
          return false;
        }
        return response.ok;
      }),
    );

    return deleteResults.every(Boolean);
  } catch {
    return false;
  }
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
  normalizedKeys.forEach((key) => {
    collections[key] = [];
  });

  const strictKeys = normalizedKeys.filter((key) => Boolean(STRICT_RESOURCE_MAP[key]));
  const optionKeys = normalizedKeys.filter((key) => !STRICT_RESOURCE_MAP[key]);

  if (strictKeys.length > 0) {
    await Promise.all(
      strictKeys.map(async (key) => {
        const rows = await fetchResourceRows(STRICT_RESOURCE_MAP[key].resource);
        collections[key] = Array.isArray(rows) ? rows : [];
      }),
    );
  }

  if (optionKeys.length > 0) {
    const optionCollections = await fetchOptionCollections(optionKeys);
    if (optionCollections) {
      optionKeys.forEach((key) => {
        collections[key] = Array.isArray(optionCollections[key]) ? optionCollections[key] : [];
      });
    }
  }

  return collections;
};

export const pushDropdownCollections = async (collections: DropdownCollectionMap): Promise<boolean> => {
  const payload: DropdownCollectionMap = {};
  Object.entries(collections || {}).forEach(([key, value]) => {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) return;
    payload[normalizedKey] = Array.isArray(value) ? value : [];
  });

  if (Object.keys(payload).length === 0) return true;
  if (!isDropdownSyncEnabled() || !getToken()) return false;

  const strictEntries = Object.entries(payload).filter(([key]) => Boolean(STRICT_RESOURCE_MAP[key]));
  const optionEntries = Object.entries(payload).filter(([key]) => !STRICT_RESOURCE_MAP[key]);

  if (strictEntries.length > 0) {
    const strictResults = await Promise.all(
      strictEntries.map(([key, rows]) => syncStrictResourceCollection(key, rows)),
    );
    if (!strictResults.every(Boolean)) return false;
  }

  if (optionEntries.length === 0) return true;

  const optionPayload: DropdownCollectionMap = {};
  optionEntries.forEach(([key, rows]) => {
    optionPayload[key] = rows;
  });

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/options/bulk`, {
      method: 'PUT',
      headers: buildHeaders(true),
      body: JSON.stringify({ collections: optionPayload }),
    });
    if (response.status === 401) {
      handle401();
      return false;
    }
    return response.ok;
  } catch {
    return false;
  }
};
