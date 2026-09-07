import { readFile } from 'node:fs/promises';

const claimsFile = process.env.FLIXO_AGENT_CLAIMS_FILE ?? '.ci/agent-coordination/claims.json';
const state = JSON.parse(await readFile(claimsFile, 'utf8'));
const fail = (message) => { throw new Error(`Agent coordination protocol validation failed: ${message}`); };
const sha = /^[0-9a-f]{40}$/iu;
const branch = /^agent\/[^/]+\/.+$/u;
const active = [];
if (state.schemaVersion !== 2 || state.protocol !== 'FLIXO multi-agent coordination') fail('schemaVersion/protocol mismatch');
if (!Number.isInteger(state.leaseMinutes) || state.leaseMinutes < 1) fail('invalid leaseMinutes');
if (!Number.isInteger(state.heartbeatMinutes) || state.heartbeatMinutes < 1 || state.heartbeatMinutes >= state.leaseMinutes) fail('invalid heartbeatMinutes');
if (!Array.isArray(state.claims)) fail('claims must be array');
const ids = new Set();
const normalize = (v) => String(v ?? '').replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+$/, '');
const overlaps = (a, b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
for (const c of state.claims) {
  if (!c || typeof c !== 'object') fail('claim must be object');
  if (!c.agentId || ids.has(c.agentId)) fail(`duplicate/missing agentId: ${c.agentId ?? '<missing>'}`);
  ids.add(c.agentId);
  if (!branch.test(c.branch ?? '')) fail(`invalid branch for ${c.agentId}`);
  if (!sha.test(c.observedHeadSha ?? '')) fail(`invalid observedHeadSha for ${c.agentId}`);
  if (!Array.isArray(c.scope?.paths) || !Array.isArray(c.scope?.contracts) || !Array.isArray(c.rootCauseIds)) fail(`incomplete scope for ${c.agentId}`);
  if (!['active', 'handoff-pending', 'released'].includes(c.status)) fail(`invalid status for ${c.agentId}`);
  if (!Number.isFinite(Date.parse(c.leasedAt)) || !Number.isFinite(Date.parse(c.leaseUntil))) fail(`invalid lease timestamps for ${c.agentId}`);
  if (c.lastHeartbeatAt && !Number.isFinite(Date.parse(c.lastHeartbeatAt))) fail(`invalid heartbeat timestamp for ${c.agentId}`);
  if (c.status === 'active' && Date.parse(c.leaseUntil) > Date.now()) active.push(c);
}
for (let i = 0; i < active.length; i += 1) for (let j = i + 1; j < active.length; j += 1) {
  const a = active[i]; const b = active[j];
  const path = a.scope.paths.some((p) => b.scope.paths.some((q) => overlaps(normalize(p), normalize(q))));
  const contract = a.scope.contracts.some((id) => b.scope.contracts.includes(id));
  const rootCause = a.rootCauseIds.some((id) => b.rootCauseIds.includes(id));
  if (path || contract || rootCause) fail(`active collision ${a.agentId}<->${b.agentId}: path=${path} contract=${contract} rootCause=${rootCause}`);
}
console.log(`Agent coordination protocol PASS: claims=${state.claims.length} active=${active.length} collisions=0`);
