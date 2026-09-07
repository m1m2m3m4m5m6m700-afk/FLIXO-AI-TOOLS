import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { replayAgentLedger } from './replay-agent-ledger.mjs';

const LEDGER = process.env.FLIXO_SWARM_LEDGER ?? 'artifacts/ci/agent-coordination/events.ndjson';
const QUEUE = 'artifacts/ci/agent-coordination/work-queue.json';
const CLAIMS = process.env.FLIXO_AGENT_CLAIMS_FILE ?? '.ci/agent-coordination/claims.json';
const SESSIONS = process.env.FLIXO_AGENT_SESSIONS_FILE ?? 'scripts/ci/active-sessions.json';
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

const canonicalize = (value) => {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (['generatedAt', 'generated_at', 'updatedAt'].includes(key)) continue;
    result[key] = canonicalize(value[key]);
  }
  return result;
};
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const claims = [...state.claims.values()].sort((a, b) => a.agentId.localeCompare(b.agentId));
const expectedClaims = {
  schemaVersion: 2,
  protocol: 'FLIXO multi-agent coordination',
  sourceOfTruth: LEDGER,
  leaseMinutes: Number(process.env.FLIXO_SWARM_LEASE_MINUTES ?? '30'),
  heartbeatMinutes: Number(process.env.FLIXO_SWARM_HEARTBEAT_MINUTES ?? '10'),
  claims,
};
const expectedSessions = {
  schema_version: 1,
  protocol: 'FLIXO active agent sessions',
  source_of_truth: LEDGER,
  active_sessions: claims.filter((claim) => claim.status === 'active').map((claim) => ({
    agentId: claim.agentId,
    branch: claim.branch,
    observedHeadSha: claim.observedHeadSha,
    scope: claim.scope,
    rootCauseIds: claim.rootCauseIds,
    workItemIds: claim.workItemIds ?? [],
    leasedAt: claim.leasedAt,
    leaseUntil: claim.leaseUntil,
    lastHeartbeatAt: claim.lastHeartbeatAt ?? null,
    sessionId: claim.sessionId,
  })),
};
let projectionDrift = false;
try {
  projectionDrift = JSON.stringify(canonicalize(readJson(CLAIMS))) !== JSON.stringify(canonicalize(expectedClaims)) ||
    JSON.stringify(canonicalize(readJson(SESSIONS))) !== JSON.stringify(canonicalize(expectedSessions));
} catch (error) {
  fail(`CONTROL_PLANE_DESYNC_DETECTED: projection unreadable (${error.message})`);
}
if (projectionDrift) fail(`CONTROL_PLANE_DESYNC_DETECTED: claims/session projections diverge from ${LEDGER}`);

const stateHash = createHash('sha256').update(JSON.stringify({ claims, workItems: [...state.workItems.values()].sort((a, b) => a.id.localeCompare(b.id)) })).digest('hex');
console.log(JSON.stringify({ result: 'PASS', mode: 'ledger-authoritative', headSha, events: state.events.length, activeClaims: claims.filter((claim) => claim.status === 'active').map((claim) => claim.agentId), workItems: state.workItems.size, projections: 'in-sync', stateHash }, null, 2));
