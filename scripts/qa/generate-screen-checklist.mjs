import path from 'node:path';
import { readText, relPath, repoRoot, writeText } from './fs-utils.mjs';

const appPath = path.join(repoRoot, 'App.tsx');
const appText = readText(appPath);

const routeMatches = [...appText.matchAll(/case\s+'([^']+)'\s*:/g)];
const routes = Array.from(new Set(routeMatches.map((match) => match[1]))).sort();

const inferModule = (route) => {
  if (route.startsWith('report-')) return 'Reports';
  if (route.includes('payment') || route.includes('account')) return 'Payments';
  if (route.includes('stock')) return 'Stock';
  if (route.includes('purchase')) return 'Purchases';
  if (route.includes('sale') || route.includes('pos') || route.includes('quotation') || route.includes('shipment')) return 'Sell';
  if (route.includes('customer') || route.includes('supplier') || route.includes('contact')) return 'Contacts';
  if (route.includes('setting') || route.includes('tax') || route.includes('location') || route.includes('printer')) return 'Settings';
  if (route.includes('user') || route.includes('role')) return 'Users';
  if (route.includes('help') || route.includes('support')) return 'Support';
  if (route.includes('dashboard')) return 'Dashboard';
  return 'General';
};

const now = new Date().toISOString().slice(0, 10);

const lines = [
  '# Screen Audit Checklist',
  '',
  `Generated from [${relPath(appPath)}](../../App.tsx) on ${now}.`,
  '',
  'Mark each route complete only when all checks pass for desktop and mobile.',
  '',
  '| Route | Module | Data Wired | Buttons Wired | Filters | Pagination | Export/Print | Permissions | Empty/Error States | Mobile Fit | Notes |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...routes.map((route) => `| \`${route}\` | ${inferModule(route)} | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |`),
  '',
  '## Completion Rule',
  '- A route is done only when all boxes are checked and evidence exists in PR notes (screenshots/test output).',
];

const outputPath = path.join(repoRoot, 'docs', 'quality', 'screen-audit-checklist.md');
writeText(outputPath, `${lines.join('\n')}\n`);
console.log(`Generated ${relPath(outputPath)} with ${routes.length} routes.`);
