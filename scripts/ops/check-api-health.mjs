import 'dotenv/config';

const base =
  String(process.env.HEALTH_API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(
    /\/+$/,
    '',
  );
const timeoutMs = Number(process.env.HEALTH_CHECK_TIMEOUT_MS || 5000);

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

async function main() {
  const healthzUrl = `${base}/healthz`;
  const apiHealthUrl = `${base}/api/health`;

  const [healthzRes, apiHealthRes] = await Promise.all([
    fetchWithTimeout(healthzUrl),
    fetchWithTimeout(apiHealthUrl),
  ]);

  const [healthzBody, apiHealthBody] = await Promise.all([
    readJsonSafe(healthzRes),
    readJsonSafe(apiHealthRes),
  ]);

  const healthzOk =
    healthzRes.ok &&
    healthzBody &&
    String(healthzBody.status || '').toLowerCase() === 'up' &&
    healthzBody.ok === true;
  const apiHealthUp =
    apiHealthRes.ok &&
    apiHealthBody &&
    String(apiHealthBody.status || '').toLowerCase() === 'up' &&
    String(apiHealthBody.db || '').toLowerCase() === 'connected';

  const output = {
    checkedAt: new Date().toISOString(),
    base,
    healthz: {
      statusCode: healthzRes.status,
      ok: healthzOk,
      body: healthzBody,
    },
    apiHealth: {
      statusCode: apiHealthRes.status,
      ok: apiHealthUp,
      body: apiHealthBody,
    },
  };

  console.log(JSON.stringify(output, null, 2));

  if (!healthzOk || !apiHealthUp) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[ops:health] failed');
  console.error(error);
  process.exitCode = 1;
});
