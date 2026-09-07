import { readFileSync } from 'node:fs';

const path = '.ci/agent-coordination/work-queue.json';
const queue = JSON.parse(readFileSync(path, 'utf8'));
const fail = (message) => { throw new Error(`Agent work queue validation failed: ${message}`); };
if (queue.schemaVersion !== 1 || queue.protocol !== 'FLIXO agent work queue') fail('schema/protocol mismatch');
if (!Array.isArray(queue.items) || queue.items.length === 0) fail('items must be non-empty');
const ids = new Set();
const byId = new Map();
for (const item of queue.items) {
  if (!item || typeof item !== 'object') fail('item must be object');
  if (!/^WQ-[A-Z0-9-]+$/u.test(item.id ?? '')) fail(`invalid item id: ${item.id}`);
  if (ids.has(item.id)) fail(`duplicate item id: ${item.id}`);
  ids.add(item.id); byId.set(item.id, item);
  if (!item.title || !item.ownerRole || !item.ownerAgentId) fail(`incomplete ownership on ${item.id}`);
  if (!Array.isArray(item.dependsOn) || !Array.isArray(item.contracts) || !Array.isArray(item.rootCauseIds)) fail(`invalid arrays on ${item.id}`);
}
for (const item of queue.items) for (const dep of item.dependsOn) if (dep === item.id || !byId.has(dep)) fail(`unknown/self dependency ${dep} on ${item.id}`);
const visiting = new Set(); const visited = new Set();
const visit = (id) => {
  if (visited.has(id)) return;
  if (visiting.has(id)) fail(`dependency cycle involving ${id}`);
  visiting.add(id);
  for (const dep of byId.get(id).dependsOn) visit(dep);
  visiting.delete(id); visited.add(id);
};
for (const item of queue.items) visit(item.id);
for (const item of queue.items) {
  for (const other of queue.items) if (item.id !== other.id) {
    const sharedContract = item.contracts.some((id) => other.contracts.includes(id));
    const sharedRootCause = item.rootCauseIds.some((id) => other.rootCauseIds.includes(id));
    if ((sharedContract || sharedRootCause) && item.ownerAgentId !== other.ownerAgentId) fail(`logical ownership collision: ${item.id} <-> ${other.id}`);
  }
}
console.log(`Agent work queue PASS: ${queue.items.length} work items, dependency graph acyclic, logical ownership coherent.`);
