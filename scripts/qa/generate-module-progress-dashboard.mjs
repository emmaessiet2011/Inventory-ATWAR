import path from 'node:path';
import { ensureDir, readText, relPath, repoRoot, writeText } from './fs-utils.mjs';

const checklistPath = path.join(repoRoot, 'docs', 'quality', 'screen-audit-checklist.md');
if (!checklistPath) {
  throw new Error('Checklist path resolution failed.');
}

const checklistText = readText(checklistPath);
const lines = checklistText.split('\n');

const headerLine = lines.find((line) => line.startsWith('| Route | Module |'));
if (!headerLine) {
  throw new Error(`Could not find checklist table header in ${relPath(checklistPath)}.`);
}

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

const rowLines = lines.filter((line) => /^\|\s*`[^`]+`\s*\|/.test(line));
if (rowLines.length === 0) {
  throw new Error(`No checklist rows found in ${relPath(checklistPath)}.`);
}

const parseCheck = (value) => /^\[\s*x\s*\]$/i.test(String(value || '').trim());
const pct = (part, total) => (total > 0 ? Number(((part / total) * 100).toFixed(1)) : 0);

const routes = rowLines.map((line) => {
  const cols = line.split('|').slice(1, -1).map((cell) => cell.trim());
  const route = cols[0].replaceAll('`', '').trim();
  const moduleName = cols[1] || 'General';
  const checksRaw = cols.slice(2, 10);
  const checks = checksRaw.map(parseCheck);
  const checksDone = checks.filter(Boolean).length;
  const missingChecks = checkLabels.filter((_, index) => !checks[index]);
  const notes = cols[10] || '';

  return {
    route,
    moduleName,
    checks,
    checksDone,
    checksTotal: checkLabels.length,
    routeDone: checksDone === checkLabels.length,
    missingChecks,
    notes,
  };
});

const moduleMap = new Map();
for (const route of routes) {
  if (!moduleMap.has(route.moduleName)) {
    moduleMap.set(route.moduleName, {
      module: route.moduleName,
      routesTotal: 0,
      routesDone: 0,
      checksTotal: 0,
      checksDone: 0,
      routes: [],
    });
  }
  const mod = moduleMap.get(route.moduleName);
  mod.routesTotal += 1;
  mod.routesDone += route.routeDone ? 1 : 0;
  mod.checksTotal += route.checksTotal;
  mod.checksDone += route.checksDone;
  mod.routes.push(route);
}

const modules = Array.from(moduleMap.values())
  .map((mod) => ({
    ...mod,
    routePercent: pct(mod.routesDone, mod.routesTotal),
    checkPercent: pct(mod.checksDone, mod.checksTotal),
    openRoutes: mod.routesTotal - mod.routesDone,
  }))
  .sort((a, b) => a.checkPercent - b.checkPercent || a.module.localeCompare(b.module));

const overall = {
  routesTotal: routes.length,
  routesDone: routes.filter((route) => route.routeDone).length,
  checksTotal: routes.length * checkLabels.length,
  checksDone: routes.reduce((sum, route) => sum + route.checksDone, 0),
};
overall.routePercent = pct(overall.routesDone, overall.routesTotal);
overall.checkPercent = pct(overall.checksDone, overall.checksTotal);

const now = new Date().toISOString();
const dashboardLines = [
  '# Module Progress Dashboard',
  '',
  `Generated from [${relPath(checklistPath)}](./screen-audit-checklist.md) on ${now}.`,
  '',
  '## Overall',
  '',
  '| Metric | Value |',
  '| --- | --- |',
  `| Routes Completed | ${overall.routesDone}/${overall.routesTotal} (${overall.routePercent}%) |`,
  `| Checklist Checks Completed | ${overall.checksDone}/${overall.checksTotal} (${overall.checkPercent}%) |`,
  '',
  '## Module Summary',
  '',
  '| Module | Routes Done/Total | Route % | Checks Done/Total | Check % | Open Routes |',
  '| --- | --- | --- | --- | --- | --- |',
  ...modules.map((mod) => `| ${mod.module} | ${mod.routesDone}/${mod.routesTotal} | ${mod.routePercent}% | ${mod.checksDone}/${mod.checksTotal} | ${mod.checkPercent}% | ${mod.openRoutes} |`),
  '',
  '## Module Details',
  '',
];

for (const mod of modules) {
  dashboardLines.push(`### ${mod.module}`);
  dashboardLines.push('');
  dashboardLines.push('| Route | Status | Checks Done | Missing Checks |');
  dashboardLines.push('| --- | --- | --- | --- |');
  const routeRows = [...mod.routes].sort((a, b) => a.route.localeCompare(b.route));
  for (const route of routeRows) {
    const status = route.routeDone ? 'DONE' : 'OPEN';
    const missing = route.missingChecks.length > 0 ? route.missingChecks.join(', ') : '--';
    dashboardLines.push(`| \`${route.route}\` | ${status} | ${route.checksDone}/${route.checksTotal} | ${missing} |`);
  }
  dashboardLines.push('');
}

const docsOutputPath = path.join(repoRoot, 'docs', 'quality', 'module-progress-dashboard.md');
writeText(docsOutputPath, `${dashboardLines.join('\n')}\n`);

const reportsDir = path.join(repoRoot, 'qa', 'reports');
ensureDir(reportsDir);
const jsonOutputPath = path.join(reportsDir, 'module-progress-dashboard.json');
writeText(
  jsonOutputPath,
  `${JSON.stringify({ generatedAt: now, overall, modules }, null, 2)}\n`
);

console.log(`Generated ${relPath(docsOutputPath)}`);
console.log(`Generated ${relPath(jsonOutputPath)}`);
