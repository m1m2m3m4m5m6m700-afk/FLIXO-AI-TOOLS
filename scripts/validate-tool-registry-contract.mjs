import { readFileSync } from 'node:fs';

const source = readFileSync('src/config/tool-definitions.ts', 'utf8');
const entries = [...source.matchAll(/\{ id: '([^']+)', title: '([^']+)', path: '([^']+)',[\s\S]*?isReady: (true|false),/g)];

if (entries.length === 0) {
  console.error('Tool registry contract failed: no tool definition entries discovered.');
  process.exit(1);
}

const ids = entries.map(([, id]) => id);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) {
  console.error(`Tool registry contract failed: duplicate ids: ${[...new Set(duplicates)].join(', ')}`);
  process.exit(1);
}

for (const [, id, title, path] of entries) {
  if (!title.trim()) {
    console.error(`Tool registry contract failed: ${id} has an empty title.`);
    process.exit(1);
  }
  if (!path.startsWith('/en/') || path.length <= 4) {
    console.error(`Tool registry contract failed: ${id} has an invalid canonical path: ${path}`);
    process.exit(1);
  }
}

console.log(`Tool registry contract passed: ${entries.length} unique tools with canonical IDs, titles, and /en/ paths.`);
