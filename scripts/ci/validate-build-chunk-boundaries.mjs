#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

const ROOT = process.cwd();
const ASSETS = join(ROOT, 'dist', 'assets');

if (!existsSync(ASSETS)) {
  console.error('BUILD CHUNK BOUNDARY: FAIL');
  console.error('dist/assets does not exist; this validator must run after the production build.');
  process.exit(1);
}

const jsFiles = readdirSync(ASSETS, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
  .map((entry) => entry.name)
  .sort();

if (jsFiles.length === 0) {
  console.error('BUILD CHUNK BOUNDARY: FAIL');
  console.error('No emitted JavaScript chunks found in dist/assets.');
  process.exit(1);
}

const files = new Set(jsFiles);
const graph = new Map(jsFiles.map((file) => [file, []]));
const internalRef = /(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g;
const dynamicRef = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

function resolveInternal(fromFile, reference) {
  if (!reference.startsWith('.')) return null;
  const path = posix.normalize(posix.join(posix.dirname(fromFile), reference));
  const normalized = path.startsWith('./') ? path.slice(2) : path;
  if (files.has(normalized)) return normalized;
  return null;
}

for (const file of jsFiles) {
  const source = readFileSync(join(ASSETS, file), 'utf8');
  const edges = [];
  const seen = new Set();

  for (const match of source.matchAll(internalRef)) {
    const target = resolveInternal(file, match[1]);
    if (!target) continue;
    const key = `static:${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ target, kind: 'static' });
  }

  for (const match of source.matchAll(dynamicRef)) {
    const target = resolveInternal(file, match[1]);
    if (!target) continue;
    const key = `dynamic:${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ target, kind: 'dynamic' });
  }

  graph.set(file, edges);
}

const state = new Map(jsFiles.map((file) => [file, 0]));
const stack = [];
const edgeStack = [];
const cycles = [];

function visit(node) {
  const current = state.get(node);
  if (current === 2) return;
  if (current === 1) return;

  state.set(node, 1);
  stack.push(node);

  for (const edge of graph.get(node) ?? []) {
    if (state.get(edge.target) === 1) {
      const start = stack.indexOf(edge.target);
      const nodes = [...stack.slice(start), edge.target];
      const cycleEdges = [];
      for (let i = start; i < stack.length - 1; i += 1) {
        const source = stack[i];
        const next = stack[i + 1];
        cycleEdges.push((graph.get(source) ?? []).find((candidate) => candidate.target === next));
      }
      cycleEdges.push(edge);
      cycles.push({ nodes, edges: cycleEdges.filter(Boolean) });
      continue;
    }
    if (state.get(edge.target) === 0) visit(edge.target);
  }

  stack.pop();
  state.set(node, 2);
}

for (const file of jsFiles) visit(file);

const uniqueCycles = [];
const cycleKeys = new Set();
for (const cycle of cycles) {
  const hasStatic = cycle.edges.some((edge) => edge.kind === 'static');
  if (!hasStatic) continue;
  const key = [...cycle.nodes].sort().join('|');
  if (cycleKeys.has(key)) continue;
  cycleKeys.add(key);
  uniqueCycles.push(cycle);
}

const staticEdgeCount = [...graph.values()].reduce((total, edges) => total + edges.filter((edge) => edge.kind === 'static').length, 0);
const dynamicEdgeCount = [...graph.values()].reduce((total, edges) => total + edges.filter((edge) => edge.kind === 'dynamic').length, 0);

if (uniqueCycles.length > 0) {
  console.error('BUILD CHUNK BOUNDARY: FAIL');
  console.error(`chunks=${jsFiles.length} staticEdges=${staticEdgeCount} dynamicEdges=${dynamicEdgeCount}`);
  for (const [index, cycle] of uniqueCycles.entries()) {
    console.error(`CYCLE_${index + 1}=${cycle.nodes.join(' -> ')}`);
    console.error(`EDGE_TYPES_${index + 1}=${cycle.edges.map((edge) => edge.kind).join(' -> ')}`);
  }
  console.error('A lazy/shared chunk must not resolve back into an entry path through a cycle.');
  process.exit(1);
}

console.log('BUILD CHUNK BOUNDARY: PASS');
console.log(`chunks=${jsFiles.length}`);
console.log(`staticEdges=${staticEdgeCount}`);
console.log(`dynamicEdges=${dynamicEdgeCount}`);
console.log('No emitted chunk dependency cycle containing a static edge was found.');
