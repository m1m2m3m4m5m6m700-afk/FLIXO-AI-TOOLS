import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { replayAgentLedger } from './replay-agent-ledger.mjs';

const LEDGER = process.env.FLIXO_SWARM_LEDGER ?? 'artifacts/ci/agent-coordination/events.ndjson';
const HEAD = process.env.EXPECTED_HEAD_SHA ?? (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return ''; } })();
const fail = (message) => { throw new Error(`Agent coordination protocol validation failed: ${message}`); };
const branch = /^agent\/[^/]+\/.+$/u;
if (!HEAD) fail('current HEAD unavailable');
const state = replayAgentLedger(await readFile(LEDGER, 'utf8'), { headSha: HEAD, signingKey: process.env.FLIXO_SWARM_EVENT_SIGNING_KEY ?? '' });
const active = [...state.claims.values()].filter((claim) => claim.status === 'active');
for (const claim of state.claims.values()) {
  if (!claim.agentId) fail('claim missing agentId');
  if (!branch.test(claim.branch ?? '')) fail(`invalid branch for ${claim.agentId}`);
  if (!/^[0-9a-f]{40}$/iu.test(claim.observedHeadSha ?? '')) fail(`invalid observedHeadSha for ${claim.agentId}`);
  if (!Array.isArray(claim.scope?.paths) || !Array.isArray(claim.scope?.contracts) || !Array.isArray(claim.rootCauseIds)) fail(`incomplete scope for ${claim.agentId}`);
  if (!['active', 'handoff-pending', 'released'].includes(claim.status)) fail(`invalid status for ${claim.agentId}`);
  if (!Number.isFinite(Date.parse(claim.leasedAt)) || !Number.isFinite(Date.parse(claim.leaseUntil))) fail(`invalid lease timestamps for ${claim.agentId}`);
  if (claim.lastHeartbeatAt && !Number.isFinite(Date.parse(claim.lastHeartbeatAt))) fail(`invalid heartbeat timestamp for ${claim.agentId}`);
}
for (let i = 0; i < active.length; i += 1) for (let j = i + 1; j < active.length; j += 1) {
  const a = active[i]; const b = active[j];
  const path = (a.scope.paths ?? []).some((p) => (b.scope.paths ?? []).some((q) => String(p).replaceAll('\\', '/') === String(q).replaceAll('\\', '/') || String(p).replaceAll('\\', '/').startsWith(`${String(q).replaceAll('\\', '/')}/`) || String(q).replaceAll('\\', '/').startsWith(`${String(p).replaceAll('\\', '/')}/`)));
  const contract = (a.scope.contracts ?? []).some((id) => (b.scope.contracts ?? []).includes(id));
  const rootCause = (a.rootCauseIds ?? []).some((id) => (b.rootCauseIds ?? []).includes(id));
  if (path || contract || rootCause) fail(`active collision ${a.agentId}<->${b.agentId}`);
}
console.log(`Agent coordination protocol PASS: ledgerClaims=${state.claims.size} active=${active.length} collisions=0`);
