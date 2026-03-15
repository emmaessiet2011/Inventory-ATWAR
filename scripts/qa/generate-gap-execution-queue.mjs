import fs from 'node:fs';
import path from 'node:path';
import { readText, relPath, repoRoot, writeText } from './fs-utils.mjs';

const checklistPath = path.join(repoRoot, 'docs', 'quality', 'screen-audit-checklist.md');
const releaseChecklistPath = path.join(repoRoot, 'docs', 'quality', 'release-checklist.md');
const loginPath = path.join(repoRoot, 'components', 'Login.tsx');
const globalContextPath = path.join(repoRoot, 'src', 'context', 'GlobalContext.tsx');
const settingsPath = path.join(repoRoot, 'components', 'Settings.tsx');
const backupPlanPath = path.join(repoRoot, 'docs', 'quality', 'backup-restore-plan.md');
const backupUtilityPath = path.join(repoRoot, 'src', 'utils', 'backupRestore.ts');

const checklistText = readText(checklistPath);
const releaseChecklistText = readText(releaseChecklistPath);
const loginText = readText(loginPath);
const globalContextText = readText(globalContextPath);
const settingsText = readText(settingsPath);

const permissionBoundaryCallCount = (globalContextText.match(/enforcePermissionBoundary\(/g) || []).length;
const hasBackupPlan = fs.existsSync(backupPlanPath);
const hasBackupUtility = fs.existsSync(backupUtilityPath);

const checkLabels = [
  'Data Wired',
  'Buttons Wired',
  'Filters',
  'Pagination',
  'Export/Print',
  'Permissions',
  'Empty/Error States',
  'Mobile Fit',
];

const checkDescriptions = {
  'Data Wired': 'This page is not yet confirmed to always save and reload information correctly.',
  'Buttons Wired': 'Some actions on this page are not yet confirmed to do exactly what users expect.',
  Filters: 'Search and filter options are not yet fully confirmed for real usage.',
  Pagination: 'Large lists on this page are not yet fully confirmed for smooth page-by-page navigation.',
  'Export/Print': 'Print and export outputs are not yet fully confirmed for this page.',
  Permissions: 'Role access on this page is not yet fully confirmed.',
  'Empty/Error States': 'This page is not yet fully confirmed for empty data and error scenarios.',
  'Mobile Fit': 'Mobile layout and touch usability are not yet fully confirmed.',
};

const titleCaseRoute = (route) => {
  const forced = {
    pos: 'POS',
    'list-pos': 'List POS',
    'vat-bills': 'VAT Bills',
    'add-sale': 'Add Sale',
    'add-order': 'Add Order',
    'list-orders': 'List Orders',
    'list-payments': 'List Payments',
    'field-payments': 'Field Payments',
    'report-profit-loss': 'Profit / Loss Report',
  };
  if (forced[route]) return forced[route];
  return route
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const parseCheck = (value) => /^\[\s*x\s*\]$/i.test(String(value || '').trim());

const routeRows = checklistText
  .split('\n')
  .filter((line) => /^\|\s*`[^`]+`\s*\|/.test(line))
  .map((line) => {
    const cols = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const route = cols[0].replaceAll('`', '').trim();
    const moduleName = cols[1] || 'General';
    const checks = cols.slice(2, 10).map(parseCheck);
    const done = checks.every(Boolean);
    const missingChecks = checkLabels.filter((_, index) => !checks[index]);
    return { route, moduleName, checks, done, missingChecks };
  })
  .sort((a, b) => a.route.localeCompare(b.route));

const routeTasks = routeRows.map((row, index) => ({
  id: `GAP-${String(index + 1).padStart(3, '0')}`,
  type: 'Route Certification',
  module: row.moduleName,
  page: titleCaseRoute(row.route),
  route: row.route,
  status: row.done ? 'CLOSED' : 'OPEN',
  whatIsMissing: row.done
    ? 'This page has passed all launch checks.'
    : row.missingChecks.map((check) => checkDescriptions[check]).join(' '),
  nextAction: row.done
    ? 'No action needed.'
    : `Complete and tick: ${row.missingChecks.join(', ')}.`,
}));

const hardeningDefinitions = [
  {
    key: 'dev_login_panel',
    label: 'Remove visible development credentials from login page',
    module: 'Security',
    page: 'Login',
    detector: () => /Login Details \(Development\)/i.test(loginText) || /Password:\s*\{user\.password\}/i.test(loginText),
    plain: 'Users can still see internal test login details on the sign-in screen.',
    next: 'Hide/remove the development credential panel in production mode.',
    autoClose: true,
  },
  {
    key: 'seed_plaintext_passwords',
    label: 'Remove seeded plaintext user passwords',
    module: 'Security',
    page: 'User Seed Data',
    detector: () => /const initialUsers[\s\S]*password:/m.test(globalContextText),
    plain: 'The app still ships with built-in plain passwords inside source code.',
    next: 'Move credentials out of seed code and stop storing plain passwords.',
    autoClose: true,
  },
  {
    key: 'localstorage_session',
    label: 'Harden session handling',
    module: 'Security',
    page: 'Session/Auth',
    detector: () => /localStorage\.setItem\('app_current_user'/.test(globalContextText),
    plain: 'Current login session is still stored in browser storage and can be tampered with.',
    next: 'Use safer session strategy for production deployment.',
    autoClose: true,
  },
  {
    key: 'localstorage_core_data',
    label: 'Harden core data storage',
    module: 'Security',
    page: 'Sales/Payments/Users Data',
    detector: () => (
      /localStorage\.setItem\('app_sales'/.test(globalContextText) ||
      /localStorage\.setItem\('app_payments'/.test(globalContextText) ||
      /localStorage\.setItem\('app_users'/.test(globalContextText)
    ),
    plain: 'Core business records are still browser-only and can be lost or edited outside normal flows.',
    next: 'Move critical records to controlled persistent storage before launch.',
    autoClose: true,
  },
  {
    key: 'server_side_access_control',
    label: 'Enforce access control outside UI checks',
    module: 'Security',
    page: 'Permissions',
    detector: () => (
      !/const enforcePermissionBoundary\s*=/.test(globalContextText) ||
      permissionBoundaryCallCount < 8
    ),
    plain: 'Permissions are still mainly enforced in the front-end experience.',
    next: 'Enforce permission checks in context-level mutation actions, not only in UI visibility.',
    autoClose: true,
  },
  {
    key: 'backup_restore_plan',
    label: 'Create backup and restore plan',
    module: 'Operations',
    page: 'Recovery',
    detector: () => !(
      hasBackupPlan &&
      hasBackupUtility &&
      /handleBackupExport/.test(settingsText) &&
      /handleBackupImport/.test(settingsText)
    ),
    plain: 'There is no formal backup and restore process to recover business data after device/browser loss.',
    next: 'Define and test backup/restore before launch.',
    autoClose: true,
  },
];

const hardeningOffset = routeTasks.length;
const hardeningTasks = hardeningDefinitions.map((item, index) => {
  const isStillOpen = item.detector();
  return {
    id: `GAP-${String(hardeningOffset + index + 1).padStart(3, '0')}`,
    type: 'Launch Hardening',
    module: item.module,
    page: item.page,
    route: '--',
    status: isStillOpen ? 'OPEN' : 'CLOSED',
    whatIsMissing: isStillOpen ? item.plain : 'This hardening task appears completed by current code scan.',
    nextAction: isStillOpen ? item.next : 'No action needed.',
    autoClose: item.autoClose,
  };
});

const releaseTasksOrdered = [
  'Scope locked and release owner assigned.',
  '`docs/quality/screen-audit-checklist.md` updated for all in-scope routes.',
  '`qa/known-issues.json` reviewed and current.',
  '`npm run release:check` passes.',
  'No open P1/P2 issues.',
  'Smoke test sign-off from product + engineering.',
  'Only blocker fixes allowed.',
  'Every blocker fix must include a regression test.',
  'Re-run `npm run release:check` after each freeze fix.',
  'Attach quality reports from `qa/reports/`.',
  'Attach E2E output and screenshots where relevant.',
  'Tag release commit with checklist completion.',
];

const isReleaseTaskChecked = (text) => {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const checkedRegex = new RegExp(`^-\\s*\\[x\\]\\s*${escaped}\\s*$`, 'im');
  return checkedRegex.test(releaseChecklistText);
};

const releaseOffset = routeTasks.length + hardeningTasks.length;
const releaseTasks = releaseTasksOrdered.map((item, index) => {
  const done = isReleaseTaskChecked(item);
  return {
    id: `GAP-${String(releaseOffset + index + 1).padStart(3, '0')}`,
    type: 'Release Process',
    module: 'Release',
    page: 'Launch Checklist',
    route: '--',
    status: done ? 'CLOSED' : 'OPEN',
    whatIsMissing: done
      ? 'Release process item is already checked.'
      : `Launch process item is still open: ${item}`,
    nextAction: done ? 'No action needed.' : `Complete and check: ${item}`,
  };
});

const queue = [...routeTasks, ...hardeningTasks, ...releaseTasks];

const counts = queue.reduce((acc, row) => {
  acc.total += 1;
  if (row.status === 'OPEN') acc.open += 1;
  if (row.status === 'CLOSED') acc.closed += 1;
  return acc;
}, { total: 0, open: 0, closed: 0 });

const moduleCounts = new Map();
for (const row of queue) {
  if (!moduleCounts.has(row.module)) {
    moduleCounts.set(row.module, { module: row.module, open: 0, closed: 0, total: 0 });
  }
  const entry = moduleCounts.get(row.module);
  entry.total += 1;
  if (row.status === 'OPEN') entry.open += 1;
  if (row.status === 'CLOSED') entry.closed += 1;
}

const moduleSummary = Array.from(moduleCounts.values())
  .sort((a, b) => b.open - a.open || a.module.localeCompare(b.module));

const now = new Date().toISOString();
const markdownLines = [
  '# Launch Gap Execution Queue',
  '',
  `Generated on ${now} from checklist + release checks.`,
  '',
  '## Overall',
  '',
  '| Metric | Value |',
  '| --- | --- |',
  `| Total Gaps | ${counts.total} |`,
  `| Open | ${counts.open} |`,
  `| Closed | ${counts.closed} |`,
  '',
  '## Module Summary',
  '',
  '| Module | Open | Closed | Total |',
  '| --- | --- | --- | --- |',
  ...moduleSummary.map((m) => `| ${m.module} | ${m.open} | ${m.closed} | ${m.total} |`),
  '',
  '## Strict Queue (One by One)',
  '',
  '| ID | Status | Type | Module | Page/Modal | What Is Still Missing (Non-Technical) | Next Action |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...queue.map((row) => `| ${row.id} | ${row.status} | ${row.type} | ${row.module} | ${row.page} | ${row.whatIsMissing} | ${row.nextAction} |`),
  '',
  '## How To Work',
  '1. Start from the first `OPEN` ID.',
  '2. Fix the item.',
  '3. Update checklist/release checkbox if relevant.',
  '4. Run `npm run qa:status` to auto-refresh this queue.',
];

const mdOut = path.join(repoRoot, 'docs', 'quality', 'gap-execution-queue.md');
const jsonOut = path.join(repoRoot, 'qa', 'reports', 'gap-execution-queue.json');

writeText(mdOut, `${markdownLines.join('\n')}\n`);
writeText(jsonOut, `${JSON.stringify({ generatedAt: now, counts, moduleSummary, queue }, null, 2)}\n`);

console.log(`Generated ${relPath(mdOut)}`);
console.log(`Generated ${relPath(jsonOut)}`);
console.log(`Open gaps: ${counts.open}/${counts.total}`);
