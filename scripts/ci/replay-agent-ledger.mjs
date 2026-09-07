import { createHash, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const HEX = /^[0-9a-f]{40}$/u;
const EVENT_TYPES = new Set([
  'STATE_BOOTSTRAP', 'WORK_QUEUE_RECONCILE', 'CLAIM_REQUEST', 'HEARTBEAT',
  'CHECK_OUT', 'HANDOFF_PENDING', 'BID_REQUEST', 'CLAIM_AWARDED', 'EXPIRED_EVICTED',
]);
const VALID_STATUSES = new Set(['available', 'ready', 'waiting_on_dependencies', 'in_progress', 'completed', 'blocked', 'blocked_by_ci']);

const fail = (message) => { throw new Error(`SWARM_LEDGER_INVALID: ${message}`); };
const canonical = (value) => JSON.stringify(value, Object.keys(value).sort());
const hashEvent = (event) => {
  const unsigned = { ...event };
  delete unsigned.hash;
  delete unsigned.signature;
  return createHash('sha256').update(canonical(unsigned)).digest('hex');
};
const parseTime = (value, field) => {
  const time = Date.parse(value ?? '');
  if (!Number.isFinite(time)) fail(`${field} must be ISO-8601`);
  return time;
};
const normalizePath = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\.?\/+/, '').replace(/\/+$/u, '');
const overlaps = (left, right) => {
  const a = normalizePath(left);
  const b = normalizePath(right);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
};
const claimCollides = (a, b) =>
  (a.scope?.paths ?? []).some((p) => (b.scope?.paths ?? []).some((q) => overlaps(p, q))) ||
  (a.scope?.contracts ?? []).some((id) => (b.scope?.contracts ?? []).includes(id)) ||
  (a.rootCauseIds ?? []).some((id) => (b.rootCauseIds ?? []).includes(id));

export function replayAgentLedger(text, { headSha = '', isAncestor = defaultIsAncestor, signingKey = '', now = Date.now() } = {}) {
  const rows = String(text ?? '').split(/\r?\n/u).filter(Boolean);
  if (!rows.length) fail('event ledger is empty');
  if (headSha && !HEX.test(headSha)) fail('current HEAD is invalid');
  const claims = new Map();
  const workItems = new Map();
  const bids = new Map();
  let previousHash = 'GENESIS';
  let previousTimestamp = 0;
  const events = [];

  for (let index = 0; index < rows.length; index += 1) {
    let event;
    try { event = JSON.parse(rows[index]); } catch { fail(`invalid JSON at sequence ${index + 1}`); }
    const sequence = index + 1;
    if (event?.schemaVersion !== 1 || event.protocol !== 'FLIXO swarm event ledger') fail(`schema/protocol mismatch at ${sequence}`);
    if (event.sequence !== sequence) fail(`sequence mismatch at ${sequence}`);
    if (sequence > 1 && event.parentSequence !== sequence - 1) fail(`parentSequence mismatch at ${sequence}`);
    if (event.prevHash !== previousHash) fail(`prevHash mismatch at ${sequence}`);
    if (!HEX.test(event.parentSha ?? '')) fail(`parentSha invalid at ${sequence}`);
    if (headSha && !awaitableAncestor(isAncestor, event.parentSha, headSha)) fail(`parentSha is not ancestor of current head at ${sequence}`);
    if (!event.eventId || !event.agentId || !EVENT_TYPES.has(event.type)) fail(`identity/type invalid at ${sequence}`);
    const timestamp = parseTime(event.timestamp, `event ${sequence}.timestamp`);
    if (timestamp < previousTimestamp) fail(`timestamp regression at ${sequence}`);
    if (hashEvent(event) !== event.hash) fail(`hash mismatch at ${sequence}`);
    if (event.signature) {
      if (!signingKey) fail(`signature ${sequence} unverifiable`);
      const signature = createHmac('sha256', signingKey).update(event.hash).digest('hex');
      if (signature !== event.signature) fail(`signature mismatch at ${sequence}`);
    }
    const p = event.payload ?? {};
    if (event.type === 'STATE_BOOTSTRAP') {
      if (sequence !== 1 || events.length) fail('invalid bootstrap placement');
      for (const claim of p.claims ?? []) claims.set(claim.agentId, { ...claim });
      for (const item of p.workItems ?? []) workItems.set(item.id, { ...item });
    } else if (event.type === 'WORK_QUEUE_RECONCILE') {
      for (const patch of p.workItems ?? []) {
        const item = workItems.get(patch.id);
        if (!item) fail(`reconcile references unknown work item ${patch.id}`);
        if (!VALID_STATUSES.has(patch.status)) fail(`invalid status for ${patch.id}`);
        item.status = patch.status;
        item.ownerAgentId = patch.ownerAgentId ?? null;
        if (patch.awardedAt !== undefined) item.awardedAt = patch.awardedAt;
      }
    } else if (event.type === 'CLAIM_REQUEST') {
      const claim = p.claim;
      if (!claim?.agentId || !Array.isArray(claim.scope?.paths) || !Array.isArray(claim.scope?.contracts) || !Array.isArray(claim.rootCauseIds)) fail(`invalid claim at ${sequence}`);
      for (const current of claims.values()) {
        if (current.status !== 'active' || current.agentId === claim.agentId) continue;
        if (parseTime(current.leaseUntil, `${current.agentId}.leaseUntil`) <= timestamp) continue;
        if (claimCollides(claim, current)) fail(`claim collision at ${sequence}`);
      }
      claims.set(claim.agentId, { ...claim, status: 'active' });
    } else if (event.type === 'HEARTBEAT') {
      const claim = claims.get(event.agentId);
      if (!claim || claim.status !== 'active') fail(`heartbeat without active claim at ${sequence}`);
      if (timestamp > parseTime(claim.leaseUntil, `${event.agentId}.leaseUntil`)) fail(`late heartbeat at ${sequence}`);
      if (!p.leaseUntil) fail(`heartbeat leaseUntil missing at ${sequence}`);
      claim.lastHeartbeatAt = event.timestamp;
      claim.leaseUntil = p.leaseUntil;
      claim.lastReanchorSha = event.parentSha;
    } else if (event.type === 'CHECK_OUT' || event.type === 'HANDOFF_PENDING') {
      const claim = claims.get(event.agentId);
      if (!claim || !['active', 'handoff-pending'].includes(claim.status)) fail(`release without claim at ${sequence}`);
      claim.status = event.type === 'HANDOFF_PENDING' ? 'handoff-pending' : 'released';
      claim.releasedAt = event.timestamp;
      claim.lastReanchorSha = event.parentSha;
      if (p.handoffTo) claim.handoffTo = p.handoffTo;
    } else if (event.type === 'BID_REQUEST') {
      if (!workItems.has(p.workItemId) || !p.timestamp) fail(`invalid bid at ${sequence}`);
      parseTime(p.timestamp, `bid ${sequence}.timestamp`);
      const list = bids.get(p.workItemId) ?? [];
      if (list.some((bid) => bid.agentId === event.agentId && bid.timestamp === p.timestamp)) fail(`duplicate bid at ${sequence}`);
      list.push({ agentId: event.agentId, timestamp: p.timestamp });
      bids.set(p.workItemId, list);
    } else if (event.type === 'CLAIM_AWARDED') {
      const item = workItems.get(p.workItemId);
      if (!item) fail(`award references unknown work item at ${sequence}`);
      const winner = [...(bids.get(p.workItemId) ?? [])].sort((a, b) => parseTime(a.timestamp, 'left bid') - parseTime(b.timestamp, 'right bid') || a.agentId.localeCompare(b.agentId))[0];
      if (!winner || winner.agentId !== p.agentId) fail(`tie-break violation at ${sequence}`);
      item.status = 'in_progress';
      item.ownerAgentId = p.agentId;
      item.awardedAt = event.timestamp;
      const claim = claims.get(p.agentId);
      if (claim?.status === 'active') {
        claim.workItemIds = [...new Set([...(claim.workItemIds ?? []), p.workItemId])];
      }
    } else if (event.type === 'EXPIRED_EVICTED') {
      const claim = claims.get(p.agentId);
      if (!claim) fail(`eviction references unknown agent at ${sequence}`);
      const leaseExpired = timestamp > parseTime(claim.leaseUntil, `${p.agentId}.leaseUntil`);
      const heartbeatExpired = timestamp - parseTime(claim.lastHeartbeatAt ?? claim.leasedAt, `${p.agentId}.heartbeat`) > 600_000;
      if (!leaseExpired && !heartbeatExpired) fail(`premature eviction at ${sequence}`);
      claim.status = 'released';
      claim.eviction = 'expired_evicted';
      claim.releasedAt = event.timestamp;
      if (p.workItemId) {
        const item = workItems.get(p.workItemId);
        if (!item) fail(`evicted work item unknown at ${sequence}`);
        item.status = 'available';
        item.ownerAgentId = null;
        item.awardedAt = null;
      }
    }
    previousHash = event.hash;
    previousTimestamp = timestamp;
    events.push(event);
  }

  for (const claim of claims.values()) {
    if (claim.status === 'active' && (now > parseTime(claim.leaseUntil, `${claim.agentId}.leaseUntil`) || now - parseTime(claim.lastHeartbeatAt ?? claim.leasedAt, `${claim.agentId}.heartbeat`) > 600_000)) {
      fail(`stale active claim ${claim.agentId} missing EXPIRED_EVICTED`);
    }
  }
  return { events, claims, workItems, bids, lastHash: previousHash };
}

async function awaitableAncestor(fn, ancestor, descendant) {
  const result = fn(ancestor, descendant);
  return result instanceof Promise ? await result : result;
}

function defaultIsAncestor(ancestor, descendant) {
  if (ancestor === descendant) return true;
  if (!HEX.test(ancestor) || !HEX.test(descendant)) return false;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export { claimCollides, overlaps, normalizePath, VALID_STATUSES };
