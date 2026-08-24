import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const INCLUDED = new Set(['src', 'scripts', 'tests']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')))) files.push(full);
  }
  return files;
}

const files = [];
for (const root of INCLUDED) files.push(...await walk(join(ROOT, root)));

const metrics = [];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  const lines = text.split(/\r?\n/).length;
  const imports = [...text.matchAll(/\bimport\s+(?:type\s+)?[\s\S]*?\sfrom\s+['\"]([^'\"]+)['\"];?/g)].length;
  const conditions = (text.match(/\b(if|else if|switch|case|catch|\?|&&|\|\|)\b/g) ?? []).length;
  const exports = (text.match(/\bexport\s+(?:default\s+)?(?:const|function|class|type|interface|\{)/g) ?? []).length;
  const duplicateImports = new Map();
  for (const match of text.matchAll(/\bimport\s+[\s\S]*?\sfrom\s+['\"]([^'\"]+)['\"];?/g)) {
    const source = match[1];
    duplicateImports.set(source, (duplicateImports.get(source) ?? 0) + 1);
  }
  const duplicateImportCount = [...duplicateImports.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0);
  metrics.push({ file: relative(ROOT, file).replaceAll('\\', '/'), lines, imports, conditions, exports, duplicateImportCount });
}

const top = [...metrics]
  .sort((a, b) => (b.conditions + b.lines / 50) - (a.conditions + a.lines / 50))
  .slice(0, 25);

const totals = metrics.reduce((acc, item) => {
  acc.files += 1;
  acc.lines += item.lines;
  acc.imports += item.imports;
  acc.conditions += item.conditions;
  acc.duplicateImports += item.duplicateImportCount;
  return acc;
}, { files: 0, lines: 0, imports: 0, conditions: 0, duplicateImports: 0 });

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), totals, hotspots: top }, null, 2));
