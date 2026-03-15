/**
 * Add gradient accent bars to all rounded-[2rem] cards that are missing them.
 * Run: node scripts/add-gradient-bars.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const componentsDir = new URL('../components/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

// Skip utility/non-page components
const SKIP = new Set([
  'Login.tsx', 'Sidebar.tsx', 'MultiSelect.tsx', 'DateRangeFilter.tsx',
  'InvoiceURLModal.tsx', 'PackingSlip.tsx', 'PrintLabels.tsx', 'DeliveryNote.tsx',
  'BackupRestore.tsx', 'POS.tsx', 'OpenRegister.tsx', 'HelpCenter.tsx',
]);

const files = readdirSync(componentsDir).filter(f => f.endsWith('.tsx') && !SKIP.has(f));

// Gradient bar patterns - different colors for different contexts
// We'll use slate for main table cards and blue→indigo for filter/form cards
const DARK_BAR = `<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>`;
const BLUE_BAR = `<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>`;

let totalChanges = 0;

for (const filename of files) {
  const filePath = join(componentsDir, filename);
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    continue;
  }

  if (!content.includes('rounded-[2rem]')) continue;

  // Find rounded-[2rem] divs that have `relative` or `overflow-hidden` but no gradient bar yet
  // We use a careful approach: look for className="...rounded-[2rem]..."> not followed by gradient bar
  let changed = false;
  const lines = content.split('\n');
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    newLines.push(lines[i]);

    const line = lines[i];
    const nextLine = lines[i + 1] || '';

    // Check if this line opens a rounded-[2rem] card
    if (
      line.includes('rounded-[2rem]') &&
      line.includes('className=') &&
      line.includes('>') &&
      !line.includes('/>') && // not self-closing
      !line.includes('button') && // not a button
      !line.includes('rounded-[2rem] shadow-2xl') && // not a modal overlay
      !line.includes('modal') &&
      !nextLine.includes('absolute top-0 left-0 w-full h-1') // no existing gradient
    ) {
      // Detect indentation of next line
      const nextIndent = nextLine.match(/^(\s*)/)?.[1] || '        ';
      // Choose bar color: dark for overflow-hidden table cards, blue for filter/form cards
      const isTableCard = line.includes('overflow-hidden') || line.includes('flex flex-col');
      const bar = isTableCard ? DARK_BAR : BLUE_BAR;
      newLines.push(`${nextIndent}${bar}`);
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(filePath, newLines.join('\n'), 'utf8');
    console.log(`✓ ${filename}`);
    totalChanges++;
  }
}

console.log(`\nAdded gradient bars to ${totalChanges} files.`);
