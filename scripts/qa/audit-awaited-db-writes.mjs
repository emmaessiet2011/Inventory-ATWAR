import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { listFilesRecursive, repoRoot } from './fs-utils.mjs';

const srcRoot = path.join(repoRoot, 'src');

const WRITE_FUNCTIONS = new Set([
  'syncRecordStrict',
  'deleteRecordStrict',
  'syncDedicatedStrict',
  'deleteDedicatedStrict',
  'syncStockDeltaStrict',
  'writeStockTransfers',
  'writeStockAdjustments',
  'writeStockLotBalances',
  'appendStockLedgerEntries',
  'setActiveRegisterSession',
  'setRegisterSessions',
  'setRegisterTransactions',
  'upsertRegisterSession',
  'addRegisterTransaction',
  'deleteRegisterTransaction',
  'applyStockLotAdjustments',
]);

const rel = (filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/');

const isPromiseAggregator = (node) => (
  ts.isCallExpression(node)
  && ts.isPropertyAccessExpression(node.expression)
  && ts.isIdentifier(node.expression.expression)
  && node.expression.expression.text === 'Promise'
  && ['all', 'allSettled'].includes(node.expression.name.text)
);

const isSafelyAwaited = (callNode) => {
  let parent = callNode.parent;
  while (parent && ts.isParenthesizedExpression(parent)) parent = parent.parent;

  if (!parent) return false;
  if (ts.isAwaitExpression(parent)) return true;
  if (ts.isReturnStatement(parent)) return true;

  if (ts.isArrayLiteralExpression(parent) && parent.parent && isPromiseAggregator(parent.parent)) {
    return true;
  }

  // Allow forwarding a promise through variable initialization only when awaited immediately.
  if (ts.isVariableDeclaration(parent) && parent.parent && parent.parent.parent && parent.parent.parent.parent) {
    const block = parent.parent.parent.parent;
    if (ts.isBlock(block)) {
      const idx = block.statements.findIndex((stmt) => stmt.getStart() === parent.parent.parent.getStart());
      const next = idx >= 0 ? block.statements[idx + 1] : undefined;
      if (
        next
        && ts.isExpressionStatement(next)
        && ts.isAwaitExpression(next.expression)
      ) {
        return true;
      }
    }
  }

  return false;
};

const files = listFilesRecursive(srcRoot, (filePath) => /\.(ts|tsx)$/.test(filePath));
const failures = [];

for (const filePath of files) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      let callName = '';
      if (ts.isIdentifier(node.expression)) {
        callName = node.expression.text;
      } else if (ts.isPropertyAccessExpression(node.expression)) {
        callName = node.expression.name.text;
      }
      if (WRITE_FUNCTIONS.has(callName) && !isSafelyAwaited(node)) {
        const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        failures.push(
          `${rel(filePath)}:${pos.line + 1}:${pos.character + 1} ${callName} must be awaited or returned`,
        );
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

if (failures.length > 0) {
  console.error('\nAwaited DB write audit failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Awaited DB write audit passed.');
