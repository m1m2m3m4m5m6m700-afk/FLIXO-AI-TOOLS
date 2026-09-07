import { appendFile, mkdir, readFile, rm } from 'node:fs/promises';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';

const LEDGER = process.env.FLIXO_SWARM_LEDGER ?? 'artifacts/ci/agent-coordination/events.ndjson';
const QUEUE = process.env.FLIXO_SWARM_WORK_QUEUE ?? '.ci/agent-coordination/work-queue.json';
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
const EVENT_TYPES = new Set([
  'STATE_BOOTSTRAP',
  'CLAIM_REQUEST',
  'HEARTBEAT',
  'CHECK_OUT',
  'HANDOFF_PENDING',
  'BID_REQUEST',
  'CLAIM_AWARDED',
  'EXPIRED_EVICTED',
]);

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
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function parseTime(value, field) {
  const time = Date.parse(value ?? '');
  if (!Number.isFinite(time)) fail('SWARM_EVENT_SCHEMA_ERROR', `${field} must be ISO-8601`);
  return time;
}

function normalizePath(value) {
  return String(value ?? '').replaceAll('\\', '/').replace(/^\.\/+/, '').replace(/\/+$/u, '');
}

function overlaps(left, right) {
  const a = normalizePath(left);
  const b = normalizePath(right);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function unique(values) {
  return [...new Set(values)];
}

function compareBids(left, right) {
  const timestampDelta = parseTime(left.timestamp, 'bid.timestamp') - parseTime(right.timestamp, 'bid.timestamp');
  if (timestampDelta !== 0) return timestampDelta;
  return left.agentId.localeCompare(right.agentId);
}

function canonicalLegacy(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function buildEventHash(event) {
  const unsigned = { ...event };
  delete unsigned.hash;
  delete unsigned.signature;
  return digest(canonicalLegacy(unsigned));
}

function sign(hash) {
  return KEY ? createHmac('sha256', KEY).update(hash).digest('hex') : null;
}

function isAncestor(ancestorSha, descendantSha) {
  if (ancestorSha === descendantSha) return true;
  if (!HEX.test(ancestorSha) || !HEX.test(descendantSha)) return false;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestorSha, descendantSha], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function assertExactHead(parentSha) {
  const current = git(['rev-parse', 'HEAD']);
  if (!HEX.test(parentSha) || !HEX.test(current) || parentSha !== current) {
    fail('SWARM_OCC_CONFLICT', `parent SHA ${parentSha} does not equal current HEAD ${current || '<unavailable>'}`);
  }
}

async function readEvents() {
  try {
    const text = await readFile(LEDGER, 'utf8');
    if (!text.trim()) return [];
    return text.split(/\r?\n/u).filter(Boolean).map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        fail('SWARM_EVENT_SCHEMA_ERROR', `invalid JSON at ledger line ${index + 1}`);
      }
    });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

function emptyState() {
  return {
    schemaVersion: 1,
    protocol: 'FLIXO swarm runtime state',
    claims: new Map(),
    workItems: new Map(),
    bids: new Map(),
    lastTimestamp: 0,
    lastHash: 'GENESIS',
  };
}

function activeClaims(state, at = Date.now()) {
  return [...state.claims.values()].filter(
    (claim) => claim.status === 'active' && parseTime(claim.leaseUntil, `${claim.agentId}.leaseUntil`) > at,
  );
}

function claimCollides(candidate, current) {
  return (
    (candidate.scope?.paths ?? []).some((path) =>
      (current.scope?.paths ?? []).some((other) => overlaps(path, other)),
    ) ||
    (candidate.scope?.contracts ?? []).some((id) => (current.scope?.contracts ?? []).includes(id)) ||
    (candidate.rootCauseIds ?? []).some((id) => (current.rootCauseIds ?? []).includes(id))
  );
}

function validateEventShape(event, expectedSequence, previousHash, replayHead) {
  if (!event || event.schemaVersion !== 1 || event.protocol !== 'FLIXO swarm event ledger') {
    fail('SWARM_EVENT_SCHEMA_ERROR', `invalid schema at sequence ${expectedSequence}`);
  }
  if (!Number.isInteger(event.sequence) || event.sequence !== expectedSequence) {
    fail('SWARM_EVENT_CHAIN_BROKEN', `expected sequence ${expectedSequence}, got ${event?.sequence}`);
  }
  if (expectedSequence > 1 && event.parentSequence !== expectedSequence - 1) {
    fail('SWARM_EVENT_CHAIN_BROKEN', `event ${expectedSequence} missing parentSequence ${expectedSequence - 1}`);
  }
  if (event.prevHash !== previousHash) {
    fail('SWARM_EVENT_CHAIN_BROKEN', `event ${expectedSequence} prevHash mismatch`);
  }
  if (!HEX.test(event.parentSha) || !isAncestor(event.parentSha, replayHead)) {
    fail('SWARM_OCC_CONFLICT', `event ${expectedSequence} parentSha is not an ancestor of current HEAD`);
  }
  if (!event.eventId || !event.agentId || !EVENT_TYPES.has(event.type)) {
    fail('SWARM_EVENT_SCHEMA_ERROR', `invalid identity/type at sequence ${expectedSequence}`);
  }
  const timestamp = parseTime(event.timestamp, `event ${expectedSequence}.timestamp`);
  if (expectedSequence === 1 && event.type !== 'STATE_BOOTSTRAP') {
    fail('SWARM_EVENT_SCHEMA_ERROR', 'sequence 1 must be STATE_BOOTSTRAP');
  }
  if (expectedSequence > 1 && event.type === 'STATE_BOOTSTRAP') {
    fail('SWARM_EVENT_SCHEMA_ERROR', 'STATE_BOOTSTRAP must occur only at sequence 1');
  }
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) {
    fail('SWARM_EVENT_SCHEMA_ERROR', `event ${expectedSequence} payload invalid`);
  }
  if (buildEventHash(event) !== event.hash) {
    fail('SWARM_EVENT_HASH_MISMATCH', `event ${expectedSequence} hash mismatch`);
  }
  if (event.signature) {
    if (!KEY) fail('SWARM_EVENT_SIGNATURE_UNVERIFIABLE', 'signing key is required to verify signed events');
    if (sign(event.hash) !== event.signature) {
      fail('SWARM_EVENT_SIGNATURE_INVALID', `event ${expectedSequence} signature mismatch`);
    }
  }
  return timestamp;
}

function reduce(events, replayHead = HEAD) {
  const state = emptyState();
  let previousHash = 'GENESIS';
  let expectedSequence = 1;

  for (const event of events) {
    const timestamp = validateEventShape(event, expectedSequence, previousHash, replayHead);
    if (timestamp < state.lastTimestamp) {
      fail('SWARM_EVENT_ORDER_ERROR', `timestamp regression at sequence ${expectedSequence}`);
    }
    state.lastTimestamp = timestamp;

    const payload = event.payload;

    if (event.type === 'STATE_BOOTSTRAP') {
      if (state.claims.size || state.workItems.size || state.bids.size) {
        fail('SWARM_EVENT_STATE_CONFLICT', 'duplicate bootstrap state');
      }
      for (const claim of payload.claims ?? []) state.claims.set(claim.agentId, { ...claim });
      for (const workItem of payload.workItems ?? []) state.workItems.set(workItem.id, { ...workItem });
    } else if (event.type === 'CLAIM_REQUEST') {
      const candidate = payload.claim;
      if (
        !candidate?.agentId ||
        !Array.isArray(candidate.scope?.paths) ||
        !Array.isArray(candidate.scope?.contracts) ||
        !Array.isArray(candidate.rootCauseIds)
      ) {
        fail('SWARM_EVENT_STATE_CONFLICT', `invalid claim at sequence ${expectedSequence}`);
      }
      const conflicts = activeClaims(state).filter(
        (claim) => claim.agentId !== candidate.agentId && claimCollides(candidate, claim),
      );
      if (conflicts.length) {
        fail('AGENT_COLLISION_DETECTED', conflicts.map((claim) => claim.agentId).sort().join(','));
      }
      state.claims.set(candidate.agentId, { ...candidate, status: 'active' });
    } else if (event.type === 'HEARTBEAT') {
      const claim = state.claims.get(event.agentId);
      if (!claim || claim.status !== 'active') {
        fail('SWARM_OCC_CONFLICT', `no active claim for ${event.agentId}`);
      }
      if (timestamp > parseTime(claim.leaseUntil, `${event.agentId}.leaseUntil`)) {
        fail('SWARM_OCC_CONFLICT', `heartbeat arrived after lease expiry for ${event.agentId}`);
      }
      if (!payload.leaseUntil) fail('SWARM_EVENT_STATE_CONFLICT', `heartbeat leaseUntil missing at sequence ${expectedSequence}`);
      claim.lastHeartbeatAt = event.timestamp;
      claim.leaseUntil = payload.leaseUntil;
      claim.lastReanchorSha = event.parentSha;
    } else if (event.type === 'CHECK_OUT' || event.type === 'HANDOFF_PENDING') {
      const claim = state.claims.get(event.agentId);
      if (!claim || !['active', 'handoff-pending'].includes(claim.status)) {
        fail('SWARM_OCC_CONFLICT', `no releasable claim for ${event.agentId}`);
      }
      claim.status = event.type === 'HANDOFF_PENDING' ? 'handoff-pending' : 'released';
      claim.releasedAt = event.timestamp;
      claim.lastReanchorSha = event.parentSha;
      if (payload.handoffTo) claim.handoffTo = payload.handoffTo;
    } else if (event.type === 'BID_REQUEST') {
      if (!state.workItems.has(payload.workItemId)) {
        fail('SWARM_EVENT_STATE_CONFLICT', `unknown work item ${payload.workItemId}`);
      }
      if (!payload.timestamp) fail('SWARM_EVENT_STATE_CONFLICT', 'bid timestamp missing');
      parseTime(payload.timestamp, 'bid.timestamp');
      const list = state.bids.get(payload.workItemId) ?? [];
      if (list.some((bid) => bid.agentId === event.agentId && bid.timestamp === payload.timestamp)) {
        fail('SWARM_EVENT_STATE_CONFLICT', `duplicate bid for ${payload.workItemId}`);
      }
      list.push({ agentId: event.agentId, timestamp: payload.timestamp });
      list.sort(compareBids);
      state.bids.set(payload.workItemId, list);
    } else if (event.type === 'CLAIM_AWARDED') {
      const item = state.workItems.get(payload.workItemId);
      if (!item) fail('SWARM_EVENT_STATE_CONFLICT', `unknown work item ${payload.workItemId}`);
      const winner = [...(state.bids.get(payload.workItemId) ?? [])].sort(compareBids)[0];
      if (!winner || winner.agentId !== payload.agentId) {
        fail('SWARM_EVENT_STATE_CONFLICT', `award violates deterministic tie-break for ${payload.workItemId}`);
      }
      item.status = 'in_progress';
      item.ownerAgentId = payload.agentId;
      item.awardedAt = event.timestamp;
    } else if (event.type === 'EXPIRED_EVICTED') {
      const claim = state.claims.get(payload.agentId);
      if (!claim) fail('SWARM_EVENT_STATE_CONFLICT', `cannot evict unknown agent ${payload.agentId}`);
      const leaseExpired = timestamp > parseTime(claim.leaseUntil, `${payload.agentId}.leaseUntil`);
      const heartbeatExpired =
        timestamp - parseTime(claim.lastHeartbeatAt ?? claim.leasedAt, `${payload.agentId}.heartbeat`) >
        HEARTBEAT_MS;
      if (!leaseExpired && !heartbeatExpired) {
        fail('SWARM_EVENT_STATE_CONFLICT', `premature eviction for ${payload.agentId}`);
      }
      claim.status = 'released';
      claim.releasedAt = event.timestamp;
      claim.eviction = 'expired_evicted';
      if (payload.workItemId) {
        const item = state.workItems.get(payload.workItemId);
        if (!item) fail('SWARM_EVENT_STATE_CONFLICT', `unknown work item ${payload.workItemId}`);
        item.status = 'available';
        item.ownerAgentId = null;
        item.awardedAt = null;
      }
    }

    previousHash = event.hash;
    state.lastHash = event.hash;
    expectedSequence += 1;
  }

  return state;
}

async function acquireLock() {
  await mkdir(dirname(LOCK), { recursive: true });
  try {
    await mkdir(LOCK);
  } catch (error) {
    if (error?.code === 'EEXIST') fail('SWARM_OCC_CONFLICT', `ledger lock already held: ${LOCK}`);
    throw error;
  }
}

async function releaseLock() {
  await rm(LOCK, { recursive: true, force: true });
}

function buildEvent(type, parentSha, agentId, payload, sequence, previousHash, timestamp = new Date().toISOString()) {
  const unsigned = {
    schemaVersion: 1,
    protocol: 'FLIXO swarm event ledger',
    sequence,
    parentSequence: sequence - 1,
    eventId: randomUUID(),
    timestamp,
    parentSha,
    agentId,
    type,
    payload,
    prevHash: previousHash,
  };
  const hash = buildEventHash(unsigned);
  const event = { ...unsigned, hash };
  const signature = sign(hash);
  if (signature) event.signature = signature;
  return event;
}

async function atomicAppend(event) {
  await acquireLock();
  try {
    const events = await readEvents();
    const currentHead = git(['rev-parse', 'HEAD']);
    if (currentHead !== event.parentSha) {
      fail('SWARM_OCC_CONFLICT', `HEAD changed during append: expected ${event.parentSha}, got ${currentHead}`);
    }
    if (events.length + 1 !== event.sequence || (events.at(-1)?.hash ?? 'GENESIS') !== event.prevHash) {
      fail('SWARM_OCC_CONFLICT', 'ledger changed concurrently; reload state and retry');
    }
    await mkdir(dirname(LEDGER), { recursive: true });
    await appendFile(LEDGER, `${JSON.stringify(event)}\n`, { flag: 'a' });
  } finally {
    await releaseLock();
  }
}

async function sweepExpired(state, parentSha) {
  const stale = activeClaims(state).filter((claim) => {
    const heartbeatAt = parseTime(claim.lastHeartbeatAt ?? claim.leasedAt, `${claim.agentId}.heartbeat`);
    return Date.now() > parseTime(claim.leaseUntil, `${claim.agentId}.leaseUntil`) || Date.now() - heartbeatAt > HEARTBEAT_MS;
  });

  const emitted = [];
  for (const claim of stale) {
    const events = await readEvents();
    const event = buildEvent(
      'EXPIRED_EVICTED',
      parentSha,
      'swarm-engine',
      {
        agentId: claim.agentId,
        workItemId: [...state.workItems.values()].find((item) => item.ownerAgentId === claim.agentId)?.id ?? null,
        reason:
          Date.now() > parseTime(claim.leaseUntil, `${claim.agentId}.leaseUntil`)
            ? 'lease_ttl_exceeded'
            : 'heartbeat_timeout',
      },
      events.length + 1,
      events.at(-1)?.hash ?? 'GENESIS',
    );
    await atomicAppend(event);
    emitted.push(event);
    parentSha = git(['rev-parse', 'HEAD']) || parentSha;
  }
  return emitted;
}

async function loadQueue() {
  const queue = JSON.parse(await readFile(QUEUE, 'utf8'));
  if (queue.schemaVersion !== 1 || queue.protocol !== 'FLIXO agent work queue' || !Array.isArray(queue.items)) {
    fail('SWARM_EVENT_STATE_CONFLICT', 'invalid work queue');
  }
  return queue;
}

function parseScope() {
  return {
    paths: unique((process.env.FLIXO_AGENT_PATHS ?? '').split(',').map(normalizePath).filter(Boolean)),
    contracts: unique((process.env.FLIXO_AGENT_CONTRACTS ?? '').split(',').map((value) => value.trim()).filter(Boolean)),
    rootCauseIds: unique((process.env.FLIXO_AGENT_ROOT_CAUSES ?? '').split(',').map((value) => value.trim()).filter(Boolean)),
  };
}

async function dryRun(state) {
  const candidate = { agentId: AGENT, scope: parseScope() };
  const conflicts = activeClaims(state).filter(
    (claim) => claim.agentId !== AGENT && claimCollides(candidate, claim),
  );
  const queue = await loadQueue().catch(() => null);
  const workItem = process.env.FLIXO_WORK_ITEM_ID
    ? queue?.items.find((item) => item.id === process.env.FLIXO_WORK_ITEM_ID) ?? null
    : null;
  const result = {
    mode: 'dry-run',
    result: conflicts.length ? 'FAIL' : 'PASS',
    parentSha: HEAD,
    conflicts: conflicts.map((claim) => claim.agentId).sort(),
    workItem: workItem ? { id: workItem.id, status: workItem.status, ownerAgentId: workItem.ownerAgentId ?? null } : null,
  };
  console.log(JSON.stringify(result, null, 2));
  if (conflicts.length) process.exitCode = 1;
}

async function mutate(action) {
  assertExactHead(HEAD);
  if (!AGENT || !AGENT_BRANCH_RE.test(BRANCH)) {
    fail('SWARM_OCC_CONFLICT', 'valid FLIXO_AGENT_ID and agent branch are required');
  }

  let state = reduce(await readEvents());
  await sweepExpired(state, HEAD);
  state = reduce(await readEvents());

  const events = await readEvents();
  const sequence = events.length + 1;
  const previousHash = events.at(-1)?.hash ?? 'GENESIS';
  const existing = state.claims.get(AGENT);

  if (action === 'check-in') {
    if (existing?.status === 'active' && parseTime(existing.leaseUntil, 'leaseUntil') > Date.now()) {
      fail('SWARM_OCC_CONFLICT', `${AGENT} already owns an active claim`);
    }
    const scope = parseScope();
    if (!scope.paths.length && !scope.contracts.length && !scope.rootCauseIds.length) {
      fail('SWARM_OCC_CONFLICT', 'claim scope cannot be empty');
    }
    const collisions = activeClaims(state).filter((claim) => claim.agentId !== AGENT && claimCollides(scope, claim));
    if (collisions.length) {
      fail('AGENT_COLLISION_DETECTED', collisions.map((claim) => claim.agentId).sort().join(','));
    }
    const now = new Date();
    const claim = {
      agentId: AGENT,
      branch: BRANCH,
      observedHeadSha: HEAD,
      scope: { paths: scope.paths, contracts: scope.contracts },
      rootCauseIds: scope.rootCauseIds,
      status: 'active',
      leasedAt: now.toISOString(),
      leaseUntil: new Date(now.getTime() + LEASE_MS).toISOString(),
      lastHeartbeatAt: now.toISOString(),
      sessionId: randomUUID(),
      workItemIds: process.env.FLIXO_WORK_ITEM_ID ? [process.env.FLIXO_WORK_ITEM_ID] : [],
    };
    const event = buildEvent('CLAIM_REQUEST', HEAD, AGENT, { claim }, sequence, previousHash);
    await atomicAppend(event);
    console.log(`CHECK_IN PASS seq=${event.sequence} hash=${event.hash}`);
    return;
  }

  if (action === 'heartbeat') {
    if (!existing || existing.status !== 'active') {
      fail('SWARM_OCC_CONFLICT', `no active claim for ${AGENT}`);
    }
    const leaseUntil = new Date(Date.now() + LEASE_MS).toISOString();
    const event = buildEvent('HEARTBEAT', HEAD, AGENT, { leaseUntil }, sequence, previousHash);
    await atomicAppend(event);
    console.log(`HEARTBEAT PASS seq=${event.sequence} hash=${event.hash}`);
    return;
  }

  if (action === 'check-out' || action === 'handoff') {
    if (!existing || !['active', 'handoff-pending'].includes(existing.status)) {
      fail('SWARM_OCC_CONFLICT', `no releasable claim for ${AGENT}`);
    }
    const eventType = action === 'handoff' ? 'HANDOFF_PENDING' : 'CHECK_OUT';
    const event = buildEvent(
      eventType,
      HEAD,
      AGENT,
      { handoffTo: action === 'handoff' ? process.env.FLIXO_AGENT_HANDOFF_TO ?? null : null },
      sequence,
      previousHash,
    );
    await atomicAppend(event);
    console.log(`${action.toUpperCase()} PASS seq=${event.sequence} hash=${event.hash}`);
    return;
  }

  if (action === 'bid') {
    const queue = await loadQueue();
    const workItem = queue.items.find((item) => item.id === process.env.FLIXO_WORK_ITEM_ID);
    if (!workItem) fail('SWARM_EVENT_STATE_CONFLICT', 'unknown work item');
    if (workItem.status !== 'available') fail('SWARM_EVENT_STATE_CONFLICT', `work item ${workItem.id} is not available`);
    const event = buildEvent(
      'BID_REQUEST',
      HEAD,
      AGENT,
      { workItemId: workItem.id, timestamp: new Date().toISOString() },
      sequence,
      previousHash,
    );
    await atomicAppend(event);
    console.log(`BID PASS seq=${event.sequence} hash=${event.hash}`);
    return;
  }

  fail('SWARM_EVENT_SCHEMA_ERROR', `unsupported action ${action}`);
}

async function replayOnly() {
  const events = await readEvents();
  const state = reduce(events);
  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        mode: 'replay-only',
        headSha: HEAD,
        sequence: events.length,
        lastHash: state.lastHash,
        activeClaims: activeClaims(state).map((claim) => claim.agentId).sort(),
        workItems: [...state.workItems.values()].sort((a, b) => a.id.localeCompare(b.id)),
      },
      null,
      2,
    ),
  );
}

function smokeTest() {
  const sameMillisecond = [
    { agentId: 'agent-b', timestamp: '2026-09-07T20:00:00.000Z' },
    { agentId: 'agent-a', timestamp: '2026-09-07T20:00:00.000Z' },
    { agentId: 'agent-c', timestamp: '2026-09-07T20:00:01.000Z' },
  ].sort(compareBids);
  if (sameMillisecond[0].agentId !== 'agent-a') fail('SWARM_TIE_BREAK_ERROR', 'same-ms tie must resolve by agentId');

  if (!overlaps('scripts/ci/swarm-engine.mjs', 'scripts/ci')) {
    fail('SWARM_COLLISION_TEST_ERROR', 'path-prefix overlap was not detected');
  }

  const nonConflict = {
    scope: { paths: ['src/components'], contracts: ['G4-A11Y-001'] },
    rootCauseIds: ['RC-G4-A11Y-001'],
  };
  const current = {
    scope: { paths: ['scripts/ci'], contracts: ['G1-ROUTE-001'] },
    rootCauseIds: ['RC-MATRIX-008'],
  };
  if (claimCollides(nonConflict, current)) {
    fail('SWARM_COLLISION_TEST_ERROR', 'disjoint paths/contracts/root causes incorrectly collided');
  }

  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        deterministicWinner: sameMillisecond[0].agentId,
        collisionIsolation: 'PASS',
        tieRule: 'timestamp-ms then agentId ASCII order',
      },
      null,
      2,
    ),
  );
}

const args = new Set(process.argv.slice(2));

try {
  if (args.has('--smoke-test')) {
    smokeTest();
  } else if (args.has('--replay-only')) {
    await replayOnly();
  } else if (args.has('--dry-run')) {
    const state = reduce(await readEvents());
    await dryRun(state);
  } else {
    await mutate(ACTION);
  }
} catch (error) {
  console.error(error?.message ?? error);
  process.exitCode = 1;
}
