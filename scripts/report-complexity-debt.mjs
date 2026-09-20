import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const INCLUDED = ['src', 'scripts', 'tests'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else {
      const dot = entry.name.lastIndexOf('.');
      if (dot !== -1 && EXTENSIONS.has(entry.name.slice(dot))) files.push(full);
    }
  }
  return files;
}

const files = (await Promise.all(INCLUDED.map((dir) => walk(join(ROOT, dir)))).then((groups) => groups.flat()));
const metrics = [];

for (const file of files) {
  const text = await readFile(file, 'utf8');
  const importsBySource = new Map();
  let imports = 0;
  for (const match of text.matchAll(/\bimport\s+[\s\S]*?\sfrom\s+['"]([^'"]+)['"];?/g)) {
    imports += 1;
    importsBySource.set(match[1], (importsBySource.get(match[1]) ?? 0) + 1);
  }

  const conditions = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bswitch\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /\?\?/g,
    /\?\.(?![?.])/g,
    /&&/g,
    /\|\|/g,
  ].reduce((total, pattern) => total + (text.match(pattern) ?? []).length, 0);

  const exports = (text.match(/\bexport\s+(?:default\s+)?(?:const|function|class|type|interface|\{)/g) ?? []).length;
  const duplicateImportCount = [...importsBySource.values()]
    .filter((count) => count > 1)
    .reduce((sum, count) => sum + count - 1, 0);
  const lines = text.split(/\r?\n/).length;
  const filePath = relative(ROOT, file).replaceAll('\\', '/');
  const score = Number((conditions + lines / 50 + imports / 20 + duplicateImportCount * 2).toFixed(2));

  metrics.push({ file: filePath, lines, imports, conditions, exports, duplicateImportCount, score });
}

const totals = metrics.reduce((acc, item) => ({
  files: acc.files + 1,
  lines: acc.lines + item.lines,
  imports: acc.imports + item.imports,
  conditions: acc.conditions + item.conditions,
  exports: acc.exports + item.exports,
  duplicateImports: acc.duplicateImports + item.duplicateImportCount,
}), { files: 0, lines: 0, imports: 0, conditions: 0, exports: 0, duplicateImports: 0 });

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  roots: INCLUDED,
  totals,
  hotspots: [...metrics].sort((a, b) => b.score - a.score).slice(0, 25),
}, null, 2));
