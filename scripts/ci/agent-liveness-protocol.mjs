#!/usr/bin/env node
export const AGENT_LIVENESS_PROTOCOL = Object.freeze({
  schemaVersion: 4,
  contractRank: 'SUPREME_AUTOMATION_RESIDENCY',
  authorityScope: 'ENTIRE_REPAIR_AUTOMATION_PLANE',
  protocolId: 'AGENT_LIVENESS_PROTOCOL',
  protocolVersion: '4.0.0',
  authority: 'CONTROL_PLANE',
  heartbeatEveryMs: 60 * 1000,
  heartbeatGraceMs: 30 * 1000,
  wakeIntervalMs: 60 * 1000,
  activeRepairWindowMs: 45 * 60 * 1000,
  manualWakeRequired: false,
  selfDisableAllowed: false,
  selfAbortAllowed: false,
  leaseTtlMs: 15 * 60 * 1000,
  progressWindowMs: 10 * 60 * 1000,
  maxNoProgressHeartbeats: 3,
  sessionPolicy: Object.freeze({
    maxSessionCycles: 12,
    sessionBudgetScopedOnly: true,
    minimumActiveWindowMs: 45 * 60 * 1000,
    minimumActiveWindowEnforced: true,
    sessionEndIsNotTaskCompletion: true,
    nonGreenSessionAction: 'RECOVER_AND_REDISPATCH',
    taskRemainsOpen: true,
    terminalCompletion: 'GREEN_ONLY',
    permanentResidency: true,
    noSleepDuringActiveWindow: true,
    noIdleDuringActiveWindow: true,
    cellLabRequired: true,
    zeroErrorTarget: true,
  }),
  workAssignedStates: Object.freeze([
    'BOOTING','ACTIVE','WAITING_EXTERNAL','RECOVERING','VERIFYING','BLOCKED_EXTERNAL',
  ]),
  terminalStates: Object.freeze(['COMPLETE']),
  forbiddenStates: Object.freeze(['SLEEP','IDLE','SILENT','ABANDONED']),
  transitions: Object.freeze({
    BOOTING: ['ACTIVE','RECOVERING'],
    ACTIVE: ['ACTIVE','WAITING_EXTERNAL','RECOVERING','VERIFYING','BLOCKED_EXTERNAL'],
    WAITING_EXTERNAL: ['WAITING_EXTERNAL','ACTIVE','RECOVERING','BLOCKED_EXTERNAL'],
    RECOVERING: ['RECOVERING','ACTIVE','VERIFYING'],
    VERIFYING: ['VERIFYING','ACTIVE','RECOVERING','COMPLETE','BLOCKED_EXTERNAL'],
    BLOCKED_EXTERNAL: ['BLOCKED_EXTERNAL','ACTIVE','RECOVERING','VERIFYING'],
    COMPLETE: ['COMPLETE','ACTIVE'],
  }),
  rules: Object.freeze([
    'PERMANENT_RESIDENCY',
    'NO_SLEEP',
    'NO_IDLE',
    'NO_SILENT_STOP',
    'OPEN_WORK_REMAINS_OPEN',
    'NON_GREEN_SESSION_END_REQUIRES_RECOVERY_AND_REDISPATCH',
    'HEARTBEAT_REQUIRED',
    'LEASE_EXPIRY_REQUIRES_RECOVERY',
    'NO_PROGRESS_REQUIRES_NEW_EVIDENCE_OR_STRATEGY',
    'EXTERNAL_WAIT_REQUIRES_HEARTBEAT',
    'COMPLETION_REQUIRES_EXACT_SHA_AND_ZERO_RED',
    'EXIT_REQUIRES_CANONICAL_GREEN',
    'ABORT_REQUIRES_EXPLICIT_AUTHORITY',
    'RECOVERY_REPLACES_SILENT_WAIT',
    'GREEN_DOES_NOT_SUSPEND_RESIDENT_AGENT',
    'RUN_END_DOES_NOT_END_TASK',
    'TIMEOUT_DOES_NOT_END_TASK',
    'SESSION_BUDGET_DOES_NOT_END_TASK',
    'MANUAL_WAKE_MUST_NEVER_BE_REQUIRED',
    'SELF_DISABLE_FORBIDDEN',
    'SELF_ABORT_FORBIDDEN',
    'LIVENESS_FAILURE_MUST_REENTER_CANONICAL_WAKE_PATH',
  ]),
});

const terminal = new Set(AGENT_LIVENESS_PROTOCOL.terminalStates);
const forbidden = new Set(AGENT_LIVENESS_PROTOCOL.forbiddenStates);
const working = new Set(AGENT_LIVENESS_PROTOCOL.workAssignedStates);

export function assertLivenessDefinition() {
  if (!AGENT_LIVENESS_PROTOCOL.protocolVersion.startsWith('4.')) throw new Error('AGENT_LIVENESS_VERSION_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.heartbeatEveryMs <= 0 || AGENT_LIVENESS_PROTOCOL.leaseTtlMs <= AGENT_LIVENESS_PROTOCOL.heartbeatEveryMs) throw new Error('AGENT_LIVENESS_TIMING_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.maxNoProgressHeartbeats < 1) throw new Error('AGENT_LIVENESS_PROGRESS_THRESHOLD_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.heartbeatEveryMs !== 60 * 1000) throw new Error('AGENT_LIVENESS_HEARTBEAT_NOT_ONE_MINUTE');
  if (AGENT_LIVENESS_PROTOCOL.heartbeatGraceMs !== 30 * 1000) throw new Error('AGENT_LIVENESS_HEARTBEAT_GRACE_NOT_THIRTY_SECONDS');
  if (AGENT_LIVENESS_PROTOCOL.activeRepairWindowMs !== 45 * 60 * 1000) throw new Error('AGENT_LIVENESS_ACTIVE_WINDOW_NOT_FORTY_FIVE_MINUTES');
  if (AGENT_LIVENESS_PROTOCOL.sessionPolicy.minimumActiveWindowMs !== AGENT_LIVENESS_PROTOCOL.activeRepairWindowMs || AGENT_LIVENESS_PROTOCOL.sessionPolicy.minimumActiveWindowEnforced !== true) throw new Error('AGENT_LIVENESS_ACTIVE_WINDOW_POLICY_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.sessionPolicy.noSleepDuringActiveWindow !== true || AGENT_LIVENESS_PROTOCOL.sessionPolicy.noIdleDuringActiveWindow !== true) throw new Error('AGENT_LIVENESS_ACTIVE_WINDOW_RESIDENCY_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.sessionPolicy.cellLabRequired !== true || AGENT_LIVENESS_PROTOCOL.sessionPolicy.zeroErrorTarget !== true) throw new Error('AGENT_LIVENESS_CELL_LAB_OR_ZERO_ERROR_POLICY_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.manualWakeRequired !== false) throw new Error('AGENT_LIVENESS_MANUAL_WAKE_FORBIDDEN');
  if (AGENT_LIVENESS_PROTOCOL.selfDisableAllowed !== false || AGENT_LIVENESS_PROTOCOL.selfAbortAllowed !== false) throw new Error('AGENT_LIVENESS_SELF_DISABLE_OR_ABORT_FORBIDDEN');
  for (const state of working) if (forbidden.has(state)) throw new Error('AGENT_LIVENESS_WORKING_FORBIDDEN_STATE');
  return true;
}

export function assertState(state, { workAssigned = true } = {}) {
  assertLivenessDefinition();
  const value = String(state ?? '');
  if (forbidden.has(value)) throw new Error('AGENT_LIVENESS_FORBIDDEN_STATE=' + value);
  if (workAssigned && terminal.has(value)) throw new Error('AGENT_LIVENESS_TERMINAL_WITH_OPEN_WORK=' + value);
  if (workAssigned && !working.has(value)) throw new Error('AGENT_LIVENESS_UNKNOWN_WORK_STATE=' + value);
  if (!workAssigned && !terminal.has(value) && !working.has(value)) throw new Error('AGENT_LIVENESS_UNKNOWN_RESIDENT_STATE=' + value);
  return true;
}

function validateCompletionEvidence({ exactShaVerified, requiredRedCount, regressionPassed, learningRecorded } = {}) {
  if (exactShaVerified !== true) throw new Error('AGENT_LIVENESS_COMPLETION_EXACT_SHA_REQUIRED');
  if (Number(requiredRedCount) !== 0) throw new Error('AGENT_LIVENESS_COMPLETION_RED_REMAINS');
  if (regressionPassed !== true) throw new Error('AGENT_LIVENESS_COMPLETION_REGRESSION_REQUIRED');
  if (learningRecorded !== true) throw new Error('AGENT_LIVENESS_COMPLETION_LEARNING_REQUIRED');
}

export function assertTransition(from, to, { workAssigned = true, exactShaVerified = false, requiredRedCount = 0, regressionPassed = false, learningRecorded = false } = {}) {
  assertState(from, { workAssigned });
  const target = String(to);
  if (workAssigned && target === 'ABORTED') throw new Error('AGENT_LIVENESS_ABORT_DISABLED_PERMANENT_RESIDENCY');
  if (target === 'COMPLETE') validateCompletionEvidence({ exactShaVerified, requiredRedCount, regressionPassed, learningRecorded });
  if (forbidden.has(target)) throw new Error('AGENT_LIVENESS_PERMANENT_RESIDENCY_BLOCK=' + target);
  const transitions = AGENT_LIVENESS_PROTOCOL.transitions[from] ?? [];
  if (!transitions.includes(target)) throw new Error(`AGENT_LIVENESS_TRANSITION_BLOCKED=${from}->${target}`);
  assertState(target, { workAssigned: target !== 'COMPLETE' });
  return true;
}

export function checkHeartbeat({ state, workAssigned = true, lastHeartbeatAt, now = Date.now() } = {}) {
  assertState(state, { workAssigned });
  if (!workAssigned && state === 'COMPLETE') return Object.freeze({ ok: true, action: 'READY_RESIDENT' });
  const last = Date.parse(String(lastHeartbeatAt ?? ''));
  if (!Number.isFinite(last)) return Object.freeze({ ok: false, action: 'RECOVERY_REQUIRED', reason: 'HEARTBEAT_MISSING' });
  const ageMs = Math.max(0, Number(now) - last);
  if (ageMs <= AGENT_LIVENESS_PROTOCOL.heartbeatEveryMs + AGENT_LIVENESS_PROTOCOL.heartbeatGraceMs) return Object.freeze({ ok: true, ageMs, action: 'CONTINUE' });
  return Object.freeze({ ok: false, ageMs, action: 'RECOVERY_REQUIRED', reason: 'HEARTBEAT_STALE', nextState: 'RECOVERING' });
}

export function checkProgress({ state, workAssigned = true, lastProgressAt, now = Date.now(), consecutiveNoProgress = 0 } = {}) {
  assertState(state, { workAssigned });
  const last = Date.parse(String(lastProgressAt ?? ''));
  const ageMs = Number.isFinite(last) ? Math.max(0, Number(now) - last) : Number.POSITIVE_INFINITY;
  if (ageMs <= AGENT_LIVENESS_PROTOCOL.progressWindowMs) return Object.freeze({ ok: true, ageMs, consecutiveNoProgress: 0, action: 'CONTINUE' });
  const nextCount = Math.max(0, Number(consecutiveNoProgress) || 0) + 1;
  return Object.freeze({ ok: false, ageMs, consecutiveNoProgress: nextCount, action: nextCount >= AGENT_LIVENESS_PROTOCOL.maxNoProgressHeartbeats ? 'STRATEGY_ROTATION_REQUIRED' : 'PROGRESS_REQUIRED', nextState: 'RECOVERING' });
}

export function completionGate({ state, workAssigned = true, exactShaVerified, requiredRedCount = 0, regressionPassed, learningRecorded } = {}) {
  if (state !== 'VERIFYING') throw new Error('AGENT_LIVENESS_COMPLETION_STATE_INVALID');
  if (workAssigned !== true) throw new Error('AGENT_LIVENESS_COMPLETION_WORK_FLAG_INVALID');
  validateCompletionEvidence({ exactShaVerified, requiredRedCount, regressionPassed, learningRecorded });
  return Object.freeze({ ok: true, state: 'COMPLETE', residentState: 'READY_RESIDENT' });
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


export function assertActiveRepairWindow({ startedAt, continuousStartedAt = startedAt, now = Date.now() } = {}) {
  const start = Date.parse(String(continuousStartedAt ?? startedAt ?? ''));
  if (!Number.isFinite(start)) throw new Error('AGENT_LIVENESS_ACTIVE_WINDOW_START_REQUIRED');
  const elapsedMs = Math.max(0, Number(now) - start);
  if (elapsedMs < AGENT_LIVENESS_PROTOCOL.activeRepairWindowMs) {
    throw new Error(`AGENT_LIVENESS_ACTIVE_WINDOW_NOT_COMPLETE=\${Math.ceil((AGENT_LIVENESS_PROTOCOL.activeRepairWindowMs - elapsedMs) / 1000)}s`);
  }
  return Object.freeze({ ok: true, elapsedMs, minimumMs: AGENT_LIVENESS_PROTOCOL.activeRepairWindowMs, continuous: true });
}

export function sessionTerminationDirective({ canonicalGreen = false, activeRepairWindowReached = false, reason = 'SESSION_BUDGET_EXHAUSTED' } = {}) {
  if (canonicalGreen === true && activeRepairWindowReached === true) return Object.freeze({ action: 'CLOSE_ALLOWED', taskRemainsOpen: false, residentState: 'READY_RESIDENT', reason: 'CANONICAL_GREEN_PROVEN' });
  if (canonicalGreen === true && activeRepairWindowReached !== true) return Object.freeze({ action: 'RECOVER_AND_CONTINUE', taskRemainsOpen: true, residentState: 'ACTIVE_OR_RECOVERING', reason: 'ACTIVE_45_MIN_WINDOW_REQUIRED', next: 'maintain_heartbeat_until_minimum_window_then_reverify' });
  return Object.freeze({ action: 'RECOVER_AND_REDISPATCH', taskRemainsOpen: true, residentState: 'ACTIVE_OR_RECOVERING', reason: String(reason), next: 'renew_lease -> capture_state -> new_evidence_or_strategy -> continue_until_verified' });
}

// Legacy admission APIs remain as hard blockers so older callers cannot suspend a resident agent.
export function sleepAdmission() { throw new Error('AGENT_LIVENESS_SLEEP_FORBIDDEN_PERMANENT_RESIDENCY'); }
export function idleAdmission() { throw new Error('AGENT_LIVENESS_IDLE_FORBIDDEN_PERMANENT_RESIDENCY'); }
export function selfDisableAdmission() { throw new Error('AGENT_LIVENESS_SELF_DISABLE_FORBIDDEN_PERMANENT_RESIDENCY'); }
export function selfAbortAdmission() { throw new Error('AGENT_LIVENESS_SELF_ABORT_FORBIDDEN_PERMANENT_RESIDENCY'); }
export function runEndAdmission() { throw new Error('AGENT_LIVENESS_RUN_END_DOES_NOT_END_TASK'); }

const isMain = process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url;
if (isMain) {
  const command = process.argv[2] ?? 'validate';
  try {
    if (command === 'validate') {
      assertLivenessDefinition();
      console.log(JSON.stringify({ status: 'PASS', protocolId: AGENT_LIVENESS_PROTOCOL.protocolId, version: AGENT_LIVENESS_PROTOCOL.protocolVersion, heartbeatEveryMs: AGENT_LIVENESS_PROTOCOL.heartbeatEveryMs, activeRepairWindowMs: AGENT_LIVENESS_PROTOCOL.activeRepairWindowMs, forbiddenStates: [...AGENT_LIVENESS_PROTOCOL.forbiddenStates], permanentResidency: true }, null, 2));
    } else if (command === 'check-heartbeat') {
      console.log(JSON.stringify(checkHeartbeat({ state: process.argv.find((v) => v.startsWith('--state='))?.slice(8) ?? 'ACTIVE', lastHeartbeatAt: process.argv.find((v) => v.startsWith('--last='))?.slice(7) }), null, 2));
    } else if (command === 'check-progress') {
      console.log(JSON.stringify(checkProgress({ state: process.argv.find((v) => v.startsWith('--state='))?.slice(8) ?? 'ACTIVE', lastProgressAt: process.argv.find((v) => v.startsWith('--last='))?.slice(7), consecutiveNoProgress: Number(process.argv.find((v) => v.startsWith('--count='))?.slice(8) ?? 0) }), null, 2));
    } else throw new Error('Usage: agent-liveness-protocol.mjs validate|check-heartbeat|check-progress');
  } catch (error) {
    console.error('AGENT_LIVENESS_PROTOCOL_BLOCK=' + String(error?.message ?? error));
    process.exitCode = 1;
  }
}
