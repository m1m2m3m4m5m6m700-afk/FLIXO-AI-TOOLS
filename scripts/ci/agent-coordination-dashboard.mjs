import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const claimsFile = process.env.FLIXO_AGENT_CLAIMS_FILE ?? '.ci/agent-coordination/claims.json';
const queueFile = process.env.FLIXO_AGENT_WORK_QUEUE_FILE ?? '.ci/agent-coordination/work-queue.json';
const eventsFile = process.env.FLIXO_AGENT_EVENT_LEDGER ?? 'artifacts/ci/agent-coordination/event-ledger.jsonl';
const outFile = process.env.FLIXO_AGENT_DASHBOARD ?? 'artifacts/ci/agent-coordination/dashboard.json';
const now = Date.now();
const state = JSON.parse(await readFile(claimsFile, 'utf8'));
const queue = JSON.parse(await readFile(queueFile, 'utf8'));
if (state.schemaVersion !== 2 || state.protocol !== 'FLIXO multi-agent coordination') throw new Error('Invalid coordination state schema');
if (!Array.isArray(state.claims) || !Array.isArray(queue.items)) throw new Error('Invalid coordination state');
let events = [];
try {
  events = (await readFile(eventsFile, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const active = state.claims.filter((c) => c.status === 'active' && Date.parse(c.leaseUntil) > now);
const expiring = active.filter((c) => Date.parse(c.leaseUntil) - now <= state.heartbeatMinutes * 60000);
const collisionEvents = events.filter((event) => event.eventType === 'claim_collision_avoided');
const recoveryEvents = events.filter((event) => event.eventType === 'recovery_completed');
const shardEvents = events.filter((event) => event.eventType === 'matrix_shard_completed');
const shardPasses = shardEvents.filter((event) => event.status === 'passed');
const durations = recoveryEvents.map((event) => {
  const start = Date.parse(event.startedAt ?? '');
  const end = Date.parse(event.completedAt ?? '');
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? (end - start) / 60000 : null;
}).filter((value) => value !== null);
const mttrMinutes = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null;
const collisionDenominator = collisionEvents.length + active.length;
const collisionAvoidanceRate = collisionDenominator ? collisionEvents.length / collisionDenominator : null;
const shardSuccessRate = shardEvents.length ? shardPasses.length / shardEvents.length : null;
const readyParallelGroups = new Map();
for (const item of queue.items) {
  if (item.status !== 'in_progress' && item.status !== 'ready') continue;
  if ((item.dependsOn ?? []).length) continue;
  const lane = item.parallelGroup ?? 'default';
  readyParallelGroups.set(lane, (readyParallelGroups.get(lane) ?? 0) + 1);
}
const dashboard = {
  schemaVersion: 3,
  generatedAt: new Date().toISOString(),
  protocol: state.protocol,
  queue: {
    total: queue.items.length,
    statuses: Object.fromEntries([...new Set(queue.items.map((item) => item.status))].map((status) => [status, queue.items.filter((item) => item.status === status).length])),
    readyParallelGroups: Object.fromEntries(readyParallelGroups),
  },
  lease: {
    leaseMinutes: state.leaseMinutes,
    heartbeatMinutes: state.heartbeatMinutes,
    activeCount: active.length,
    expiringCount: expiring.length,
    staleOrExpiredCount: state.claims.filter((c) => c.status === 'active' && Date.parse(c.leaseUntil) <= now).length,
    evictedCount: state.claims.filter((c) => c.status === 'expired_evicted').length,
  },
  telemetry: {
    mttrMinutes,
    collisionAvoidanceRate,
    collisionsAvoided: collisionEvents.length,
    shardSuccessRate,
    shardPasses: shardPasses.length,
    shardRuns: shardEvents.length,
  },
  agents: active.map((c) => ({
    agentId: c.agentId,
    branch: c.branch,
    observedHeadSha: c.observedHeadSha,
    workItemIds: c.workItemIds ?? [],
    paths: c.scope.paths,
    contracts: c.scope.contracts,
    rootCauseIds: c.rootCauseIds,
    leasedAt: c.leasedAt,
    leaseUntil: c.leaseUntil,
    lastHeartbeatAt: c.lastHeartbeatAt ?? null,
    heartbeatDue: Date.parse(c.leaseUntil) - now <= state.heartbeatMinutes * 60000,
  })).sort((a, b) => a.agentId.localeCompare(b.agentId)),
};
dashboard.stateHash = createHash('sha256').update(JSON.stringify(state)).digest('hex');
await mkdir('artifacts/ci/agent-coordination', { recursive: true });
await writeFile(outFile, JSON.stringify(dashboard, null, 2) + '\n');
console.log(`Agent coordination dashboard PASS: active=${dashboard.lease.activeCount} expiring=${dashboard.lease.expiringCount} mttr=${dashboard.telemetry.mttrMinutes ?? 'n/a'} shardSuccess=${dashboard.telemetry.shardSuccessRate ?? 'n/a'} stateHash=${dashboard.stateHash}`);
