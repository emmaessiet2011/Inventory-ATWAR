import path from 'node:path';
import { ensureDir, getLine, listFilesRecursive, readText, relPath, repoRoot, writeText } from './fs-utils.mjs';

const appPath = path.join(repoRoot, 'App.tsx');
const appText = readText(appPath);

const routeMatches = [...appText.matchAll(/case\s+'([^']+)'\s*:/g)];
const routes = new Set(routeMatches.map((match) => match[1]));

const dynamicPrefixMatches = [...appText.matchAll(/currentPage\.startsWith\('([^']+)'\)/g)];
const dynamicPrefixes = dynamicPrefixMatches.map((match) => match[1]);

const sourceFiles = [
  path.join(repoRoot, 'App.tsx'),
  ...listFilesRecursive(path.join(repoRoot, 'components'), (filePath) => filePath.endsWith('.tsx')),
];

const unknownNavigationTargets = [];
const deadOnClickHandlers = [];
const bannedCalls = [];

const isTargetKnown = (target) => {
  if (routes.has(target)) return true;
  return dynamicPrefixes.some((prefix) => target.startsWith(prefix));
};

const onNavigateRegex = /onNavigate\??\.?\(\s*['"`]([^'"`$]+)['"`]\s*\)/g;
const emptyOnClickRegex = /onClick=\{\s*\(\)\s*=>\s*\{\s*\}\s*\}/g;
const deadOnClickRegex = /onClick=\{[\s\S]{0,220}?(alert|console\.log)\s*\(/g;
const bannedCallRegex = /\b(alert|console\.log)\s*\(/g;

for (const filePath of sourceFiles) {
  const text = readText(filePath);

  for (const match of text.matchAll(onNavigateRegex)) {
    const target = match[1].trim();
    if (!target) continue;
    if (!isTargetKnown(target)) {
      unknownNavigationTargets.push({
        file: relPath(filePath),
        line: getLine(text, match.index ?? 0),
        target,
      });
    }
  }

  for (const match of text.matchAll(emptyOnClickRegex)) {
    deadOnClickHandlers.push({
      file: relPath(filePath),
      line: getLine(text, match.index ?? 0),
      snippet: match[0].slice(0, 120),
    });
  }

  for (const match of text.matchAll(deadOnClickRegex)) {
    deadOnClickHandlers.push({
      file: relPath(filePath),
      line: getLine(text, match.index ?? 0),
      snippet: match[0].slice(0, 120),
    });
  }

  for (const match of text.matchAll(bannedCallRegex)) {
    // Allow console.log/assertion in test files only.
    if (filePath.includes(`${path.sep}tests${path.sep}`) || filePath.includes(`${path.sep}e2e${path.sep}`)) continue;
    bannedCalls.push({
      file: relPath(filePath),
      line: getLine(text, match.index ?? 0),
      call: match[1],
    });
  }
}

const dedupe = (rows, keyFn) => {
  const seen = new Set();
  return rows.filter((row) => {
    const key = keyFn(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const result = {
  summary: {
    routes: routes.size,
    dynamicPrefixes,
    unknownNavigationTargets: unknownNavigationTargets.length,
    deadOnClickHandlers: deadOnClickHandlers.length,
    bannedCalls: bannedCalls.length,
  },
  unknownNavigationTargets: dedupe(unknownNavigationTargets, (row) => `${row.file}:${row.line}:${row.target}`),
  deadOnClickHandlers: dedupe(deadOnClickHandlers, (row) => `${row.file}:${row.line}:${row.snippet}`),
  bannedCalls: dedupe(bannedCalls, (row) => `${row.file}:${row.line}:${row.call}`),
};

const reportsDir = path.join(repoRoot, 'qa', 'reports');
ensureDir(reportsDir);
const outPath = path.join(reportsDir, 'route-action-audit.json');
writeText(outPath, `${JSON.stringify(result, null, 2)}\n`);

console.log(`Route/action audit written to ${relPath(outPath)}`);
console.log(`Unknown navigation targets: ${result.summary.unknownNavigationTargets}`);
console.log(`Dead onClick handlers: ${result.summary.deadOnClickHandlers}`);
console.log(`Banned alert/console.log calls: ${result.summary.bannedCalls}`);

if (
  result.summary.unknownNavigationTargets > 0 ||
  result.summary.deadOnClickHandlers > 0 ||
  result.summary.bannedCalls > 0
) {
  process.exit(1);
}
