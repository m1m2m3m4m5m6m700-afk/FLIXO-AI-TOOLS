import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { replayAgentLedger, normalizePath, overlaps } from './replay-agent-ledger.mjs';

const LEDGER = process.env.FLIXO_SWARM_LEDGER ?? 'artifacts/ci/agent-coordination/events.ndjson';
const HEAD = process.env.EXPECTED_HEAD_SHA ?? process.env.GITHUB_SHA ?? '';

const state = replayAgentLedger(await readFile(LEDGER, 'utf8'), { headSha: HEAD });
const now = Date.now();
const claims = [...state.claims.values()];
const active = claims.filter((claim) => claim.status === 'active' && Date.parse(claim.leaseUntil) > now);
const stale = claims.filter((claim) => claim.status === 'active' && Date.parse(claim.leaseUntil) <= now);
const collisions = [];

for (let i = 0; i < active.length; i += 1) {
  for (let j = i + 1; j < active.length; j += 1) {
    const left = active[i];
    const right = active[j];
    const sharedPath = (left.scope?.paths ?? []).some((path) => (right.scope?.paths ?? []).some((other) => overlaps(path, other)));
    const sharedContract = (left.scope?.contracts ?? []).some((id) => (right.scope?.contracts ?? []).includes(id));
    const sharedRootCause = (left.rootCauseIds ?? []).some((id) => (right.rootCauseIds ?? []).includes(id));
    if (sharedPath || sharedContract || sharedRootCause) collisions.push({ type: 'active-scope', left: left.agentId, right: right.agentId, sharedPath, sharedContract, sharedRootCause });
  }
}

if (collisions.length) throw new Error(`CONTROL_PLANE_COLLISION_DETECTED: ${JSON.stringify(collisions)}`);

const snapshot = {
  schemaVersion: 3,
  generatedAt: new Date().toISOString(),
  sourceOfTruth: LEDGER,
  headSha: HEAD || null,
  activeCount: active.length,
  staleOrExpiredCount: stale.length,
  agents: active.map((claim) => ({
    agentId: claim.agentId,
    branch: claim.branch,
    observedHeadSha: claim.observedHeadSha,
    leaseUntil: claim.leaseUntil,
    lastHeartbeatAt: claim.lastHeartbeatAt ?? null,
    paths: (claim.scope?.paths ?? []).map(normalizePath),
    contracts: claim.scope?.contracts ?? [],
    rootCauseIds: claim.rootCauseIds ?? [],
  })).sort((a, b) => a.agentId.localeCompare(b.agentId)),
  collisions: 0,
};
snapshot.stateHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
console.log(JSON.stringify(snapshot, null, 2));
