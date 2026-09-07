import { readFileSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const LEDGER = process.env.FLIXO_SWARM_LEDGER ?? 'artifacts/ci/agent-coordination/events.ndjson';
const QUEUE = process.env.FLIXO_SWARM_WORK_QUEUE ?? '.ci/agent-coordination/work-queue.json';
const HEAD = process.env.EXPECTED_HEAD_SHA ?? git('rev-parse', 'HEAD');
const KEY = process.env.FLIXO_SWARM_EVENT_SIGNING_KEY ?? '';
const HEX = /^[0-9a-f]{40}$/u;
const fail = (m) => { throw new Error(`SWARM_STATE_INVALID: ${m}`); };
function git(...args) { try { return execFileSync('git', args, { encoding: 'utf8' }).trim(); } catch { return ''; } }
function ancestor(a, b) { if (a === b) return true; try { execFileSync('git', ['merge-base', '--is-ancestor', a, b], { stdio: 'ignore' }); return true; } catch { return false; } }
function ts(v, f) { const n = Date.parse(v ?? ''); if (!Number.isFinite(n)) fail(`${f} invalid timestamp`); return n; }
function hash(v) { return createHash('sha256').update(v).digest('hex'); }
function canonical(v) { return JSON.stringify(v, Object.keys(v).sort()); }
const raw = readFileSync(LEDGER, 'utf8'); const rows = raw.split(/\r?\n/u).filter(Boolean); if (!rows.length) fail('event ledger is empty'); if (!HEX.test(HEAD)) fail('HEAD invalid');
let previous = 'GENESIS'; let sequence = 1; let lastTime = 0; let bootstrapSeen = false; const claims = new Map(); const work = new Map(); const bids = new Map();
for (const line of rows) {
  let e; try { e = JSON.parse(line); } catch { fail(`invalid JSON at event ${sequence}`); }
  if (e.schemaVersion !== 1 || e.protocol !== 'FLIXO swarm event ledger') fail(`schema at ${sequence}`);
  if (e.sequence !== sequence || e.prevHash !== previous) fail(`sequence/hash link at ${sequence}`);
  if (!HEX.test(e.parentSha ?? '') || !ancestor(e.parentSha, HEAD)) fail(`event ${sequence} parentSha is not ancestor of current HEAD`);
  const time = ts(e.timestamp, `event ${sequence}`); if (time < lastTime) fail(`timestamp regression at ${sequence}`); lastTime = time;
  if (!e.eventId || !e.agentId || !e.type || !e.payload || typeof e.payload !== 'object') fail(`shape at ${sequence}`);
  const unsigned = { ...e }; delete unsigned.hash; delete unsigned.signature; if (hash(canonical(unsigned)) !== e.hash) fail(`hash mismatch at ${sequence}`);
  if (e.signature) { if (!KEY) fail(`signature ${sequence} unverifiable`); const expected = createHmac('sha256', KEY).update(e.hash).digest('hex'); if (expected !== e.signature) fail(`signature mismatch at ${sequence}`); }
  const p = e.payload;
  if (e.type === 'STATE_BOOTSTRAP') { if (sequence !== 1 || bootstrapSeen) fail('invalid bootstrap'); bootstrapSeen = true; for (const c of p.claims ?? []) claims.set(c.agentId, { ...c }); for (const w of p.workItems ?? []) work.set(w.id, { ...w }); }
  else if (e.type === 'CLAIM_REQUEST') { const c = p.claim; if (!c?.agentId || !Array.isArray(c.scope?.paths) || !Array.isArray(c.scope?.contracts) || !Array.isArray(c.rootCauseIds)) fail(`invalid claim at ${sequence}`); for (const x of claims.values()) if (x.status === 'active' && ts(x.leaseUntil, 'leaseUntil') > time && x.agentId !== c.agentId) { const path = c.scope.paths.some((a) => x.scope.paths.some((b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`))); const contract = c.scope.contracts.some((a) => x.scope.contracts.includes(a)); const root = c.rootCauseIds.some((a) => x.rootCauseIds.includes(a)); if (path || contract || root) fail(`collision at ${sequence}`); } claims.set(c.agentId, { ...c, status: 'active' }); }
  else if (e.type === 'HEARTBEAT') { const c = claims.get(e.agentId); if (!c || c.status !== 'active') fail(`heartbeat without claim at ${sequence}`); if (time > ts(c.leaseUntil, 'leaseUntil')) fail(`late heartbeat at ${sequence}`); c.lastHeartbeatAt = e.timestamp; c.leaseUntil = p.leaseUntil; }
  else if (e.type === 'CHECK_OUT' || e.type === 'HANDOFF_PENDING') { const c = claims.get(e.agentId); if (!c || !['active', 'handoff-pending'].includes(c.status)) fail(`release without claim at ${sequence}`); c.status = e.type === 'HANDOFF_PENDING' ? 'handoff-pending' : 'released'; c.releasedAt = e.timestamp; }
  else if (e.type === 'BID_REQUEST') { if (!work.has(p.workItemId) || !p.timestamp) fail(`invalid bid at ${sequence}`); const list = bids.get(p.workItemId) ?? []; if (list.some((b) => b.agentId === e.agentId && b.timestamp === p.timestamp)) fail(`duplicate bid at ${sequence}`); list.push({ agentId: e.agentId, timestamp: p.timestamp }); bids.set(p.workItemId, list); }
  else if (e.type === 'CLAIM_AWARDED') { const item = work.get(p.workItemId); if (!item) fail(`unknown work item at ${sequence}`); const winner = [...(bids.get(p.workItemId) ?? [])].sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.agentId.localeCompare(b.agentId))[0]; if (!winner || winner.agentId !== p.agentId) fail(`tie-break violation at ${sequence}`); item.status = 'in_progress'; item.ownerAgentId = p.agentId; }
  else if (e.type === 'EXPIRED_EVICTED') { const c = claims.get(p.agentId); if (c) c.status = 'released'; if (p.workItemId && work.has(p.workItemId)) { const w = work.get(p.workItemId); w.status = 'available'; w.ownerAgentId = null; } }
  else fail(`unsupported event type ${e.type}`);
  previous = e.hash; sequence += 1;
}
if (!bootstrapSeen) fail('STATE_BOOTSTRAP missing'); for (const c of claims.values()) if (c.status === 'active' && (Date.now() > ts(c.leaseUntil, 'leaseUntil') || Date.now() - ts(c.lastHeartbeatAt ?? c.leasedAt, 'heartbeat') > 10 * 60_000)) fail(`stale active claim ${c.agentId} requires EXPIRED_EVICTED`);
const queue = JSON.parse(readFileSync(QUEUE, 'utf8')); if (queue.schemaVersion !== 1 || queue.protocol !== 'FLIXO agent work queue') fail('queue schema'); for (const item of queue.items) { if (!work.has(item.id)) fail(`queue item ${item.id} absent from ledger`); const p = work.get(item.id); if (p.status !== item.status || (p.ownerAgentId ?? null) !== (item.ownerAgentId ?? null)) fail(`queue projection drift for ${item.id}`); }
const stateHash = hash(JSON.stringify({ claims: [...claims.values()].sort((a,b)=>a.agentId.localeCompare(b.agentId)), work: [...work.values()].sort((a,b)=>a.id.localeCompare(b.id)) }));
console.log(JSON.stringify({ result:'PASS', headSha:HEAD, events:rows.length, activeClaims:[...claims.values()].filter((c)=>c.status==='active').map((c)=>c.agentId), workItems:work.size, stateHash }, null, 2));
