import { readFileSync } from 'node:fs';

const queuePath = '.ci/agent-coordination/work-queue.json';
const claimsPath = '.ci/agent-coordination/claims.json';
const queue = JSON.parse(readFileSync(queuePath, 'utf8'));
const claims = JSON.parse(readFileSync(claimsPath, 'utf8'));
const fail = (message) => { throw new Error(`Agent work queue validation failed: ${message}`); };
if (queue.schemaVersion !== 2 || queue.protocol !== 'FLIXO agent work queue') fail('schema/protocol mismatch');
if (!Array.isArray(queue.items) || queue.items.length === 0) fail('items must be non-empty');
if (!Number.isInteger(queue.parallelism?.maxReadyPerLane) || queue.parallelism.maxReadyPerLane < 1) fail('parallelism.maxReadyPerLane must be >= 1');
const ids = new Set();
const byId = new Map();
for (const item of queue.items) {
  if (!item || typeof item !== 'object') fail('item must be object');
  if (!/^WQ-[A-Z0-9-]+$/u.test(item.id ?? '')) fail(`invalid item id: ${item.id}`);
  if (ids.has(item.id)) fail(`duplicate item id: ${item.id}`);
  ids.add(item.id); byId.set(item.id, item);
  if (!item.title || !item.ownerRole || !item.ownerAgentId) fail(`incomplete ownership on ${item.id}`);
  if (!Array.isArray(item.dependsOn) || !Array.isArray(item.contracts) || !Array.isArray(item.rootCauseIds)) fail(`invalid arrays on ${item.id}`);
  if (item.parallelGroup !== undefined && (typeof item.parallelGroup !== 'string' || !item.parallelGroup)) fail(`invalid parallelGroup on ${item.id}`);
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
    if (item.parallelGroup && item.parallelGroup === other.parallelGroup && (sharedContract || sharedRootCause)) fail(`parallel group contains overlapping logical scope: ${item.id} <-> ${other.id}`);
  }
}
const claimByAgent = new Map((claims.claims ?? []).map((claim) => [claim.agentId, claim]));
const claimedItems = new Map();
for (const claim of claims.claims ?? []) {
  for (const workItemId of claim.workItemIds ?? []) {
    if (!byId.has(workItemId)) fail(`claim ${claim.agentId} references unknown work item ${workItemId}`);
    if (claimedItems.has(workItemId) && claimedItems.get(workItemId) !== claim.agentId) fail(`work item ${workItemId} claimed by multiple agents`);
    claimedItems.set(workItemId, claim.agentId);
    if (claim.status === 'active') {
      const item = byId.get(workItemId);
      if (item.ownerAgentId !== claim.agentId) fail(`active claim ${claim.agentId} does not match owner of ${workItemId}`);
    }
  }
}
for (const item of queue.items) {
  if (!['in_progress', 'blocked_by_ci', 'ready'].includes(item.status)) continue;
  const claimAgent = claimedItems.get(item.id);
  if (item.status === 'in_progress' && claimAgent !== item.ownerAgentId) fail(`in_progress work item ${item.id} has no matching claim`);
}
for (const [agentId, claim] of claimByAgent) {
  if (!Array.isArray(claim.workItemIds ?? [])) fail(`claim ${agentId}.workItemIds must be an array`);
}
console.log(`Agent work queue PASS: ${queue.items.length} items, acyclic DAG, claim bindings coherent, parallel lanes safe.`);
