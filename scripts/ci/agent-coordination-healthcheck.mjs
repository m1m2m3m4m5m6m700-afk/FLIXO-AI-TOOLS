import { readFile } from 'node:fs/promises';

const claims = JSON.parse(await readFile('.ci/agent-coordination/claims.json', 'utf8'));
if (claims.schemaVersion !== 2) throw new Error('Coordination healthcheck: schemaVersion must be 2');
if (claims.protocol !== 'FLIXO multi-agent coordination') throw new Error('Coordination healthcheck: protocol mismatch');
const now = Date.now();
const active = claims.claims.filter((c) => c.status === 'active' && Date.parse(c.leaseUntil) > now);
for (const c of active) {
  if (!/^agent\/[^/]+\/.+$/u.test(c.branch ?? '')) throw new Error(`Invalid active branch ${c.branch}`);
  if (!/^[0-9a-f]{40}$/iu.test(c.observedHeadSha ?? '')) throw new Error(`Invalid active SHA for ${c.agentId}`);
  if (!c.lastHeartbeatAt) throw new Error(`Missing heartbeat for ${c.agentId}`);
  if (Date.parse(c.lastHeartbeatAt) > now) throw new Error(`Future heartbeat for ${c.agentId}`);
}
console.log(`Agent coordination health PASS: active=${active.length} stale=${claims.claims.length-active.length}`);
