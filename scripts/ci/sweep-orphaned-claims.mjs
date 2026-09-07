import { readFile, writeFile } from 'node:fs/promises';
import { mkdir, appendFile } from 'node:fs/promises';

const claimsFile = process.env.FLIXO_AGENT_CLAIMS_FILE ?? '.ci/agent-coordination/claims.json';
const ledgerFile = process.env.FLIXO_AGENT_EVENT_LEDGER ?? 'artifacts/ci/agent-coordination/event-ledger.jsonl';
const now = Date.now();
const graceMinutes = Number(process.env.FLIXO_AGENT_SWEEP_GRACE_MINUTES ?? '10');
if (!Number.isFinite(graceMinutes) || graceMinutes < 0) throw new Error('Invalid FLIXO_AGENT_SWEEP_GRACE_MINUTES');

const state = JSON.parse(await readFile(claimsFile, 'utf8'));
if (state?.schemaVersion !== 2 || state?.protocol !== 'FLIXO multi-agent coordination' || !Array.isArray(state.claims)) {
  throw new Error('Invalid claims schema/protocol');
}
const events = [];
const graceMs = graceMinutes * 60_000;
for (const claim of state.claims) {
  if (claim.status !== 'active') continue;
  const leaseUntil = Date.parse(claim.leaseUntil ?? '');
  const heartbeatAt = Date.parse(claim.lastHeartbeatAt ?? claim.leasedAt ?? '');
  const leaseExpired = Number.isFinite(leaseUntil) && leaseUntil <= now;
  const heartbeatStale = !Number.isFinite(heartbeatAt) || heartbeatAt + graceMs <= now;
  if (!leaseExpired || !heartbeatStale) continue;
  claim.status = 'expired_evicted';
  claim.evictedAt = new Date(now).toISOString();
  events.push({
    schemaVersion: 1,
    eventType: 'claim_expired_evicted',
    agentId: claim.agentId,
    branch: claim.branch,
    observedHeadSha: claim.observedHeadSha,
    leaseUntil: claim.leaseUntil,
    lastHeartbeatAt: claim.lastHeartbeatAt ?? null,
    reason: 'lease_expired_and_heartbeat_stale',
    graceMinutes,
    generatedAt: new Date(now).toISOString(),
  });
}

if (events.length) {
  state.updatedAt = new Date(now).toISOString();
  await writeFile(claimsFile, JSON.stringify(state, null, 2) + '\n');
}
await mkdir(ledgerFile.split('/').slice(0, -1).join('/') || '.', { recursive: true });
if (events.length) await appendFile(ledgerFile, events.map((event) => JSON.stringify(event)).join('\n') + '\n');
console.log(`Claim sweep PASS: evicted=${events.length} graceMinutes=${graceMinutes}`);
