import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const claimsFile = process.env.FLIXO_AGENT_CLAIMS_FILE ?? '.ci/agent-coordination/claims.json';
const outFile = process.env.FLIXO_AGENT_DASHBOARD ?? 'artifacts/ci/agent-coordination/dashboard.json';
const now = Date.now();
const state = JSON.parse(await readFile(claimsFile, 'utf8'));
if (state.schemaVersion !== 2 || state.protocol !== 'FLIXO multi-agent coordination') throw new Error('Invalid coordination state schema');
if (!Array.isArray(state.claims)) throw new Error('Invalid coordination claims');
const active = state.claims.filter((c) => c.status === 'active' && Date.parse(c.leaseUntil) > now);
const expiring = active.filter((c) => Date.parse(c.leaseUntil) - now <= state.heartbeatMinutes * 60000);
const dashboard = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  protocol: state.protocol,
  leaseMinutes: state.leaseMinutes,
  heartbeatMinutes: state.heartbeatMinutes,
  activeCount: active.length,
  expiringCount: expiring.length,
  staleOrExpiredCount: state.claims.filter((c) => c.status === 'active' && Date.parse(c.leaseUntil) <= now).length,
  agents: active.map((c) => ({ agentId: c.agentId, branch: c.branch, observedHeadSha: c.observedHeadSha, paths: c.scope.paths, contracts: c.scope.contracts, rootCauseIds: c.rootCauseIds, leasedAt: c.leasedAt, leaseUntil: c.leaseUntil, lastHeartbeatAt: c.lastHeartbeatAt ?? null, heartbeatDue: Date.parse(c.leaseUntil) - now <= state.heartbeatMinutes * 60000 })).sort((a, b) => a.agentId.localeCompare(b.agentId)),
  stateHash: createHash('sha256').update(JSON.stringify(state)).digest('hex'),
};
await mkdir('artifacts/ci/agent-coordination', { recursive: true });
await writeFile(outFile, JSON.stringify(dashboard, null, 2) + '\n');
console.log(`Agent coordination dashboard PASS: active=${dashboard.activeCount} expiring=${dashboard.expiringCount} stateHash=${dashboard.stateHash}`);
