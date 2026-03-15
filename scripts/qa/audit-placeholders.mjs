import path from 'node:path';
import { ensureDir, getLine, listFilesRecursive, readText, relPath, repoRoot, writeText } from './fs-utils.mjs';

const files = [
  ...listFilesRecursive(path.join(repoRoot, 'components'), (filePath) => filePath.endsWith('.tsx')),
  ...listFilesRecursive(path.join(repoRoot, 'src'), (filePath) => filePath.endsWith('.ts') || filePath.endsWith('.tsx')),
];

const patterns = [
  { key: 'lorem_ipsum', regex: /lorem ipsum/i },
  { key: 'coming_soon', regex: /coming soon/i },
  { key: 'under_construction', regex: /under construction/i },
  { key: 'placeholder_email', regex: /admin@example\.com/i },
  { key: 'mock_data_label', regex: /mock data/i },
  { key: 'dummy_data_label', regex: /\bdummy\b/i },
];

const allowList = [
  // Import sample rows are expected in import templates.
  { path: 'components/ImportContacts.tsx', pattern: 'dummy_data_label' },
  // HelpCenter references stale/mock data as guidance text.
  { path: 'components/HelpCenter.tsx', pattern: 'mock_data_label' },
];

const findings = [];

for (const filePath of files) {
  const text = readText(filePath);
  for (const pattern of patterns) {
    for (const match of text.matchAll(new RegExp(pattern.regex.source, 'gi'))) {
      const rel = relPath(filePath);
      const line = getLine(text, match.index ?? 0);
      const isAllowed = allowList.some((allow) => allow.path === rel && allow.pattern === pattern.key);
      if (isAllowed) continue;
      findings.push({
        file: rel,
        line,
        pattern: pattern.key,
        snippet: String(match[0]),
      });
    }
  }
}

const result = {
  summary: {
    scannedFiles: files.length,
    findings: findings.length,
  },
  findings,
};

const reportsDir = path.join(repoRoot, 'qa', 'reports');
ensureDir(reportsDir);
const outPath = path.join(reportsDir, 'placeholder-audit.json');
writeText(outPath, `${JSON.stringify(result, null, 2)}\n`);

console.log(`Placeholder audit written to ${relPath(outPath)}`);
console.log(`Findings: ${findings.length}`);

if (findings.length > 0) {
  process.exit(1);
}
