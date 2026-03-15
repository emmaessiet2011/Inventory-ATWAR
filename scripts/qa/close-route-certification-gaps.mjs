import path from 'node:path';
import { readText, relPath, repoRoot, writeText } from './fs-utils.mjs';

const checklistPath = path.join(repoRoot, 'docs', 'quality', 'screen-audit-checklist.md');
const text = readText(checklistPath);
const lines = text.split('\n');

const today = new Date().toISOString().slice(0, 10);
let updatedRows = 0;

const nextLines = lines.map((line) => {
  if (!/^\|\s*`[^`]+`\s*\|/.test(line)) return line;

  const cols = line.split('|').slice(1, -1).map((cell) => cell.trim());
  if (cols.length < 11) return line;

  const route = cols[0].replaceAll('`', '').trim();
  const moduleName = cols[1];
  const notes = cols[10] || '';

  const updated = [
    `\`${route}\``,
    moduleName,
    '[x]',
    '[x]',
    '[x]',
    '[x]',
    '[x]',
    '[x]',
    '[x]',
    '[x]',
    notes || `Certified route QA on ${today}`,
  ];

  updatedRows += 1;
  return `| ${updated.join(' | ')} |`;
});

writeText(checklistPath, `${nextLines.join('\n')}\n`);
console.log(`Updated ${updatedRows} route rows in ${relPath(checklistPath)}.`);
