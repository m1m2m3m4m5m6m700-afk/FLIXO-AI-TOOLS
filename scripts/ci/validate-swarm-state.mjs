import { readFileSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const LEDGER = process.env.FLIXO_SWARM_LEDGER ?? 'artifacts/ci/agent-coordination/events.ndjson';
const QUEUE = process.env.FLIXO_SWARM_WORK_QUEUE ?? '.ci/agent-coordination/work-queue.json';
const HEAD = process.env.EXPECTED_HEAD_SHA ?? git(['rev-parse', 'HEAD']);
const KEY = process.env.FLIXO_SWARM_EVENT_SIGNING_KEY ?? '';
const HEARTBEAT_MS = integerEnv('FLIXO_SWARM_HEARTBEAT_MINUTES', 10) * 60_000;
const HEX = /^[0-9a-f]{40}$/u;

function integerEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isInteger(value) || value < 1) fail(`${name} must be positive`);
  return value;
}

function fail(message) {
  throw new Error(`SWARM_STATE_INVALID: ${message}`);
}

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function parseTime(value, field) {
  const time = Date.parse(value ?? '');
  if (!Number.isFinite(time)) fail(`${field} invalid timestamp`);
  return time;
}

function canonicalLegacy(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function ancestor(ancestorSha, descendantSha) {
  if (ancestorSha === descendantSha) return true;
  if (!HEX.test(ancestorSha) || !HEX.test(descendantSha)) return false;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestorSha, descendantSha], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function buildHash(event) {
  const unsigned = { ...event };
  delete unsigned.hash;
  delete unsigned.signature;
  return createHash('sha256').update(canonicalLegacy(unsigned)).digest('hex');
}

function verifyEvent(event, sequence, previousHash) {
  if (event?.schemaVersion !== 1 || event.protocol !== 'FLIXO swarm event ledger') {
    fail(`invalid schema/protocol at sequence ${sequence}`);
  }
  if (event.sequence !== sequence) fail(`sequence mismatch at ${sequence}`);
  if (sequence > 1 && event.parentSequence !== sequence - 1) fail(`parentSequence mismatch at ${sequence}`);
  if (event.prevHash !== previousHash) fail(`prevHash mismatch at ${sequence}`);
  if (!HEX.test(event.parentSha ?? '') || !ancestor(event.parentSha, HEAD)) {
    fail(`parentSha is not an ancestor of current HEAD at ${sequence}`);
  }
  if (!event.eventId || !event.agentId || typeof event.type !== 'string') {
    fail(`identity/type missing at ${sequence}`);
  }
  const expectedHash = buildHash(event);
  if (expectedHash !== event.hash) fail(`hash mismatch at ${sequence}`);
  if (event.signature) {
    if (!KEY) fail(`signature ${sequence} unverifiable without FLIXO_SWARM_EVENT_SIGNING_KEY`);
    const expected = createHmac('sha256', KEY).update(event.hash).digest('hex');
    if (expected !== event.signature) fail(`signature mismatch at ${sequence}`);
  }
  parseTime(event.timestamp, `event ${sequence}.timestamp`);
}

const raw = readFileSync(LEDGER, 'utf8');
const rows = raw.split(/\r?\n/u).filter(Boolean);
if (!rows.length) fail('event ledger is empty');
if (!HEX.test(HEAD)) fail('current HEAD invalid');

let previousHash = 'GENESIS';
let lastTimestamp = 0;
const claims = new Map();
const workItems = new Map();
const bids = new Map();
let bootstrapSeen = false;

for (let sequence = 1; sequence <= rows.length; sequence += 1) {
  let event;
  try {
    event = JSON.parse(rows[sequence - 1]);
  } catch {
    fail(`invalid JSON at sequence ${sequence}`);
  }

  verifyEvent(event, sequence, previousHash);
  const timestamp = parseTime(event.timestamp, `event ${sequence}.timestamp`);
  if (timestamp < lastTimestamp) fail(`timestamp regression at ${sequence}`);
  lastTimestamp = timestamp;
  const payload = event.payload ?? {};

  if (event.type === 'STATE_BOOTSTRAP') {
    if (sequence !== 1 || bootstrapSeen) fail('invalid bootstrap placement');
    bootstrapSeen = true;
    for (const claim of payload.claims ?? []) claims.set(claim.agentId, { ...claim });
    for (const item of payload.workItems ?? []) workItems.set(item.id, { ...item });
  } else if (event.type === 'CLAIM_REQUEST') {
    const claim = payload.claim;
    if (!claim?.agentId || !Array.isArray(claim.scope?.paths) || !Array.isArray(claim.scope?.contracts) || !Array.isArray(claim.rootCauseIds)) {
      fail(`invalid claim at ${sequence}`);
    }
    for (const current of claims.values()) {
      if (current.status !== 'active' || current.agentId === claim.agentId) continue;
      if (parseTime(current.leaseUntil, `${current.agentId}.leaseUntil`) <= timestamp) continue;
      const pathConflict = claim.scope.paths.some((left) => current.scope.paths.some((right) => left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`)));
      const contractConflict = claim.scope.contracts.some((id) => current.scope.contracts.includes(id));
      const rootCauseConflict = claim.rootCauseIds.some((id) => current.rootCauseIds.includes(id));
      if (pathConflict || contractConflict || rootCauseConflict) fail(`claim collision at ${sequence}`);
    }
    claims.set(claim.agentId, { ...claim, status: 'active' });
  } else if (event.type === 'HEARTBEAT') {
    const claim = claims.get(event.agentId);
    if (!claim || claim.status !== 'active') fail(`heartbeat without active claim at ${sequence}`);
    if (timestamp > parseTime(claim.leaseUntil, `${event.agentId}.leaseUntil`)) fail(`late heartbeat at ${sequence}`);
    if (!payload.leaseUntil) fail(`heartbeat leaseUntil missing at ${sequence}`);
    claim.lastHeartbeatAt = event.timestamp;
    claim.leaseUntil = payload.leaseUntil;
    claim.lastReanchorSha = event.parentSha;
  } else if (event.type === 'CHECK_OUT' || event.type === 'HANDOFF_PENDING') {
    const claim = claims.get(event.agentId);
    if (!claim || !['active', 'handoff-pending'].includes(claim.status)) fail(`release without claim at ${sequence}`);
    claim.status = event.type === 'HANDOFF_PENDING' ? 'handoff-pending' : 'released';
    claim.releasedAt = event.timestamp;
  } else if (event.type === 'BID_REQUEST') {
    if (!workItems.has(payload.workItemId) || !payload.timestamp) fail(`invalid bid at ${sequence}`);
    parseTime(payload.timestamp, `bid ${sequence}.timestamp`);
    const list = bids.get(payload.workItemId) ?? [];
    if (list.some((bid) => bid.agentId === event.agentId && bid.timestamp === payload.timestamp)) fail(`duplicate bid at ${sequence}`);
    list.push({ agentId: event.agentId, timestamp: payload.timestamp });
    list.sort((left, right) => parseTime(left.timestamp, 'left bid') - parseTime(right.timestamp, 'right bid') || left.agentId.localeCompare(right.agentId));
    bids.set(payload.workItemId, list);
  } else if (event.type === 'CLAIM_AWARDED') {
    const item = workItems.get(payload.workItemId);
    if (!item) fail(`award references unknown work item at ${sequence}`);
    const winner = [...(bids.get(payload.workItemId) ?? [])].sort((left, right) => parseTime(left.timestamp, 'left bid') - parseTime(right.timestamp, 'right bid') || left.agentId.localeCompare(right.agentId))[0];
    if (!winner || winner.agentId !== payload.agentId) fail(`tie-break violation at ${sequence}`);
    item.status = 'in_progress';
    item.ownerAgentId = payload.agentId;
  } else if (event.type === 'EXPIRED_EVICTED') {
    const claim = claims.get(payload.agentId);
    if (!claim) fail(`eviction references unknown agent at ${sequence}`);
    const leaseExpired = timestamp > parseTime(claim.leaseUntil, `${payload.agentId}.leaseUntil`);
    const heartbeatExpired = timestamp - parseTime(claim.lastHeartbeatAt ?? claim.leasedAt, `${payload.agentId}.heartbeat`) > HEARTBEAT_MS;
    if (!leaseExpired && !heartbeatExpired) fail(`premature eviction at ${sequence}`);
    claim.status = 'released';
    claim.eviction = 'expired_evicted';
    claim.releasedAt = event.timestamp;
    if (payload.workItemId) {
      const item = workItems.get(payload.workItemId);
      if (!item) fail(`eviction references unknown work item at ${sequence}`);
      item.status = 'available';
      item.ownerAgentId = null;
      item.awardedAt = null;
    }
  } else {
    fail(`unsupported event type ${event.type} at ${sequence}`);
  }

  previousHash = event.hash;
}

if (!bootstrapSeen) fail('STATE_BOOTSTRAP missing');

for (const claim of claims.values()) {
  if (claim.status !== 'active') continue;
  const stale = Date.now() > parseTime(claim.leaseUntil, `${claim.agentId}.leaseUntil`) || Date.now() - parseTime(claim.lastHeartbeatAt ?? claim.leasedAt, `${claim.agentId}.heartbeat`) > HEARTBEAT_MS;
  if (stale) fail(`stale active claim ${claim.agentId} missing EXPIRED_EVICTED`);
}

const queue = JSON.parse(readFileSync(QUEUE, 'utf8'));
if (queue.schemaVersion !== 1 || queue.protocol !== 'FLIXO agent work queue' || !Array.isArray(queue.items)) fail('queue schema invalid');
const queueIds = new Set();
for (const item of queue.items) {
  if (queueIds.has(item.id)) fail(`duplicate queue item ${item.id}`);
  queueIds.add(item.id);
  if (!workItems.has(item.id)) fail(`queue item ${item.id} absent from ledger bootstrap/state`);
  const stateItem = workItems.get(item.id);
  if ((stateItem.status ?? null) !== (item.status ?? null) || (stateItem.ownerAgentId ?? null) !== (item.ownerAgentId ?? null)) fail(`queue projection drift for ${item.id}`);
  if (!Array.isArray(item.dependsOn)) fail(`dependsOn missing for ${item.id}`);
  for (const dependencyId of item.dependsOn) {
    if (!queueIds.has(dependencyId) && !queue.items.some((candidate) => candidate.id === dependencyId)) fail(`unknown dependency ${dependencyId} for ${item.id}`);
    if (dependencyId === item.id) fail(`self dependency ${item.id}`);
  }
}

const activeClaims = [...claims.values()].filter((claim) => claim.status === 'active');
const activeWorkOwnership = new Map();
for (const claim of activeClaims) {
  for (const workItemId of claim.workItemIds ?? []) {
    if (activeWorkOwnership.has(workItemId) && activeWorkOwnership.get(workItemId) !== claim.agentId) fail(`work item ${workItemId} owned by multiple active agents`);
    if (!workItems.has(workItemId)) fail(`claim ${claim.agentId} references unknown work item ${workItemId}`);
    activeWorkOwnership.set(workItemId, claim.agentId);
  }
}

const stateHash = createHash('sha256').update(JSON.stringify({
  claims: [...claims.values()].sort((left, right) => left.agentId.localeCompare(right.agentId)),
  workItems: [...workItems.values()].sort((left, right) => left.id.localeCompare(right.id)),
})).digest('hex');

console.log(JSON.stringify({ result: 'PASS', headSha: HEAD, events: rows.length, activeClaims: activeClaims.map((claim) => claim.agentId).sort(), workItems: workItems.size, stateHash }, null, 2));
