import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { replayAgentLedger, normalizePath, overlaps } from './replay-agent-ledger.mjs';

const QUEUE = process.env.FLIXO_SWARM_WORK_QUEUE ?? 'artifacts/ci/agent-coordination/work-queue.json';
const LEDGER = process.env.FLIXO_SWARM_LEDGER ?? 'artifacts/ci/agent-coordination/events.ndjson';
const HEAD = process.env.EXPECTED_HEAD_SHA ?? '';
const fail = (message) => { throw new Error(`Agent work queue validation failed: ${message}`); };
const headSha = HEAD || (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return ''; } })();
if (!headSha) fail('current HEAD unavailable');

const queue = JSON.parse(readFileSync(QUEUE, 'utf8'));
if (queue.schemaVersion !== 2 || queue.protocol !== 'FLIXO agent work queue') fail('schema/protocol mismatch');
if (!Array.isArray(queue.items) || queue.items.length === 0) fail('items must be non-empty');
if (!Number.isInteger(queue.parallelism?.maxReadyPerLane) || queue.parallelism.maxReadyPerLane < 1) fail('parallelism.maxReadyPerLane must be >= 1');

const byId = new Map();
for (const item of queue.items) {
  if (!item || typeof item !== 'object') fail('item must be object');
  if (!/^WQ-[A-Z0-9-]+$/u.test(item.id ?? '')) fail(`invalid item id: ${item.id}`);
  if (byId.has(item.id)) fail(`duplicate item id: ${item.id}`);
  if (!item.title || !item.ownerRole || !item.ownerAgentId) fail(`incomplete ownership on ${item.id}`);
  if (!Array.isArray(item.dependsOn) || !Array.isArray(item.contracts) || !Array.isArray(item.rootCauseIds) || !Array.isArray(item.paths)) fail(`invalid arrays on ${item.id}`);
  if (item.parallelGroup !== undefined && (typeof item.parallelGroup !== 'string' || !item.parallelGroup)) fail(`invalid parallelGroup on ${item.id}`);
  if (item.paths.some((path) => !normalizePath(path))) fail(`empty path on ${item.id}`);
  byId.set(item.id, item);
}

for (const item of queue.items) for (const dep of item.dependsOn) if (dep === item.id || !byId.has(dep)) fail(`unknown/self dependency ${dep} on ${item.id}`);
const visiting = new Set();
const visited = new Set();
const visit = (id) => {
  if (visited.has(id)) return;
  if (visiting.has(id)) fail(`dependency cycle involving ${id}`);
  visiting.add(id);
  for (const dep of byId.get(id).dependsOn) visit(dep);
  visiting.delete(id);
  visited.add(id);
};
for (const item of queue.items) visit(item.id);

const dependsTransitivelyOn = (fromId, targetId, seen = new Set()) => {
  if (seen.has(fromId)) return false;
  seen.add(fromId);
  const item = byId.get(fromId);
  if (!item) return false;
  return item.dependsOn.includes(targetId) || item.dependsOn.some((dep) => dependsTransitivelyOn(dep, targetId, seen));
};
const sequentiallyOrdered = (left, right) => dependsTransitivelyOn(left.id, right.id) || dependsTransitivelyOn(right.id, left.id);

for (let i = 0; i < queue.items.length; i += 1) {
  for (let j = i + 1; j < queue.items.length; j += 1) {
    const left = queue.items[i];
    const right = queue.items[j];
    const sharedContract = left.contracts.some((id) => right.contracts.includes(id));
    const sharedRootCause = left.rootCauseIds.some((id) => right.rootCauseIds.includes(id));
    const sharedPath = left.paths.some((path) => right.paths.some((other) => overlaps(path, other)));
    const overlap = sharedContract || sharedRootCause || sharedPath;
    if (!overlap) continue;
    if (left.parallelGroup && left.parallelGroup === right.parallelGroup) fail(`parallel group contains overlapping scope: ${left.id} <-> ${right.id}`);
    if (left.ownerAgentId !== right.ownerAgentId && !sequentiallyOrdered(left, right)) fail(`concurrent logical ownership collision: ${left.id} <-> ${right.id}`);
  }
}

const state = replayAgentLedger(readFileSync(LEDGER, 'utf8'), { headSha, signingKey: process.env.FLIXO_SWARM_EVENT_SIGNING_KEY ?? '' });
for (const claim of state.claims.values()) {
  if (claim.status !== 'active') continue;
  for (const workItemId of claim.workItemIds ?? []) {
    const item = byId.get(workItemId);
    if (!item) fail(`active claim ${claim.agentId} references unknown work item ${workItemId}`);
    if (item.ownerAgentId !== claim.agentId || item.status !== 'in_progress') fail(`active claim binding mismatch for ${claim.agentId}/${workItemId}`);
    const claimPaths = (claim.scope?.paths ?? []).map(normalizePath);
    for (const itemPath of item.paths.map(normalizePath)) if (!claimPaths.some((path) => overlaps(itemPath, path))) fail(`active claim ${claim.agentId} does not cover ${itemPath}`);
  }
}

for (const item of queue.items) {
  const stateItem = state.workItems.get(item.id);
  if (!stateItem) fail(`queue item ${item.id} absent from ledger`);
  if ((stateItem.status ?? null) !== (item.status ?? null) || (stateItem.ownerAgentId ?? null) !== (item.ownerAgentId ?? null)) fail(`queue projection drift for ${item.id}`);
  if (item.status === 'in_progress') {
    const claim = [...state.claims.values()].find((candidate) => candidate.status === 'active' && (candidate.workItemIds ?? []).includes(item.id));
    if (!claim || claim.agentId !== item.ownerAgentId) fail(`in_progress work item ${item.id} lacks ledger claim binding`);
  }
}

console.log(`Agent work queue PASS: ${queue.items.length} items, acyclic DAG, parallel isolation enforced, ledger-authoritative claim bindings.`);
