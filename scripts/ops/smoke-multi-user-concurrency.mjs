import 'dotenv/config';

const base = String(
  process.env.SMOKE_API_BASE_URL || process.env.HEALTH_API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:4000',
).replace(/\/+$/, '');

const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15000);
const sessionCount = Math.max(2, Math.min(3, Number(process.env.SMOKE_SESSION_COUNT || 3)));
const strictRequired = String(process.env.SMOKE_REQUIRED || 'false').trim().toLowerCase() === 'true';
const cleanupEnabled = String(process.env.SMOKE_SKIP_CLEANUP || 'false').trim().toLowerCase() !== 'true';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url, init = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const readJsonSafe = async (res) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

const authHeaders = (token) => ({
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

const getCredential = (index) => {
  const idx = index + 1;
  const email = String(process.env[`SMOKE_USER_${idx}_EMAIL`] || process.env.SMOKE_EMAIL || '').trim();
  const password = String(process.env[`SMOKE_USER_${idx}_PASSWORD`] || process.env.SMOKE_PASSWORD || '').trim();
  if (!email || !password) return null;
  return { email, password };
};

const ensureCredentials = () => {
  const creds = [];
  for (let i = 0; i < sessionCount; i += 1) {
    const credential = getCredential(i);
    if (!credential) return [];
    creds.push(credential);
  }
  return creds;
};

const apiLogin = async (email, password) => {
  const res = await fetchWithTimeout(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password, rememberMe: false }),
  });
  const payload = await readJsonSafe(res);
  if (!res.ok || !payload?.ok || !payload?.token) {
    throw new Error(payload?.error || `Login failed (${res.status})`);
  }
  return {
    token: String(payload.token),
    user: payload.user || null,
  };
};

const putSyncRecord = async (resource, payload, token) => {
  const res = await fetchWithTimeout(`${base}/api/sync/record/${encodeURIComponent(resource)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await readJsonSafe(res);
  if (!res.ok || body?.ok === false) {
    throw new Error(body?.error || `sync ${resource} failed (${res.status})`);
  }
  return body;
};

const getById = async (resource, id, token) => {
  const res = await fetchWithTimeout(`${base}/api/data/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  const body = await readJsonSafe(res);
  if (!res.ok || body?.ok === false) {
    throw new Error(body?.error || `fetch ${resource}/${id} failed (${res.status})`);
  }
  return body?.data || null;
};

const searchRows = async (resource, query, token) => {
  const res = await fetchWithTimeout(
    `${base}/api/data/${encodeURIComponent(resource)}?paginate=false&q=${encodeURIComponent(query)}`,
    {
      method: 'GET',
      headers: authHeaders(token),
    },
  );
  const body = await readJsonSafe(res);
  if (!res.ok || body?.ok === false) {
    throw new Error(body?.error || `search ${resource} failed (${res.status})`);
  }
  return Array.isArray(body?.data) ? body.data : [];
};

const deleteById = async (resource, id, token) => {
  const res = await fetchWithTimeout(`${base}/api/data/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await readJsonSafe(res);
    throw new Error(body?.error || `delete ${resource}/${id} failed (${res.status})`);
  }
};

async function main() {
  const startedAt = Date.now();
  const credentials = ensureCredentials();

  if (credentials.length === 0) {
    const skipped = {
      checkedAt: new Date().toISOString(),
      base,
      status: strictRequired ? 'failed' : 'skipped',
      reason:
        'Missing credentials. Provide SMOKE_EMAIL/SMOKE_PASSWORD or SMOKE_USER_1..3_EMAIL/PASSWORD to run concurrency smoke.',
      required: strictRequired,
    };
    console.log(JSON.stringify(skipped, null, 2));
    if (strictRequired) process.exitCode = 1;
    return;
  }

  const sessions = await Promise.all(credentials.map((credential) => apiLogin(credential.email, credential.password)));
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const customerId = `SMK-CUST-${stamp}`;
  const orderId = `SMK-ORD-${stamp}`;
  const paymentIds = sessions.map((_, index) => `SMK-PAY-${stamp}-${index + 1}`);
  const paymentSearchKey = `SMOKE-${stamp}`;
  const customerDueUpdates = sessions.map((_, index) => Number((index + 1) * 10));
  const orderStatuses = ['PROCESSING', 'READY', 'DELIVERED'].slice(0, sessions.length);

  const result = {
    checkedAt: new Date().toISOString(),
    base,
    sessions: sessions.map((session, index) => ({
      session: index + 1,
      userId: String(session.user?.id || ''),
      email: String(session.user?.email || credentials[index].email || ''),
    })),
    steps: [],
    verification: {},
    cleanup: { enabled: cleanupEnabled, errors: [] },
    durationMs: 0,
    status: 'passed',
  };

  try {
    result.steps.push('Create shared customer');
    await putSyncRecord(
      'customers',
      {
        id: customerId,
        businessName: `Smoke Customer ${stamp}`,
        name: `Smoke Customer ${stamp}`,
        email: `smoke-${stamp}@example.com`,
        mobile: '',
        status: 'ACTIVE',
        creditLimit: 0,
        openingBalance: 0,
        advanceBalance: 0,
        totalSellDue: 0,
        totalSellReturnDue: 0,
      },
      sessions[0].token,
    );

    result.steps.push('Create shared order');
    await putSyncRecord(
      'orders',
      {
        id: orderId,
        orderNumber: `SMOKE-ORDER-${stamp}`,
        customerId,
        orderDate: new Date().toISOString(),
        status: 'PENDING',
        paymentStatus: 'DUE',
        subTotal: 100,
        taxAmount: 0,
        discountAmount: 0,
        total: 100,
        note: `Concurrency smoke seed ${stamp}`,
      },
      sessions[0].token,
    );

    result.steps.push('Concurrent updates on same customer');
    await Promise.all(
      sessions.map((session, index) =>
        putSyncRecord(
          'customers',
          {
            id: customerId,
            businessName: `Smoke Customer ${stamp}`,
            name: `Smoke Customer ${stamp}`,
            email: `smoke-${stamp}@example.com`,
            status: 'ACTIVE',
            totalSellDue: customerDueUpdates[index],
          },
          session.token,
        ),
      ),
    );

    result.steps.push('Concurrent updates on same order');
    await Promise.all(
      sessions.map((session, index) =>
        putSyncRecord(
          'orders',
          {
            id: orderId,
            orderNumber: `SMOKE-ORDER-${stamp}`,
            customerId,
            orderDate: new Date().toISOString(),
            status: orderStatuses[index],
            paymentStatus: 'DUE',
            subTotal: 100,
            total: 100,
            note: `Concurrency order update from session ${index + 1}`,
          },
          session.token,
        ),
      ),
    );

    result.steps.push('Concurrent create payments for same customer');
    await Promise.all(
      sessions.map((session, index) =>
        putSyncRecord(
          'payments',
          {
            id: paymentIds[index],
            date: new Date().toISOString(),
            contactType: 'CUSTOMER',
            direction: 'RECEIVED',
            customerId,
            referenceNo: `${paymentSearchKey}-${index + 1}`,
            method: 'Cash',
            amount: Number((index + 1) * 5),
            note: `Concurrency payment ${index + 1}`,
          },
          session.token,
        ),
      ),
    );

    await sleep(150);

    result.steps.push('Verify records');
    const [customerRow, orderRow, paymentRows] = await Promise.all([
      getById('customers', customerId, sessions[0].token),
      getById('orders', orderId, sessions[0].token),
      searchRows('payments', paymentSearchKey, sessions[0].token),
    ]);

    const matchedPayments = paymentRows.filter((row) =>
      String(row?.referenceNo || '').includes(paymentSearchKey),
    );

    const customerDue = Number(customerRow?.totalSellDue || 0);
    const orderStatus = String(orderRow?.status || '').toUpperCase();
    const verification = {
      customerExists: String(customerRow?.id || '') === customerId,
      customerDueInExpectedSet: customerDueUpdates.includes(customerDue),
      orderExists: String(orderRow?.id || '') === orderId,
      orderStatusInExpectedSet: orderStatuses.includes(orderStatus),
      paymentRowsCount: matchedPayments.length,
      paymentRowsAtLeastSessionCount: matchedPayments.length >= sessions.length,
    };
    result.verification = verification;

    const failedChecks = Object.entries(verification)
      .filter(([key, value]) => key !== 'paymentRowsCount' && value === false)
      .map(([key]) => key);

    if (failedChecks.length > 0) {
      throw new Error(`Verification failed: ${failedChecks.join(', ')}`);
    }
  } catch (error) {
    result.status = 'failed';
    result.error = error instanceof Error ? error.message : 'Unknown smoke test error';
    process.exitCode = 1;
  } finally {
    if (cleanupEnabled) {
      for (const paymentId of paymentIds) {
        try {
          await deleteById('payments', paymentId, sessions[0].token);
        } catch (error) {
          result.cleanup.errors.push(error instanceof Error ? error.message : `Failed to cleanup payment ${paymentId}`);
        }
      }
      try {
        await deleteById('orders', orderId, sessions[0].token);
      } catch (error) {
        result.cleanup.errors.push(error instanceof Error ? error.message : `Failed to cleanup order ${orderId}`);
      }
      try {
        await deleteById('customers', customerId, sessions[0].token);
      } catch (error) {
        result.cleanup.errors.push(error instanceof Error ? error.message : `Failed to cleanup customer ${customerId}`);
      }
    }
    result.durationMs = Date.now() - startedAt;
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((error) => {
  console.error('[ops:smoke:concurrency] failed');
  console.error(error);
  process.exitCode = 1;
});
