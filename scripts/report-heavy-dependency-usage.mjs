import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = 'src';
const reportDir = 'diagnostics';
const reportPath = join(reportDir, 'heavy-dependency-usage.json');

const heavyDependencies = [
  '@ffmpeg/core',
  '@ffmpeg/ffmpeg',
  'pdfjs-dist',
  'pdf-lib',
  'jspdf',
  'jszip',
  'docx',
  'marked',
  'motion',
  'gif.js',
  'gifuct-js',
];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const staticImportPattern = /(^|[\n\r])\s*import\s+(?!\()(?:(?:[^'"`]*?)\s+from\s+)?['"]([^'"]+)['"]/gm;
const dynamicImportPattern = /import\(\s*['"]([^'"]+)['"]\s*\)/gm;

const usage = Object.fromEntries(
  heavyDependencies.map((dependency) => [
    dependency,
    { staticImports: [], dynamicImports: [] },
  ]),
);

for (const file of walk(root)) {
  const source = readFileSync(file, 'utf8');
  const relativePath = relative('.', file).replaceAll('\\', '/');

  for (const match of source.matchAll(staticImportPattern)) {
    const specifier = match[2];
    const dependency = heavyDependencies.find(
      (candidate) => specifier === candidate || specifier.startsWith(`${candidate}/`),
    );
    if (dependency) usage[dependency].staticImports.push(relativePath);
  }

  for (const match of source.matchAll(dynamicImportPattern)) {
    const specifier = match[1];
    const dependency = heavyDependencies.find(
      (candidate) => specifier === candidate || specifier.startsWith(`${candidate}/`),
    );
    if (dependency) usage[dependency].dynamicImports.push(relativePath);
  }
}

for (const entry of Object.values(usage)) {
  entry.staticImports = [...new Set(entry.staticImports)].sort();
  entry.dynamicImports = [...new Set(entry.dynamicImports)].sort();
}

const summary = Object.entries(usage).map(([dependency, entry]) => ({
  dependency,
  staticImportCount: entry.staticImports.length,
  dynamicImportCount: entry.dynamicImports.length,
  staticImports: entry.staticImports,
  dynamicImports: entry.dynamicImports,
}));

mkdirSync(reportDir, { recursive: true });
writeFileSync(
  reportPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), summary }, null, 2)}\n`,
  'utf8',
);

console.log('Heavy dependency usage inventory');
for (const entry of summary) {
  console.log(
    `${entry.dependency}: static=${entry.staticImportCount} dynamic=${entry.dynamicImportCount}`,
  );
  for (const file of entry.staticImports) console.log(`  static  ${file}`);
  for (const file of entry.dynamicImports) console.log(`  dynamic ${file}`);
}
