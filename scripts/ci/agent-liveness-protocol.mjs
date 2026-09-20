#!/usr/bin/env node
export const AGENT_LIVENESS_PROTOCOL = Object.freeze({
  schemaVersion: 1,
  protocolId: 'AGENT_LIVENESS_PROTOCOL',
  protocolVersion: '1.0.0',
  authority: 'CONTROL_PLANE',
  heartbeatEveryMs: 5 * 60 * 1000,
  heartbeatGraceMs: 2 * 60 * 1000,
  leaseTtlMs: 15 * 60 * 1000,
  progressWindowMs: 10 * 60 * 1000,
  maxNoProgressHeartbeats: 3,
  workAssignedStates: Object.freeze([
    'BOOTING',
    'ACTIVE',
    'WAITING_EXTERNAL',
    'RECOVERING',
    'VERIFYING',
    'BLOCKED_EXTERNAL',
  ]),
  terminalStates: Object.freeze(['COMPLETE', 'ABORTED']),
  forbiddenStates: Object.freeze(['SLEEP', 'IDLE', 'SILENT', 'ABANDONED']),
  transitions: Object.freeze({
    BOOTING: ['ACTIVE', 'RECOVERING', 'ABORTED'],
    ACTIVE: ['ACTIVE', 'WAITING_EXTERNAL', 'RECOVERING', 'VERIFYING', 'BLOCKED_EXTERNAL', 'ABORTED'],
    WAITING_EXTERNAL: ['WAITING_EXTERNAL', 'ACTIVE', 'RECOVERING', 'BLOCKED_EXTERNAL', 'ABORTED'],
    RECOVERING: ['RECOVERING', 'ACTIVE', 'VERIFYING', 'ABORTED'],
    VERIFYING: ['VERIFYING', 'ACTIVE', 'RECOVERING', 'COMPLETE', 'BLOCKED_EXTERNAL', 'ABORTED'],
    BLOCKED_EXTERNAL: ['BLOCKED_EXTERNAL', 'ACTIVE', 'RECOVERING', 'VERIFYING', 'ABORTED'],
    COMPLETE: [],
    ABORTED: [],
  }),
  rules: Object.freeze([
    'NO_SILENT_STOP',
    'NO_SLEEP_WHILE_WORK_ASSIGNED',
    'NO_IDLE_WHILE_WORK_ASSIGNED',
    'HEARTBEAT_REQUIRED',
    'LEASE_EXPIRY_REQUIRES_RECOVERY',
    'NO_PROGRESS_REQUIRES_NEW_EVIDENCE_OR_STRATEGY',
    'EXTERNAL_WAIT_REQUIRES_HEARTBEAT',
    'COMPLETION_REQUIRES_EXACT_SHA_AND_ZERO_RED',
    'ABORT_REQUIRES_EXPLICIT_AUTHORITY',
    'RECOVERY_REPLACES_SILENT_WAIT',
  ]),
});

const terminal = new Set(AGENT_LIVENESS_PROTOCOL.terminalStates);
const forbidden = new Set(AGENT_LIVENESS_PROTOCOL.forbiddenStates);
const working = new Set(AGENT_LIVENESS_PROTOCOL.workAssignedStates);

export function assertLivenessDefinition() {
  if (!AGENT_LIVENESS_PROTOCOL.protocolVersion.startsWith('1.')) throw new Error('AGENT_LIVENESS_VERSION_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.heartbeatEveryMs <= 0 || AGENT_LIVENESS_PROTOCOL.leaseTtlMs <= AGENT_LIVENESS_PROTOCOL.heartbeatEveryMs) throw new Error('AGENT_LIVENESS_TIMING_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.maxNoProgressHeartbeats < 1) throw new Error('AGENT_LIVENESS_PROGRESS_THRESHOLD_INVALID');
  for (const state of working) {
    if (forbidden.has(state)) throw new Error('AGENT_LIVENESS_WORKING_FORBIDDEN_STATE');
  }
  return true;
}

export function assertState(state, { workAssigned = true } = {}) {
  assertLivenessDefinition();
  const value = String(state ?? '');
  if (forbidden.has(value)) throw new Error('AGENT_LIVENESS_FORBIDDEN_STATE=' + value);
  if (workAssigned && terminal.has(value)) throw new Error('AGENT_LIVENESS_TERMINAL_WITH_OPEN_WORK=' + value);
  if (workAssigned && !working.has(value)) throw new Error('AGENT_LIVENESS_UNKNOWN_WORK_STATE=' + value);
  return true;
}

export function assertTransition(from, to, { workAssigned = true, authorization = null } = {}) {
  assertState(from, { workAssigned });
  if (workAssigned && String(to) === 'ABORTED' && authorization !== 'EXPLICIT_ABORT_AUTHORITY') {
    throw new Error('AGENT_LIVENESS_ABORT_AUTHORITY_REQUIRED');
  }
  assertState(to, { workAssigned: false });
  if (!AGENT_LIVENESS_PROTOCOL.transitions[from]?.includes(to)) {
    throw new Error(`AGENT_LIVENESS_TRANSITION_BLOCKED=${from}->${to}`);
  }
  if (workAssigned && forbidden.has(to)) throw new Error('AGENT_LIVENESS_FORBIDDEN_TRANSITION=' + to);
  return true;
}

export function checkHeartbeat({ state, workAssigned = true, lastHeartbeatAt, now = Date.now() } = {}) {
  assertState(state, { workAssigned });
  if (!workAssigned) return Object.freeze({ ok: true, reason: 'NO_ASSIGNED_WORK' });
  const last = Date.parse(String(lastHeartbeatAt ?? ''));
  if (!Number.isFinite(last)) return Object.freeze({ ok: false, action: 'RECOVERY_REQUIRED', reason: 'HEARTBEAT_MISSING' });
  const ageMs = Math.max(0, Number(now) - last);
  if (ageMs <= AGENT_LIVENESS_PROTOCOL.heartbeatEveryMs + AGENT_LIVENESS_PROTOCOL.heartbeatGraceMs) {
    return Object.freeze({ ok: true, ageMs, action: 'CONTINUE' });
  }
  return Object.freeze({
    ok: false,
    ageMs,
    action: 'RECOVERY_REQUIRED',
    reason: 'HEARTBEAT_STALE',
    nextState: 'RECOVERING',
  });
}

export function checkProgress({ state, workAssigned = true, lastProgressAt, now = Date.now(), consecutiveNoProgress = 0 } = {}) {
  assertState(state, { workAssigned });
  if (!workAssigned) return Object.freeze({ ok: true, reason: 'NO_ASSIGNED_WORK' });
  const last = Date.parse(String(lastProgressAt ?? ''));
  const ageMs = Number.isFinite(last) ? Math.max(0, Number(now) - last) : Number.POSITIVE_INFINITY;
  if (ageMs <= AGENT_LIVENESS_PROTOCOL.progressWindowMs) {
    return Object.freeze({ ok: true, ageMs, consecutiveNoProgress: 0, action: 'CONTINUE' });
  }
  const nextCount = Math.max(0, Number(consecutiveNoProgress) || 0) + 1;
  return Object.freeze({
    ok: false,
    ageMs,
    consecutiveNoProgress: nextCount,
    action: nextCount >= AGENT_LIVENESS_PROTOCOL.maxNoProgressHeartbeats ? 'STRATEGY_ROTATION_REQUIRED' : 'PROGRESS_REQUIRED',
    nextState: 'RECOVERING',
  });
}

export function completionGate({ state, workAssigned = true, exactShaVerified, requiredRedCount = 0, regressionPassed, learningRecorded } = {}) {
  if (state !== 'VERIFYING') throw new Error('AGENT_LIVENESS_COMPLETION_STATE_INVALID');
  if (workAssigned !== true) throw new Error('AGENT_LIVENESS_COMPLETION_WORK_FLAG_INVALID');
  if (exactShaVerified !== true) throw new Error('AGENT_LIVENESS_COMPLETION_EXACT_SHA_REQUIRED');
  if (Number(requiredRedCount) !== 0) throw new Error('AGENT_LIVENESS_COMPLETION_RED_REMAINS');
  if (regressionPassed !== true) throw new Error('AGENT_LIVENESS_COMPLETION_REGRESSION_REQUIRED');
  if (learningRecorded !== true) throw new Error('AGENT_LIVENESS_COMPLETION_LEARNING_REQUIRED');
  return Object.freeze({ ok: true, state: 'COMPLETE' });
}

export function buildRecoveryDirective({ reason, currentState = 'ACTIVE', newEvidenceRequired = true } = {}) {
  assertState(currentState, { workAssigned: true });
  return Object.freeze({
    protocolId: AGENT_LIVENESS_PROTOCOL.protocolId,
    action: 'RECOVER_AND_CONTINUE',
    reason: String(reason || 'LIVENESS_FAILURE'),
    from: currentState,
    to: 'RECOVERING',
    newEvidenceRequired: Boolean(newEvidenceRequired),
    forbidden: [...AGENT_LIVENESS_PROTOCOL.forbiddenStates],
    next: 'reacquire_or_renew_lease -> capture_state -> change_strategy_or_evidence -> continue_until_verified',
  });
}

const command = process.argv[2] ?? 'validate';
try {
  if (command === 'validate') {
    assertLivenessDefinition();
    console.log(JSON.stringify({ status: 'PASS', protocolId: AGENT_LIVENESS_PROTOCOL.protocolId, version: AGENT_LIVENESS_PROTOCOL.protocolVersion, forbiddenStates: [...AGENT_LIVENESS_PROTOCOL.forbiddenStates] }, null, 2));
  } else if (command === 'check-heartbeat') {
    console.log(JSON.stringify(checkHeartbeat({
      state: process.argv.find((v) => v.startsWith('--state='))?.slice(8) ?? 'ACTIVE',
      lastHeartbeatAt: process.argv.find((v) => v.startsWith('--last='))?.slice(7),
    }), null, 2));
  } else if (command === 'check-progress') {
    console.log(JSON.stringify(checkProgress({
      state: process.argv.find((v) => v.startsWith('--state='))?.slice(8) ?? 'ACTIVE',
      lastProgressAt: process.argv.find((v) => v.startsWith('--last='))?.slice(7),
      consecutiveNoProgress: Number(process.argv.find((v) => v.startsWith('--count='))?.slice(8) ?? 0),
    }), null, 2));
  } else {
    throw new Error('Usage: agent-liveness-protocol.mjs validate|check-heartbeat|check-progress');
  }
} catch (error) {
  console.error('AGENT_LIVENESS_PROTOCOL_BLOCK=' + String(error?.message ?? error));
  process.exitCode = 1;
}
