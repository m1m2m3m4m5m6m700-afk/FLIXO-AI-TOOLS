import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const claimsFile = process.env.FLIXO_AGENT_CLAIMS_FILE ?? '.ci/agent-coordination/claims.json';
const state = JSON.parse(await readFile(claimsFile, 'utf8'));
if (state.schemaVersion !== 2 || state.protocol !== 'FLIXO multi-agent coordination') throw new Error('Invalid coordination schema');
if (!Array.isArray(state.claims)) throw new Error('Invalid claims registry');
const now = Date.now();
const active = state.claims.filter((c) => c.status === 'active' && Date.parse(c.leaseUntil) > now);
const stale = state.claims.filter((c) => c.status === 'active' && Date.parse(c.leaseUntil) <= now);
const byPath = new Map();
const collisions = [];
const normalize = (v) => String(v ?? '').replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+$/, '');
const overlaps = (a, b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
for (const c of active) for (const p of c.scope.paths.map(normalize)) {
  const prior = byPath.get(p) ?? [];
  for (const other of prior) collisions.push({ type: 'path', left: other, right: c.agentId, value: p });
  for (const [otherPath, owners] of byPath) if (otherPath !== p && overlaps(p, otherPath)) for (const owner of owners) collisions.push({ type: 'path', left: owner, right: c.agentId, value: `${p}<->${otherPath}` });
  byPath.set(p, [...prior, c.agentId]);
}
for (let i = 0; i < active.length; i += 1) for (let j = i + 1; j < active.length; j += 1) {
  const a = active[i]; const b = active[j];
  if (a.scope.contracts.some((id) => b.scope.contracts.includes(id))) collisions.push({ type: 'contract', left: a.agentId, right: b.agentId });
  if (a.rootCauseIds.some((id) => b.rootCauseIds.includes(id))) collisions.push({ type: 'rootCause', left: a.agentId, right: b.agentId });
}
if (collisions.length) throw new Error(`Coordination collision detected: ${JSON.stringify(collisions)}`);
const snapshot = { schemaVersion: 2, generatedAt: new Date().toISOString(), activeCount: active.length, staleOrExpiredCount: stale.length, agents: active.map((c) => ({ agentId: c.agentId, branch: c.branch, observedHeadSha: c.observedHeadSha, leaseUntil: c.leaseUntil, lastHeartbeatAt: c.lastHeartbeatAt ?? null, paths: c.scope.paths, contracts: c.scope.contracts, rootCauseIds: c.rootCauseIds })) , collisions: 0 };
snapshot.stateHash = createHash('sha256').update(JSON.stringify(state)).digest('hex');
console.log(JSON.stringify(snapshot, null, 2));
