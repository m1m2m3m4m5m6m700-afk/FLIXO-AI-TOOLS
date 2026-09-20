#!/usr/bin/env node
export const AGENT_LIVENESS_PROTOCOL = Object.freeze({
  schemaVersion: 2,
  protocolId: 'AGENT_LIVENESS_PROTOCOL',
  protocolVersion: '2.1.0',
  authority: 'CONTROL_PLANE',
  heartbeatEveryMs: 5 * 60 * 1000,
  heartbeatGraceMs: 2 * 60 * 1000,
  leaseTtlMs: 15 * 60 * 1000,
  progressWindowMs: 10 * 60 * 1000,
  maxNoProgressHeartbeats: 3,
  sessionPolicy: Object.freeze({
    maxSessionCycles: 12,
    sessionBudgetScopedOnly: true,
    sessionEndIsNotTaskCompletion: true,
    nonGreenSessionAction: 'RECOVER_AND_REDISPATCH',
    taskRemainsOpen: true,
    terminalCompletion: 'GREEN_ONLY',
  }),
  workAssignedStates: Object.freeze([
    'BOOTING',
    'ACTIVE',
    'WAITING_EXTERNAL',
    'RECOVERING',
    'VERIFYING',
    'BLOCKED_EXTERNAL',
  ]),
  terminalStates: Object.freeze(['COMPLETE', 'ABORTED']),
  forbiddenStates: Object.freeze(['SILENT', 'ABANDONED']),
  protectedRestStates: Object.freeze(['SLEEP', 'IDLE']),
  sleepPolicy: Object.freeze({
    requiresGreenRecord: true,
    greenAuthority: 'DAILY_FLIXO_GREEN_GATE',
    greenConclusion: 'success',
    zeroRedRequired: true,
    exactShaRequired: true,
    openWorkBlocksSleep: true,
  }),
  transitions: Object.freeze({
    BOOTING: ['ACTIVE', 'RECOVERING', 'ABORTED'],
    ACTIVE: ['ACTIVE', 'WAITING_EXTERNAL', 'RECOVERING', 'VERIFYING', 'BLOCKED_EXTERNAL', 'ABORTED'],
    WAITING_EXTERNAL: ['WAITING_EXTERNAL', 'ACTIVE', 'RECOVERING', 'BLOCKED_EXTERNAL', 'ABORTED'],
    RECOVERING: ['RECOVERING', 'ACTIVE', 'VERIFYING', 'ABORTED'],
    VERIFYING: ['VERIFYING', 'ACTIVE', 'RECOVERING', 'COMPLETE', 'BLOCKED_EXTERNAL', 'ABORTED'],
    BLOCKED_EXTERNAL: ['BLOCKED_EXTERNAL', 'ACTIVE', 'RECOVERING', 'VERIFYING', 'ABORTED'],
    COMPLETE: ['SLEEP', 'IDLE'],
    SLEEP: ['ACTIVE'],
    IDLE: ['ACTIVE'],
    ABORTED: [] ,
  }),
  rules: Object.freeze([
    'SESSION_BUDGET_IS_NOT_TASK_COMPLETION',
    'OPEN_WORK_REMAINS_OPEN_AFTER_SESSION_END',
    'NON_GREEN_SESSION_END_REQUIRES_RECOVERY_AND_REDISPATCH',
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
    'NO_SLEEP_WITHOUT_GREEN_RECORD',
    'NO_IDLE_WITHOUT_GREEN_RECORD',
    'GREEN_RECORD_MUST_MATCH_TARGET_SHA',
    'OPEN_WORK_BLOCKS_SLEEP',
  ]),
});

const terminal = new Set(AGENT_LIVENESS_PROTOCOL.terminalStates);
const forbidden = new Set(AGENT_LIVENESS_PROTOCOL.forbiddenStates);
const protectedRest = new Set(AGENT_LIVENESS_PROTOCOL.protectedRestStates);
const working = new Set(AGENT_LIVENESS_PROTOCOL.workAssignedStates);

export function assertLivenessDefinition() {
  if (!AGENT_LIVENESS_PROTOCOL.protocolVersion.startsWith('2.')) throw new Error('AGENT_LIVENESS_VERSION_INVALID');
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
  if (!workAssigned && !terminal.has(value) && !protectedRest.has(value) && !working.has(value)) throw new Error('AGENT_LIVENESS_UNKNOWN_REST_STATE=' + value);
  return true;
}

export function assertTransition(from, to, { workAssigned = true, authorization = null, greenRecord = null, targetSha = null, taskId = null, fingerprint = null } = {}) {
  assertState(from, { workAssigned });
  const target = String(to);
  if (workAssigned && target === 'ABORTED' && authorization !== 'EXPLICIT_ABORT_AUTHORITY') {
    throw new Error('AGENT_LIVENESS_ABORT_AUTHORITY_REQUIRED');
  }
  if (target === 'COMPLETE') {
    validateGreenRecord(greenRecord, { targetSha, taskId, fingerprint });
  }
  if (protectedRest.has(target)) {
    if (workAssigned) throw new Error('AGENT_LIVENESS_REST_WITH_OPEN_WORK');
    if (!['COMPLETE'].includes(String(from))) throw new Error('AGENT_LIVENESS_REST_ENTRY_STATE_INVALID');
    validateGreenRecord(greenRecord, { targetSha, taskId, fingerprint });
  }
  assertState(target, { workAssigned: false });
  if (!AGENT_LIVENESS_PROTOCOL.transitions[from]?.includes(target)) {
    throw new Error(`AGENT_LIVENESS_TRANSITION_BLOCKED=${from}->${target}`);
  }
  if (workAssigned && protectedRest.has(target)) throw new Error('AGENT_LIVENESS_REST_TRANSITION_BLOCKED=' + target);
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

export function sessionTerminationDirective({ canonicalGreen = false, greenRecord = null, targetSha = null, taskId = null, fingerprint = null, reason = 'SESSION_BUDGET_EXHAUSTED' } = {}) {
  if (canonicalGreen === true) {
    validateGreenRecord(greenRecord, { targetSha, taskId, fingerprint });
    return Object.freeze({
      protocolId: AGENT_LIVENESS_PROTOCOL.protocolId,
      action: 'CLOSE_ALLOWED',
      taskRemainsOpen: false,
      reason: 'CANONICAL_GREEN_PROVEN',
      targetSha: greenRecord.targetSha,
    });
  }
  return Object.freeze({
    protocolId: AGENT_LIVENESS_PROTOCOL.protocolId,
    action: 'RECOVER_AND_REDISPATCH',
    taskRemainsOpen: true,
    reason: String(reason),
    next: 'reacquire_or_renew_lease -> capture_state -> new_evidence_or_strategy -> continue_until_verified',
  });
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


const GREEN_SHA_RE = /^[a-f0-9]{40}$/u;

export function validateGreenRecord(greenRecord, { targetSha = null, taskId = null, fingerprint = null } = {}) {
  if (!greenRecord || typeof greenRecord !== 'object') throw new Error('AGENT_LIVENESS_GREEN_RECORD_REQUIRED');
  if (greenRecord.source !== AGENT_LIVENESS_PROTOCOL.sleepPolicy.greenAuthority) throw new Error('AGENT_LIVENESS_GREEN_AUTHORITY_INVALID');
  if (greenRecord.conclusion !== AGENT_LIVENESS_PROTOCOL.sleepPolicy.greenConclusion) throw new Error('AGENT_LIVENESS_GREEN_CONCLUSION_INVALID');
  if (greenRecord.zeroRed !== true) throw new Error('AGENT_LIVENESS_GREEN_RED_REMAINS');
  if (greenRecord.exactShaVerified !== true) throw new Error('AGENT_LIVENESS_GREEN_EXACT_SHA_REQUIRED');
  if (!GREEN_SHA_RE.test(String(greenRecord.targetSha ?? ''))) throw new Error('AGENT_LIVENESS_GREEN_TARGET_SHA_INVALID');
  if (targetSha && greenRecord.targetSha !== targetSha) throw new Error('AGENT_LIVENESS_GREEN_TARGET_SHA_MISMATCH');
  if (taskId && greenRecord.taskId !== taskId) throw new Error('AGENT_LIVENESS_GREEN_TASK_MISMATCH');
  if (fingerprint && greenRecord.fingerprint !== fingerprint) throw new Error('AGENT_LIVENESS_GREEN_FINGERPRINT_MISMATCH');
  if (!greenRecord.recordId || !greenRecord.recordedAt) throw new Error('AGENT_LIVENESS_GREEN_RECORD_IDENTITY_MISSING');
  return Object.freeze({ ok: true, recordId: greenRecord.recordId, targetSha: greenRecord.targetSha });
}

export function sleepAdmission({ workAssigned = false, greenRecord = null, targetSha = null, taskId = null, fingerprint = null } = {}) {
  validateGreenRecord(greenRecord, { targetSha, taskId, fingerprint });
  if (workAssigned) throw new Error('AGENT_LIVENESS_SLEEP_BLOCKED_OPEN_WORK');
  assertTransition('COMPLETE','SLEEP',{workAssigned:false,greenRecord,targetSha,taskId,fingerprint});
  return Object.freeze({ ok: true, state: 'SLEEP', admission: 'GREEN_RECORD_VERIFIED' });
}

export function idleAdmission({ workAssigned = false, greenRecord = null, targetSha = null, taskId = null, fingerprint = null } = {}) {
  validateGreenRecord(greenRecord, { targetSha, taskId, fingerprint });
  if (workAssigned) throw new Error('AGENT_LIVENESS_IDLE_BLOCKED_OPEN_WORK');
  assertTransition('COMPLETE','IDLE',{workAssigned:false,greenRecord,targetSha,taskId,fingerprint});
  return Object.freeze({ ok: true, state: 'IDLE', admission: 'GREEN_RECORD_VERIFIED' });
}
