import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { replayAgentLedger } from './replay-agent-ledger.mjs';

const LEDGER = process.env.FLIXO_SWARM_LEDGER ?? 'artifacts/ci/agent-coordination/events.ndjson';
const QUEUE = 'artifacts/ci/agent-coordination/work-queue.json';
const OUT = process.env.FLIXO_AGENT_DASHBOARD ?? 'artifacts/ci/agent-coordination/dashboard.json';
const now = Date.now();
const ledgerText = await readFile(LEDGER, 'utf8');
const state = replayAgentLedger(ledgerText, { headSha: process.env.EXPECTED_HEAD_SHA ?? process.env.GITHUB_SHA ?? '' });
const queue = JSON.parse(await readFile(QUEUE, 'utf8'));
if (queue.schemaVersion !== 2 || queue.protocol !== 'FLIXO agent work queue' || !Array.isArray(queue.items)) throw new Error('Invalid canonical work queue');
const claims = [...state.claims.values()];
const active = claims.filter((claim) => claim.status === 'active' && Date.parse(claim.leaseUntil) > now);
const expiring = active.filter((claim) => Date.parse(claim.leaseUntil) - now <= Number(process.env.FLIXO_SWARM_HEARTBEAT_MINUTES ?? '10') * 60000);
const readyParallelGroups = new Map();
for (const item of queue.items) {
  if (item.status !== 'in_progress' && item.status !== 'ready') continue;
  if ((item.dependsOn ?? []).length) continue;
  const lane = item.parallelGroup ?? 'default';
  readyParallelGroups.set(lane, (readyParallelGroups.get(lane) ?? 0) + 1);
}
const dashboard = {
  schemaVersion: 4,
  generatedAt: new Date().toISOString(),
  protocol: 'FLIXO multi-agent coordination',
  sourceOfTruth: LEDGER,
  queue: {
    sourceOfTruth: QUEUE,
    total: queue.items.length,
    statuses: Object.fromEntries([...new Set(queue.items.map((item) => item.status))].map((status) => [status, queue.items.filter((item) => item.status === status).length])),
    readyParallelGroups: Object.fromEntries(readyParallelGroups),
  },
  lease: {
    leaseMinutes: Number(process.env.FLIXO_SWARM_LEASE_MINUTES ?? '30'),
    heartbeatMinutes: Number(process.env.FLIXO_SWARM_HEARTBEAT_MINUTES ?? '10'),
    activeCount: active.length,
    expiringCount: expiring.length,
    staleOrExpiredCount: claims.filter((claim) => claim.status === 'active' && Date.parse(claim.leaseUntil) <= now).length,
    evictedCount: claims.filter((claim) => claim.eviction === 'expired_evicted').length,
  },
  agents: active.map((claim) => ({
    agentId: claim.agentId,
    branch: claim.branch,
    observedHeadSha: claim.observedHeadSha,
    workItemIds: claim.workItemIds ?? [],
    paths: claim.scope?.paths ?? [],
    contracts: claim.scope?.contracts ?? [],
    rootCauseIds: claim.rootCauseIds ?? [],
    leasedAt: claim.leasedAt,
    leaseUntil: claim.leaseUntil,
    lastHeartbeatAt: claim.lastHeartbeatAt ?? null,
    heartbeatDue: Date.parse(claim.leaseUntil) - now <= Number(process.env.FLIXO_SWARM_HEARTBEAT_MINUTES ?? '10') * 60000,
  })).sort((a, b) => a.agentId.localeCompare(b.agentId)),
};
dashboard.stateHash = createHash('sha256').update(JSON.stringify({ claims: [...state.claims.values()].sort((a, b) => a.agentId.localeCompare(b.agentId)), workItems: [...state.workItems.values()].sort((a, b) => a.id.localeCompare(b.id)) })).digest('hex');
await mkdir('artifacts/ci/agent-coordination', { recursive: true });
await writeFile(OUT, JSON.stringify(dashboard, null, 2) + '\n');
console.log(`Agent coordination dashboard PASS: active=${active.length} expiring=${expiring.length} stateHash=${dashboard.stateHash}`);
