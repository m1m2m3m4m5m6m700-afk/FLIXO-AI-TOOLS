import { existsSync, readFileSync } from 'node:fs';

const canonicalPath = 'src/config/canonical-tool-definition.ts';
const legacyPath = 'src/config/tool-definitions/image.ts';

if (!existsSync(canonicalPath)) {
  console.error(`Tool registry contract failed: canonical source missing: ${canonicalPath}`);
  process.exit(1);
}

if (existsSync(legacyPath)) {
  console.error(`Tool registry contract failed: legacy image family source remains: ${legacyPath}`);
  process.exit(1);
}

const source = readFileSync(canonicalPath, 'utf8');
const inventoryMatch = source.match(/const IMAGE_TOOL_CONFIGS:[\s\S]*?Object\.freeze\(\[(?<entries>[\s\S]*?)\]\);/);
if (!inventoryMatch?.groups?.entries) {
  console.error('Tool registry contract failed: canonical image inventory block not found.');
  process.exit(1);
}

const entries = [];
for (const match of inventoryMatch.groups.entries.matchAll(/\{ id: '([^']+)', title: '([^']+)', path: '([^']+)', description: '([^']+)', category: '([^']+)', isReady: (true|false),/g)) {
  entries.push({ id: match[1], title: match[2], path: match[3], description: match[4], category: match[5], isReady: match[6] === 'true' });
}

const expectedToolCount = 22;
const expectedReadyCount = 21;
const expectedUnavailableCount = 1;
if (entries.length !== expectedToolCount) {
  console.error(`Tool registry contract failed: expected ${expectedToolCount} canonical image tools, discovered ${entries.length}.`);
  process.exit(1);
}

const ids = entries.map(({ id }) => id);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) {
  console.error(`Tool registry contract failed: duplicate canonical IDs: ${[...new Set(duplicates)].join(', ')}`);
  process.exit(1);
}

const paths = entries.map(({ path }) => path);
const duplicatePaths = paths.filter((path, index) => paths.indexOf(path) !== index);
if (duplicatePaths.length) {
  console.error(`Tool registry contract failed: duplicate canonical paths: ${[...new Set(duplicatePaths)].join(', ')}`);
  process.exit(1);
}

const readyCount = entries.filter(({ isReady }) => isReady).length;
const unavailableCount = entries.length - readyCount;
if (readyCount !== expectedReadyCount || unavailableCount !== expectedUnavailableCount) {
  console.error(`Tool registry contract failed: readiness mismatch (expected ${expectedReadyCount} ready/${expectedUnavailableCount} unavailable, actual ${readyCount}/${unavailableCount}).`);
  process.exit(1);
}

for (const { id, title, description, category, path } of entries) {
  if (!title.trim() || !description.trim()) {
    console.error(`Tool registry contract failed: ${id} has empty title or description.`);
    process.exit(1);
  }
  if (category !== 'Images') {
    console.error(`Tool registry contract failed: ${id} is outside the Images family.`);
    process.exit(1);
  }
  if (!path.startsWith('/en/') || path.length <= 4) {
    console.error(`Tool registry contract failed: ${id} has an invalid canonical path: ${path}`);
    process.exit(1);
  }
}

const unavailableIds = entries.filter(({ isReady }) => !isReady).map(({ id }) => id);
if (unavailableIds.length !== 1 || unavailableIds[0] !== 'photo-colorizer') {
  console.error(`Tool registry contract failed: expected only photo-colorizer to be unavailable; actual: ${unavailableIds.join(', ') || 'none'}.`);
  process.exit(1);
}

console.log(`Canonical tool registry contract passed: ${entries.length} unique tools (${readyCount} ready, ${unavailableCount} unavailable) with canonical IDs, titles, descriptions, category, and /en/ paths.`);
