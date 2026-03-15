import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { relPath, repoRoot } from './fs-utils.mjs';

const run = (command) => {
  console.log(`\n$ ${command}`);
  execSync(command, { stdio: 'inherit', cwd: repoRoot });
};

const knownIssuesPath = path.join(repoRoot, 'qa', 'known-issues.json');
if (!fs.existsSync(knownIssuesPath)) {
  throw new Error(`Missing required file: ${relPath(knownIssuesPath)}`);
}

const knownIssues = JSON.parse(fs.readFileSync(knownIssuesPath, 'utf8'));
if (!Array.isArray(knownIssues)) {
  throw new Error(`${relPath(knownIssuesPath)} must be a JSON array.`);
}

const openCritical = knownIssues.filter((issue) => {
  const status = String(issue?.status || '').toLowerCase();
  const severity = String(issue?.severity || '').toUpperCase();
  return status !== 'closed' && (severity === 'P1' || severity === 'P2');
});

if (openCritical.length > 0) {
  console.error('\nRelease gate blocked: open P1/P2 issues found.');
  for (const issue of openCritical) {
    console.error(`- ${issue.id || 'UNKNOWN'} (${issue.severity}) ${issue.title || ''}`);
  }
  process.exit(1);
}

run('npm run typecheck:strict');
run('npm run audit:quality');
run('npm run test:unit');
run('npm run test:e2e:smoke');

console.log('\nRelease gate passed.');
