import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const base =
  String(process.env.HEALTH_API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(
    /\/+$/,
    '',
  );
const timeoutMs = Number(process.env.HEALTH_CHECK_TIMEOUT_MS || 7000);
const sampleCount = Math.max(1, Number(process.env.HEALTH_SAMPLE_COUNT || 3));
const warnLatencyMs = Number(process.env.HEALTH_WARN_LATENCY_MS || 1200);
const failLatencyMs = Number(process.env.HEALTH_FAIL_LATENCY_MS || 3500);
const failOnDegraded = String(process.env.HEALTH_FAIL_ON_DEGRADED || 'false').trim().toLowerCase() === 'true';
const alertWebhookUrl = String(process.env.HEALTH_ALERT_WEBHOOK_URL || '').trim();
const enableDatabaseDirectCheck = String(
  process.env.HEALTH_ENABLE_DATABASE_DIRECT_CHECK || process.env.HEALTH_ENABLE_NEON_DIRECT_CHECK || 'true',
)
  .trim()
  .toLowerCase() !== 'false';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readJsonSafe = async (res) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

const fetchWithTimeout = async (url, init = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await readJsonSafe(response);
    return {
      ok: response.ok,
      statusCode: response.status,
      body,
      latencyMs: Date.now() - started,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 0,
      body: null,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'Unknown fetch error',
    };
  } finally {
    clearTimeout(timer);
  }
};

const p95 = (values) => {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
};

const summarizeProbe = (name, samples, validator) => {
  const latencies = samples.map((sample) => Number(sample.latencyMs || 0)).filter((value) => Number.isFinite(value));
  const checks = samples.map((sample) => ({
    ...sample,
    valid: sample.ok && validator(sample.body),
  }));
  const hasFailure = checks.some((check) => !check.valid);
  const p95Latency = p95(latencies);
  const avgLatency =
    latencies.length > 0 ? Number((latencies.reduce((sum, value) => sum + value, 0) / latencies.length).toFixed(1)) : 0;
  let level = 'up';
  if (hasFailure || p95Latency > failLatencyMs) level = 'down';
  else if (p95Latency > warnLatencyMs) level = 'degraded';
  return {
    name,
    level,
    avgLatencyMs: avgLatency,
    p95LatencyMs: p95Latency,
    samples: checks,
  };
};

const runEndpointProbes = async () => {
  const healthzUrl = `${base}/healthz`;
  const apiHealthUrl = `${base}/api/health`;

  const healthzSamples = [];
  const apiHealthSamples = [];
  for (let attempt = 0; attempt < sampleCount; attempt += 1) {
    const [healthz, apiHealth] = await Promise.all([
      fetchWithTimeout(healthzUrl, { method: 'GET', headers: { Accept: 'application/json' } }),
      fetchWithTimeout(apiHealthUrl, { method: 'GET', headers: { Accept: 'application/json' } }),
    ]);
    healthzSamples.push(healthz);
    apiHealthSamples.push(apiHealth);
    if (attempt < sampleCount - 1) await sleep(250);
  }

  const healthzSummary = summarizeProbe('healthz', healthzSamples, (body) => (
    body &&
    body.ok === true &&
    String(body.status || '').toLowerCase() === 'up'
  ));

  const apiHealthSummary = summarizeProbe('apiHealth', apiHealthSamples, (body) => (
    body &&
    body.ok === true &&
    String(body.status || '').toLowerCase() === 'up' &&
    String(body.db || '').toLowerCase() === 'connected'
  ));

  return {
    endpoints: {
      healthz: { url: healthzUrl, ...healthzSummary },
      apiHealth: { url: apiHealthUrl, ...apiHealthSummary },
    },
  };
};

const runDatabaseDirectProbe = async () => {
  if (!enableDatabaseDirectCheck) {
    return {
      enabled: false,
      level: 'skipped',
      latencyMs: 0,
      error: null,
    };
  }

  const prisma = new PrismaClient();
  const started = Date.now();
  try {
    await prisma.$executeRaw`SELECT 1`;
    const latencyMs = Date.now() - started;
    return {
      enabled: true,
      level: latencyMs > warnLatencyMs ? 'degraded' : 'up',
      latencyMs,
      error: null,
    };
  } catch (error) {
    return {
      enabled: true,
      level: 'down',
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'Database probe failed',
    };
  } finally {
    await prisma.$disconnect();
  }
};

const computeOverallLevel = (endpointResult, databaseResult) => {
  const endpointLevels = [endpointResult.endpoints.healthz.level, endpointResult.endpoints.apiHealth.level];
  const levels = databaseResult.enabled ? [...endpointLevels, databaseResult.level] : endpointLevels;
  if (levels.includes('down')) return 'down';
  if (levels.includes('degraded')) return 'degraded';
  return 'up';
};

const sendAlert = async (report) => {
  if (!alertWebhookUrl) return { sent: false, statusCode: null };
  const payload = {
    text: `[ATWAR OPS] ${report.overall.level.toUpperCase()} infra health check`,
    report,
  };
  try {
    const response = await fetch(alertWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return {
      sent: true,
      statusCode: response.status,
    };
  } catch {
    return {
      sent: false,
      statusCode: null,
    };
  }
};

async function main() {
  const endpointResult = await runEndpointProbes();
  const databaseResult = await runDatabaseDirectProbe();
  const overallLevel = computeOverallLevel(endpointResult, databaseResult);
  const report = {
    checkedAt: new Date().toISOString(),
    base,
    thresholds: {
      timeoutMs,
      sampleCount,
      warnLatencyMs,
      failLatencyMs,
      failOnDegraded,
    },
    endpoints: endpointResult.endpoints,
    databaseDirect: databaseResult,
    overall: {
      level: overallLevel,
      shouldFail: overallLevel === 'down' || (failOnDegraded && overallLevel === 'degraded'),
    },
  };

  const alertResult =
    report.overall.level === 'up'
      ? { sent: false, statusCode: null }
      : await sendAlert(report);

  console.log(
    JSON.stringify(
      {
        ...report,
        alert: alertResult,
      },
      null,
      2,
    ),
  );

  if (report.overall.shouldFail) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[ops:health:alerts] failed');
  console.error(error);
  process.exitCode = 1;
});
