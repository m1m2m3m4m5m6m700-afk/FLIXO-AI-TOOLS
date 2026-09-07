import { appendFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { replayAgentLedger } from './replay-agent-ledger.mjs';

const ROOT = 'artifacts/ci/agent-coordination';
const LEDGER = process.env.FLIXO_SWARM_LEDGER ?? `${ROOT}/events.ndjson`;
const QUEUE = `${ROOT}/work-queue.json`;
const CLAIMS = process.env.FLIXO_AGENT_CLAIMS_FILE ?? `${ROOT}/claims.json`;
const SESSIONS = process.env.FLIXO_AGENT_SESSIONS_FILE ?? `${ROOT}/active-sessions.json`;
const HEAD = process.env.EXPECTED_HEAD_SHA ?? git(['rev-parse', 'HEAD']);
const AGENT = process.env.FLIXO_AGENT_ID ?? '';
const BRANCH = process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? git(['branch', '--show-current']);
const ACTION = (process.env.FLIXO_AGENT_ACTION ?? 'status').toLowerCase();
const LEASE_MS = integerEnv('FLIXO_SWARM_LEASE_MINUTES', 30) * 60_000;
const HEARTBEAT_MS = integerEnv('FLIXO_SWARM_HEARTBEAT_MINUTES', 10) * 60_000;
const KEY = process.env.FLIXO_SWARM_EVENT_SIGNING_KEY ?? '';
const LOCK = `${LEDGER}.lock`;
const HEX = /^[0-9a-f]{40}$/u;
const AGENT_BRANCH_RE = /^agent\/[^/]+\/.+$/u;
const EVENT_TYPES = new Set(['STATE_BOOTSTRAP', 'WORK_QUEUE_RECONCILE', 'CLAIM_REQUEST', 'HEARTBEAT', 'CHECK_OUT', 'HANDOFF_PENDING', 'BID_REQUEST', 'CLAIM_AWARDED', 'EXPIRED_EVICTED']);

function integerEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isInteger(value) || value < 1) fail('SWARM_EVENT_SCHEMA_ERROR', `${name} must be a positive integer`);
  return value;
}
function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}
function git(args) {
  try { return execFileSync('git', args, { encoding: 'utf8' }).trim(); } catch { return ''; }
}
function parseTime(value, field) {
  const time = Date.parse(value ?? '');
  if (!Number.isFinite(time)) fail('SWARM_EVENT_SCHEMA_ERROR', `${field} must be ISO-8601`);
  return time;
}
function normalizePath(value) { return String(value ?? '').replaceAll('\\', '/').replace(/^\.\/+/, '').replace(/\/+$/u, ''); }
function overlaps(left, right) {
  const a = normalizePath(left); const b = normalizePath(right);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}
function unique(values) { return [...new Set(values)]; }
function compareBids(left, right) {
  const delta = parseTime(left.timestamp, 'bid.timestamp') - parseTime(right.timestamp, 'bid.timestamp');
  return delta || left.agentId.localeCompare(right.agentId);
}
function canonicalLegacy(value) { return JSON.stringify(value, Object.keys(value).sort()); }
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function buildEventHash(event) {
  const unsigned = { ...event }; delete unsigned.hash; delete unsigned.signature;
  return digest(canonicalLegacy(unsigned));
}
function sign(hash) { return KEY ? createHmac('sha256', KEY).update(hash).digest('hex') : null; }
function isAncestor(ancestorSha, descendantSha) {
  if (ancestorSha === descendantSha) return true;
  if (!HEX.test(ancestorSha) || !HEX.test(descendantSha)) return false;
  try { execFileSync('git', ['merge-base', '--is-ancestor', ancestorSha, descendantSha], { stdio: 'ignore' }); return true; }
  catch { return false; }
}
function assertExactHead(parentSha) {
  const current = git(['rev-parse', 'HEAD']);
  if (!HEX.test(parentSha) || !HEX.test(current) || parentSha !== current) fail('SWARM_OCC_CONFLICT', `parent SHA ${parentSha} does not equal current HEAD ${current || '<unavailable>'}`);
}
async function readEvents() {
  try {
    const text = await readFile(LEDGER, 'utf8');
    if (!text.trim()) return [];
    return text.split(/\r?\n/u).filter(Boolean).map((line, index) => {
      try { return JSON.parse(line); } catch { fail('SWARM_EVENT_SCHEMA_ERROR', `invalid JSON at ledger line ${index + 1}`); }
    });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}
function emptyState() { return { claims: new Map(), workItems: new Map(), bids: new Map(), lastTimestamp: 0, lastHash: 'GENESIS' }; }
function claimCollides(candidate, current) {
  return (candidate.scope?.paths ?? []).some((p) => (current.scope?.paths ?? []).some((q) => overlaps(p, q))) ||
    (candidate.scope?.contracts ?? []).some((id) => (current.scope?.contracts ?? []).includes(id)) ||
    (candidate.rootCauseIds ?? []).some((id) => (current.rootCauseIds ?? []).includes(id));
}
function activeClaims(state, at = Date.now()) { return [...state.claims.values()].filter((claim) => claim.status === 'active' && Date.parse(claim.leaseUntil) > at); }
function validateEventShape(event, expectedSequence, previousHash, replayHead) {
  if (!event || event.schemaVersion !== 1 || event.protocol !== 'FLIXO swarm event ledger') fail('SWARM_EVENT_SCHEMA_ERROR', `invalid schema at sequence ${expectedSequence}`);
  if (!Number.isInteger(event.sequence) || event.sequence !== expectedSequence) fail('SWARM_EVENT_CHAIN_BROKEN', `expected sequence ${expectedSequence}, got ${event?.sequence}`);
  if (expectedSequence > 1 && event.parentSequence !== expectedSequence - 1) fail('SWARM_EVENT_CHAIN_BROKEN', `event ${expectedSequence} parentSequence mismatch`);
  if (event.prevHash !== previousHash) fail('SWARM_EVENT_CHAIN_BROKEN', `event ${expectedSequence} prevHash mismatch`);
  if (!HEX.test(event.parentSha ?? '') || !isAncestor(event.parentSha, replayHead)) fail('SWARM_OCC_CONFLICT', `event ${expectedSequence} parentSha is not an ancestor of current HEAD`);
  if (!event.eventId || !event.agentId || !EVENT_TYPES.has(event.type)) fail('SWARM_EVENT_SCHEMA_ERROR', `invalid identity/type at sequence ${expectedSequence}`);
  const timestamp = parseTime(event.timestamp, `event ${expectedSequence}.timestamp`);
  if (expectedSequence === 1 && event.type !== 'STATE_BOOTSTRAP') fail('SWARM_EVENT_SCHEMA_ERROR', 'sequence 1 must be STATE_BOOTSTRAP');
  if (expectedSequence > 1 && event.type === 'STATE_BOOTSTRAP') fail('SWARM_EVENT_SCHEMA_ERROR', 'STATE_BOOTSTRAP must occur only at sequence 1');
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) fail('SWARM_EVENT_SCHEMA_ERROR', `event ${expectedSequence} payload invalid`);
  if (buildEventHash(event) !== event.hash) fail('SWARM_EVENT_HASH_MISMATCH', `event ${expectedSequence} hash mismatch`);
  if (event.signature) {
    if (!KEY) fail('SWARM_EVENT_SIGNATURE_UNVERIFIABLE', 'signing key is required to verify signed events');
    if (sign(event.hash) !== event.signature) fail('SWARM_EVENT_SIGNATURE_INVALID', `event ${expectedSequence} signature mismatch`);
  }
  return timestamp;
}
function reduce(events, replayHead = HEAD) {
  const state = emptyState(); let previousHash = 'GENESIS'; let expectedSequence = 1;
  for (const event of events) {
    const timestamp = validateEventShape(event, expectedSequence, previousHash, replayHead);
    if (timestamp < state.lastTimestamp) fail('SWARM_EVENT_ORDER_ERROR', `timestamp regression at sequence ${expectedSequence}`);
    state.lastTimestamp = timestamp; const p = event.payload;
    if (event.type === 'STATE_BOOTSTRAP') {
      if (state.claims.size || state.workItems.size || state.bids.size) fail('SWARM_EVENT_STATE_CONFLICT', 'duplicate bootstrap state');
      for (const claim of p.claims ?? []) state.claims.set(claim.agentId, { ...claim });
      for (const item of p.workItems ?? []) state.workItems.set(item.id, { ...item });
    } else if (event.type === 'WORK_QUEUE_RECONCILE') {
      for (const patch of p.workItems ?? []) {
        const item = state.workItems.get(patch.id); if (!item) fail('SWARM_EVENT_STATE_CONFLICT', `reconcile references unknown work item ${patch.id}`);
        item.status = patch.status; item.ownerAgentId = patch.ownerAgentId ?? null;
        if (patch.awardedAt !== undefined) item.awardedAt = patch.awardedAt;
      }
    } else if (event.type === 'CLAIM_REQUEST') {
      const claim = p.claim;
      if (!claim?.agentId || !Array.isArray(claim.scope?.paths) || !Array.isArray(claim.scope?.contracts) || !Array.isArray(claim.rootCauseIds)) fail('SWARM_EVENT_STATE_CONFLICT', `invalid claim at sequence ${expectedSequence}`);
      for (const current of activeClaims(state, timestamp)) if (current.agentId !== claim.agentId && claimCollides(claim, current)) fail('AGENT_COLLISION_DETECTED', `${claim.agentId} conflicts with ${current.agentId}`);
      state.claims.set(claim.agentId, { ...claim, status: 'active' });
    } else if (event.type === 'HEARTBEAT') {
      const claim = state.claims.get(event.agentId);
      if (!claim || claim.status !== 'active') fail('SWARM_OCC_CONFLICT', `no active claim for ${event.agentId}`);
      if (timestamp > parseTime(claim.leaseUntil, `${event.agentId}.leaseUntil`)) fail('SWARM_OCC_CONFLICT', `heartbeat arrived after lease expiry for ${event.agentId}`);
      if (!p.leaseUntil) fail('SWARM_EVENT_STATE_CONFLICT', `heartbeat leaseUntil missing at sequence ${expectedSequence}`);
      claim.lastHeartbeatAt = event.timestamp; claim.leaseUntil = p.leaseUntil; claim.lastReanchorSha = event.parentSha;
    } else if (event.type === 'CHECK_OUT' || event.type === 'HANDOFF_PENDING') {
      const claim = state.claims.get(event.agentId);
      if (!claim || !['active', 'handoff-pending'].includes(claim.status)) fail('SWARM_OCC_CONFLICT', `no releasable claim for ${event.agentId}`);
      claim.status = event.type === 'HANDOFF_PENDING' ? 'handoff-pending' : 'released'; claim.releasedAt = event.timestamp; claim.lastReanchorSha = event.parentSha;
      if (p.handoffTo) claim.handoffTo = p.handoffTo;
    } else if (event.type === 'BID_REQUEST') {
      if (!state.workItems.has(p.workItemId) || !p.timestamp) fail('SWARM_EVENT_STATE_CONFLICT', `invalid bid at sequence ${expectedSequence}`);
      parseTime(p.timestamp, `bid ${expectedSequence}.timestamp`);
      const list = state.bids.get(p.workItemId) ?? [];
      if (list.some((bid) => bid.agentId === event.agentId && bid.timestamp === p.timestamp)) fail('SWARM_EVENT_STATE_CONFLICT', `duplicate bid for ${p.workItemId}`);
      list.push({ agentId: event.agentId, timestamp: p.timestamp }); list.sort(compareBids); state.bids.set(p.workItemId, list);
    } else if (event.type === 'CLAIM_AWARDED') {
      const item = state.workItems.get(p.workItemId); if (!item) fail('SWARM_EVENT_STATE_CONFLICT', `unknown work item ${p.workItemId}`);
      const winner = [...(state.bids.get(p.workItemId) ?? [])].sort(compareBids)[0];
      if (!winner || winner.agentId !== p.agentId) fail('SWARM_EVENT_STATE_CONFLICT', `award violates deterministic tie-break for ${p.workItemId}`);
      item.status = 'in_progress'; item.ownerAgentId = p.agentId; item.awardedAt = event.timestamp;
      const claim = state.claims.get(p.agentId); if (claim?.status === 'active') claim.workItemIds = unique([...(claim.workItemIds ?? []), p.workItemId]);
    } else if (event.type === 'EXPIRED_EVICTED') {
      const claim = state.claims.get(p.agentId); if (!claim) fail('SWARM_EVENT_STATE_CONFLICT', `cannot evict unknown agent ${p.agentId}`);
      const leaseExpired = timestamp > parseTime(claim.leaseUntil, `${p.agentId}.leaseUntil`);
      const heartbeatExpired = timestamp - parseTime(claim.lastHeartbeatAt ?? claim.leasedAt, `${p.agentId}.heartbeat`) > HEARTBEAT_MS;
      if (!leaseExpired && !heartbeatExpired) fail('SWARM_EVENT_STATE_CONFLICT', `premature eviction for ${p.agentId}`);
      claim.status = 'released'; claim.releasedAt = event.timestamp; claim.eviction = 'expired_evicted';
      if (p.workItemId) {
        const item = state.workItems.get(p.workItemId); if (!item) fail('SWARM_EVENT_STATE_CONFLICT', `unknown work item ${p.workItemId}`);
        item.status = 'available'; item.ownerAgentId = null; item.awardedAt = null;
      }
    }
    previousHash = event.hash; state.lastHash = event.hash; expectedSequence += 1;
  }
  return state;
}
async function loadQueue() {
  const queue = JSON.parse(await readFile(QUEUE, 'utf8'));
  if (queue.schemaVersion !== 2 || queue.protocol !== 'FLIXO agent work queue' || !Array.isArray(queue.items)) fail('SWARM_EVENT_STATE_CONFLICT', 'invalid canonical work queue');
  return queue;
}
async function acquireLock() {
  await mkdir(dirname(LOCK), { recursive: true });
  try { await mkdir(LOCK); } catch (error) { if (error?.code === 'EEXIST') fail('SWARM_OCC_CONFLICT', `ledger lock already held: ${LOCK}`); throw error; }
}
async function releaseLock() { await rm(LOCK, { recursive: true, force: true }); }
function buildEvent(type, parentSha, agentId, payload, sequence, previousHash, timestamp = new Date().toISOString()) {
  const unsigned = { schemaVersion: 1, protocol: 'FLIXO swarm event ledger', sequence, parentSequence: sequence - 1, eventId: randomUUID(), timestamp, parentSha, agentId, type, payload, prevHash: previousHash };
  const hash = buildEventHash(unsigned); const event = { ...unsigned, hash }; const signature = sign(hash); if (signature) event.signature = signature; return event;
}
async function atomicAppend(event) {
  await acquireLock();
  try {
    const events = await readEvents(); const currentHead = git(['rev-parse', 'HEAD']);
    if (currentHead !== event.parentSha) fail('SWARM_OCC_CONFLICT', `HEAD changed during append: expected ${event.parentSha}, got ${currentHead}`);
    if (events.length + 1 !== event.sequence || (events.at(-1)?.hash ?? 'GENESIS') !== event.prevHash) fail('SWARM_OCC_CONFLICT', 'ledger changed concurrently; reload state and retry');
    await mkdir(dirname(LEDGER), { recursive: true }); await appendFile(LEDGER, `${JSON.stringify(event)}\n`, { flag: 'a' });
  } finally { await releaseLock(); }
}
function projectionPayload(state) {
  const claims = [...state.claims.values()].sort((a, b) => a.agentId.localeCompare(b.agentId));
  return { claims, activeSessions: claims.filter((claim) => claim.status === 'active').map((claim) => ({ agentId: claim.agentId, branch: claim.branch, observedHeadSha: claim.observedHeadSha, scope: claim.scope, rootCauseIds: claim.rootCauseIds, workItemIds: claim.workItemIds ?? [], leasedAt: claim.leasedAt, leaseUntil: claim.leaseUntil, lastHeartbeatAt: claim.lastHeartbeatAt ?? null, sessionId: claim.sessionId })) };
}
async function readJsonIfPresent(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
}
function stableProjection(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stableProjection);
  const copy = {};
  for (const key of Object.keys(value).sort()) {
    if (['generatedAt', 'generated_at', 'updatedAt'].includes(key)) continue;
    copy[key] = stableProjection(value[key]);
  }
  return copy;
}
async function writeAtomic(path, content) {
  await mkdir(dirname(path), { recursive: true }); const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try { await writeFile(temp, content, 'utf8'); await rename(temp, path); } finally { await rm(temp, { force: true }); }
}
async function flushProjections(state) {
  const { claims, activeSessions } = projectionPayload(state);
  const leaseMinutes = Number.parseInt(process.env.FLIXO_SWARM_LEASE_MINUTES ?? '30', 10);
  const heartbeatMinutes = Number.parseInt(process.env.FLIXO_SWARM_HEARTBEAT_MINUTES ?? '10', 10);
  const claimsProjection = { schemaVersion: 2, protocol: 'FLIXO multi-agent coordination', sourceOfTruth: LEDGER, generatedAt: new Date().toISOString(), leaseMinutes, heartbeatMinutes, claims };
  const sessionsProjection = { schema_version: 1, protocol: 'FLIXO active agent sessions', source_of_truth: LEDGER, generated_at: new Date().toISOString(), active_sessions: activeSessions };
  const priorClaims = stableProjection(await readJsonIfPresent(CLAIMS)); const priorSessions = stableProjection(await readJsonIfPresent(SESSIONS));
  const desyncDetected = JSON.stringify(priorClaims) !== JSON.stringify(stableProjection(claimsProjection)) || JSON.stringify(priorSessions) !== JSON.stringify(stableProjection(sessionsProjection));
  await writeAtomic(CLAIMS, JSON.stringify(claimsProjection, null, 2) + '\n'); await writeAtomic(SESSIONS, JSON.stringify(sessionsProjection, null, 2) + '\n');
  return { desyncDetected, claims: claims.length, activeSessions: activeSessions.length };
}
async function replayAndProject() { const events = await readEvents(); const state = reduce(events); const projection = await flushProjections(state); return { events, state, projection }; }
async function sweepExpired(state, parentSha) {
  const expired = activeClaims(state).filter((claim) => Date.now() > parseTime(claim.leaseUntil, `${claim.agentId}.leaseUntil`) || Date.now() - parseTime(claim.lastHeartbeatAt ?? claim.leasedAt, `${claim.agentId}.heartbeat`) > HEARTBEAT_MS);
  for (const claim of expired) {
    const events = await readEvents(); const item = [...state.workItems.values()].find((workItem) => workItem.ownerAgentId === claim.agentId);
    const reason = Date.now() > parseTime(claim.leaseUntil, `${claim.agentId}.leaseUntil`) ? 'lease_ttl_exceeded' : 'heartbeat_timeout';
    const event = buildEvent('EXPIRED_EVICTED', parentSha, 'swarm-engine', { agentId: claim.agentId, workItemId: item?.id ?? null, reason }, events.length + 1, events.at(-1)?.hash ?? 'GENESIS');
    await atomicAppend(event); const latest = await readEvents(); Object.assign(state, reduce(latest));
  }
}
async function dryRun(state) {
  const scope = { paths: unique((process.env.FLIXO_AGENT_PATHS ?? '').split(',').map(normalizePath).filter(Boolean)), contracts: unique((process.env.FLIXO_AGENT_CONTRACTS ?? '').split(',').map((value) => value.trim()).filter(Boolean)), rootCauseIds: unique((process.env.FLIXO_AGENT_ROOT_CAUSES ?? '').split(',').map((value) => value.trim()).filter(Boolean)) };
  const conflicts = activeClaims(state).filter((claim) => claim.agentId !== AGENT && claimCollides(scope, claim));
  const result = { mode: 'dry-run', result: conflicts.length ? 'FAIL' : 'PASS', parentSha: HEAD, queuePath: QUEUE, conflicts: conflicts.map((claim) => claim.agentId).sort() };
  console.log(JSON.stringify(result, null, 2)); if (conflicts.length) process.exitCode = 1;
}
async function mutate(action) {
  assertExactHead(HEAD);
  if (action === 'sweep') {
    const initial = await replayAndProject();
    await sweepExpired(initial.state, HEAD);
    const projected = await replayAndProject();
    console.log(JSON.stringify({ result: 'PASS', action, headSha: HEAD, projection: projected.projection }, null, 2));
    return;
  }
  if (!AGENT || !AGENT_BRANCH_RE.test(BRANCH)) fail('SWARM_OCC_CONFLICT', 'valid FLIXO_AGENT_ID and agent branch are required');
  let { state } = await replayAndProject(); await sweepExpired(state, HEAD); ({ state } = await replayAndProject());
  const events = await readEvents(); const sequence = events.length + 1; const previousHash = events.at(-1)?.hash ?? 'GENESIS'; const existing = state.claims.get(AGENT);
  if (action === 'check-in') {
    if (existing?.status === 'active' && parseTime(existing.leaseUntil, 'leaseUntil') > Date.now()) fail('SWARM_OCC_CONFLICT', `${AGENT} already owns an active claim`);
    const scope = parseScope(); if (!scope.paths.length && !scope.contracts.length && !scope.rootCauseIds.length) fail('SWARM_OCC_CONFLICT', 'claim scope cannot be empty');
    const collisions = activeClaims(state).filter((claim) => claim.agentId !== AGENT && claimCollides(scope, claim)); if (collisions.length) fail('AGENT_COLLISION_DETECTED', collisions.map((claim) => claim.agentId).sort().join(','));
    const now = new Date();
    const claim = { agentId: AGENT, branch: BRANCH, observedHeadSha: HEAD, scope: { paths: scope.paths, contracts: scope.contracts }, rootCauseIds: scope.rootCauseIds, status: 'active', leasedAt: now.toISOString(), leaseUntil: new Date(now.getTime() + LEASE_MS).toISOString(), lastHeartbeatAt: now.toISOString(), sessionId: randomUUID(), workItemIds: process.env.FLIXO_WORK_ITEM_ID ? [process.env.FLIXO_WORK_ITEM_ID] : [] };
    await atomicAppend(buildEvent('CLAIM_REQUEST', HEAD, AGENT, { claim }, sequence, previousHash));
  } else if (action === 'heartbeat') {
    if (!existing || existing.status !== 'active') fail('SWARM_OCC_CONFLICT', `no active claim for ${AGENT}`);
    await atomicAppend(buildEvent('HEARTBEAT', HEAD, AGENT, { leaseUntil: new Date(Date.now() + LEASE_MS).toISOString() }, sequence, previousHash));
  } else if (action === 'check-out' || action === 'handoff') {
    if (!existing || !['active', 'handoff-pending'].includes(existing.status)) fail('SWARM_OCC_CONFLICT', 'releasable claim required');
    await atomicAppend(buildEvent(action === 'handoff' ? 'HANDOFF_PENDING' : 'CHECK_OUT', HEAD, AGENT, { handoffTo: action === 'handoff' ? process.env.FLIXO_AGENT_HANDOFF_TO ?? null : null }, sequence, previousHash));
  } else if (action === 'bid') {
    const queue = await loadQueue(); const item = queue.items.find((candidate) => candidate.id === process.env.FLIXO_WORK_ITEM_ID);
    if (!item) fail('SWARM_EVENT_STATE_CONFLICT', 'unknown work item'); if (item.status !== 'available') fail('SWARM_EVENT_STATE_CONFLICT', `work item ${item.id} is not available`);
    await atomicAppend(buildEvent('BID_REQUEST', HEAD, AGENT, { workItemId: item.id, timestamp: new Date().toISOString() }, sequence, previousHash));
  } else fail('SWARM_EVENT_SCHEMA_ERROR', `unsupported action ${action}`);
  const projected = await replayAndProject(); console.log(JSON.stringify({ result: 'PASS', action, headSha: HEAD, projection: projected.projection }, null, 2));
}
function parseScope() { return { paths: unique((process.env.FLIXO_AGENT_PATHS ?? '').split(',').map(normalizePath).filter(Boolean)), contracts: unique((process.env.FLIXO_AGENT_CONTRACTS ?? '').split(',').map((value) => value.trim()).filter(Boolean)), rootCauseIds: unique((process.env.FLIXO_AGENT_ROOT_CAUSES ?? '').split(',').map((value) => value.trim()).filter(Boolean)) }; }
function smokeTest() {
  const bids = [{ agentId: 'agent-b', timestamp: '2026-09-07T20:00:00.000Z' }, { agentId: 'agent-a', timestamp: '2026-09-07T20:00:00.000Z' }, { agentId: 'agent-c', timestamp: '2026-09-07T20:00:01.000Z' }].sort(compareBids);
  if (bids[0].agentId !== 'agent-a') fail('SWARM_TIE_BREAK_ERROR', 'same-ms tie must resolve by agentId');
  if (!overlaps('scripts/ci/swarm-engine.mjs', 'scripts/ci')) fail('SWARM_COLLISION_TEST_ERROR', 'path overlap was not detected');
  if (claimCollides({ scope: { paths: ['src/components'], contracts: ['G4-A11Y-001'] }, rootCauseIds: ['RC-G4-A11Y-001'] }, { scope: { paths: ['scripts/ci'], contracts: ['G1-ROUTE-001'] }, rootCauseIds: ['RC-MATRIX-008'] })) fail('SWARM_COLLISION_TEST_ERROR', 'disjoint scopes collided');
  console.log(JSON.stringify({ result: 'PASS', queuePath: QUEUE, deterministicWinner: bids[0].agentId, collisionIsolation: 'PASS', tieRule: 'timestamp then lexical agentId' }, null, 2));
}

const args = new Set(process.argv.slice(2));
try {
  if (args.has('--smoke-test')) smokeTest();
  else if (args.has('--replay-only')) {
    const result = await replayAndProject();
    console.log(JSON.stringify({ result: 'PASS', mode: 'replay-only', headSha: HEAD, sequence: result.events.length, lastHash: result.state.lastHash, activeClaims: activeClaims(result.state).map((claim) => claim.agentId).sort(), workItems: [...result.state.workItems.values()].sort((a, b) => a.id.localeCompare(b.id)), projection: result.projection }, null, 2));
  } else if (args.has('--dry-run')) {
    const result = await replayAndProject(); await dryRun(result.state);
  } else await mutate(ACTION);
} catch (error) {
  console.error(error?.message ?? error); process.exitCode = 1;
}
