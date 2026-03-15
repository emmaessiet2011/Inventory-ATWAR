import fs from 'node:fs';
import path from 'node:path';

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  '.app-config',
  'coverage',
]);

export const repoRoot = process.cwd();

export const readText = (filePath) => fs.readFileSync(filePath, 'utf8');

export const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

export const writeText = (filePath, content) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
};

export const listFilesRecursive = (dirPath, predicate, acc = []) => {
  if (!fs.existsSync(dirPath)) return acc;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      listFilesRecursive(fullPath, predicate, acc);
      continue;
    }
    if (!predicate || predicate(fullPath)) acc.push(fullPath);
  }
  return acc;
};

export const toPosix = (filePath) => filePath.replaceAll(path.sep, '/');

export const relPath = (filePath) => toPosix(path.relative(repoRoot, filePath));

export const getLine = (text, index) => text.slice(0, index).split('\n').length;
