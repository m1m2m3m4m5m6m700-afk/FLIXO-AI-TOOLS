#!/usr/bin/env node
import fs from 'node:fs';
const LOGICAL_BOT_IDS = Object.freeze(Array.from({ length: 100 }, (_, index) => `CELL-${String(index + 1).padStart(3, '0')}`));
const RESIDENT_RUNTIME_IDS = Object.freeze(['FLIXO1','FLIXO2','FLIXO3','FLIXO4','FLIXO5','FLIXO6','FLIXO7','FLIXO8','FLIXO9','FLIXO10']);
const RESIDENT_DEVELOPMENT_DOMAINS = Object.freeze([
  Object.freeze({ id:'RCA_ARCH', role:'RCA_AND_ARCHITECTURE', skills:['root-cause','architecture','dependency-analysis'] }),
  Object.freeze({ id:'CODE_RUNTIME', role:'CODE_PATH_AND_RUNTIME', skills:['typescript','react','runtime-debugging'] }),
  Object.freeze({ id:'TEST_CONTRACTS', role:'TEST_CONTRACTS_AND_REGRESSION', skills:['unit-tests','contract-tests','regression'] }),
  Object.freeze({ id:'CI_WORKFLOWS', role:'CI_AND_WORKFLOW_ENGINEERING', skills:['github-actions','concurrency','workflow-contracts'] }),
  Object.freeze({ id:'BROWSER_SECURITY', role:'BROWSER_RUNTIME_AND_SECURITY', skills:['playwright','browser-runtime','security'] }),
  Object.freeze({ id:'ADVERSARIAL', role:'INDEPENDENT_FALSIFICATION', skills:['counterexamples','red-team','false-green-detection'] }),
  Object.freeze({ id:'REPAIR_STRATEGY', role:'REPAIR_STRATEGY_AND_DEPENDENCIES', skills:['repair-strategy','dependency-graph','recurrence-prevention'] }),
  Object.freeze({ id:'IMPLEMENTATION', role:'IMPLEMENTATION_AND_REGRESSION', skills:['bounded-implementation','targeted-regression','integration'] }),
  Object.freeze({ id:'EXACT_SHA', role:'EXACT_SHA_AND_PROOF', skills:['exact-sha','provenance','certification-evidence'] }),
  Object.freeze({ id:'FINAL_VERIFY', role:'FINAL_VERIFICATION_AND_PLAN', skills:['verification','roadmap','learning'] }),
]);
const LOGICAL_BOT_DEVELOPMENT_PROFILES = Object.freeze(LOGICAL_BOT_IDS.map((botId, index) => {
  const domain = RESIDENT_DEVELOPMENT_DOMAINS[index % RESIDENT_DEVELOPMENT_DOMAINS.length];
  return Object.freeze({
    botId, seat: (index % 10) + 1, squadOrdinal: Math.floor(index / 10) + 1,
    domainId: domain.id, role: domain.role, skills: Object.freeze([...domain.skills]),
    developmentMode: 'EVIDENCE_DRIVEN_SPECIALIZATION',
    mutationAuthority: false, certificationAuthority: false,
    sourceOfTruth: 'RPR-UNIFIED-EXECUTION-001',
  });
}));
export const AGENT_LIVENESS_PROTOCOL = Object.freeze({
  schemaVersion: 4,
  contractRank: 'SUPREME_AUTOMATION_RESIDENCY',
  authorityScope: 'ENTIRE_REPAIR_AUTOMATION_PLANE',
  protocolId: 'AGENT_LIVENESS_PROTOCOL',
  protocolVersion: '5.0.0',
  authority: 'CONTROL_PLANE',
  scheduleIntervalMs: 5 * 60 * 1000,
  internalHeartbeatEveryMs: 60 * 1000,
  heartbeatEveryMs: 60 * 1000,
  heartbeatGraceMs: 30 * 1000,
  wakeIntervalMs: 60 * 1000,
  teamWakeIntervalMs: 60 * 1000,
  teamWakePolicy: 'ANY_ACTIVE_ACTION_REPAIR_BOT_WAKES_ALL',
  teamWakeScope: 'ALL_ACTION_REPAIR_TEAM',
  heartbeatWakePolicy: 'ONE_MINUTE_HEARTBEAT_WAKES_ALL_AGENTS',
  heartbeatWakeScope: 'ALL_AGENTS',
  pulseEveryMs: 60 * 1000,
  logicalBotCount: 100,
  logicalBotIdPrefix: 'CELL-',
  logicalBotIdWidth: 3,
  logicalBotIds: LOGICAL_BOT_IDS,
  logicalBotDevelopmentDomains: RESIDENT_DEVELOPMENT_DOMAINS,
  logicalBotDevelopmentProfiles: LOGICAL_BOT_DEVELOPMENT_PROFILES,
  logicalBotPolicy: 'FIXED_100_LOGICAL_PROFILES',
  residentRuntimeCount: 10,
  residentRuntimeIds: RESIDENT_RUNTIME_IDS,
  residentRuntimePolicy: 'ONLY_VERIFIED_LIVE_RUNTIME_IDS_COUNT_AS_RESIDENT',
  onePulsePerHeartbeat: true,
  pulseProfiles: Object.freeze([
    Object.freeze({ botId:'FLIXO1', pulseType:'RCA_AND_ARCHITECTURE' }),
    Object.freeze({ botId:'FLIXO2', pulseType:'CODE_PATH_AND_RUNTIME' }),
    Object.freeze({ botId:'FLIXO3', pulseType:'TEST_CONTRACTS' }),
    Object.freeze({ botId:'FLIXO4', pulseType:'CI_AND_WORKFLOWS' }),
    Object.freeze({ botId:'FLIXO5', pulseType:'BROWSER_RUNTIME_AND_SECURITY' }),
    Object.freeze({ botId:'FLIXO6', pulseType:'INDEPENDENT_FALSIFICATION' }),
    Object.freeze({ botId:'FLIXO7', pulseType:'REPAIR_STRATEGY_AND_DEPENDENCIES' }),
    Object.freeze({ botId:'FLIXO8', pulseType:'IMPLEMENTATION_AND_REGRESSION' }),
    Object.freeze({ botId:'FLIXO9', pulseType:'EXACT_SHA_FALSE_GREEN_AND_SECURITY' }),
    Object.freeze({ botId:'FLIXO10', pulseType:'FINAL_VERIFICATION_AND_DEVELOPMENT_PLAN' }),
  ]),
  idleSweepMode: 'FULL_REPOSITORY_READ_ONLY_SCAN',
  idleSweepPlanLedger: 'المهام.md',
  idleSweepPlanSection: 'FLIXO BOT — AUTONOMOUS FULL-REPOSITORY DEVELOPMENT PLAN',
  actionRepairTeamSize: 10,
  actionRepairTeamIds: Object.freeze([
    'FLIXO1','FLIXO2','FLIXO3','FLIXO4','FLIXO5',
    'FLIXO6','FLIXO7','FLIXO8','FLIXO9','FLIXO10',
  ]),
  activeRepairWindowMs: 45 * 60 * 1000,
  maxContinuousActiveSessionMs: 3 * 60 * 60 * 1000,
  masterStatusUpdateEveryMs: 5 * 60 * 1000,
  taskReminderEveryMs: 10 * 60 * 1000,
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
    maxContinuousActiveSessionMs: 3 * 60 * 60 * 1000,
    maxContinuousSegmentEnforced: true,
    totalTaskDurationUnlimitedWhileOpen: true,
    masterChannelRequired: true,
    masterStatusUpdateEveryMs: 5 * 60 * 1000,
    taskReminderEveryMs: 10 * 60 * 1000,
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
  if (!AGENT_LIVENESS_PROTOCOL.protocolVersion.startsWith('5.')) throw new Error('AGENT_LIVENESS_VERSION_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.scheduleIntervalMs !== 5 * 60 * 1000) throw new Error('AGENT_LIVENESS_SCHEDULE_INTERVAL_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.internalHeartbeatEveryMs !== 60 * 1000) throw new Error('AGENT_LIVENESS_INTERNAL_HEARTBEAT_INTERVAL_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.heartbeatEveryMs !== AGENT_LIVENESS_PROTOCOL.internalHeartbeatEveryMs) throw new Error('AGENT_LIVENESS_HEARTBEAT_ALIGNMENT_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.heartbeatEveryMs <= 0 || AGENT_LIVENESS_PROTOCOL.leaseTtlMs <= AGENT_LIVENESS_PROTOCOL.heartbeatEveryMs) throw new Error('AGENT_LIVENESS_TIMING_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.maxNoProgressHeartbeats < 1) throw new Error('AGENT_LIVENESS_PROGRESS_THRESHOLD_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.onePulsePerHeartbeat !== true) throw new Error('AGENT_LIVENESS_ONE_PULSE_PER_HEARTBEAT_REQUIRED');
  if (AGENT_LIVENESS_PROTOCOL.teamWakeIntervalMs !== 60 * 1000) throw new Error('AGENT_LIVENESS_TEAM_WAKE_NOT_ONE_MINUTE');
  if (AGENT_LIVENESS_PROTOCOL.teamWakePolicy !== 'ANY_ACTIVE_ACTION_REPAIR_BOT_WAKES_ALL') throw new Error('AGENT_LIVENESS_TEAM_WAKE_POLICY_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.teamWakeScope !== 'ALL_ACTION_REPAIR_TEAM') throw new Error('AGENT_LIVENESS_TEAM_WAKE_SCOPE_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.heartbeatWakePolicy !== 'ONE_MINUTE_HEARTBEAT_WAKES_ALL_AGENTS') throw new Error('AGENT_LIVENESS_HEARTBEAT_WAKE_POLICY_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.heartbeatWakeScope !== 'ALL_AGENTS') throw new Error('AGENT_LIVENESS_HEARTBEAT_WAKE_SCOPE_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.pulseEveryMs !== 60 * 1000) throw new Error('AGENT_LIVENESS_PULSE_NOT_ONE_MINUTE');
  if (AGENT_LIVENESS_PROTOCOL.logicalBotCount !== 100 || AGENT_LIVENESS_PROTOCOL.logicalBotIds.length !== 100 || AGENT_LIVENESS_PROTOCOL.logicalBotIds[0] !== 'CELL-001' || AGENT_LIVENESS_PROTOCOL.logicalBotIds[99] !== 'CELL-100' || new Set(AGENT_LIVENESS_PROTOCOL.logicalBotIds).size !== 100) throw new Error('AGENT_LIVENESS_100_LOGICAL_BOT_ROSTER_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.logicalBotDevelopmentDomains.length !== 10 || AGENT_LIVENESS_PROTOCOL.logicalBotDevelopmentProfiles.length !== 100 || new Set(AGENT_LIVENESS_PROTOCOL.residentBotDevelopmentProfiles.map((x) => x.botId)).size !== 100 || AGENT_LIVENESS_PROTOCOL.residentBotDevelopmentProfiles.some((x) => x.mutationAuthority !== false || x.certificationAuthority !== false || !x.skills.length)) throw new Error('AGENT_LIVENESS_LOGICAL_BOT_DEVELOPMENT_PROFILE_INVALID');
  for (const domain of AGENT_LIVENESS_PROTOCOL.residentBotDevelopmentDomains) if (AGENT_LIVENESS_PROTOCOL.residentBotDevelopmentProfiles.filter((x) => x.domainId === domain.id).length !== 10) throw new Error('AGENT_LIVENESS_BOT_DOMAIN_DISTRIBUTION_INVALID=' + domain.id);
  if (AGENT_LIVENESS_PROTOCOL.pulseProfiles.length !== 10 || new Set(AGENT_LIVENESS_PROTOCOL.pulseProfiles.map((x) => x.botId)).size !== 10 || new Set(AGENT_LIVENESS_PROTOCOL.pulseProfiles.map((x) => x.pulseType)).size !== 10) throw new Error('AGENT_LIVENESS_PULSE_PROFILE_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.idleSweepMode !== 'FULL_REPOSITORY_READ_ONLY_SCAN' || AGENT_LIVENESS_PROTOCOL.idleSweepPlanLedger !== 'المهام.md') throw new Error('AGENT_LIVENESS_IDLE_SWEEP_POLICY_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.actionRepairTeamSize !== 10 || AGENT_LIVENESS_PROTOCOL.actionRepairTeamIds.length !== 10) throw new Error('AGENT_LIVENESS_TEAM_SIZE_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.heartbeatEveryMs !== 60 * 1000) throw new Error('AGENT_LIVENESS_HEARTBEAT_NOT_ONE_MINUTE');
  if (AGENT_LIVENESS_PROTOCOL.heartbeatGraceMs !== 30 * 1000) throw new Error('AGENT_LIVENESS_HEARTBEAT_GRACE_NOT_THIRTY_SECONDS');
  if (AGENT_LIVENESS_PROTOCOL.activeRepairWindowMs !== 45 * 60 * 1000) throw new Error('AGENT_LIVENESS_ACTIVE_WINDOW_NOT_FORTY_FIVE_MINUTES');
  if (AGENT_LIVENESS_PROTOCOL.maxContinuousActiveSessionMs !== 3 * 60 * 60 * 1000) throw new Error('AGENT_LIVENESS_MAX_CONTINUOUS_SEGMENT_NOT_THREE_HOURS');
  if (AGENT_LIVENESS_PROTOCOL.masterStatusUpdateEveryMs !== 5 * 60 * 1000 || AGENT_LIVENESS_PROTOCOL.taskReminderEveryMs !== 10 * 60 * 1000) throw new Error('AGENT_LIVENESS_COORDINATION_CADENCE_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.sessionPolicy.maxContinuousActiveSessionMs !== AGENT_LIVENESS_PROTOCOL.maxContinuousActiveSessionMs || AGENT_LIVENESS_PROTOCOL.sessionPolicy.maxContinuousSegmentEnforced !== true || AGENT_LIVENESS_PROTOCOL.sessionPolicy.totalTaskDurationUnlimitedWhileOpen !== true) throw new Error('AGENT_LIVENESS_LONG_SESSION_POLICY_INVALID');
  if (AGENT_LIVENESS_PROTOCOL.sessionPolicy.masterChannelRequired !== true) throw new Error('AGENT_LIVENESS_MASTER_CHANNEL_REQUIRED');
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

export function emitHeartbeat({ file = process.env.FLIXO_HEARTBEAT_PATH ?? '/tmp/flixo-agent-heartbeat.json', taskId = process.env.FLIXO_TASK_ID ?? process.env.FLIXO_AGENT_TASK ?? null, state = 'ACTIVE', exactSha = process.env.FLIXO_TARGET_SHA ?? process.env.FLIXO_FAILED_SHA ?? null, progress = false, now = new Date().toISOString() } = {}) {
  assertState(state, { workAssigned: true });
  if (!/^[a-f0-9]{40}$/iu.test(String(exactSha ?? ''))) throw new Error('AGENT_LIVENESS_HEARTBEAT_EXACT_SHA_REQUIRED');
  const record = { protocolId: AGENT_LIVENESS_PROTOCOL.protocolId, protocolVersion: AGENT_LIVENESS_PROTOCOL.protocolVersion, taskId: taskId ? String(taskId) : null, state: String(state), exactSha: String(exactSha), progress: Boolean(progress), at: String(now) };
  fs.mkdirSync(file.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  return Object.freeze(record);
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

export function buildTeamWakeDirective({ actor, targetSha, taskId = null, failureFingerprint = null, reason = 'ACTIVE_BOT_WAKE' } = {}) {
  assertLivenessDefinition();
  const actorId = String(actor ?? '').trim();
  const sha = String(targetSha ?? '').trim();
  if (!AGENT_LIVENESS_PROTOCOL.actionRepairTeamIds.includes(actorId)) throw new Error('AGENT_LIVENESS_TEAM_WAKE_ACTOR_NOT_AUTHORIZED=' + actorId);
  if (!/^[a-f0-9]{40}$/iu.test(sha)) throw new Error('AGENT_LIVENESS_TEAM_WAKE_EXACT_SHA_REQUIRED');
  const fingerprint = String(failureFingerprint ?? '').trim() || `WAKE-${sha.slice(0, 12)}`;
  return Object.freeze({
    protocolId: AGENT_LIVENESS_PROTOCOL.protocolId,
    action: 'WAKE_ALL_ACTION_REPAIR_TEAM',
    policy: AGENT_LIVENESS_PROTOCOL.teamWakePolicy,
    scope: AGENT_LIVENESS_PROTOCOL.teamWakeScope,
    actor: actorId,
    targetSha: sha,
    taskId: taskId ? String(taskId) : null,
    failureFingerprint: fingerprint,
    reason: String(reason),
    recipients: [...AGENT_LIVENESS_PROTOCOL.actionRepairTeamIds],
    recipientCount: AGENT_LIVENESS_PROTOCOL.actionRepairTeamIds.length,
    mutationAuthority: false,
    pushAuthority: 'CHAIR_1_ONLY',
    next: 'canonical_agent_repair_supervisor_and_existing_wake_dispatcher',
  });
}

export function buildTeamPulseDirective({ targetSha, taskId = null, activeOperation = true, activeWorker = null, reason = 'MINUTE_HEARTBEAT' } = {}) {
  assertLivenessDefinition();
  const sha = String(targetSha ?? '').trim();
  if (!/^[a-f0-9]{40}$/iu.test(sha)) throw new Error('AGENT_LIVENESS_PULSE_EXACT_SHA_REQUIRED');
  const worker = activeWorker == null ? null : String(activeWorker).trim();
  if (worker && !AGENT_LIVENESS_PROTOCOL.actionRepairTeamIds.includes(worker)) throw new Error('AGENT_LIVENESS_ACTIVE_WORKER_NOT_AUTHORIZED=' + worker);
  return Object.freeze({
    protocolId: AGENT_LIVENESS_PROTOCOL.protocolId,
    action: 'WAKE_ALL_AGENTS',
    pulseType: 'CANONICAL_TEAM_HEARTBEAT',
    actor: 'FLIXO_HEARTBEAT_CONTROLLER',
    activeWorker: worker,
    targetSha: sha,
    taskId: taskId ? String(taskId) : null,
    activeOperation: Boolean(activeOperation),
    mode: activeOperation ? 'ACTIVE_OPERATION' : 'READY_RESIDENT',
    reason: String(reason),
    wakeScope: AGENT_LIVENESS_PROTOCOL.heartbeatWakeScope,
    recipients: ['ALL_AGENTS'],
    recipientCount: AGENT_LIVENESS_PROTOCOL.residentRuntimeCount,
    teamMemberCount: AGENT_LIVENESS_PROTOCOL.actionRepairTeamIds.length,
    logicalBotCount: AGENT_LIVENESS_PROTOCOL.logicalBotCount,
     residentRuntimeCount: AGENT_LIVENESS_PROTOCOL.residentRuntimeCount,
    logicalBotIds: [...AGENT_LIVENESS_PROTOCOL.logicalBotIds],
     residentRuntimeIds: [...AGENT_LIVENESS_PROTOCOL.residentRuntimeIds],
    developmentProfiles: AGENT_LIVENESS_PROTOCOL.logicalBotDevelopmentProfiles,
    mutationAuthority: false,
    pushAuthority: 'CHAIR_1_ONLY',
    exactShaRequired: true,
    readOnlyWhenResident: true,
    residentState: activeOperation ? 'ACTIVE_OPERATION' : 'READY_RESIDENT',
    sleep: false,
    idle: false,
    onePulsePerHeartbeat: true,
  });
}

export function buildDifferentiatedPulseDirective({ actor, targetSha, taskId = null, activeOperation = true, reason = 'MINUTE_PULSE' } = {}) {
  return buildTeamPulseDirective({ targetSha, taskId, activeOperation, activeWorker: actor, reason: 'LEGACY_COMPATIBILITY_' + reason });
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


export function checkContinuousSessionWindow({ continuousStartedAt, now = Date.now() } = {}) {
  const start = Date.parse(String(continuousStartedAt ?? ''));
  if (!Number.isFinite(start)) return Object.freeze({ ok: false, action: 'RECOVERY_REQUIRED', reason: 'CONTINUOUS_WINDOW_START_MISSING' });
  const elapsedMs = Math.max(0, Number(now) - start);
  if (elapsedMs < AGENT_LIVENESS_PROTOCOL.maxContinuousActiveSessionMs) return Object.freeze({ ok: true, action: 'CONTINUE', elapsedMs, remainingMs: AGENT_LIVENESS_PROTOCOL.maxContinuousActiveSessionMs - elapsedMs });
  return Object.freeze({ ok: false, action: 'RESIDENCY_RENEWAL_REQUIRED', reason: 'MAX_CONTINUOUS_SEGMENT_REACHED', elapsedMs, nextState: 'RECOVERING' });
}

export function assertActiveRepairWindow({ startedAt, continuousStartedAt = startedAt, now = Date.now() } = {}) {
  const start = Date.parse(String(continuousStartedAt ?? startedAt ?? ''));
  if (!Number.isFinite(start)) throw new Error('AGENT_LIVENESS_ACTIVE_WINDOW_START_REQUIRED');
  const elapsedMs = Math.max(0, Number(now) - start);
  if (elapsedMs < AGENT_LIVENESS_PROTOCOL.activeRepairWindowMs) {
    throw new Error(`AGENT_LIVENESS_ACTIVE_WINDOW_NOT_COMPLETE=${Math.ceil((AGENT_LIVENESS_PROTOCOL.activeRepairWindowMs - elapsedMs) / 1000)}s`);
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
    } else if (command === 'heartbeat') {
      const getArg = (name, fallback = null) => process.argv.find((v) => v.startsWith('--' + name + '='))?.slice(name.length + 3) ?? fallback;
      const heartbeat = emitHeartbeat({
        file: getArg('file') ?? undefined,
        taskId: getArg('task') ?? undefined,
        state: getArg('state', 'ACTIVE'),
        exactSha: getArg('sha') ?? undefined,
        progress: getArg('progress', 'false') === 'true',
      });
      console.log(JSON.stringify({ status: 'PASS', heartbeat }, null, 2));
    } else if (command === 'check-heartbeat') {
      console.log(JSON.stringify(checkHeartbeat({ state: process.argv.find((v) => v.startsWith('--state='))?.slice(8) ?? 'ACTIVE', lastHeartbeatAt: process.argv.find((v) => v.startsWith('--last='))?.slice(7) }), null, 2));
    } else if (command === 'check-progress') {
      console.log(JSON.stringify(checkProgress({ state: process.argv.find((v) => v.startsWith('--state='))?.slice(8) ?? 'ACTIVE', lastProgressAt: process.argv.find((v) => v.startsWith('--last='))?.slice(7), consecutiveNoProgress: Number(process.argv.find((v) => v.startsWith('--count='))?.slice(8) ?? 0) }), null, 2));
    } else throw new Error('Usage: agent-liveness-protocol.mjs validate|heartbeat|check-heartbeat|check-progress');
  } catch (error) {
    console.error('AGENT_LIVENESS_PROTOCOL_BLOCK=' + String(error?.message ?? error));
    process.exitCode = 1;
  }
}
