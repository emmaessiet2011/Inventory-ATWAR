/**
 * Apply AddProduct icon-box header theme to remaining list/specialized pages.
 * Run: node scripts/theme-lists.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const componentsDir = new URL('../components/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

const pageConfigs = [
  {
    file: 'ListStockAdjustments.tsx',
    icon: 'SlidersHorizontal',
    oldHeader: '<h2 className="text-2xl font-bold text-slate-900">Stock Adjustments</h2>',
    newHeader: `<div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
            <SlidersHorizontal size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Stock Adjustments</h2>
            <p className="text-slate-500 text-sm mt-0.5">Add or deduct stock quantities</p>
          </div>
        </div>`,
    buttonOld: `className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-1 shadow-sm transition-all"`,
    buttonNew: `className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md active:scale-95 transition"`,
  },
  {
    file: 'ListStockTransfers.tsx',
    icon: 'ArrowLeftRight',
    oldHeader: '<h2 className="text-2xl font-bold text-slate-900">Stock Transfers</h2>',
    newHeader: `<div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
            <ArrowLeftRight size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Stock Transfers</h2>
            <p className="text-slate-500 text-sm mt-0.5">Transfer stock between locations</p>
          </div>
        </div>`,
    buttonOld: `className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-1 shadow-sm transition-all"`,
    buttonNew: `className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md active:scale-95 transition"`,
  },
  {
    file: 'Shipments.tsx',
    icon: 'Truck',
    oldHeader: '<h2 className="text-2xl font-bold text-slate-900">Shipments</h2>',
    newHeader: `<div className="flex items-center gap-4">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <Truck size={24} className="text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Shipments</h2>
          <p className="text-slate-500 text-sm mt-0.5">Track delivery status and shipping details</p>
        </div>
      </div>`,
    // Also fix old filter card style
    filterOld: `<div className="bg-white rounded shadow-sm border border-slate-200 p-4">`,
    filterNew: `<div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>`,
  },
];

function ensureIconImport(content, icon) {
  const importLineMatch = content.match(/^import \{([^}]+)\} from 'lucide-react';/m);
  if (!importLineMatch) return content;
  const currentIcons = importLineMatch[1];
  if (currentIcons.includes(icon)) return content;
  const newImports = currentIcons.trimEnd() + `, ${icon}`;
  return content.replace(importLineMatch[0], `import {${newImports}} from 'lucide-react';`);
}

for (const config of pageConfigs) {
  const filePath = join(componentsDir, config.file);
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    console.warn(`⚠ Could not read ${config.file}`);
    continue;
  }

  let changed = false;

  // Ensure icon import
  const before = content;
  content = ensureIconImport(content, config.icon);
  if (content !== before) changed = true;

  // Replace header
  if (config.oldHeader && content.includes(config.oldHeader)) {
    content = content.replace(config.oldHeader, config.newHeader);
    changed = true;
  }

  // Replace button style
  if (config.buttonOld && config.buttonNew && content.includes(config.buttonOld)) {
    content = content.replace(config.buttonOld, config.buttonNew);
    changed = true;
  }

  // Fix filter card style
  if (config.filterOld && config.filterNew && content.includes(config.filterOld)) {
    content = content.replace(config.filterOld, config.filterNew);
    changed = true;
  }

  // Add gradient bars to rounded-[2rem] cards without them
  const gradientBar = `<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>`;
  const filterGradient = `<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>`;

  const newContent = content.replace(
    /(className="[^"]*rounded-\[2rem\][^"]*relative[^"]*overflow-hidden[^"]*">)\s*(?!<div className="absolute)/g,
    (match, group1) => `${group1}\n        ${gradientBar}\n`
  );
  if (newContent !== content) {
    content = newContent;
    changed = true;
  }

  if (changed) {
    writeFileSync(filePath, content, 'utf8');
    console.log(`✓ ${config.file}`);
  } else {
    console.log(`- ${config.file} (no changes)`);
  }
}

// Also handle Expenses page header
const expensesPath = join(componentsDir, 'Expenses.tsx');
try {
  let content = readFileSync(expensesPath, 'utf8');
  let changed = false;

  // Check if it needs header update
  const headerMatch = content.match(/<h[12][^>]*>Expenses<\/h[12]>/);
  if (headerMatch) {
    // Make sure Receipt is imported
    content = ensureIconImport(content, 'Receipt');
    content = content.replace(headerMatch[0], `<div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
            <Receipt size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Expenses</h2>
            <p className="text-slate-500 text-sm mt-0.5">Track and manage business expenses</p>
          </div>
        </div>`);
    changed = true;
  }

  if (changed) {
    writeFileSync(expensesPath, content, 'utf8');
    console.log('✓ Expenses.tsx');
  }
} catch { /* skip */ }

console.log('\nDone!');
