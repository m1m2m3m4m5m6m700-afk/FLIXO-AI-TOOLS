#!/usr/bin/env node

export const FLIXO_WORKER_IDS = Object.freeze([
  'FLIXO1','FLIXO2','FLIXO3','FLIXO4','FLIXO5',
  'FLIXO6','FLIXO7','FLIXO8','FLIXO9','FLIXO10',
]);

export const FLIXO_ACTIVE_WORKER_GUARD = Object.freeze({
  schemaVersion: 1,
  protocol: 'FLIXO-ACTIVE-WORKER-GUARD-v1',
  heartbeatMaxAgeMs: 90 * 1000,
  initialWorker: 'FLIXO1',
  takeoverPolicy: 'NEXT_WORKER_ONLY_AFTER_HEARTBEAT_STALE',
  simultaneousActiveWorkers: 1,
  peerCompetition: 'FORBIDDEN',
});

const isWorker = (value) => FLIXO_WORKER_IDS.includes(String(value ?? '').trim().toUpperCase());
const nextWorker = (workerId) => {
  const id = String(workerId ?? '').trim().toUpperCase();
  const index = FLIXO_WORKER_IDS.indexOf(id);
  if (index < 0) throw new Error('FLIXO_ACTIVE_WORKER_UNKNOWN=' + id);
  return FLIXO_WORKER_IDS[(index + 1) % FLIXO_WORKER_IDS.length];
};

export function assertActiveWorkerGuardDefinition() {
  if (FLIXO_ACTIVE_WORKER_GUARD.heartbeatMaxAgeMs !== 90 * 1000) throw new Error('FLIXO_ACTIVE_WORKER_GUARD_HEARTBEAT_WINDOW_INVALID');
  if (FLIXO_ACTIVE_WORKER_GUARD.initialWorker !== 'FLIXO1') throw new Error('FLIXO_ACTIVE_WORKER_GUARD_INITIAL_WORKER_INVALID');
  if (FLIXO_ACTIVE_WORKER_GUARD.takeoverPolicy !== 'NEXT_WORKER_ONLY_AFTER_HEARTBEAT_STALE') throw new Error('FLIXO_ACTIVE_WORKER_GUARD_TAKEOVER_POLICY_INVALID');
  if (FLIXO_ACTIVE_WORKER_GUARD.simultaneousActiveWorkers !== 1) throw new Error('FLIXO_ACTIVE_WORKER_GUARD_SINGLE_ACTIVE_WORKER_REQUIRED');
  if (FLIXO_ACTIVE_WORKER_GUARD.peerCompetition !== 'FORBIDDEN') throw new Error('FLIXO_ACTIVE_WORKER_GUARD_COMPETITION_MUST_BE_FORBIDDEN');
  return true;
}

export function nextFlixoWorker(workerId) {
  assertActiveWorkerGuardDefinition();
  return nextWorker(workerId);
}

export function evaluateWorkerClaim({ seat = null, requestedAgent, taskId, sessionId, targetSha, now = Date.now() } = {}) {
  assertActiveWorkerGuardDefinition();
  const agentId = String(requestedAgent ?? '').trim().toUpperCase();
  if (!isWorker(agentId)) throw new Error('FLIXO_ACTIVE_WORKER_NOT_AUTHORIZED=' + agentId);
  if (!taskId || !sessionId) throw new Error('FLIXO_ACTIVE_WORKER_TASK_AND_SESSION_REQUIRED');
  if (!/^[a-f0-9]{40}$/iu.test(String(targetSha ?? ''))) throw new Error('FLIXO_ACTIVE_WORKER_EXACT_SHA_REQUIRED');

  if (!seat) {
    if (agentId !== FLIXO_ACTIVE_WORKER_GUARD.initialWorker) {
      throw new Error('FLIXO_ACTIVE_WORKER_GUARD_INITIAL_SLOT_RESERVED_FOR=' + FLIXO_ACTIVE_WORKER_GUARD.initialWorker);
    }
    return Object.freeze({ allowed: true, action: 'INITIAL_CLAIM', expectedAgent: agentId, previousAgent: null });
  }

  if (seat.taskId !== taskId) throw new Error('FLIXO_ACTIVE_WORKER_GUARD_TASK_BUSY=' + String(seat.taskId));
  if (seat.targetSha !== targetSha) throw new Error('FLIXO_ACTIVE_WORKER_GUARD_STALE_SHA');
  if (seat.agentId === agentId && seat.sessionId === sessionId) {
    return Object.freeze({ allowed: true, action: 'RENEW_EXISTING_OWNER', expectedAgent: agentId, previousAgent: agentId });
  }

  const heartbeatAt = Date.parse(String(seat.heartbeatAt ?? seat.lastSeenAt ?? ''));
  const ageMs = Number.isFinite(heartbeatAt) ? Math.max(0, Number(now) - heartbeatAt) : Number.POSITIVE_INFINITY;
  if (ageMs <= FLIXO_ACTIVE_WORKER_GUARD.heartbeatMaxAgeMs) {
    throw new Error(`FLIXO_ACTIVE_WORKER_GUARD_BUSY=${seat.agentId}:${seat.taskId}`);
  }

  const expectedAgent = nextWorker(seat.agentId);
  if (agentId !== expectedAgent) {
    throw new Error(`FLIXO_ACTIVE_WORKER_GUARD_NEXT_REQUIRED=${expectedAgent}`);
  }
  return Object.freeze({ allowed: true, action: 'FAILOVER_CLAIM', expectedAgent, previousAgent: seat.agentId, previousSessionId: seat.sessionId, staleAgeMs: ageMs });
}

export function buildActiveWorkerSeat({ taskId, sessionId, agentId, targetSha, previousSeat = null, now = new Date().toISOString(), takeover = false } = {}) {
  const result = evaluateWorkerClaim({ seat: previousSeat, requestedAgent: agentId, taskId, sessionId, targetSha, now: Date.parse(now) });
  if (!result.allowed) throw new Error('FLIXO_ACTIVE_WORKER_GUARD_CLAIM_BLOCKED');
  return Object.freeze({
    schemaVersion: 1,
    protocol: FLIXO_ACTIVE_WORKER_GUARD.protocol,
    taskId: String(taskId),
    sessionId: String(sessionId),
    agentId: String(agentId).toUpperCase(),
    targetSha: String(targetSha),
    state: 'ACTIVE',
    claimedAt: previousSeat && takeover ? previousSeat.claimedAt : now,
    heartbeatAt: now,
    lastSeenAt: now,
    immutableTask: true,
    simultaneousActiveWorkers: 1,
    previousAgent: previousSeat?.agentId ?? null,
    takeover: Boolean(takeover),
    takeoverReason: takeover ? 'PREVIOUS_HEARTBEAT_STALE_NEXT_WORKER' : null,
    noPeerTakeover: true,
  });
}
