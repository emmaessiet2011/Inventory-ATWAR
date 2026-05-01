import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const reportDir = path.resolve(process.cwd(), 'qa', 'reports');
const reportPath = path.join(reportDir, 'ops-go-live-checklist-summary.json');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const defaultSteps = [
  {
    id: 'health-alerts',
    label: 'Infra health checks (VPS API + PostgreSQL)',
    cmd: npmCommand,
    args: ['run', 'ops:health:alerts'],
  },
  {
    id: 'postgres-reconcile',
    label: 'Postgres reconciliation snapshot',
    cmd: npmCommand,
    args: ['run', 'ops:reconcile'],
  },
  {
    id: 'multi-user-smoke',
    label: 'Multi-user concurrency smoke test',
    cmd: npmCommand,
    args: ['run', 'ops:smoke:concurrency'],
  },
];

const runStep = (step) =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    const cmd = process.platform === 'win32' ? 'cmd.exe' : step.cmd;
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', step.cmd, ...step.args] : step.args;
    const child = spawn(cmd, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
      shell: false,
    });

    child.on('close', (exitCode, signal) => {
      resolve({
        id: step.id,
        label: step.label,
        command: `${step.cmd} ${step.args.join(' ')}`,
        startedAt: new Date(startedAt).toISOString(),
        durationMs: Date.now() - startedAt,
        exitCode: Number(exitCode ?? 1),
        signal: signal ? String(signal) : null,
        status: Number(exitCode ?? 1) === 0 ? 'passed' : 'failed',
      });
    });

    child.on('error', (error) => {
      resolve({
        id: step.id,
        label: step.label,
        command: `${step.cmd} ${step.args.join(' ')}`,
        startedAt: new Date(startedAt).toISOString(),
        durationMs: Date.now() - startedAt,
        exitCode: 1,
        signal: null,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown execution error',
      });
    });
  });

async function main() {
  const startedAt = Date.now();
  const steps = [];

  for (const step of defaultSteps) {
    console.log(`[ops:go-live:checklist] running: ${step.label}`);
    const result = await runStep(step);
    steps.push(result);
    if (result.status === 'failed') {
      console.error(`[ops:go-live:checklist] failed at step: ${step.label}`);
      break;
    }
  }

  const failedSteps = steps.filter((step) => step.status === 'failed');
  const summary = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    status: failedSteps.length > 0 ? 'failed' : 'passed',
    steps,
    failedStepIds: failedSteps.map((step) => step.id),
    env: {
      apiBase: String(process.env.HEALTH_API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:4000'),
      smokeRequired: String(process.env.SMOKE_REQUIRED || 'false').trim().toLowerCase() === 'true',
      neonDirectEnabled:
        String(process.env.HEALTH_ENABLE_NEON_DIRECT_CHECK || 'true').trim().toLowerCase() !== 'false',
    },
  };

  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`[ops:go-live:checklist] report: ${reportPath}`);
  console.log(JSON.stringify(summary, null, 2));

  if (summary.status === 'failed') process.exitCode = 1;
}

main().catch((error) => {
  console.error('[ops:go-live:checklist] failed');
  console.error(error);
  process.exitCode = 1;
});
