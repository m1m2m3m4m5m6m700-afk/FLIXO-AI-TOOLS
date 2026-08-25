import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const definitionsDir = 'src/config/tool-definitions';
const requiredFamilies = ['image.ts', 'pdf.ts', 'audio.ts', 'video.ts', 'ai.ts', 'other.ts'];
const files = readdirSync(definitionsDir).filter((name) => name.endsWith('.ts') && name !== 'types.ts');

const missingFamilies = requiredFamilies.filter((name) => !files.includes(name));
if (missingFamilies.length) {
  console.error(`Tool registry contract failed: missing family files: ${missingFamilies.join(', ')}`);
  process.exit(1);
}

const entries = [];
for (const file of files) {
  const source = readFileSync(join(definitionsDir, file), 'utf8');
  for (const match of source.matchAll(/\{ id: '([^']+)', title: '([^']+)', path: '([^']+)',[\s\S]*?isReady: (true|false),/g)) {
    entries.push({ id: match[1], title: match[2], path: match[3], file });
  }
}

if (entries.length === 0) {
  console.error('Tool registry contract failed: no family tool definitions discovered.');
  process.exit(1);
}

const ids = entries.map(({ id }) => id);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) {
  console.error(`Tool registry contract failed: duplicate ids: ${[...new Set(duplicates)].join(', ')}`);
  process.exit(1);
}

const paths = entries.map(({ path }) => path);
const duplicatePaths = paths.filter((path, index) => paths.indexOf(path) !== index);
if (duplicatePaths.length) {
  console.error(`Tool registry contract failed: duplicate paths: ${[...new Set(duplicatePaths)].join(', ')}`);
  process.exit(1);
}

for (const { id, title, path, file } of entries) {
  if (!title.trim()) {
    console.error(`Tool registry contract failed: ${id} in ${file} has an empty title.`);
    process.exit(1);
  }
  if (!path.startsWith('/en/') || path.length <= 4) {
    console.error(`Tool registry contract failed: ${id} in ${file} has an invalid canonical path: ${path}`);
    process.exit(1);
  }
}

console.log(`Tool registry contract passed: ${entries.length} unique tools across ${files.length} family files with canonical IDs, titles, and /en/ paths.`);
