import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { replayAgentLedger } from './replay-agent-ledger.mjs';

const LEDGER = process.env.FLIXO_SWARM_LEDGER ?? 'artifacts/ci/agent-coordination/events.ndjson';
const QUEUE = process.env.FLIXO_SWARM_WORK_QUEUE ?? '.ci/agent-coordination/work-queue.json';
const fail = (message) => { throw new Error(`SWARM_STATE_INVALID: ${message}`); };
const headSha = process.env.EXPECTED_HEAD_SHA ?? (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return ''; } })();
if (!headSha) fail('current HEAD unavailable');

const state = replayAgentLedger(readFileSync(LEDGER, 'utf8'), { headSha, signingKey: process.env.FLIXO_SWARM_EVENT_SIGNING_KEY ?? '' });
const queue = JSON.parse(readFileSync(QUEUE, 'utf8'));
if (queue.schemaVersion !== 2 || queue.protocol !== 'FLIXO agent work queue' || !Array.isArray(queue.items)) fail('queue schema invalid');
const queueById = new Map(queue.items.map((item) => [item.id, item]));

for (const item of queue.items) {
  const stateItem = state.workItems.get(item.id);
  if (!stateItem) fail(`queue item ${item.id} absent from ledger`);
  if ((stateItem.status ?? null) !== (item.status ?? null) || (stateItem.ownerAgentId ?? null) !== (item.ownerAgentId ?? null)) fail(`queue projection drift for ${item.id}`);
  for (const dep of item.dependsOn ?? []) {
    if (!queueById.has(dep)) fail(`unknown dependency ${dep} for ${item.id}`);
    const depItem = queueById.get(dep);
    if (['in_progress', 'ready'].includes(item.status) && depItem.status !== 'completed') fail(`dependency ${dep} not complete for ${item.id}`);
  }
}

for (const claim of state.claims.values()) {
  if (claim.status !== 'active') continue;
  for (const workItemId of claim.workItemIds ?? []) {
    const item = state.workItems.get(workItemId);
    if (!item) fail(`active claim ${claim.agentId} references unknown work item ${workItemId}`);
    if (item.ownerAgentId !== claim.agentId || item.status !== 'in_progress') fail(`claim/work-item binding drift for ${claim.agentId}/${workItemId}`);
  }
}

const stateHash = createHash('sha256').update(JSON.stringify({
  claims: [...state.claims.values()].sort((a, b) => a.agentId.localeCompare(b.agentId)),
  workItems: [...state.workItems.values()].sort((a, b) => a.id.localeCompare(b.id)),
})).digest('hex');
console.log(JSON.stringify({ result: 'PASS', mode: 'ledger-authoritative', headSha, events: state.events.length, activeClaims: [...state.claims.values()].filter((claim) => claim.status === 'active').map((claim) => claim.agentId).sort(), workItems: state.workItems.size, stateHash }, null, 2));
